"""Generate Pydantic models from JSON Schema produced by terse-types.

Replaces both ``datamodel-codegen`` and ``postprocess-generated-types.py``.
"""

from __future__ import annotations

import json
import re
import shutil
import subprocess
import sys
from pathlib import Path
from typing import Any

REPO_ROOT = Path(__file__).resolve().parents[1]
SCHEMA_FILE = REPO_ROOT / "terse-types/dist/json-schema/terse-types.schema.json"
OUTPUT_FILE = REPO_ROOT / "packages/terse-python-sdk/src/terse_sdk/types/_generated.py"

HEADER_LINES = [
    "# AUTO-GENERATED - DO NOT EDIT. Run 'pnpm run generate:python-types' to regenerate.",
    "# ruff: noqa: E501",
]

# Canonical enums already defined in terse_sdk.types.enums — import aliases instead
# of generating duplicate StrEnum classes. Keys are the $defs names from JSON Schema.
CANONICAL_ENUMS: dict[str, str] = {
    "ConfigTypeEnum": "from terse_sdk.types.enums import ConfigType as ConfigTypeEnum",
    "IntegrationTypeEnum": "from terse_sdk.types.enums import IntegrationType as IntegrationTypeEnum",
    "SlackChannelType": "from terse_sdk.types.enums import SlackChannelType",
}

# JS Number.MAX_SAFE_INTEGER bounds — carry no Python semantics.
_JS_SAFE_MIN = -9007199254740991
_JS_SAFE_MAX = 9007199254740991

# Python reserved keywords that can't be used as field names.
_PYTHON_KEYWORDS = {
    "False", "None", "True", "and", "as", "assert", "async", "await",
    "break", "class", "continue", "def", "del", "elif", "else", "except",
    "finally", "for", "from", "global", "if", "import", "in", "is",
    "lambda", "nonlocal", "not", "or", "pass", "raise", "return", "try",
    "while", "with", "yield",
}


def main() -> None:
    schema = json.loads(SCHEMA_FILE.read_text())
    defs: dict[str, Any] = schema["$defs"]

    # Resolve nested $defs (e.g., Zod cycle refs like __schema0)
    _resolve_nested_defs(defs)

    # Build dependency graph and topological sort
    sorted_names = topological_sort(defs)

    # Track imports needed
    imports: set[str] = set()
    canonical_imports: list[str] = []
    classes: list[str] = []

    for name in sorted_names:
        defn = defs[name]
        code = emit_def(name, defn, defs, imports)
        if code is not None:
            classes.append(code)

    # Build canonical enum imports
    for enum_name, import_line in CANONICAL_ENUMS.items():
        canonical_imports.append(import_line)

    output = build_output(imports, canonical_imports, classes)
    OUTPUT_FILE.write_text(output)

    run_ruff("check", "--fix", str(OUTPUT_FILE))
    run_ruff("format", str(OUTPUT_FILE))


# ---------------------------------------------------------------------------
# Code emission
# ---------------------------------------------------------------------------


def emit_def(name: str, defn: dict[str, Any], all_defs: dict[str, Any], imports: set[str]) -> str | None:
    # String enum -> StrEnum class (or canonical import)
    if defn.get("type") == "string" and "enum" in defn:
        if name in CANONICAL_ENUMS:
            return None  # handled via canonical import
        imports.add("StrEnum")
        members = "\n".join(f"    {enum_member_name(v)} = {v!r}" for v in defn["enum"])
        return f"class {name}(StrEnum):\n{members}"

    # Object with properties -> Pydantic model
    if defn.get("type") == "object" and "properties" in defn:
        return emit_object_class(name, defn, all_defs, imports)

    # Object without properties (dict type) -> type alias
    if defn.get("type") == "object" and "properties" not in defn:
        return f"{name} = dict[str, Any]"

    # $ref alias
    if "$ref" in defn and len(defn) == 1:
        target = ref_to_name(defn["$ref"])
        return f"{name} = {target}"

    # anyOf/oneOf union
    if "anyOf" in defn or "oneOf" in defn:
        return emit_union(name, defn, all_defs, imports)

    # Nullable wrapper
    if defn.get("type") == "null":
        return f"{name} = None"

    # Primitive type alias
    if "type" in defn:
        py_type = primitive_type(defn, imports)
        return f"{name} = {py_type}"

    return f"# TODO: unhandled schema for {name}"


def emit_object_class(name: str, defn: dict[str, Any], all_defs: dict[str, Any], imports: set[str]) -> str:
    props = defn.get("properties", {})
    required = set(defn.get("required", []))
    lines = [f"class {name}(TerseModel):"]

    if not props:
        lines.append("    pass")
        return "\n".join(lines)

    for prop_name, prop_schema in props.items():
        field_name = to_snake_case(prop_name)
        py_type = resolve_type(prop_schema, all_defs, imports)
        is_required = prop_name in required

        # Handle Python reserved keywords as field names
        if field_name in _PYTHON_KEYWORDS:
            imports.add("Field")
            safe_name = f"{field_name}_"
            if not is_required:
                if "| None" not in py_type:
                    py_type = f"{py_type} | None"
                lines.append(f"    {safe_name}: {py_type} = Field(None, alias={prop_name!r})")
            else:
                lines.append(f"    {safe_name}: {py_type} = Field(alias={prop_name!r})")
        elif not is_required:
            if "| None" not in py_type:
                py_type = f"{py_type} | None"
            lines.append(f"    {field_name}: {py_type} = None")
        else:
            lines.append(f"    {field_name}: {py_type}")

    return "\n".join(lines)


def emit_union(name: str, defn: dict[str, Any], all_defs: dict[str, Any], imports: set[str]) -> str:
    members_key = "anyOf" if "anyOf" in defn else "oneOf"
    members = defn[members_key]

    # Check for nullable (union with null)
    non_null = [m for m in members if m.get("type") != "null"]
    if len(non_null) == 1 and len(members) == 2:
        py_type = resolve_type(non_null[0], all_defs, imports)
        return f"{name} = {py_type} | None"

    # Union of refs or mixed types
    member_types = [resolve_type(m, all_defs, imports) for m in members]
    union_type = " | ".join(member_types)

    # If all members are $ref'd models, use RootModel
    all_refs = all(m.get("$ref") for m in members)
    if all_refs:
        imports.add("RootModel")
        return f"class {name}(RootModel[{union_type}]):\n    root: {union_type}"

    return f"{name} = {union_type}"


# ---------------------------------------------------------------------------
# Type resolution
# ---------------------------------------------------------------------------


def resolve_type(schema: dict[str, Any], all_defs: dict[str, Any], imports: set[str]) -> str:
    # $ref
    if "$ref" in schema:
        target = ref_to_name(schema["$ref"])
        return target

    # anyOf (nullable or union)
    if "anyOf" in schema:
        members = schema["anyOf"]
        non_null = [m for m in members if m.get("type") != "null"]
        has_null = len(non_null) < len(members)

        if len(non_null) == 1 and has_null:
            inner = resolve_type(non_null[0], all_defs, imports)
            return f"{inner} | None"

        parts = [resolve_type(m, all_defs, imports) for m in members if m.get("type") != "null"]
        result = " | ".join(parts)
        if has_null:
            result += " | None"
        return result

    # oneOf (same treatment)
    if "oneOf" in schema:
        parts = [resolve_type(m, all_defs, imports) for m in schema["oneOf"]]
        return " | ".join(parts)

    schema_type = schema.get("type")

    # const (Literal)
    if "const" in schema:
        val = schema["const"]
        imports.add("Literal")
        if isinstance(val, bool):
            return f"Literal[{val}]"
        if isinstance(val, str):
            return f"Literal[{val!r}]"
        return f"Literal[{val}]"

    # Inline string enum
    if schema_type == "string" and "enum" in schema:
        imports.add("Literal")
        vals = ", ".join(repr(v) for v in schema["enum"])
        return f"Literal[{vals}]"

    # Primitive types
    if schema_type:
        return primitive_type(schema, imports)

    # Fallback
    imports.add("Any")
    return "Any"


def primitive_type(schema: dict[str, Any], imports: set[str]) -> str:
    t = schema.get("type")
    fmt = schema.get("format")

    if t == "string":
        if fmt == "date-time":
            return "str"
        if fmt == "email":
            imports.add("EmailStr")
            return "EmailStr"
        if fmt == "uri":
            imports.add("AnyUrl")
            return "AnyUrl"
        if fmt == "uuid":
            imports.add("UUID")
            return "UUID"
        return "str"

    if t == "integer":
        ge = schema.get("minimum")
        le = schema.get("maximum")
        # Drop JS-safe sentinels
        if ge == _JS_SAFE_MIN:
            ge = None
        if le == _JS_SAFE_MAX:
            le = None
        if ge is not None or le is not None:
            imports.add("Annotated")
            imports.add("Field")
            parts = []
            if ge is not None:
                parts.append(f"ge={ge}")
            if le is not None:
                parts.append(f"le={le}")
            return f"Annotated[int, Field({', '.join(parts)})]"
        return "int"

    if t == "number":
        return "float"

    if t == "boolean":
        return "bool"

    if t == "null":
        return "None"

    if t == "array":
        items = schema.get("items", {})
        if items:
            inner = resolve_type(items, {}, imports)
            return f"list[{inner}]"
        imports.add("Any")
        return "list[Any]"

    if t == "object":
        additional = schema.get("additionalProperties")
        if additional and isinstance(additional, dict) and additional:
            val_type = resolve_type(additional, {}, imports)
            return f"dict[str, {val_type}]"
        imports.add("Any")
        return "dict[str, Any]"

    imports.add("Any")
    return "Any"


# ---------------------------------------------------------------------------
# Helpers
# ---------------------------------------------------------------------------


def _resolve_nested_defs(defs: dict[str, Any]) -> None:
    """Inline nested $defs (e.g., Zod's __schema0 cycle refs) into top-level $refs."""
    for name, defn in list(defs.items()):
        nested = defn.pop("$defs", None)
        if not nested:
            continue
        # Build mapping from nested names to their resolved $ref targets
        mapping: dict[str, str] = {}
        for nested_name, nested_schema in nested.items():
            if "$ref" in nested_schema:
                # The nested def is a $ref to a top-level def
                mapping[f"#/$defs/{nested_name}"] = nested_schema["$ref"]
            else:
                # Promote the nested def to top-level with a prefixed name
                promoted_name = f"{name}_{nested_name}"
                defs[promoted_name] = nested_schema
                mapping[f"#/$defs/{nested_name}"] = f"#/$defs/{promoted_name}"
        # Rewrite all $refs in this schema
        _rewrite_refs(defn, mapping)


def _rewrite_refs(obj: Any, mapping: dict[str, str]) -> None:
    """Recursively rewrite $ref values using the given mapping."""
    if isinstance(obj, dict):
        if "$ref" in obj and obj["$ref"] in mapping:
            obj["$ref"] = mapping[obj["$ref"]]
        for v in obj.values():
            _rewrite_refs(v, mapping)
    elif isinstance(obj, list):
        for item in obj:
            _rewrite_refs(item, mapping)


def ref_to_name(ref: str) -> str:
    """Extract the definition name from a $ref like ``#/$defs/FooBar``."""
    return ref.rsplit("/", 1)[-1]


def to_snake_case(name: str) -> str:
    """Convert camelCase to snake_case."""
    # Insert underscore before uppercase letters that follow lowercase letters
    s = re.sub(r"([a-z0-9])([A-Z])", r"\1_\2", name)
    # Handle consecutive uppercase (e.g., "URL" -> "url", "isIM" -> "is_im")
    s = re.sub(r"([A-Z]+)([A-Z][a-z])", r"\1_\2", s)
    return s.lower()


def enum_member_name(value: str) -> str:
    """Convert an enum value to a valid Python StrEnum member name."""
    # Handle already-uppercase values (e.g., "POSTHOG", "DATADOG")
    if value.isupper() or "_" in value:
        name = value.upper()
    else:
        # Convert camelCase/snake_case to UPPER_SNAKE
        name = re.sub(r"([a-z0-9])([A-Z])", r"\1_\2", value)
        name = re.sub(r"([A-Z]+)([A-Z][a-z])", r"\1_\2", name)
        name = name.upper()
    # Enum member names can't start with a digit
    if name and name[0].isdigit():
        name = f"_{name}"
    return name


def topological_sort(defs: dict[str, Any]) -> list[str]:
    """Sort definitions so that dependencies come before dependents."""
    deps: dict[str, set[str]] = {}
    all_names = set(defs.keys())

    for name, defn in defs.items():
        refs = _collect_refs(defn)
        deps[name] = {ref_to_name(r) for r in refs if ref_to_name(r) in all_names and ref_to_name(r) != name}

    # Kahn's algorithm
    in_degree: dict[str, int] = {n: 0 for n in all_names}
    for name, dep_set in deps.items():
        for dep in dep_set:
            in_degree[name] = in_degree.get(name, 0)

    # Recompute: in_degree[x] = number of schemas that x depends on... no,
    # we want in_degree[x] = number of schemas that depend on x.
    # Actually for topo sort: in_degree[x] = number of deps x has.
    # We emit x when all its deps are emitted.
    in_degree = {n: len(deps.get(n, set())) for n in all_names}
    queue = sorted([n for n in all_names if in_degree[n] == 0])
    result: list[str] = []
    emitted: set[str] = set()

    while queue:
        name = queue.pop(0)
        result.append(name)
        emitted.add(name)
        # Find all schemas that depend on this name and decrement their in-degree
        for other, other_deps in deps.items():
            if name in other_deps and other not in emitted:
                in_degree[other] -= 1
                if in_degree[other] == 0:
                    queue.append(other)
        queue.sort()  # deterministic order

    # Handle cycles (shouldn't happen, but just in case — use forward refs)
    remaining = all_names - emitted
    result.extend(sorted(remaining))

    return result


def _collect_refs(obj: Any) -> list[str]:
    """Recursively collect all $ref strings from a JSON schema."""
    refs: list[str] = []
    if isinstance(obj, dict):
        if "$ref" in obj:
            refs.append(obj["$ref"])
        for v in obj.values():
            refs.extend(_collect_refs(v))
    elif isinstance(obj, list):
        for item in obj:
            refs.extend(_collect_refs(item))
    return refs


# ---------------------------------------------------------------------------
# Output assembly
# ---------------------------------------------------------------------------


def build_output(imports: set[str], canonical_imports: list[str], classes: list[str]) -> str:
    header = "\n".join(HEADER_LINES)

    # Build import blocks
    typing_imports = sorted(imports & {"Annotated", "Any", "Literal"})
    enum_imports = sorted(imports & {"StrEnum"})
    uuid_imports = sorted(imports & {"UUID"})
    pydantic_imports = sorted(imports & {"AnyUrl", "AwareDatetime", "EmailStr", "Field", "RootModel"})

    import_lines = ["from __future__ import annotations", ""]

    if enum_imports:
        import_lines.append(f"from enum import {', '.join(enum_imports)}")
    if typing_imports:
        import_lines.append(f"from typing import {', '.join(typing_imports)}")
    if uuid_imports:
        import_lines.append("from uuid import UUID")

    import_lines.append("")

    if pydantic_imports:
        import_lines.append(f"from pydantic import {', '.join(pydantic_imports)}")

    import_lines.append("")
    import_lines.append("from terse_sdk.types._base import TerseModel")

    for ci in canonical_imports:
        import_lines.append(ci)

    body = "\n\n\n".join(classes)
    return f"{header}\n\n{chr(10).join(import_lines)}\n\n\n{body}\n"


# ---------------------------------------------------------------------------
# ruff runner
# ---------------------------------------------------------------------------


def run_ruff(*args: str) -> None:
    ruff = shutil.which("ruff")
    if ruff is not None:
        command = [ruff, *args]
    else:
        command = [sys.executable, "-m", "ruff", *args]
    subprocess.run(command, check=True, cwd=REPO_ROOT)


if __name__ == "__main__":
    main()

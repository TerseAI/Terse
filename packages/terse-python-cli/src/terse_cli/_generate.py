"""Shared generator backend for `terse generate` and `terse init`."""

from __future__ import annotations

import logging
import re
from collections.abc import Callable
from dataclasses import dataclass, field
from pathlib import Path
from typing import Any, Self, TypeVar, cast
from urllib.parse import quote

import jinja2

from ._http import request_json
from ._project import assert_project_root, read_api_key

LOGGER = logging.getLogger("terse.cli.generate")


class MissingApiKeyError(RuntimeError):
    """Raised when `TERSE_API_KEY` is missing for a command that requires it."""


@dataclass(frozen=True)
class AttioAttributeData:
    api_slug: str
    title: str = ""
    type: str = ""
    is_required: bool = False
    is_unique: bool = False


@dataclass(frozen=True)
class AttioObjectData:
    api_slug: str
    singular_noun: str
    attributes: list[AttioAttributeData] = field(default_factory=list)


@dataclass(frozen=True)
class AttioInstanceData:
    id: str
    display_name: str
    objects: list[AttioObjectData] = field(default_factory=list)


@dataclass(frozen=True)
class SnowflakeInstanceData:
    id: str
    display_name: str


@dataclass(frozen=True)
class ToolDefinition:
    name: str
    display_name: str
    description: str
    integration: str
    is_read_only: bool
    supports_approval: bool = False
    parameters: dict[str, Any] = field(default_factory=dict)


@dataclass(frozen=True)
class CodegenInput:
    attio: list[AttioInstanceData] = field(default_factory=list)
    snowflake: list[SnowflakeInstanceData] = field(default_factory=list)
    tools: list[ToolDefinition] = field(default_factory=list)


@dataclass(frozen=True)
class GenerateResult:
    project_dir: Path
    output_path: Path
    summary_lines: list[str]


T = TypeVar("T")
_SUPPORTED_TOOL_SPECS: tuple[tuple[str, str, str], ...] = (
    ("attio", "attio_list_objects", "list_objects"),
    ("attio", "attio_query_records", "query_records"),
    ("attio", "attio_upsert_record", "upsert_record"),
    ("snowflake", "snowflakeExecuteQuery", "execute_query"),
    ("snowflake", "snowflakeExplainQuery", "explain_query"),
)
_SUPPORTED_TOOL_NAMES = {tool_name for _, tool_name, _ in _SUPPORTED_TOOL_SPECS}
_TOOL_METHOD_NAME_BY_TOOL = {
    tool_name: method_name for _, tool_name, method_name in _SUPPORTED_TOOL_SPECS
}
_TOOL_NAME_ALIASES = {
    "snowflake_execute_query": "snowflakeExecuteQuery",
    "snowflake_explain_query": "snowflakeExplainQuery",
}
_TOOL_OUTPUT_MODEL_BY_TOOL = {
    "attio_list_objects": "AttioListObjectsToolOutput",
    "attio_query_records": "AttioQueryRecordsToolOutput",
    "attio_upsert_record": "AttioUpsertRecordToolOutput",
    "snowflakeExecuteQuery": "SnowflakeExecuteQueryToolOutput",
    "snowflakeExplainQuery": "SnowflakeExplainQueryToolOutput",
}


# === Template context dataclasses ===


@dataclass(frozen=True)
class _AttioAttrCtx:
    api_slug: str
    record_type: str
    input_type: str
    filter_type: str


@dataclass(frozen=True)
class _AttioObjectCtx:
    api_slug: str
    api_slug_repr: str
    singular_noun: str
    singular_noun_repr: str
    pascal: str
    static_name: str
    attributes: list[_AttioAttrCtx]
    attr_slugs_literal: str
    multi_value_slugs: list[str]
    multi_value_frozenset_repr: str
    attribute_tuple_repr: str


@dataclass(frozen=True)
class _AttioCtx:
    instance_id_repr: str
    has_attrs: bool
    objects: list[_AttioObjectCtx]
    tools: list[_ToolCtx]


@dataclass(frozen=True)
class _SnowflakeCtx:
    instance_id_repr: str
    tools: list[_ToolCtx]


@dataclass(frozen=True)
class _ToolCtx:
    name: str
    name_repr: str
    method_name: str
    output_model: str
    approvable: bool


def generate_project(project_dir: Path | None = None) -> GenerateResult:
    """Generate Python helper bindings for the project's active integrations."""

    resolved_dir = assert_project_root(project_dir)
    api_key = read_api_key(resolved_dir)
    if not api_key:
        raise MissingApiKeyError(
            "Missing TERSE_API_KEY in .env.\nCreate a project with `terse init` or add TERSE_API_KEY to your .env file."
        )

    active_types = request_json("/integrations/active", api_key)
    active_set = (
        {str(item).lower() for item in active_types}
        if isinstance(active_types, list)
        else set()
    )

    codegen_input = _build_codegen_input(active_set, api_key)
    output_path = write_generated_module(
        resolved_dir, render_generated_module(codegen_input)
    )

    return GenerateResult(
        project_dir=resolved_dir,
        output_path=output_path,
        summary_lines=_build_summary_lines(codegen_input),
    )


class TemplateContextBuilder:
    """Build the integration-scoped Jinja2 context for terse_generated.py."""

    def __init__(self, codegen_input: CodegenInput | None = None) -> None:
        self._input = codegen_input or CodegenInput()
        self._context: dict[str, Any] = {}

    def with_attio(self) -> Self:
        attio_tools = _select_supported_tools(self._input.tools, "attio")
        self._context["attio"] = (
            _build_attio_ctx(self._input.attio[0], attio_tools)
            if self._input.attio
            else None
        )
        return self

    def with_snowflake(self) -> Self:
        snowflake_tools = _select_supported_tools(self._input.tools, "snowflake")
        self._context["snowflake"] = (
            _build_snowflake_ctx(self._input.snowflake[0], snowflake_tools)
            if self._input.snowflake
            else None
        )
        return self

    def with_all(self) -> Self:
        return self.with_attio().with_snowflake()

    def build(self) -> dict[str, Any]:
        return dict(self._context)


def render_generated_module(codegen_input: CodegenInput | None = None) -> str:
    """Render the generated Python helper module."""

    context = TemplateContextBuilder(codegen_input).with_all().build()
    template = _get_jinja_env().get_template("terse_generated.py.jinja2")
    return template.render(**context)


def write_generated_module(project_dir: Path, content: str) -> Path:
    """Write the generated helper module into the project's src directory."""

    try:
        compile(content, "terse_generated.py", "exec")
    except SyntaxError as exc:
        raise RuntimeError(
            f"Generated module contains invalid Python syntax: {exc}"
        ) from exc

    output_path = project_dir / "src" / "terse_generated.py"
    output_path.parent.mkdir(parents=True, exist_ok=True)
    output_path.write_text(content, encoding="utf-8")
    return output_path


def _build_codegen_input(active_set: set[str], api_key: str) -> CodegenInput:
    return CodegenInput(
        attio=(
            _safe_fetch(lambda: _fetch_attio_instances(api_key))
            if "attio" in active_set
            else []
        ),
        snowflake=(
            _safe_fetch(lambda: _fetch_snowflake_instances(api_key))
            if "snowflake" in active_set
            else []
        ),
        tools=_safe_fetch(lambda: _fetch_tool_definitions(api_key, active_set)),
    )


def _safe_fetch(fetcher: Callable[[], list[T]]) -> list[T]:
    try:
        return fetcher()
    except Exception as exc:
        LOGGER.warning(
            "Failed to fetch data for codegen (%s): %s",
            getattr(fetcher, "__name__", repr(fetcher)),
            exc,
        )
        return []


def _as_dict(value: object) -> dict[str, Any] | None:
    if isinstance(value, dict):
        return cast(dict[str, Any], value)
    return None


def _as_list(value: object) -> list[Any]:
    if isinstance(value, list):
        return cast(list[Any], value)
    return []


def _fetch_attio_instances(api_key: str) -> list[AttioInstanceData]:
    raw_instances = _as_list(request_json("/attio/integrations", api_key))
    instances: list[AttioInstanceData] = []

    for integration in raw_instances:
        integration_data = _as_dict(integration)
        if integration_data is None:
            continue

        integration_id = str(integration_data.get("id", ""))
        raw_objects = _safe_request_json(
            f"/attio/integrations/{quote(integration_id, safe='')}/objects",
            api_key,
        )
        objects: list[AttioObjectData] = []
        for raw_object in _as_list(raw_objects):
            obj_data = _as_dict(raw_object)
            if obj_data is None:
                continue
            api_slug = str(obj_data.get("api_slug", ""))
            if not api_slug:
                continue
            attributes = [
                AttioAttributeData(
                    api_slug=str(attr_dict.get("api_slug", "")),
                    title=str(attr_dict.get("title", "")),
                    type=str(attr_dict.get("type", "")),
                    is_required=bool(attr_dict.get("is_required")),
                    is_unique=bool(attr_dict.get("is_unique")),
                )
                for raw_attr in _as_list(obj_data.get("attributes"))
                if (attr_dict := _as_dict(raw_attr)) is not None
                and str(attr_dict.get("api_slug", ""))
            ]
            objects.append(
                AttioObjectData(
                    api_slug=api_slug,
                    singular_noun=str(obj_data.get("singular_noun", "")),
                    attributes=attributes,
                )
            )
        instances.append(
            AttioInstanceData(
                id=integration_id,
                display_name=str(
                    integration_data.get("workspaceName") or integration_id
                ),
                objects=objects,
            )
        )

    return instances


def _fetch_snowflake_instances(api_key: str) -> list[SnowflakeInstanceData]:
    raw_instances = _as_list(request_json("/snowflake/integrations", api_key))
    return [
        SnowflakeInstanceData(
            id=str((_as_dict(integration) or {}).get("id", "")),
            display_name=str(
                (_as_dict(integration) or {}).get("accountIdentifier")
                or (_as_dict(integration) or {}).get("id")
                or ""
            ),
        )
        for integration in raw_instances
        if _as_dict(integration) is not None
    ]


def _fetch_tool_definitions(api_key: str, active_set: set[str]) -> list[ToolDefinition]:
    raw_payload = _as_dict(request_json("/sdk/tool-definitions", api_key))
    raw_tools = _as_list(raw_payload.get("tools") if raw_payload is not None else None)
    definitions: list[ToolDefinition] = []

    for raw_tool in raw_tools:
        tool_data = _as_dict(raw_tool)
        if tool_data is None:
            continue

        integration = str(tool_data.get("integration", "")).lower()
        tool_name = _canonical_tool_name(str(tool_data.get("name", "")))
        if integration not in active_set or tool_name not in _SUPPORTED_TOOL_NAMES:
            continue

        definitions.append(
            ToolDefinition(
                name=tool_name,
                display_name=str(tool_data.get("displayName") or tool_name),
                description=str(tool_data.get("description") or ""),
                integration=integration,
                is_read_only=bool(tool_data.get("isReadOnly")),
                supports_approval=bool(tool_data.get("supportsApproval")),
                parameters=_as_dict(tool_data.get("parameters")) or {},
            )
        )

    return definitions


def _safe_request_json(path: str, api_key: str) -> object | None:
    try:
        return request_json(path, api_key)
    except Exception as exc:
        LOGGER.warning("Request to %s failed: %s", path, exc)
        return None


def _is_attio_multi_value(attr: AttioAttributeData) -> bool:
    """Check if an Attio attribute is multi-valued."""
    slug = attr.api_slug.lower()
    type_ = attr.type.lower()
    return (
        "multi" in type_
        or "array" in type_
        or "list" in type_
        or slug
        in (
            "email_addresses",
            "domains",
            "phone_numbers",
            "social_profiles",
            "links",
            "tags",
        )
        or slug.endswith("_addresses")
        or slug.endswith("_ids")
    )


def _attio_base_python_type(attr: AttioAttributeData) -> str:
    """Map an Attio attribute type to a Python type string."""
    type_ = attr.type.lower()
    slug = attr.api_slug.lower()
    if "checkbox" in type_ or "boolean" in type_:
        return "bool"
    if any(k in type_ for k in ("number", "currency", "rating", "percent")):
        return "float"
    if any(
        k in type_
        for k in (
            "date",
            "time",
            "email",
            "domain",
            "phone",
            "url",
            "select",
            "status",
            "text",
            "string",
            "name",
        )
    ):
        return "str"
    if any(k in type_ for k in ("location", "address", "reference", "record", "actor")):
        return "dict[str, Any]"
    if slug in ("email_addresses", "domains", "phone_numbers", "name"):
        return "str"
    return "Any"


def _attio_record_python_type(attr: AttioAttributeData) -> str:
    """Python type for record output (multi-value → list[T])."""
    base = _attio_base_python_type(attr)
    if not _is_attio_multi_value(attr):
        return base
    return f"list[{base}]"


def _attio_input_python_type(attr: AttioAttributeData) -> str:
    """Python type for input values (multi-value → T | list[T])."""
    base = _attio_base_python_type(attr)
    if not _is_attio_multi_value(attr):
        return base
    return f"{base} | list[{base}]"


def _attio_filter_python_type(attr: AttioAttributeData) -> str:
    """Python type for filter values (input shorthand or operator dict)."""
    value_type = _attio_input_python_type(attr)
    if value_type in ("Any", "dict[str, Any]"):
        return "dict[str, Any]"
    return f"{value_type} | dict[str, Any]"


def _build_summary_lines(codegen_input: CodegenInput) -> list[str]:
    lines = [
        f"Attio ({instance.display_name}) — {len(instance.objects)} objects"
        for instance in codegen_input.attio
    ]
    lines.extend(
        f"Snowflake ({instance.display_name})" for instance in codegen_input.snowflake
    )
    lines.append("Schedule trigger")
    return lines


def _build_attio_object_ctx(
    obj: AttioObjectData, used_names: set[str], has_attrs: bool
) -> _AttioObjectCtx:
    pascal = _to_pascal_case(obj.singular_noun or obj.api_slug) or "Object"
    static_name = _unique_name(pascal, used_names)
    attrs = [
        _AttioAttrCtx(
            api_slug=attr.api_slug,
            record_type=_attio_record_python_type(attr),
            input_type=_attio_input_python_type(attr),
            filter_type=_attio_filter_python_type(attr),
        )
        for attr in obj.attributes
    ]
    multi_slugs = [
        attr.api_slug for attr in obj.attributes if _is_attio_multi_value(attr)
    ]
    multi_frozenset = (
        f"frozenset({{{', '.join(repr(s) for s in multi_slugs)}}})"
        if multi_slugs
        else ""
    )
    return _AttioObjectCtx(
        api_slug=obj.api_slug,
        api_slug_repr=repr(obj.api_slug),
        singular_noun=obj.singular_noun,
        singular_noun_repr=repr(obj.singular_noun),
        pascal=pascal,
        static_name=static_name,
        attributes=attrs,
        attr_slugs_literal=(
            ", ".join(repr(a.api_slug) for a in attrs) if attrs else "''"
        ),
        multi_value_slugs=multi_slugs,
        multi_value_frozenset_repr=multi_frozenset,
        attribute_tuple_repr=_render_attribute_tuple(obj.attributes),
    )


def _build_attio_ctx(
    instance: AttioInstanceData,
    tools: list[ToolDefinition],
) -> _AttioCtx:
    has_attrs = any(obj.attributes for obj in instance.objects)
    used_names: set[str] = set()
    objects = [
        _build_attio_object_ctx(obj, used_names, has_attrs) for obj in instance.objects
    ]
    return _AttioCtx(
        instance_id_repr=repr(instance.id),
        has_attrs=has_attrs,
        objects=objects,
        tools=[_build_tool_ctx(tool) for tool in tools],
    )


def _build_snowflake_ctx(
    instance: SnowflakeInstanceData,
    tools: list[ToolDefinition],
) -> _SnowflakeCtx:
    return _SnowflakeCtx(
        instance_id_repr=repr(instance.id),
        tools=[_build_tool_ctx(tool) for tool in tools],
    )


def _build_tool_ctx(tool: ToolDefinition) -> _ToolCtx:
    return _ToolCtx(
        name=tool.name,
        name_repr=repr(tool.name),
        method_name=_TOOL_METHOD_NAME_BY_TOOL[tool.name],
        output_model=_TOOL_OUTPUT_MODEL_BY_TOOL[tool.name],
        approvable=(not tool.is_read_only or tool.supports_approval),
    )


def _get_jinja_env() -> jinja2.Environment:
    templates_dir = Path(__file__).parent / "templates"
    env = jinja2.Environment(
        loader=jinja2.FileSystemLoader(str(templates_dir)),
        trim_blocks=True,
        lstrip_blocks=True,
        keep_trailing_newline=True,
        undefined=jinja2.StrictUndefined,
    )
    env.filters["pyrepr"] = repr
    return env


def _render_attribute_tuple(attributes: list[AttioAttributeData]) -> str:
    """Render a tuple of AttioAttributeDefinition(...) calls."""
    if not attributes:
        return "()"
    parts = []
    for attr in attributes:
        args = [f"api_slug={attr.api_slug!r}"]
        if attr.title:
            args.append(f"title={attr.title!r}")
        if attr.type:
            args.append(f"type={attr.type!r}")
        if attr.is_required:
            args.append("is_required=True")
        if attr.is_unique:
            args.append("is_unique=True")
        parts.append(f"AttioAttributeDefinition({', '.join(args)})")
    return f"({', '.join(parts)},)"


def _select_supported_tools(
    tools: list[ToolDefinition], integration: str
) -> list[ToolDefinition]:
    ordered: list[ToolDefinition] = []
    available = {
        _canonical_tool_name(tool.name): ToolDefinition(
            name=_canonical_tool_name(tool.name),
            display_name=tool.display_name,
            description=tool.description,
            integration=tool.integration,
            is_read_only=tool.is_read_only,
            supports_approval=tool.supports_approval,
            parameters=tool.parameters,
        )
        for tool in tools
        if tool.integration == integration
    }
    for supported_integration, tool_name, _method_name in _SUPPORTED_TOOL_SPECS:
        if supported_integration != integration:
            continue
        tool = available.get(tool_name)
        if tool is not None:
            ordered.append(tool)
    return ordered


def _canonical_tool_name(tool_name: str) -> str:
    return _TOOL_NAME_ALIASES.get(tool_name, tool_name)


def _to_pascal_case(value: str) -> str:
    parts = re.split(r"[^0-9A-Za-z]+", value)
    normalized = "".join(part[:1].upper() + part[1:] for part in parts if part)
    if normalized[:1].isdigit():
        return f"_{normalized}"
    return normalized


def _unique_name(candidate: str, used_names: set[str]) -> str:
    if candidate not in used_names:
        used_names.add(candidate)
        return candidate

    index = 2
    while f"{candidate}{index}" in used_names:
        index += 1

    unique_name = f"{candidate}{index}"
    used_names.add(unique_name)
    return unique_name

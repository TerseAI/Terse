"""Generate Pydantic models from JSON Schema produced by terse-types.

Uses datamodel-code-generator for the heavy lifting, then post-processes the
output to inject Pydantic ``Discriminator`` annotations on ``RootModel`` unions.
This turns bare unions into tagged unions so that validation errors only show
failures for the *matching* member instead of dumping errors for every variant.
"""

from __future__ import annotations

import re
import shutil
import subprocess
import sys
from pathlib import Path

REPO_ROOT = Path(__file__).resolve().parents[1]
SCHEMA_FILE = REPO_ROOT / "terse-types/dist/json-schema/terse-types.schema.json"
OUTPUT_FILE = REPO_ROOT / "packages/terse-python-sdk/src/terse_sdk/types/_generated.py"

HEADER = "# AUTO-GENERATED - DO NOT EDIT. Run 'pnpm run generate:python-types' to regenerate.\n# ruff: noqa: E501"

# RootModel union classes that should use a Pydantic Discriminator.
# Each entry maps a class name to the discriminator field name (Python name).
DISCRIMINATED_UNIONS: dict[str, str] = {
    "GithubTrigger": "event_type",
    "LinearTrigger": "event_type",
    "SdkAgentStreamEvent": "type",
    "SkillConfigData": "config_type",
    "SlackTrigger": "event_type",
    "TriggerConfigData": "config_type",
    "WorkOSTrigger": "event_type",
}


def main() -> None:
    cmd = [
        sys.executable,
        "-m",
        "datamodel_code_generator",
        "--input",
        str(SCHEMA_FILE),
        "--output",
        str(OUTPUT_FILE),
        "--output-model-type",
        "pydantic_v2.BaseModel",
        "--target-python-version",
        "3.11",
        "--use-union-operator",
        "--field-constraints",
        "--snake-case-field",
        "--use-one-literal-as-default",
        "--base-class",
        "terse_sdk.types._base.TerseModel",
        "--naming-strategy",
        "parent-prefixed",
        "--use-title-as-name",
        "--reuse-model",
        "--use-annotated",
        "--custom-file-header",
        HEADER,
        "--disable-timestamp",
    ]
    subprocess.run(cmd, check=True, cwd=REPO_ROOT)

    _inject_discriminators(OUTPUT_FILE)

    run_ruff("check", "--fix", str(OUTPUT_FILE))
    run_ruff("format", str(OUTPUT_FILE))


def _inject_discriminators(output: Path) -> None:
    """Post-process generated code to add ``Discriminator`` to RootModel unions.

    For each class listed in ``DISCRIMINATED_UNIONS``, rewrites both the
    ``RootModel[...]`` type parameter and the ``root:`` annotation to wrap
    the union with ``Annotated[..., Discriminator("field")]``.
    """
    source = output.read_text()

    needs_discriminator_import = False

    for class_name, field_name in DISCRIMINATED_UNIONS.items():
        multiline_pattern = re.compile(
            rf"(class {re.escape(class_name)}\(\n"
            rf"    RootModel\[\n)"  # group 1: class header + RootModel[
            rf"((?:        .+\n)+?)"  # group 2: union members in RootModel
            rf"(    \]\n"  # group 3: closing ] and ):
            rf"\):\n"
            rf"    root: \(\n)"
            rf"((?:        .+\n)+?)"  # group 4: union members in root
            rf"(    \)\n)",  # group 5: closing )
        )

        def _replace_multiline(m: re.Match[str], _field: str = field_name) -> str:
            root_model_union = _build_annotated_union(
                m.group(2),
                _field,
                first_line_prefix="        ",
                union_indent="            ",
                closing_indent="        ",
            )
            root_field_union = _build_annotated_union(
                m.group(4),
                _field,
                union_indent="        ",
                closing_indent="    ",
            )

            return f"{m.group(1)}{root_model_union}    ]\n):\n    root: {root_field_union}"

        new_source, count = multiline_pattern.subn(_replace_multiline, source, count=1)
        if count == 0:
            singleline_root_pattern = re.compile(
                rf"class {re.escape(class_name)}\(\s*RootModel\[(.+?)\]\s*\):\n"
                rf"    root: ([^\n]+)\n",
                re.DOTALL,
            )

            def _replace_singleline(
                m: re.Match[str],
                _field: str = field_name,
                _class_name: str = class_name,
            ) -> str:
                root_model_union = _build_annotated_union(
                    m.group(1),
                    _field,
                    first_line_prefix="        ",
                    union_indent="            ",
                    closing_indent="        ",
                )
                root_field_union = _build_annotated_union(
                    m.group(2),
                    _field,
                    union_indent="        ",
                    closing_indent="    ",
                )

                return (
                    f"class {_class_name}(\n    RootModel[\n{root_model_union}    ]\n):\n    root: {root_field_union}"
                )

            new_source, count = singleline_root_pattern.subn(_replace_singleline, source, count=1)
        if count > 0:
            source = new_source
            needs_discriminator_import = True
            print(f'  Injected Discriminator("{field_name}") into {class_name}')
        else:
            print(f"  WARNING: Could not find {class_name} to inject discriminator")

    if needs_discriminator_import and "from pydantic import Discriminator, " not in source:
        # Add Discriminator to the pydantic imports
        source = source.replace(
            "from pydantic import ",
            "from pydantic import Discriminator, ",
            1,
        )

    output.write_text(source)


def _build_annotated_union(
    union_block: str,
    field_name: str,
    *,
    first_line_prefix: str = "",
    union_indent: str | None = None,
    closing_indent: str | None = None,
) -> str:
    if union_indent is None:
        union_indent = _infer_indent(union_block)
    if closing_indent is None:
        closing_indent = union_indent[:-4]

    union_lines = _format_union_lines(union_block, union_indent)
    return (
        f'{first_line_prefix}Annotated[\n{union_lines}{union_indent}Discriminator("{field_name}"),\n{closing_indent}]\n'
    )


def _format_union_lines(union_block: str, union_indent: str) -> str:
    stripped_union = union_block.strip()

    if "\n" in stripped_union:
        lines = [line.strip() for line in stripped_union.splitlines()]
    else:
        parts = [part.strip() for part in stripped_union.split("|")]
        lines = [parts[0], *(f"| {part}" for part in parts[1:])]

    lines[-1] = f"{lines[-1]},"
    return "".join(f"{union_indent}{line}\n" for line in lines)


def _infer_indent(union_block: str) -> str:
    match = re.search(r"^(\s*)\S", union_block, flags=re.MULTILINE)
    return match.group(1) if match is not None else ""


def run_ruff(*args: str) -> None:
    ruff = shutil.which("ruff")
    command = [ruff, *args] if ruff is not None else [sys.executable, "-m", "ruff", *args]
    subprocess.run(command, check=True, cwd=REPO_ROOT)


if __name__ == "__main__":
    main()

"""Generate Pydantic models from JSON Schema produced by terse-types.

Uses datamodel-code-generator for the heavy lifting.
"""

from __future__ import annotations

import shutil
import subprocess
import sys
from pathlib import Path

REPO_ROOT = Path(__file__).resolve().parents[1]
SCHEMA_FILE = REPO_ROOT / "terse-types/dist/json-schema/terse-types.schema.json"
OUTPUT_FILE = REPO_ROOT / "packages/terse-python-sdk/src/terse_sdk/types/_generated.py"

HEADER = "# AUTO-GENERATED - DO NOT EDIT. Run 'pnpm run generate:python-types' to regenerate.\n# ruff: noqa: E501"


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

    run_ruff("check", "--fix", str(OUTPUT_FILE))
    run_ruff("format", str(OUTPUT_FILE))


def run_ruff(*args: str) -> None:
    ruff = shutil.which("ruff")
    if ruff is not None:
        command = [ruff, *args]
    else:
        command = [sys.executable, "-m", "ruff", *args]
    subprocess.run(command, check=True, cwd=REPO_ROOT)


if __name__ == "__main__":
    main()

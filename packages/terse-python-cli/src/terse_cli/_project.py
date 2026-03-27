"""Filesystem and project helpers for the Python CLI."""

from __future__ import annotations

import json
import os
import re
import subprocess
import tempfile
from collections.abc import Mapping
from dataclasses import dataclass
from importlib import metadata, resources
from pathlib import Path

from dotenv import dotenv_values, load_dotenv, set_key
from jinja2 import Environment, StrictUndefined

_TEMPLATE_ENV = Environment(
    autoescape=False,
    keep_trailing_newline=True,
    undefined=StrictUndefined,
)

UV_INSTALL_DOCS_URL = "https://docs.astral.sh/uv/getting-started/installation/"


class ProjectRootError(RuntimeError):
    """Raised when a command is run outside a Terse Python project."""


@dataclass(frozen=True)
class DependencyInstallResult:
    """Result of attempting to install project dependencies."""

    succeeded: bool
    command: tuple[str, ...]
    details: str = ""


def assert_project_root(project_dir: Path | None = None) -> Path:
    """Validate that the directory looks like a scaffolded Terse Python project."""

    resolved_dir = (project_dir or Path.cwd()).resolve()
    pyproject_path = resolved_dir / "pyproject.toml"
    main_path = resolved_dir / "src" / "main.py"

    if not pyproject_path.exists():
        raise ProjectRootError("No pyproject.toml found. Run this command from the root of your Terse project.")

    if not main_path.exists():
        raise ProjectRootError("No src/main.py found. Run this command from the root of your Terse project.")

    return resolved_dir


def load_template_text(template_path: str) -> str:
    """Load a scaffold template from package resources."""

    template = resources.files("terse_cli").joinpath("templates", *template_path.split("/"))
    return template.read_text(encoding="utf-8")


def scaffold_template_context(project_name: str) -> dict[str, object]:
    """Build the shared template context for scaffolded project files."""

    local_sdk_path = detect_local_sdk_source_path()
    return {
        "PROJECT_NAME": project_name,
        "SDK_DEPENDENCY": build_sdk_dependency_requirement(),
        "USE_LOCAL_SDK_SOURCE": local_sdk_path is not None,
        "SDK_SOURCE_PATH": json.dumps(str(local_sdk_path)) if local_sdk_path is not None else '""',
        "SDK_SRC_PATH": json.dumps(str(local_sdk_path / "src")) if local_sdk_path is not None else '""',
    }


def render_template(content: str, context: Mapping[str, object]) -> str:
    """Render a scaffold template using Jinja."""

    return _TEMPLATE_ENV.from_string(content).render(**dict(context))


def write_scaffold_file(target_path: Path, content: str) -> None:
    """Write a scaffold file, creating parent directories as needed."""

    target_path.parent.mkdir(parents=True, exist_ok=True)
    target_path.write_text(content, encoding="utf-8")


def read_api_key(project_dir: Path | None = None) -> str | None:
    """Read ``TERSE_API_KEY`` from the project's ``.env`` file."""

    env_path = (project_dir or Path.cwd()).resolve() / ".env"
    if not env_path.exists():
        return None

    api_key = _normalize_env_value(str(dotenv_values(env_path).get("TERSE_API_KEY") or ""))
    if api_key:
        os.environ["TERSE_API_KEY"] = api_key
        return api_key
    return None


def write_api_key(project_dir: Path, api_key: str) -> None:
    """Write or update ``TERSE_API_KEY`` in the project's ``.env`` file."""

    env_path = project_dir / ".env"
    if not env_path.exists():
        env_path.write_text("", encoding="utf-8")

    set_key(env_path, "TERSE_API_KEY", api_key, quote_mode="never")
    os.environ["TERSE_API_KEY"] = api_key


def load_project_env(project_dir: Path | None = None, *, override: bool = False) -> Path:
    """Load the project's ``.env`` file into ``os.environ`` when present."""

    env_path = (project_dir or Path.cwd()).resolve() / ".env"
    if env_path.exists():
        load_dotenv(env_path, override=override)
    return env_path


def run_uv_sync(project_dir: Path) -> DependencyInstallResult:
    """Run ``uv sync`` for a scaffolded project."""

    command = ("uv", "sync")
    env = os.environ.copy()
    env.setdefault("UV_CACHE_DIR", str(Path(tempfile.gettempdir()) / "terse-uv-cache"))

    try:
        completed = subprocess.run(
            command,
            cwd=project_dir,
            capture_output=True,
            check=False,
            env=env,
            text=True,
        )
    except OSError as exc:
        return DependencyInstallResult(succeeded=False, command=command, details=str(exc))

    details = "\n".join(part for part in (completed.stderr.strip(), completed.stdout.strip()) if part).strip()
    return DependencyInstallResult(succeeded=completed.returncode == 0, command=command, details=details)


def run_ty_check(project_dir: Path) -> DependencyInstallResult:
    """Run ``ty check`` for a scaffolded project."""

    command = ("uv", "run", "ty", "check")

    try:
        completed = subprocess.run(
            command,
            cwd=project_dir,
            capture_output=True,
            check=False,
            text=True,
        )
    except OSError as exc:
        return DependencyInstallResult(succeeded=False, command=command, details=str(exc))

    details = "\n".join(part for part in (completed.stderr.strip(), completed.stdout.strip()) if part).strip()
    return DependencyInstallResult(succeeded=completed.returncode == 0, command=command, details=details)


def format_command(command: tuple[str, ...]) -> str:
    """Return a display string for a command tuple."""

    return " ".join(command)


def is_uv_missing_result(result: DependencyInstallResult) -> bool:
    """Return whether a failed command was caused by a missing ``uv`` executable."""

    if result.command[:1] != ("uv",):
        return False

    normalized = result.details.lower()
    missing_patterns = (
        "no such file or directory",
        "not found",
        "cannot find the file specified",
        "executable file not found",
        "failed to find executable",
        "command not found",
    )
    return "uv" in normalized and any(pattern in normalized for pattern in missing_patterns)


def format_missing_uv_install_message(command: tuple[str, ...]) -> str:
    """Explain how to recover when ``uv`` is missing."""

    return f"`uv` is not installed. Install it from {UV_INSTALL_DOCS_URL}, then run `{format_command(command)}`."


def format_uv_prerequisite_hint(command: tuple[str, ...]) -> str:
    """Explain that ``uv`` may need to be installed before using a command."""

    return f"Install `uv` if it is not already available, then run `{format_command(command)}`."


def _normalize_env_value(value: str) -> str:
    return value.strip()


def build_sdk_dependency_requirement() -> str:
    """Return the published SDK requirement used in scaffolded projects."""

    version = _installed_version("terse-sdk") or "0.1.5"
    normalized = _normalize_release_version(version)
    major, minor, patch = normalized
    return f"terse-sdk~={major}.{minor}.{patch}"


def detect_local_sdk_source_path() -> Path | None:
    """Detect a local SDK checkout when the CLI is running from the monorepo."""

    package_dir = Path(__file__).resolve()
    packages_dir = package_dir.parents[3]
    candidate = packages_dir / "terse-python-sdk"

    if packages_dir.name != "packages":
        return None
    if not (candidate / "pyproject.toml").exists():
        return None

    pyproject = (candidate / "pyproject.toml").read_text(encoding="utf-8")
    if 'name = "terse-sdk"' not in pyproject:
        return None

    return candidate


def _installed_version(package_name: str) -> str | None:
    try:
        return metadata.version(package_name)
    except metadata.PackageNotFoundError:
        return None


def _normalize_release_version(version: str) -> tuple[int, int, int]:
    match = re.search(r"(\d+)\.(\d+)\.(\d+)", version)
    if match is None:
        return (0, 1, 0)
    major, minor, patch = (int(group) for group in match.groups())
    return (major, minor, patch)

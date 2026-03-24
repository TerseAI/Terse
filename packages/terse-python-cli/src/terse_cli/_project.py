"""Filesystem and project helpers for the Python CLI."""

from __future__ import annotations

import os
import subprocess
import tempfile
from dataclasses import dataclass
from importlib import resources
from pathlib import Path


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


def render_template(content: str, replacements: dict[str, str]) -> str:
    """Apply ``{{TOKEN}}`` replacements to a template string."""

    rendered = content
    for token, value in replacements.items():
        rendered = rendered.replace(f"{{{{{token}}}}}", value)
    return rendered


def write_scaffold_file(target_path: Path, content: str) -> None:
    """Write a scaffold file, creating parent directories as needed."""

    target_path.parent.mkdir(parents=True, exist_ok=True)
    target_path.write_text(content, encoding="utf-8")


def read_api_key(project_dir: Path | None = None) -> str | None:
    """Read ``TERSE_API_KEY`` from the project's ``.env`` file."""

    env_path = (project_dir or Path.cwd()).resolve() / ".env"
    if not env_path.exists():
        return None

    for line in env_path.read_text(encoding="utf-8").splitlines():
        trimmed = line.strip()
        if not trimmed or trimmed.startswith("#") or "=" not in trimmed:
            continue

        key, value = trimmed.split("=", 1)
        if key.strip() != "TERSE_API_KEY":
            continue

        api_key = value.strip()
        if api_key:
            os.environ["TERSE_API_KEY"] = api_key
            return api_key
        return None

    return None


def write_api_key(project_dir: Path, api_key: str) -> None:
    """Write the project ``.env`` file with a single API key entry."""

    env_path = project_dir / ".env"
    env_path.write_text(f"TERSE_API_KEY={api_key}\n", encoding="utf-8")


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

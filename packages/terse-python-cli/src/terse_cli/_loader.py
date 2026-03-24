"""Project/module loading helpers for runtime-backed CLI commands."""

from __future__ import annotations

import importlib.util
import sys
import uuid
from collections.abc import Iterator
from contextlib import contextmanager
from pathlib import Path
from types import ModuleType

from terse_sdk import RegisteredJob, clear_job_registry, get_job_registry

from ._project import assert_project_root, load_project_env
from ._ui import prompt_select


class ProjectImportError(RuntimeError):
    """Raised when ``src/main.py`` could not be imported cleanly."""


class NoJobsFoundError(RuntimeError):
    """Raised when a project registers no jobs."""


class JobSelectionError(RuntimeError):
    """Raised when the requested job name could not be resolved."""


def load_job_registry(project_dir: Path | None = None) -> tuple[Path, dict[str, RegisteredJob]]:
    """Import ``src/main.py`` and return the registered job map."""

    resolved_dir = assert_project_root(project_dir)
    load_project_env(resolved_dir)
    clear_job_registry()
    _purge_project_modules(resolved_dir)
    _import_project_main(resolved_dir)

    registry = get_job_registry()
    if not registry:
        raise NoJobsFoundError(
            "No jobs found. Make sure your src/main.py registers at least one job with @app.job(...)."
        )

    return resolved_dir, registry


def resolve_job(registry: dict[str, RegisteredJob], job_name: str | None) -> RegisteredJob:
    """Resolve the target job using the requested name or an interactive prompt."""

    if job_name:
        try:
            return registry[job_name]
        except KeyError as exc:
            available = "\n".join(f"  - {name}" for name in sorted(registry))
            raise JobSelectionError(f'Job "{job_name}" not found.\n\nAvailable jobs:\n{available}') from exc

    if len(registry) == 1:
        return next(iter(registry.values()))

    selected_name = prompt_select(
        "Multiple jobs found. Which one?",
        [(name, name) for name in sorted(registry)],
    )
    return registry[selected_name]


def _import_project_main(project_dir: Path) -> ModuleType:
    main_path = project_dir / "src" / "main.py"
    module_name = f"_terse_project_main_{uuid.uuid4().hex}"
    spec = importlib.util.spec_from_file_location(module_name, main_path)
    if spec is None or spec.loader is None:
        raise ProjectImportError(f"Could not create an import spec for {main_path}.")

    module = importlib.util.module_from_spec(spec)
    sys.modules[module_name] = module

    try:
        with _temporary_sys_path([project_dir, project_dir / "src"]):
            spec.loader.exec_module(module)
    except ModuleNotFoundError as exc:
        raise ProjectImportError(_format_missing_module_message(exc)) from exc
    except Exception:
        sys.modules.pop(module_name, None)
        raise

    return module


@contextmanager
def _temporary_sys_path(paths: list[Path]) -> Iterator[None]:
    inserted = [str(path) for path in paths]
    sys.path[:0] = inserted
    try:
        yield
    finally:
        for path in inserted:
            try:
                sys.path.remove(path)
            except ValueError:
                continue


def _purge_project_modules(project_dir: Path) -> None:
    for module_name, module in list(sys.modules.items()):
        if module_name == "terse_generated" or module_name.startswith("_terse_project_main_"):
            sys.modules.pop(module_name, None)
            continue
        module_file = getattr(module, "__file__", None)
        if not module_file:
            continue
        try:
            module_path = Path(module_file).resolve()
        except OSError:
            continue
        if _is_within_project(module_path, project_dir):
            sys.modules.pop(module_name, None)


def _is_within_project(path: Path, project_dir: Path) -> bool:
    try:
        path.relative_to(project_dir)
        return True
    except ValueError:
        return False


def _format_missing_module_message(error: ModuleNotFoundError) -> str:
    package = error.name or "unknown"
    message = f"Cannot find package '{package}' imported from src/main.py."
    if package == "terse_sdk":
        return f"{message}\n\nMake sure terse-python-sdk is installed in your project:\n  uv sync"
    return f"{message}\n\nInstall the missing package in your project:\n  uv add {package}"

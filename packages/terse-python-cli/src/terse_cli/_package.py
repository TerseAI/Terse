"""Packaging helpers for `terse deploy`."""

from __future__ import annotations

import base64
from dataclasses import dataclass
from io import BytesIO
from pathlib import Path
from zipfile import ZIP_DEFLATED, ZipFile

import pathspec

MANDATORY_EXCLUDED_DIRS = {
    ".git",
    ".idea",
    ".mypy_cache",
    ".nox",
    ".pytest_cache",
    ".ruff_cache",
    ".tox",
    ".venv",
    ".vscode",
    "__pycache__",
    "build",
    "dist",
}
MANDATORY_EXCLUDED_FILES = {
    ".DS_Store",
    ".env",
}
MANDATORY_EXCLUDED_SUFFIXES = {
    ".pyc",
    ".pyo",
}


class PackagingError(RuntimeError):
    """Raised when the project source bundle could not be created."""


@dataclass(frozen=True)
class DeployArchive:
    """The encoded deployable source archive."""

    source_zip_base64: str
    file_count: int
    zip_size_bytes: int


def build_deploy_archive(project_dir: Path) -> DeployArchive:
    """Build a zipped source archive while honoring `.gitignore` and safety excludes."""

    ignore_spec = _load_gitignore_spec(project_dir)
    file_paths = list(_iter_project_files(project_dir, ignore_spec))
    if not file_paths:
        raise PackagingError("No files found to deploy.")

    buffer = BytesIO()
    with ZipFile(buffer, "w", compression=ZIP_DEFLATED, compresslevel=6) as archive:
        for file_path in file_paths:
            archive.writestr(file_path.relative_to(project_dir).as_posix(), file_path.read_bytes())

    zip_data = buffer.getvalue()
    return DeployArchive(
        source_zip_base64=base64.b64encode(zip_data).decode("utf-8"),
        file_count=len(file_paths),
        zip_size_bytes=len(zip_data),
    )


def _iter_project_files(project_dir: Path, ignore_spec: pathspec.PathSpec) -> list[Path]:
    files: list[Path] = []
    stack = [project_dir]

    while stack:
        current_dir = stack.pop()
        for entry in sorted(current_dir.iterdir(), key=lambda path: path.name):
            relative_path = entry.relative_to(project_dir).as_posix()

            if _should_skip_path(entry, relative_path, ignore_spec, project_dir):
                continue

            if entry.is_dir():
                stack.append(entry)
                continue

            if entry.is_file():
                files.append(entry)

    return files


def _load_gitignore_spec(project_dir: Path) -> pathspec.PathSpec:
    gitignore_path = project_dir / ".gitignore"
    if not gitignore_path.exists():
        return pathspec.PathSpec.from_lines("gitignore", [])
    return pathspec.PathSpec.from_lines("gitignore", gitignore_path.read_text(encoding="utf-8").splitlines())


def _should_skip_path(
    entry: Path,
    relative_path: str,
    ignore_spec: pathspec.PathSpec,
    project_dir: Path,
) -> bool:
    if _is_mandatory_excluded(entry):
        return True

    if ignore_spec.match_file(relative_path) or (entry.is_dir() and ignore_spec.match_file(f"{relative_path}/")):
        return True

    if not entry.is_symlink():
        return False

    try:
        resolved = entry.resolve(strict=True)
    except OSError:
        return True

    if not _is_within_project(resolved, project_dir):
        return True

    return resolved.is_dir()


def _is_mandatory_excluded(entry: Path) -> bool:
    if entry.name in MANDATORY_EXCLUDED_FILES:
        return True
    if entry.suffix in MANDATORY_EXCLUDED_SUFFIXES:
        return True
    return entry.name in MANDATORY_EXCLUDED_DIRS and entry.is_dir()


def _is_within_project(path: Path, project_dir: Path) -> bool:
    try:
        path.relative_to(project_dir)
        return True
    except ValueError:
        return False

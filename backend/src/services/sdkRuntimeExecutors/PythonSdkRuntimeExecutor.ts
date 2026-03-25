import type { SandboxCommandResult, SdkRuntimeExecutor, SdkRuntimeExecutorContext } from "./types"

export class PythonSdkRuntimeExecutor implements SdkRuntimeExecutor {
    readonly runtime = "python" as const
    readonly sandboxImage = "python:3.11-slim"
    readonly detectionEntries = ["pyproject.toml"] as const

    matchesArchive(entries: Set<string>): boolean {
        return entries.has("pyproject.toml")
    }

    async execute(context: SdkRuntimeExecutorContext): Promise<SandboxCommandResult> {
        await context.ensureSandboxCommand(
            "install uv",
            "python -m pip install --no-cache-dir uv"
        )
        await context.ensureSandboxCommand(
            "uv sync",
            `cd ${context.projectDir} && uv sync`
        )
        await context.ensureSandboxCommand(
            "install terse-cli",
            `cd ${context.projectDir} && uv pip install --python .venv/bin/python terse-cli`
        )
        await context.ensureSandboxCommand(
            "python runtime diagnostics",
            this.buildDiagnosticsCommand(context)
        )

        return context.runSandboxCommand(
            "terse run",
            `cd ${context.projectDir} && TERSE_DEBUG=1 uv run --no-sync --python .venv/bin/python terse --debug run ${context.escapeShellArg(context.jobName)} --event-file ${context.eventFilePath}`
        )
    }

    private buildDiagnosticsCommand(context: SdkRuntimeExecutorContext): string {
        return [
            `cd ${context.projectDir} && .venv/bin/python - <<'PY'`,
            "from __future__ import annotations",
            "",
            "import importlib.metadata as metadata",
            "import importlib.util",
            "import os",
            "import sys",
            "import uuid",
            "from pathlib import Path",
            "",
            "project_dir = Path.cwd()",
            "src_dir = project_dir / 'src'",
            "main_path = src_dir / 'main.py'",
            "",
            "print('=== python runtime diagnostics ===')",
            "print('cwd=', project_dir)",
            "print('python_executable=', sys.executable)",
            "print('job_name=', os.environ.get('TERSE_JOB_NAME', '<unset>'))",
            "print('terse_backend_url=', os.environ.get('TERSE_BACKEND_URL', '<unset>'))",
            "print('project_files=', sorted(path.name for path in project_dir.iterdir()))",
            "print('src_files=', sorted(path.name for path in src_dir.iterdir()) if src_dir.exists() else '<missing src>')",
            "print('main_exists=', main_path.exists())",
            "print('venv_terse_exists=', (project_dir / '.venv' / 'bin' / 'terse').exists())",
            "",
            "for package_name in ('terse-cli', 'terse-sdk'):",
            "    try:",
            "        print(f'{package_name}_version=', metadata.version(package_name))",
            "    except Exception as exc:",
            "        print(f'{package_name}_version_error=', repr(exc))",
            "",
            "try:",
            "    import terse_sdk",
            "    import terse_sdk.runtime as terse_runtime",
            "    from terse_sdk import clear_job_registry, get_job_registry",
            "    print('terse_sdk_file=', getattr(terse_sdk, '__file__', '<missing>'))",
            "    print('terse_runtime_file=', getattr(terse_runtime, '__file__', '<missing>'))",
            "    print('sdk_registry_store_id=', id(get_job_registry.__globals__.get('_JOB_REGISTRY')))",
            "    print('terse_job_store_id=', id(terse_sdk.Terse.job.__globals__.get('_JOB_REGISTRY')))",
            "except Exception as exc:",
            "    print('terse_sdk_import_error=', repr(exc))",
            "    raise",
            "",
            "original_job = terse_sdk.Terse.job",
            "",
            "def traced_job(self, *args, **kwargs):",
            "    print('trace_job_called=', {'self_id': id(self), 'name': kwargs.get('name'), 'registry_before': sorted(get_job_registry().keys())})",
            "    decorator = original_job(self, *args, **kwargs)",
            "",
            "    def traced_decorator(handler):",
            "        print('trace_job_decorator_before=', {'handler': getattr(handler, '__name__', '<unknown>'), 'registry_before': sorted(get_job_registry().keys())})",
            "        result = decorator(handler)",
            "        print('trace_job_decorator_after=', {'handler': getattr(handler, '__name__', '<unknown>'), 'registry_after': sorted(get_job_registry().keys())})",
            "        return result",
            "",
            "    return traced_decorator",
            "",
            "terse_sdk.Terse.job = traced_job",
            "",
            "try:",
            "    from terse_cli import _loader",
            "    print('terse_cli_loader_file=', getattr(_loader, '__file__', '<missing>'))",
            "    print('loader_registry_store_id=', id(_loader.get_job_registry.__globals__.get('_JOB_REGISTRY')))",
            "except Exception as exc:",
            "    print('terse_cli_loader_import_error=', repr(exc))",
            "    raise",
            "",
            "clear_job_registry()",
            "inserted_paths = [str(project_dir), str(src_dir)]",
            "sys.path[:0] = inserted_paths",
            "print('sys_path_head=', sys.path[:5])",
            "",
            "module_name = f'_terse_project_main_{uuid.uuid4().hex}'",
            "spec = importlib.util.spec_from_file_location(module_name, main_path)",
            "if spec is None or spec.loader is None:",
            "    raise RuntimeError(f'Could not create import spec for {main_path}')",
            "",
            "module = importlib.util.module_from_spec(spec)",
            "sys.modules[module_name] = module",
            "",
            "try:",
            "    spec.loader.exec_module(module)",
            "    print('direct_main_terse_module=', getattr(getattr(module, 'Terse', None), '__module__', '<missing>'))",
            "    print('direct_main_terse_is_sdk_terse=', getattr(module, 'Terse', None) is terse_sdk.Terse)",
            "    print('direct_main_app_type=', type(getattr(module, 'app', None)).__module__ + '.' + type(getattr(module, 'app', None)).__name__)",
            "    print('direct_terse_generated_file=', getattr(sys.modules.get('terse_generated'), '__file__', '<missing>'))",
            "    print('direct_registry_keys=', sorted(get_job_registry().keys()))",
            "except Exception as exc:",
            "    print('direct_import_error=', repr(exc))",
            "",
            "try:",
            "    clear_job_registry()",
            "    _loader._purge_project_modules(project_dir)",
            "    print('after_purge_has_terse_generated=', 'terse_generated' in sys.modules)",
            "    manual_module = _loader._import_project_main(project_dir)",
            "    print('manual_module_name=', getattr(manual_module, '__name__', '<missing>'))",
            "    print('manual_module_file=', getattr(manual_module, '__file__', '<missing>'))",
            "    print('manual_main_terse_module=', getattr(getattr(manual_module, 'Terse', None), '__module__', '<missing>'))",
            "    print('manual_main_terse_is_sdk_terse=', getattr(manual_module, 'Terse', None) is terse_sdk.Terse)",
            "    print('manual_main_app_type=', type(getattr(manual_module, 'app', None)).__module__ + '.' + type(getattr(manual_module, 'app', None)).__name__)",
            "    print('manual_terse_generated_file=', getattr(sys.modules.get('terse_generated'), '__file__', '<missing>'))",
            "    print('manual_loader_registry_keys=', sorted(get_job_registry().keys()))",
            "    print('manual_loader_registry_keys_via_loader=', sorted(_loader.get_job_registry().keys()))",
            "except Exception as exc:",
            "    print('manual_loader_error=', repr(exc))",
            "",
            "try:",
            "    from terse_cli._loader import load_job_registry",
            "    _, registry = load_job_registry(project_dir)",
            "    print('loader_registry_keys=', sorted(registry.keys()))",
            "except Exception as exc:",
            "    print('loader_registry_error=', repr(exc))",
            "PY",
        ].join("\n")
    }
}

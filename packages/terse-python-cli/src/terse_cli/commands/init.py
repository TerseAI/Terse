"""`terse init` command."""

from __future__ import annotations

from pathlib import Path

import click

from .._generate import (
    CodegenInput,
    MissingApiKeyError,
    generate_project,
    render_generated_module,
    write_generated_module,
)
from .._http import ApiRequestError, AuthenticationError, frontend_url, verify_api_key
from .._project import (
    load_template_text,
    render_template,
    run_uv_sync,
    scaffold_template_context,
    write_api_key,
    write_scaffold_file,
)


@click.command("init", help="Scaffold a new Terse project.")
@click.argument("project_name", required=False)
def init_command(project_name: str | None) -> None:
    target_dir = (Path.cwd() / project_name).resolve() if project_name else Path.cwd().resolve()
    resolved_name = project_name or target_dir.name

    click.echo(f"\n  Creating Terse project {resolved_name}\n")

    if project_name:
        if target_dir.exists():
            raise click.ClickException(f'Directory "{project_name}" already exists.')
        target_dir.mkdir(parents=True, exist_ok=True)

    _scaffold_project(target_dir, resolved_name)
    _install_dependencies(target_dir)
    _prompt_for_api_key(target_dir)
    _generate_helpers(target_dir)
    _print_next_steps(target_dir, project_name)


def _scaffold_project(target_dir: Path, project_name: str) -> None:
    replacements = scaffold_template_context(project_name)
    files = [
        ("pyproject.toml.jinja2", "pyproject.toml"),
        ("README.md.jinja2", "README.md"),
        ("env.example.jinja2", ".env.example"),
        ("gitignore.jinja2", ".gitignore"),
        (".python-version.jinja2", ".python-version"),
        ("src/main.py.jinja2", "src/main.py"),
    ]

    for template_name, output_name in files:
        template = load_template_text(template_name)
        rendered = render_template(template, replacements)
        write_scaffold_file(target_dir / output_name, rendered)
        click.secho(f"  + {output_name}", fg="green")


def _install_dependencies(target_dir: Path) -> None:
    result = run_uv_sync(target_dir)
    command = " ".join(result.command)
    if result.succeeded:
        click.echo(f"\n  Installed dependencies with {command}")
        return

    click.secho(f"\n  Warning: Failed to install dependencies with {command}.", fg="yellow")
    if result.details:
        detail_lines = [line.strip() for line in result.details.splitlines() if line.strip()]
        if detail_lines:
            preferred_line = next(
                (line for line in detail_lines if "error" in line.lower() or "failed" in line.lower()),
                detail_lines[-1],
            )
            click.echo(click.style(f"  {preferred_line}", dim=True))
    click.echo(click.style(f"  Run `{command}` manually when you're ready.", dim=True))


def _prompt_for_api_key(target_dir: Path) -> None:
    click.echo(f"\n  Create an API key at: {frontend_url()}/app/profile?tab=api-tokens\n")

    try:
        api_key = click.prompt(
            "Paste your API key (or press Enter to skip)",
            default="",
            show_default=False,
        ).strip()
    except click.Abort:
        click.echo("\n")
        raise SystemExit(0) from None

    if not api_key:
        write_api_key(target_dir, "")
        click.echo(click.style("  Skipped; you can add TERSE_API_KEY to .env later.", dim=True))
        return

    try:
        name = verify_api_key(api_key)
        click.secho(f"  Hello, {name}! API key verified.", fg="green")
    except AuthenticationError:
        click.secho(
            "  Warning: Could not verify API key (invalid or server error). Saving it anyway.",
            fg="yellow",
        )
    except ApiRequestError:
        click.secho(
            "  Warning: Could not reach the server to verify your API key. Saving it anyway.",
            fg="yellow",
        )

    write_api_key(target_dir, api_key)


def _generate_helpers(target_dir: Path) -> None:
    try:
        result = generate_project(target_dir)
    except (MissingApiKeyError, AuthenticationError, ApiRequestError) as exc:
        fallback_path = write_generated_module(target_dir, render_generated_module(CodegenInput()))
        click.secho("\n  Warning: Could not fetch integration helpers during init.", fg="yellow")
        click.echo(click.style(f"  {str(exc).splitlines()[0]}", dim=True))
        click.echo(
            click.style(
                f"  Wrote {fallback_path.relative_to(target_dir)} with built-in helpers only.",
                dim=True,
            )
        )
        click.echo(
            click.style(
                "  Rerun `terse generate` after adding a valid TERSE_API_KEY and connecting Attio or Snowflake.",
                dim=True,
            )
        )
        return

    click.echo("")
    for line in result.summary_lines:
        click.echo(f"  + {line}")
    click.secho(
        f"\n  Generated {result.output_path.relative_to(result.project_dir)}",
        fg="green",
    )


def _print_next_steps(target_dir: Path, project_name: str | None) -> None:
    click.secho("\n  Done! Your Terse project is ready.\n", fg="green")
    click.echo("  Next steps:\n")

    step = 1
    if project_name:
        click.echo(f"  {step}. cd {project_name}")
        step += 1

    click.echo(f"  {step}. Edit src/main.py to register your job")
    step += 1
    click.echo(f"  {step}. Run `terse test` to execute it locally")
    step += 1
    click.echo(f"  {step}. Use `terse run --event ...` when you want to pass a serialized event")
    step += 1
    click.echo(f"  {step}. Run `terse generate` again after you connect Attio or Snowflake\n")

"""Command registration for the Terse Python CLI."""

from .deploy import deploy_command
from .generate import generate_command
from .init import init_command
from .integrate import integrate_command
from .run import run_command
from .test import test_command

__all__ = [
    "deploy_command",
    "generate_command",
    "init_command",
    "integrate_command",
    "run_command",
    "test_command",
]

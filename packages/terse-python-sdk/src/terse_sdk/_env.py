import os


def _is_truthy_env(var_name: str) -> bool:
    value = os.environ.get(var_name)
    if value is None:
        return False
    return value.strip().lower() not in {"", "0", "false", "no", "off"}

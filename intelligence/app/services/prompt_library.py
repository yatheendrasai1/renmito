from pathlib import Path

_PROMPTS_DIR = Path(__file__).parent.parent.parent / "prompts"


def get_prompt(prompt_id: str, vars: dict, template_override: str | None = None) -> str:
    """Interpolate {{key}} placeholders. Uses file template unless override is given."""
    if template_override:
        content = template_override
    else:
        path = _PROMPTS_DIR / f"{prompt_id}.txt"
        if not path.exists():
            raise FileNotFoundError(f"Prompt template not found: {prompt_id}")
        content = path.read_text(encoding="utf-8")

    for key, value in vars.items():
        content = content.replace("{{" + key + "}}", str(value))
    return content

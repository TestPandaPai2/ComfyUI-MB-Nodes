"""Krea2 prompt-styles picker. Parses the bundled styles table once at import
time so the pack ships one source of truth (the .md file) instead of a
hand-transcribed dict that can drift from it."""

import os
import random
import re

from comfy_api.latest import io

DATA_PATH = os.path.join(os.path.dirname(os.path.abspath(__file__)), "data", "krea2_styles.md")

_CATEGORY_RE = re.compile(r"^## (.+)$")
_STYLE_RE = re.compile(r"^### (.+?)(?:\s*\*\(also:.*?\)\*)?\s*$")


def _parse(path):
    """{category: [(style_name, prompt_text), ...]}, in file order."""
    categories: dict[str, list[tuple[str, str]]] = {}
    category = None
    style_name = None
    prompt_lines: list[str] = []

    def flush():
        if category is not None and style_name is not None:
            text = " ".join(prompt_lines).strip()
            if text:
                categories.setdefault(category, []).append((style_name, text))

    with open(path, "r", encoding="utf-8") as f:
        for raw in f:
            line = raw.rstrip("\n")

            cat_match = _CATEGORY_RE.match(line)
            if cat_match:
                flush()
                category = cat_match.group(1).strip()
                style_name = None
                prompt_lines = []
                continue

            style_match = _STYLE_RE.match(line)
            if style_match:
                flush()
                style_name = style_match.group(1).strip()
                prompt_lines = []
                continue

            if style_name is None or not line.strip():
                continue
            prompt_lines.append(line.strip())

    flush()
    return categories


try:
    STYLES = _parse(DATA_PATH)
except OSError:
    STYLES = {}

CATEGORIES = list(STYLES.keys())
DEFAULT_CATEGORY = CATEGORIES[0] if CATEGORIES else ""

# The sub_style combo declares every style name across every category so
# whatever the client has selected passes backend validation; the web
# extension narrows the visible options to the ones in the active category.
ALL_STYLES = list(dict.fromkeys(name for styles in STYLES.values() for name, _ in styles))
DEFAULT_STYLE = ALL_STYLES[0] if ALL_STYLES else ""

_PROMPT_BY_NAME = {name: prompt for styles in STYLES.values() for name, prompt in styles}


class MBKrea2Styles(io.ComfyNode):
    """Category + style picker over the Krea2 prompt-styles table. Outputs
    "StyleName: Prompt". `randomize` picks a random style inside the chosen
    category only — the category itself is never randomized."""

    @classmethod
    def define_schema(cls) -> io.Schema:
        return io.Schema(
            node_id="MBNodesKrea2Styles",
            display_name="Krea2 Styles (MB)",
            category="MBNodes",
            description="Pick a Krea2 prompt style by category; outputs \"StyleName: Prompt\".",
            search_aliases=["krea", "krea2", "style", "prompt style"],
            inputs=[
                io.Combo.Input(
                    "category",
                    options=CATEGORIES,
                    default=DEFAULT_CATEGORY,
                    socketless=True,
                ),
                io.Combo.Input(
                    "sub_style",
                    options=ALL_STYLES,
                    default=DEFAULT_STYLE,
                    socketless=True,
                ),
                io.Boolean.Input(
                    "randomize",
                    default=False,
                    tooltip="Pick a random style inside the selected category on every run. The category itself is never randomized.",
                ),
                io.Boolean.Input(
                    "bypass",
                    default=False,
                    tooltip="Output an empty string instead of the style prompt.",
                ),
            ],
            outputs=[
                io.String.Output("prompt"),
            ],
        )

    @classmethod
    def execute(cls, category, sub_style, randomize, bypass) -> io.NodeOutput:
        if bypass:
            return io.NodeOutput("")

        styles = STYLES.get(category, [])
        if randomize and styles:
            name, prompt = random.choice(styles)
        else:
            name = sub_style
            prompt = _PROMPT_BY_NAME.get(sub_style, "")
            if not prompt and styles:
                name, prompt = styles[0]

        return io.NodeOutput(f"{name}: {prompt}")

    @classmethod
    def fingerprint_inputs(cls, category, sub_style, randomize, bypass):
        if randomize:
            return random.random()
        return f"{category}|{sub_style}|{bypass}"


try:
    from server import PromptServer
    from aiohttp import web

    @PromptServer.instance.routes.get("/mbnodes/krea2_styles")
    async def _mbnodes_krea2_styles(request):
        return web.json_response({
            "categories": CATEGORIES,
            "table": {cat: [name for name, _ in styles] for cat, styles in STYLES.items()},
        })
except Exception:  # server missing (unit runs) or route already registered
    pass


NODES = [MBKrea2Styles]

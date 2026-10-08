"""Prompt (MB): save the prompt under a tag name, then write @name in any
Prompt Tags node to pull that prompt in. Tags live in one JSON file shared by
every workflow; saving and managing them are frontend actions over the routes
below, expansion happens when the graph runs."""

import json
import os
import re

from comfy_api.latest import io

PACK_ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
TAGS_FILE = os.path.join(PACK_ROOT, "PromptTags.json")

TAG_NAME = re.compile(r"^[A-Za-z0-9_-]+$")
TAG_REF = re.compile(r"@([A-Za-z0-9_-]+)")
MAX_DEPTH = 16


def load_tags():
    if not os.path.isfile(TAGS_FILE):
        return {}
    with open(TAGS_FILE, "r", encoding="utf-8") as f:
        data = json.load(f)
    return {k: v for k, v in data.items() if isinstance(v, str) and TAG_NAME.match(k)}


def write_tags(tags):
    tmp = TAGS_FILE + ".tmp"
    with open(tmp, "w", encoding="utf-8") as f:
        json.dump(dict(sorted(tags.items())), f, indent=2, ensure_ascii=False)
    os.replace(tmp, TAGS_FILE)


def expand(text, tags, chain=()):
    """Replace @name with its saved prompt, recursively. Unknown names and
    references back into the current chain (a tag that includes itself) stay
    as typed."""
    def sub(match):
        name = match.group(1)
        if name not in tags or name in chain or len(chain) >= MAX_DEPTH:
            return match.group(0)
        return expand(tags[name], tags, chain + (name,))
    return TAG_REF.sub(sub, text)


class MBPromptTags(io.ComfyNode):
    """Write a prompt, name it, and Save Tag. Then @name in the text pulls the
    saved prompt in when the graph runs."""

    @classmethod
    def define_schema(cls) -> io.Schema:
        return io.Schema(
            node_id="MBPromptTags",
            display_name="Prompt (MB)",
            category="MBNodes",
            description="Save prompts as @tags and reuse them by name. Tags expand recursively when the graph runs.",
            search_aliases=["prompt tags", "tag", "@ tag", "prompt snippet"],
            inputs=[
                io.String.Input("text", multiline=True, default=""),
                io.String.Input(
                    "tag_name",
                    default="",
                    socketless=True,
                    tooltip="Name the Save Tag button stores the prompt under. Use it as @name.",
                ),
            ],
            outputs=[io.String.Output("text")],
        )

    @classmethod
    def fingerprint_inputs(cls, text, tag_name):
        # A tag edited elsewhere changes the output without changing the inputs.
        return expand(text, load_tags())

    @classmethod
    def execute(cls, text, tag_name) -> io.NodeOutput:
        return io.NodeOutput(expand(text, load_tags()))


NODES = [MBPromptTags]


# ------------------------------------------------------------------- routes

try:
    from server import PromptServer
    from aiohttp import web

    @PromptServer.instance.routes.get("/mbnodes/prompt_tags")
    async def _mbnodes_prompt_tags(request):
        return web.json_response({"tags": load_tags()})

    @PromptServer.instance.routes.post("/mbnodes/prompt_tags/save")
    async def _mbnodes_prompt_tags_save(request):
        data = await request.json()
        name = (data.get("name") or "").strip().lstrip("@")
        if not TAG_NAME.match(name):
            return web.json_response({"error": "Tag names use letters, digits, _ and - only."}, status=400)

        tags = load_tags()
        if name in tags and not data.get("overwrite"):
            return web.json_response({"error": "exists", "name": name}, status=409)

        tags[name] = data.get("text") or ""
        write_tags(tags)
        return web.json_response({"name": name, "tags": tags})

    @PromptServer.instance.routes.post("/mbnodes/prompt_tags/replace")
    async def _mbnodes_prompt_tags_replace(request):
        tags = (await request.json()).get("tags") or {}
        bad = [k for k, v in tags.items() if not TAG_NAME.match(k) or not isinstance(v, str)]
        if bad:
            return web.json_response({"error": f"Invalid tag: {bad[0]}"}, status=400)
        write_tags(tags)
        return web.json_response({"tags": tags})

except Exception:  # server missing (unit runs) or routes already registered
    pass

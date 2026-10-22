"""Prompt (MB): save the prompt under a tag name, then write @name in any
Prompt Tags node to pull that prompt in. Tags live in one JSON file shared by
every workflow; saving and managing them are frontend actions over the routes
below, expansion happens when the graph runs."""

import json
import logging
import os
import random
import re

from comfy_api.latest import io

PACK_ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
TAGS_FILE = os.path.join(PACK_ROOT, "PromptTags.json")

TAG_NAME = re.compile(r"^[A-Za-z0-9_-]+$")
# @name, optionally weighted as @name:1.2
TAG_REF = re.compile(r"@([A-Za-z0-9_-]+)(?::(\d+(?:\.\d+)?))?")
MAX_DEPTH = 16


def load_tags():
    if not os.path.isfile(TAGS_FILE):
        return {}
    try:
        with open(TAGS_FILE, "r", encoding="utf-8") as f:
            data = json.load(f)
    except json.JSONDecodeError:
        logging.warning(f"[MBNodes] {TAGS_FILE} is not valid JSON; ignoring saved tags.")
        return {}
    if not isinstance(data, dict):
        return {}
    return {k: v for k, v in data.items() if isinstance(v, str) and TAG_NAME.match(k)}


def write_tags(tags):
    tmp = TAGS_FILE + ".tmp"
    with open(tmp, "w", encoding="utf-8") as f:
        json.dump(dict(sorted(tags.items())), f, indent=2, ensure_ascii=False)
    os.replace(tmp, TAGS_FILE)


def expand(text, tags, chain=()):
    """Replace @name with its saved prompt, recursively; @name:1.2 becomes
    (prompt:1.2). Unknown names and references back into the current chain
    (a tag that includes itself) stay as typed."""
    def sub(match):
        name, weight = match.groups()
        if name not in tags or name in chain or len(chain) >= MAX_DEPTH:
            return match.group(0)
        expanded = expand(tags[name], tags, chain + (name,))
        return f"({expanded.strip(' ,')}:{weight})" if weight else expanded
    return TAG_REF.sub(sub, text)


# Innermost {a|b|c} group: no braces inside, at least one "|". Braces without
# a "|" (JSON, literal text) are left alone.
CHOICE = re.compile(r"\{([^{}]*\|[^{}]*)\}")


def resolve_choices(text, seed):
    """Pick one option from every {a|b|c}, innermost groups first so nested
    choices work. The same seed always gives the same picks."""
    rng = random.Random(seed)
    while True:
        picked = CHOICE.sub(lambda m: rng.choice(m.group(1).split("|")), text)
        if picked == text:
            return picked
        text = picked


def render(text, dynamic_prompts, seed):
    """What the node outputs: tags expanded, choices picked, then tidied."""
    text = expand(text, load_tags())
    if dynamic_prompts:
        text = resolve_choices(text, seed)
    return tidy(text)


def tidy(text):
    """Clean up what splicing tags in leaves behind: runs of spaces, empty
    comma slots, spaces before commas, commas at line ends. Line breaks stay."""
    text = re.sub(r"[ \t]+", " ", text)
    text = re.sub(r" ?,(?: ?,)+", ",", text)
    text = re.sub(r" +,", ",", text)
    text = re.sub(r"^[ ,]+|[ ,]+$", "", text, flags=re.M)
    return text.strip()


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
                io.Boolean.Input(
                    "dynamic_prompts",
                    default=False,
                    tooltip="Pick one option from each {a|b|c} (nested allowed), after @tags expand, so choices inside saved tags work too.",
                ),
                # Starts fixed: a seed that changes every run would re-run
                # everything downstream even with dynamic prompts off.
                io.Int.Input(
                    "seed",
                    default=0,
                    min=0,
                    max=0xFFFFFFFFFFFFFFFF,
                    control_after_generate=io.ControlAfterGenerate.fixed,
                    tooltip="Same seed, same picks. Set the control below to randomize for a new pick every run.",
                ),
            ],
            outputs=[io.String.Output("text")],
        )

    @classmethod
    def fingerprint_inputs(cls, text, tag_name, dynamic_prompts=False, seed=0):
        # A tag edited elsewhere changes the output without changing the inputs.
        return render(text, dynamic_prompts, seed)

    @classmethod
    def execute(cls, text, tag_name, dynamic_prompts=False, seed=0) -> io.NodeOutput:
        return io.NodeOutput(render(text, dynamic_prompts, seed))


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

    # The Tag manager sends only what it changed, applied to the file as it is
    # now, so tags saved elsewhere while the dialog was open are kept.
    # Order: deletes, then renames, then new or edited text.
    @PromptServer.instance.routes.post("/mbnodes/prompt_tags/apply")
    async def _mbnodes_prompt_tags_apply(request):
        data = await request.json()
        delete = data.get("delete") or []
        rename = data.get("rename") or {}
        changed = data.get("set") or {}
        names = [*rename.values(), *changed.keys()]
        bad = [n for n in names if not isinstance(n, str) or not TAG_NAME.match(n)]
        bad += [k for k, v in changed.items() if not isinstance(v, str)]
        if bad:
            return web.json_response({"error": f"Invalid tag: {bad[0]}"}, status=400)

        tags = load_tags()
        for name in delete:
            tags.pop(name, None)
        for old, new in rename.items():
            if old in tags:
                tags[new] = tags.pop(old)
        tags.update(changed)
        write_tags(tags)
        return web.json_response({"tags": tags})

except Exception:  # server missing (unit runs) or routes already registered
    pass

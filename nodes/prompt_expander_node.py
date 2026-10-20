"""Prompt Expander (MB): sends a short prompt and a system prompt to a local
Ollama server and outputs the rewrite. The system prompt box is filled from a
preset — built in, or saved from the node into ExpanderPresets.json."""

import asyncio
import json
import logging
import os
import re
import urllib.error
import urllib.request

from comfy_api.latest import io

from .common import MAX_SEED

PACK_ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
PRESETS_FILE = os.path.join(PACK_ROOT, "ExpanderPresets.json")

DEFAULT_URL = "http://127.0.0.1:11434"
MAX_NAME = 64

BUILTIN_PRESETS = {
    "Detailed photo": (
        "You expand short image ideas into one detailed photographic prompt. Keep the subject and every detail "
        "the user gave. Add setting, lighting, lens and camera settings, composition, and surface texture. "
        "Write one paragraph of plain descriptive prose. Output only the prompt, no preamble or notes."
    ),
    "Cinematic still": (
        "You rewrite short ideas as a cinematic film still. Keep the subject and every detail the user gave. "
        "Describe shot type, framing, color grade, mood lighting, production design and atmosphere. "
        "Write one paragraph. Output only the prompt, no preamble or notes."
    ),
    "Fashion editorial": (
        "You expand short ideas into a fashion editorial photo prompt. Keep the subject and every detail the user "
        "gave. Describe the garment's fabric, cut and fit, the pose, styling, hair, makeup, accessories, backdrop "
        "and lighting setup. Write one paragraph. Output only the prompt, no preamble or notes."
    ),
    "Illustration": (
        "You turn short ideas into a digital illustration prompt. Keep the subject and every detail the user gave. "
        "Describe art style, linework, color palette, composition and rendering detail. "
        "Write one paragraph. Output only the prompt, no preamble or notes."
    ),
    "Image edit instruction": (
        "You rewrite a user's request as a clear instruction for an image editing model. State exactly what "
        "changes and what must stay the same (identity, pose, framing, background) unless the user asks otherwise. "
        "Use short direct sentences. Output only the instruction, no preamble or notes."
    ),
    "Video motion": (
        "You expand short ideas into a video generation prompt. Keep the subject and every detail the user gave. "
        "Describe the subject's action over time, camera movement, pacing, and motion in the environment, in "
        "present tense. Write one paragraph. Output only the prompt, no preamble or notes."
    ),
    "Tags (comma list)": (
        "You turn short ideas into a comma-separated list of image tags covering subject, clothing, pose, setting, "
        "lighting, camera and quality. Keep every detail the user gave. Output only the tags, no sentences."
    ),
    "System prompt creator": (
        "You write system prompts for a local LLM that rewrites short image or video ideas into generation prompts. "
        "The user describes the kind of expander they want (subject area, style, target model, output format). "
        "Write a system prompt addressed to the model as \"You\": state its job, what to keep from the user's idea, "
        "which details to add, the output format and length, and to output only the prompt with no preamble. "
        "Output only the system prompt, no title, notes or quotes."
    ),
}

THINK = re.compile(r"<think>.*?</think>", re.DOTALL)
PREAMBLE = re.compile(r"^(sure|here|okay|certainly)\b[^\n]*:\s*\n", re.IGNORECASE)


def load_custom():
    if not os.path.isfile(PRESETS_FILE):
        return {}
    try:
        with open(PRESETS_FILE, "r", encoding="utf-8") as f:
            data = json.load(f)
    except json.JSONDecodeError:
        logging.warning(f"[MBNodes] {PRESETS_FILE} is not valid JSON; ignoring saved presets.")
        return {}
    if not isinstance(data, dict):
        return {}
    return {k: v for k, v in data.items() if isinstance(v, str) and k not in BUILTIN_PRESETS}


def write_custom(presets):
    tmp = PRESETS_FILE + ".tmp"
    with open(tmp, "w", encoding="utf-8") as f:
        json.dump(dict(sorted(presets.items())), f, indent=2, ensure_ascii=False)
    os.replace(tmp, PRESETS_FILE)


def ollama(url, route, payload=None, timeout=300):
    data = json.dumps(payload).encode("utf-8") if payload is not None else None
    request = urllib.request.Request(url.rstrip("/") + route, data=data, headers={"Content-Type": "application/json"})
    try:
        with urllib.request.urlopen(request, timeout=timeout) as response:
            return json.loads(response.read().decode("utf-8"))
    except urllib.error.HTTPError as e:
        detail = e.read().decode("utf-8", errors="replace")
        try:
            detail = json.loads(detail).get("error", detail)
        except json.JSONDecodeError:
            pass
        raise RuntimeError(f"Ollama error: {detail}") from e
    except urllib.error.URLError as e:
        raise RuntimeError(f"Can't reach Ollama at {url}. Is it running? ({e.reason})") from e


def clean(text):
    text = PREAMBLE.sub("", THINK.sub("", text).strip()).strip()
    if len(text) > 1 and text[0] == text[-1] and text[0] in "\"'":
        text = text[1:-1].strip()
    return text


class MBPromptExpander(io.ComfyNode):
    """Pick a system prompt preset (or edit the box), then the prompt is
    rewritten by a local Ollama model when the graph runs."""

    @classmethod
    def define_schema(cls) -> io.Schema:
        # Re-read on every validation, so a preset saved from the node is valid at once.
        presets = list(BUILTIN_PRESETS) + list(load_custom())
        return io.Schema(
            node_id="MBPromptExpander",
            display_name="Prompt Expander (MB)",
            category="MBNodes",
            description="Expand a short prompt with a local Ollama model. System prompt presets are built in, and you can save your own.",
            search_aliases=["prompt expander", "prompt enhancer", "ollama", "llm", "expand prompt"],
            inputs=[
                io.String.Input("prompt", multiline=True, default=""),
                io.Combo.Input(
                    "preset",
                    options=presets,
                    default=presets[0],
                    socketless=True,
                    tooltip="Fills the system prompt box. The box is what gets sent, edits included.",
                ),
                io.String.Input("system_prompt", multiline=True, default=BUILTIN_PRESETS[presets[0]]),
                io.String.Input(
                    "preset_name",
                    default="",
                    socketless=True,
                    tooltip="Name the Save Preset button stores the system prompt under.",
                ),
                io.String.Input("url", default=DEFAULT_URL, socketless=True),
                io.String.Input("model", default="qwen3:8b", socketless=True, tooltip="Ollama model name. Pick Model lists the installed ones."),
                io.Float.Input("temperature", default=0.7, min=0.0, max=2.0, step=0.05),
                io.Int.Input("max_tokens", default=0, min=0, max=32768, step=16, tooltip="Cap on generated tokens. 0 = no limit."),
                io.Int.Input("seed", default=0, min=0, max=MAX_SEED, control_after_generate=True),
                io.Combo.Input(
                    "keep_alive",
                    options=["0", "5m", "30m", "-1"],
                    default="0",
                    tooltip="How long Ollama keeps the model loaded. 0 frees VRAM before sampling; -1 keeps it forever.",
                ),
            ],
            outputs=[io.String.Output("prompt")],
        )

    @classmethod
    def execute(cls, prompt, preset, system_prompt, preset_name, url, model, temperature, max_tokens, seed, keep_alive) -> io.NodeOutput:
        if not prompt.strip():
            return io.NodeOutput("")
        options = {"temperature": temperature, "seed": seed % 2**31}
        if max_tokens:
            options["num_predict"] = max_tokens
        result = ollama(url, "/api/generate", {
            "model": model.strip(),
            "prompt": prompt,
            "system": system_prompt,
            "stream": False,
            "think": False,
            "keep_alive": keep_alive if keep_alive in ("5m", "30m") else int(keep_alive),
            "options": options,
        })
        return io.NodeOutput(clean(result.get("response", "")))


NODES = [MBPromptExpander]


# ------------------------------------------------------------------- routes

try:
    from server import PromptServer
    from aiohttp import web

    @PromptServer.instance.routes.get("/mbnodes/expander_presets")
    async def _mbnodes_expander_presets(request):
        return web.json_response({"builtin": BUILTIN_PRESETS, "custom": load_custom()})

    @PromptServer.instance.routes.post("/mbnodes/expander_presets/save")
    async def _mbnodes_expander_presets_save(request):
        data = await request.json()
        name = (data.get("name") or "").strip()
        if not name or len(name) > MAX_NAME:
            return web.json_response({"error": f"Preset names need 1 to {MAX_NAME} characters."}, status=400)
        if name in BUILTIN_PRESETS:
            return web.json_response({"error": f"\"{name}\" is a built-in preset. Pick another name."}, status=400)

        presets = load_custom()
        if name in presets and not data.get("overwrite"):
            return web.json_response({"error": "exists", "name": name}, status=409)

        presets[name] = data.get("text") or ""
        write_custom(presets)
        return web.json_response({"name": name, "custom": presets})

    @PromptServer.instance.routes.post("/mbnodes/expander_presets/delete")
    async def _mbnodes_expander_presets_delete(request):
        name = (await request.json()).get("name") or ""
        presets = load_custom()
        if name not in presets:
            return web.json_response({"error": f"No custom preset named \"{name}\"."}, status=404)
        del presets[name]
        write_custom(presets)
        return web.json_response({"custom": presets})

    @PromptServer.instance.routes.get("/mbnodes/ollama_models")
    async def _mbnodes_ollama_models(request):
        url = request.query.get("url") or DEFAULT_URL
        try:
            data = await asyncio.to_thread(ollama, url, "/api/tags", None, 5)
        except RuntimeError as e:
            return web.json_response({"error": str(e)}, status=502)
        return web.json_response({"models": sorted(m["name"] for m in data.get("models", []))})

except Exception:  # server missing (unit runs) or routes already registered
    pass

"""Any number of LoRAs from one node, plus their trigger words.

The rows (on/off, file, strength, picked triggers) are drawn by
web/lora_stack_node.js and saved as a JSON list in the hidden `loras` widget.
Applying a row is core's LoraLoader path. Trigger words come from the Civitai
sidecars next to the file and the safetensors header; civitai.com is asked only
when the row's info popup opens and nothing local has any. That answer and the
user's own triggers are kept in a `.mbtriggers.json` sidecar next to the LoRA.
"""

import asyncio
import hashlib
import json
import os
import struct
import urllib.request

import comfy.sd
import comfy.utils
import folder_paths
from comfy_api.latest import io

CIVITAI_BY_HASH = "https://civitai.com/api/v1/model-versions/by-hash/"
TAG_COUNT = 3


def _read_json(path):
    if not os.path.isfile(path):
        return None
    try:
        with open(path, "r", encoding="utf-8") as f:
            return json.load(f)
    except (OSError, ValueError):
        return None


def _split_words(words):
    out = []
    for entry in words or []:
        out += [w.strip() for w in str(entry).split(",") if w.strip()]
    return out


def _header_metadata(path):
    if not path.lower().endswith(".safetensors"):
        return {}
    try:
        with open(path, "rb") as f:
            size = struct.unpack("<Q", f.read(8))[0]
            return json.loads(f.read(size)).get("__metadata__") or {}
    except (OSError, ValueError, struct.error):
        return {}


def _header_words(metadata):
    if not metadata:
        return []
    if metadata.get("modelspec.trigger_phrase"):
        return _split_words([metadata["modelspec.trigger_phrase"]])
    try:
        datasets = json.loads(metadata.get("ss_tag_frequency") or "{}")
    except ValueError:
        return []
    counts = {}
    for tags in datasets.values():
        for tag, n in tags.items():
            counts[tag.strip()] = counts.get(tag.strip(), 0) + n
    return [t for t in sorted(counts, key=counts.get, reverse=True) if t][:TAG_COUNT]


def _sha256(path):
    h = hashlib.sha256()
    with open(path, "rb") as f:
        for chunk in iter(lambda: f.read(1 << 20), b""):
            h.update(chunk)
    return h.hexdigest()


def _civitai_words(sha):
    try:
        with urllib.request.urlopen(CIVITAI_BY_HASH + sha, timeout=10) as r:
            return _split_words(json.load(r).get("trainedWords"))
    except (OSError, ValueError):
        return []


def _sidecar(path):
    return os.path.splitext(path)[0] + ".mbtriggers.json"


def _save_sidecar(path, data):
    with open(_sidecar(path), "w", encoding="utf-8") as f:
        json.dump(data, f, indent=2)


def lora_triggers(path, metadata=None, fetch=False):
    """(found, custom) trigger words. Only `fetch` may reach civitai.com."""
    stem = os.path.splitext(path)[0]
    info = _read_json(stem + ".civitai.info") or {}
    manager = _read_json(stem + ".metadata.json") or {}
    saved = _read_json(_sidecar(path)) or {}

    words = _split_words(info.get("trainedWords"))
    words = words or _split_words((manager.get("civitai") or {}).get("trainedWords") or manager.get("trainedWords"))
    words = words or _header_words(_header_metadata(path) if metadata is None else metadata)
    words = words or saved.get("civitai") or []

    if not words and fetch and "civitai" not in saved:
        sha = manager.get("sha256")
        for file in info.get("files", []):
            sha = sha or file.get("hashes", {}).get("SHA256")
        words = _civitai_words((sha or _sha256(path)).lower())
        saved["civitai"] = words
        _save_sidecar(path, saved)

    return list(dict.fromkeys(words)), saved.get("custom", [])


try:
    from server import PromptServer
    from aiohttp import web

    @PromptServer.instance.routes.get("/mbnodes/lora_triggers")
    async def _mbnodes_lora_triggers(request):
        path = folder_paths.get_full_path("loras", request.query.get("lora", ""))
        if not path:
            return web.json_response({"error": "LoRA not found"}, status=404)
        found, custom = await asyncio.to_thread(lora_triggers, path, None, True)
        return web.json_response({"triggers": found, "custom": custom})

    @PromptServer.instance.routes.post("/mbnodes/lora_triggers")
    async def _mbnodes_lora_triggers_save(request):
        data = await request.json()
        path = folder_paths.get_full_path("loras", data.get("lora") or "")
        if not path:
            return web.json_response({"error": "LoRA not found"}, status=404)
        saved = _read_json(_sidecar(path)) or {}
        saved["custom"] = list(dict.fromkeys(w.strip() for w in data.get("custom", []) if str(w).strip()))
        _save_sidecar(path, saved)
        return web.json_response({"custom": saved["custom"]})
except Exception:  # server missing (unit runs) or route already registered
    pass


class MBLoraStack(io.ComfyNode):
    """Apply a list of LoRAs and collect their trigger words."""

    @classmethod
    def define_schema(cls) -> io.Schema:
        return io.Schema(
            node_id="MBLoraStack",
            display_name="LoRA Stack (MB)",
            category="MBNodes",
            description="Applies any number of LoRAs, each with an on/off toggle and strength, and outputs the trigger words picked for them.",
            search_aliases=["lora", "lora stack", "lora loader", "multiple loras", "trigger words"],
            inputs=[
                io.Model.Input("model"),
                io.Clip.Input("clip", optional=True, tooltip="Leave empty to apply the LoRAs to the model only."),
                io.String.Input("loras", default="[]", tooltip="Rows edited on the node: JSON list of {on, lora, strength, triggers}."),
                io.String.Input("separator", default=", "),
            ],
            outputs=[
                io.Model.Output("model"),
                io.Clip.Output("clip"),
                io.String.Output("trigger_words"),
                io.String.Output("lora_info"),
            ],
        )

    @classmethod
    def execute(cls, model, loras, separator, clip=None) -> io.NodeOutput:
        words, info = [], []
        for row in json.loads(loras or "[]"):
            name, strength = row.get("lora"), float(row.get("strength", 1.0))
            if not row.get("on", True) or not name or strength == 0:
                continue
            path = folder_paths.get_full_path_or_raise("loras", name)
            lora, metadata = comfy.utils.load_torch_file(path, safe_load=True, return_metadata=True)
            model, clip = comfy.sd.load_lora_for_models(model, clip, lora, strength, strength if clip is not None else 0, lora_metadata=metadata)
            if row.get("triggers") is None:  # rows saved before triggers could be picked
                found, custom = lora_triggers(path, metadata)
                words += found + custom
            else:
                words += row["triggers"]
            info.append(f"{name} @ {strength:.2f}")

        return io.NodeOutput(model, clip, separator.join(dict.fromkeys(words)), "\n".join(info))


NODES = [MBLoraStack]

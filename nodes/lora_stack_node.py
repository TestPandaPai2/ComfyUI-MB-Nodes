"""Any number of LoRAs from one node, plus their trigger words.

The rows (on/off, file, strength) are drawn by web/lora_stack_node.js and saved
as a JSON list in the hidden `loras` widget. Applying a row is core's
LoraLoader path; trigger words come from the Civitai sidecars next to the file,
the safetensors header, and civitai.com only when online_lookup is on.
"""

import hashlib
import json
import os
import urllib.request

import comfy.sd
import comfy.utils
import folder_paths
from comfy_api.latest import io

CIVITAI_BY_HASH = "https://civitai.com/api/v1/model-versions/by-hash/"
TAG_COUNT = 3

# (path, mtime, online) -> trigger words. Strings only, so it stays tiny.
_triggers = {}


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


def trigger_words(path, metadata, online_lookup, allow_hashing):
    key = (path, os.path.getmtime(path), online_lookup, allow_hashing)
    if key in _triggers:
        return _triggers[key]

    stem = os.path.splitext(path)[0]
    info = _read_json(stem + ".civitai.info") or {}
    manager = _read_json(stem + ".metadata.json") or {}

    words = _split_words(info.get("trainedWords"))
    words = words or _split_words((manager.get("civitai") or {}).get("trainedWords") or manager.get("trainedWords"))
    words = words or _header_words(metadata)

    if not words and online_lookup:
        sha = manager.get("sha256")
        for file in info.get("files", []):
            sha = sha or file.get("hashes", {}).get("SHA256")
        if not sha and allow_hashing:
            sha = _sha256(path)
        if sha:
            words = _civitai_words(sha.lower())

    _triggers[key] = words
    return words


class MBLoraStack(io.ComfyNode):
    """Apply a list of LoRAs and collect their trigger words."""

    @classmethod
    def define_schema(cls) -> io.Schema:
        return io.Schema(
            node_id="MBLoraStack",
            display_name="LoRA Stack (MB)",
            category="MBNodes",
            description="Applies any number of LoRAs, each with an on/off toggle and strength, and outputs their trigger words.",
            search_aliases=["lora", "lora stack", "lora loader", "multiple loras", "trigger words"],
            inputs=[
                io.Model.Input("model"),
                io.Clip.Input("clip", optional=True, tooltip="Leave empty to apply the LoRAs to the model only."),
                io.String.Input("loras", default="[]", tooltip="Rows edited on the node: JSON list of {on, lora, strength}."),
                io.String.Input("separator", default=", "),
                io.Boolean.Input("online_lookup", default=False, advanced=True,
                                 tooltip="Ask civitai.com for trigger words when no local metadata has them."),
                io.Boolean.Input("allow_hashing", default=False, advanced=True,
                                 tooltip="Let the online lookup hash the file when no hash is known yet."),
            ],
            outputs=[
                io.Model.Output("model"),
                io.Clip.Output("clip"),
                io.String.Output("trigger_words"),
                io.String.Output("lora_info"),
            ],
        )

    @classmethod
    def execute(cls, model, loras, separator, online_lookup, allow_hashing, clip=None) -> io.NodeOutput:
        words, info = [], []
        for row in json.loads(loras or "[]"):
            name, strength = row.get("lora"), float(row.get("strength", 1.0))
            if not row.get("on", True) or not name or strength == 0:
                continue
            path = folder_paths.get_full_path_or_raise("loras", name)
            lora, metadata = comfy.utils.load_torch_file(path, safe_load=True, return_metadata=True)
            model, clip = comfy.sd.load_lora_for_models(model, clip, lora, strength, strength if clip is not None else 0, lora_metadata=metadata)
            words += trigger_words(path, metadata, online_lookup, allow_hashing)
            info.append(f"{name} @ {strength:.2f}")

        return io.NodeOutput(model, clip, separator.join(dict.fromkeys(words)), "\n".join(info))


NODES = [MBLoraStack]

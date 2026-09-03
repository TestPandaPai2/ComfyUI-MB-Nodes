"""Wildcard picker: choose a .txt from ComfyUI's wildcards folder, pull one
line out of it with a seed, and wrap that line in a prompt weight."""

import os

import folder_paths
from comfy_api.latest import io

MAX_SEED = 0xFFFFFFFFFFFFFFFF

WILDCARD_FOLDER = "wildcards"

# Register the folder so listing goes through folder_paths: recursive scan,
# mtime-checked caching and extra_model_paths.yaml overrides come for free.
if WILDCARD_FOLDER not in folder_paths.folder_names_and_paths:
    folder_paths.folder_names_and_paths[WILDCARD_FOLDER] = (
        [os.path.join(folder_paths.base_path, WILDCARD_FOLDER)],
        {".txt"},
    )


def wildcard_files():
    """Every wildcard .txt, relative to the wildcards folder."""
    try:
        return folder_paths.get_filename_list(WILDCARD_FOLDER)
    except Exception:
        return []


def read_items(name):
    """Non-blank, non-comment lines of one wildcard file."""
    path = folder_paths.get_full_path(WILDCARD_FOLDER, name) if name else None
    if not path:
        return []
    try:
        with open(path, "r", encoding="utf-8", errors="replace") as f:
            raw = f.read()
    except OSError:
        return []
    items = []
    for line in raw.splitlines():
        line = line.strip()
        if line and not line.startswith("#"):
            items.append(line)
    return items


def apply_weight(item, weight, mode):
    """A1111/Comfy prompt weight around an item. `auto` leaves a weight of 1
    unwrapped so an unweighted pick stays a plain string."""
    if not item or mode == "off":
        return item
    if mode == "auto" and abs(weight - 1.0) < 1e-6:
        return item
    escaped = item.replace("\\", "\\\\").replace("(", "\(").replace(")", "\)")
    return f"({escaped}:{weight:.2f})"


class MBWildcardSelect(io.ComfyNode):
    """Picks one item out of a wildcard file and weights it. `seed` is a
    KSampler-style seed widget mapped onto the item count via modulo, so any
    seed value always lands on a real item."""

    @classmethod
    def define_schema(cls) -> io.Schema:
        files = wildcard_files()
        return io.Schema(
            node_id="MBNodesWildcardSelect",
            display_name="Wildcard Select (MB)",
            category="MBNodes",
            description="Pick a random item from a wildcard file and apply a prompt weight.",
            search_aliases=["wildcard", "random prompt", "dynamic prompt", "weight"],
            inputs=[
                io.Combo.Input(
                    "wildcard",
                    options=files,
                    default=files[0] if files else None,
                    socketless=True,
                    tooltip="A .txt file from ComfyUI's wildcards folder.",
                ),
                io.Int.Input(
                    "seed",
                    default=0,
                    min=0,
                    max=MAX_SEED,
                    control_after_generate=True,
                    tooltip="Item index, wrapped to however many items the file has.",
                ),
                io.Float.Input(
                    "weight",
                    default=1.0,
                    min=0.0,
                    max=5.0,
                    step=0.05,
                    display_mode=io.NumberDisplay.slider,
                    tooltip="Prompt weight applied to the whole picked item.",
                ),
                io.Combo.Input(
                    "weight_format",
                    options=["auto", "always", "off"],
                    default="auto",
                    socketless=True,
                    tooltip="auto: skip the parentheses at weight 1.0. always: always wrap. off: never wrap.",
                ),
                io.Boolean.Input(
                    "bypass",
                    default=False,
                    tooltip="Output an empty string instead of the picked item.",
                ),
            ],
            outputs=[
                io.String.Output("string"),
                io.String.Output("raw"),
                io.Int.Output("item_number", display_name="item_number"),
                io.Int.Output("item_count", display_name="item_count"),
            ],
        )

    @classmethod
    def execute(cls, wildcard, seed, weight, weight_format, bypass) -> io.NodeOutput:
        if bypass:
            return io.NodeOutput("", "", 0, 0)

        items = read_items(wildcard)
        if not items:
            return io.NodeOutput("", "", 0, 0)

        index = seed % len(items)
        item = items[index]
        return io.NodeOutput(
            apply_weight(item, weight, weight_format), item, index + 1, len(items)
        )

    @classmethod
    def fingerprint_inputs(cls, wildcard, seed, weight, weight_format, bypass):
        # Editing the wildcard file has to re-run the node; a fixed seed with an
        # untouched file must still hit the cache.
        path = folder_paths.get_full_path(WILDCARD_FOLDER, wildcard) if wildcard else None
        try:
            mtime = os.path.getmtime(path) if path else 0
        except OSError:
            mtime = 0
        return f"{wildcard}|{seed}|{weight}|{weight_format}|{bypass}|{mtime}"


NODES = [MBWildcardSelect]

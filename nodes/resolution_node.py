import math

import torch

from comfy_api.latest import io

RATIOS = [
    ("1:1 (Square)", 1 / 1),
    ("2:3 (Portrait Photo)", 2 / 3),
    ("3:2 (Photo)", 3 / 2),
    ("3:4 (Portrait Standard)", 3 / 4),
    ("4:3 (Standard)", 4 / 3),
    ("9:16 (Portrait Widescreen)", 9 / 16),
    ("16:9 (Widescreen)", 16 / 9),
    ("21:9 (Ultrawide)", 21 / 9),
    ("9:19 (Tall Phone)", 9 / 19),
    ("1:2 (Tall)", 1 / 2),
    ("1:3 (Extra Tall)", 1 / 3),
]

STEPS = 7           # options offered per ratio
SNAP = 64           # every dimension is a multiple of this
MAX_SIDE = 1920     # Full HD long side
MIN_AREA = 0.26e6   # 512 x 512
MAX_AREA = 1920 * 1088
RATIO_TOLERANCE = 0.02  # max |ln(actual / nominal)| after snapping


def _snap(value):
    return max(SNAP, int(round(value / SNAP)) * SNAP)


def _candidates(ratio):
    """All snapped sizes for a ratio that stay inside the area window and keep
    the ratio within tolerance, ascending by pixel count."""
    pool = []
    # Step the long side, so ratios below 1 (portrait) are capped by height the
    # same way landscape ones are capped by width.
    for units in range(SNAP // 16, MAX_SIDE // SNAP + 1):
        long_side = units * SNAP
        if ratio >= 1:
            width, height = long_side, _snap(long_side / ratio)
        else:
            width, height = _snap(long_side * ratio), long_side
        area = width * height
        if not (MIN_AREA * 0.94 <= area <= MAX_AREA * 1.02):
            continue
        if abs(math.log((width / height) / ratio)) > RATIO_TOLERANCE:
            continue
        pool.append((area, width, height))
    pool.sort()
    return pool


def _pick_steps(pool):
    """STEPS sizes spread evenly on a log-area scale between the pool's ends."""
    smallest, largest = pool[0][0], pool[-1][0]
    picks = []
    for i in range(STEPS):
        target = smallest * (largest / smallest) ** (i / (STEPS - 1))
        remaining = [entry for entry in pool if entry not in picks]
        if not remaining:
            break
        picks.append(min(remaining, key=lambda e: abs(math.log(e[0] / target))))
    picks.sort()
    return picks


def build_table():
    """{ratio label: [dimension label, ...]}"""
    table = {}
    for name, ratio in RATIOS:
        pool = _candidates(ratio)
        table[name] = [f"{w} x {h}" for _, w, h in _pick_steps(pool)]
    return table


TABLE = build_table()

# The resolution widget declares every label from every ratio so that whatever
# the client picks passes backend validation; the web extension narrows the
# visible options to the ones belonging to the selected ratio.
ALL_RESOLUTIONS = list(dict.fromkeys(l for labels in TABLE.values() for l in labels))

DEFAULT_RATIO = RATIOS[0][0]
DEFAULT_RESOLUTION = "1024 x 1024"


class MBResolution(io.ComfyNode):
    """Aspect-ratio / resolution picker. Outputs width and height as INT,
    plus a matching empty latent."""

    @classmethod
    def define_schema(cls) -> io.Schema:
        return io.Schema(
            node_id="MBResolution",
            display_name="Resolution (MB)",
            category="MBNodes",
            description="Pick an aspect ratio and a resolution; outputs width, height and an empty latent.",
            search_aliases=["resolution", "aspect ratio", "empty latent"],
            inputs=[
                io.Combo.Input(
                    "aspect_ratio",
                    options=[name for name, _ in RATIOS],
                    default=DEFAULT_RATIO,
                    socketless=True,
                ),
                io.Combo.Input(
                    "resolution",
                    options=ALL_RESOLUTIONS,
                    default=DEFAULT_RESOLUTION,
                    socketless=True,
                ),
                io.Boolean.Input(
                    "portrait",
                    default=False,
                    label_on="portrait",
                    label_off="landscape",
                    tooltip="Swap width and height.",
                ),
                io.Int.Input("batch_size", default=1, min=1, max=4096),
            ],
            outputs=[
                io.Int.Output("width"),
                io.Int.Output("height"),
                io.Latent.Output("latent"),
                io.Int.Output("batch_size"),
            ],
        )

    @classmethod
    def execute(cls, aspect_ratio, resolution, portrait, batch_size) -> io.NodeOutput:
        width, height = (int(part) for part in resolution.split(" x "))
        if portrait:
            width, height = height, width

        latent = torch.zeros([batch_size, 4, height // 8, width // 8])
        return io.NodeOutput(width, height, {"samples": latent}, batch_size)


# Hand the table to the frontend so the button grid and the option filtering
# come from the same source as the validated widget values.
try:
    from server import PromptServer
    from aiohttp import web

    @PromptServer.instance.routes.get("/mbnodes/resolutions")
    async def _mbnodes_resolutions(request):
        return web.json_response({"ratios": [n for n, _ in RATIOS], "table": TABLE})
except Exception:  # server missing (unit runs) or route already registered
    pass


NODES = [MBResolution]

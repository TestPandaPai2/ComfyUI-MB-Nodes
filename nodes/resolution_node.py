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
    ("9:21 (Portrait Ultrawide)", 9 / 21),
    ("21:9 (Ultrawide)", 21 / 9),
    ("9:19 (Tall Phone)", 9 / 19),
    ("19:9 (Wide Phone)", 19 / 9),
    ("1:2 (Tall)", 1 / 2),
    ("2:1 (Wide)", 2 / 1),
    ("1:3 (Extra Tall)", 1 / 3),
    ("3:1 (Extra Wide)", 3 / 1),
]

TARGETS_MP = [0.25, 0.5, 0.75, 1.0, 1.25, 1.5, 1.75, 2.0, 3.0, 4.0]  # options offered per ratio


def _exact_size(megapixels, ratio):
    """Whole-pixel size for a target. multiple_of rounds it later, at output."""
    width = math.sqrt(megapixels * 1e6 * ratio)
    return round(width), round(width / ratio)


def build_table():
    """{ratio label: [dimension label, ...]}"""
    table = {}
    for name, ratio in RATIOS:
        sizes = (_exact_size(mp, ratio) for mp in TARGETS_MP)
        table[name] = [f"{w} x {h}" for w, h in sizes]
    return table


TABLE = build_table()

# The resolution widget declares every label from every ratio so that whatever
# the client picks passes backend validation; the web extension narrows the
# visible options to the ones belonging to the selected ratio.
ALL_RESOLUTIONS = list(dict.fromkeys(l for labels in TABLE.values() for l in labels))

DEFAULT_RATIO = RATIOS[0][0]
DEFAULT_RESOLUTION = "1000 x 1000"


class MBResolution(io.ComfyNode):
    """Aspect-ratio / resolution picker. Outputs width and height as INT,
    plus a matching empty latent."""

    @classmethod
    def define_schema(cls) -> io.Schema:
        return io.Schema(
            node_id="MBResolution",
            display_name="MB Resolution",
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
                    tooltip="Output orientation. The grid keeps it in step with the ratio; wired in, it forces the size to that orientation.",
                ),
                io.Int.Input("batch_size", default=1, min=1, max=4096),
                io.Combo.Input(
                    "multiple_of",
                    options=["8", "16", "32", "64", "128"],
                    default="64",
                    tooltip="Round width and height to the nearest multiple of this.",
                ),
            ],
            outputs=[
                io.Int.Output("width"),
                io.Int.Output("height"),
                io.Latent.Output("latent"),
                io.Int.Output("batch_size"),
            ],
        )

    @classmethod
    def execute(cls, aspect_ratio, resolution, portrait, batch_size, multiple_of) -> io.NodeOutput:
        width, height = (int(part) for part in resolution.split(" x "))
        if width != height and (height > width) != portrait:
            width, height = height, width
        step = int(multiple_of)
        width, height = (max(step, round(side / step) * step) for side in (width, height))

        latent = torch.zeros([batch_size, 4, height // 8, width // 8])
        return io.NodeOutput(width, height, {"samples": latent}, batch_size)


# Hand the table to the frontend so the button grid and the option filtering
# come from the same source as the validated widget values.
try:
    from server import PromptServer
    from aiohttp import web

    @PromptServer.instance.routes.get("/mbnodes/resolutions")
    async def _mbnodes_resolutions(request):
        return web.json_response({
            "ratios": [n for n, _ in RATIOS],
            # Numeric W/H per name, so the frontend never has to parse the
            # label back into a ratio and drift from this table.
            "values": {n: v for n, v in RATIOS},
            "table": TABLE,
        })
except Exception:  # server missing (unit runs) or route already registered
    pass


NODES = [MBResolution]

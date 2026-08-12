import math

import torch

RATIOS = [
    ("1:1", 1 / 1),
    ("5:4", 5 / 4),
    ("4:3", 4 / 3),
    ("3:2", 3 / 2),
    ("16:10", 16 / 10),
    ("16:9", 16 / 9),
    ("1.85:1", 1.85),
    ("2:1", 2 / 1),
    ("21:9", 21 / 9),
]

STEPS = 7           # options offered per ratio
SNAP = 64           # every dimension is a multiple of this
MAX_WIDTH = 1920    # Full HD long side
MIN_AREA = 0.26e6   # 512 x 512
MAX_AREA = 1920 * 1088
RATIO_TOLERANCE = 0.02  # max |ln(actual / nominal)| after snapping


def _snap(value):
    return max(SNAP, int(round(value / SNAP)) * SNAP)


def _candidates(ratio):
    """All snapped sizes for a ratio that stay inside the area window and keep
    the ratio within tolerance, ascending by pixel count."""
    pool = []
    for units in range(SNAP // 16, MAX_WIDTH // SNAP + 1):
        width = units * SNAP
        height = _snap(width / ratio)
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

DEFAULT_RATIO = "1:1"
DEFAULT_RESOLUTION = "1024 x 1024"


class MBResolution:
    """Aspect-ratio / resolution picker. Outputs width and height as INT,
    plus a matching empty latent."""

    @classmethod
    def INPUT_TYPES(cls):
        return {
            "required": {
                "aspect_ratio": ([name for name, _ in RATIOS], {"default": DEFAULT_RATIO}),
                "resolution": (ALL_RESOLUTIONS, {"default": DEFAULT_RESOLUTION}),
                "portrait": ("BOOLEAN", {"default": False}),
                "batch_size": ("INT", {"default": 1, "min": 1, "max": 4096}),
            },
        }

    RETURN_TYPES = ("INT", "INT", "LATENT", "INT")
    RETURN_NAMES = ("width", "height", "latent", "batch_size")
    FUNCTION = "run"
    CATEGORY = "MBNodes"

    def run(self, aspect_ratio, resolution, portrait, batch_size):
        width, height = (int(part) for part in resolution.split(" x "))
        if portrait:
            width, height = height, width

        latent = torch.zeros([batch_size, 4, height // 8, width // 8])
        return (width, height, {"samples": latent}, batch_size)


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


NODE_CLASS_MAPPINGS = {"MBResolution": MBResolution}
NODE_DISPLAY_NAME_MAPPINGS = {"MBResolution": "Resolution (MB)"}

import json
import os
import re

import numpy as np
from PIL import Image

import folder_paths
from comfy_api.latest import io

# Aspect presets. "free" leaves the box unconstrained, "source" locks it to the
# aspect of the incoming image. Everything else is a fixed w:h.
RATIOS = [
    "free", "source",
    "1:1", "4:3", "3:2", "16:10", "16:9", "1.85:1", "2:1", "21:9",
    "3:4", "2:3", "10:16", "9:16", "1:1.85", "1:2", "9:21",
]

CACHE_DIR_NAME = "MBNodesCache"  # shared with Save Image (MB)
SOURCE_MAX = 1024   # longest side of the copy the crop editor draws
SOURCE_QUALITY = 82
KEY_SAFE = re.compile(r"[^A-Za-z0-9_.-]")


def _cache_dir():
    path = os.path.join(folder_paths.get_output_directory(), CACHE_DIR_NAME)
    os.makedirs(path, exist_ok=True)
    return path


def _cache_key(workflow_id, node_id):
    """One cache slot per node per workflow, so a restart can find it again."""
    return KEY_SAFE.sub("_", f"crop_{workflow_id or 'default'}_{node_id or '0'}")


def _write_source_preview(image_tensor, key):
    """Downscaled copy of the *uncropped* input, kept in output/MBNodesCache so
    the editor has something to drag a box over — including after a restart. The
    sidecar carries the real size, which the downscale would otherwise lose."""
    array = np.clip(255.0 * image_tensor.cpu().numpy(), 0, 255).astype(np.uint8)
    pil = Image.fromarray(array).convert("RGB")
    full_width, full_height = pil.width, pil.height

    scale = min(1.0, SOURCE_MAX / max(pil.width, pil.height))
    if scale < 1.0:
        pil = pil.resize((max(1, int(pil.width * scale)), max(1, int(pil.height * scale))),
                         Image.LANCZOS)

    pil.save(os.path.join(_cache_dir(), f"{key}.webp"), quality=SOURCE_QUALITY)
    with open(os.path.join(_cache_dir(), f"{key}.json"), "w", encoding="utf-8") as f:
        json.dump({"width": full_width, "height": full_height}, f)


def crop_box(width, height, x, y, w, h):
    """Normalised crop rect -> integer pixel box clamped inside the image, never
    smaller than one pixel."""
    left = int(round(min(max(x, 0.0), 1.0) * width))
    top = int(round(min(max(y, 0.0), 1.0) * height))
    right = int(round(min(max(x + w, 0.0), 1.0) * width))
    bottom = int(round(min(max(y + h, 0.0), 1.0) * height))

    left = min(left, width - 1)
    top = min(top, height - 1)
    right = max(right, left + 1)
    bottom = max(bottom, top + 1)
    return left, top, right, bottom


class MBImageCrop(io.ComfyNode):
    """Crop an incoming image by dragging a box over it on the node, optionally
    locked to an aspect preset. The crop rect is stored as fractions of the
    image, so it survives a change of input resolution."""

    @classmethod
    def define_schema(cls) -> io.Schema:
        return io.Schema(
            node_id="MBImageCrop",
            display_name="Crop Image (MB)",
            category="MBNodes",
            description="Drag a crop box over the incoming image, with optional aspect presets.",
            search_aliases=["crop", "crop image", "aspect crop"],
            inputs=[
                io.Image.Input("image"),
                io.Combo.Input(
                    "aspect_ratio",
                    options=RATIOS,
                    default="free",
                    tooltip="free: drag any box. source: keep the input's aspect. Otherwise the box is locked to the chosen ratio.",
                ),
                # Driven by the editor widget, hidden from the node body by the
                # frontend. Fractions of the image so they stay valid whatever
                # resolution arrives.
                io.Float.Input("crop_x", default=0.0, min=0.0, max=1.0, step=0.0001, socketless=True),
                io.Float.Input("crop_y", default=0.0, min=0.0, max=1.0, step=0.0001, socketless=True),
                io.Float.Input("crop_width", default=1.0, min=0.0, max=1.0, step=0.0001, socketless=True),
                io.Float.Input("crop_height", default=1.0, min=0.0, max=1.0, step=0.0001, socketless=True),
            ],
            outputs=[
                io.Image.Output("image"),
                io.Int.Output("width"),
                io.Int.Output("height"),
            ],
            hidden=[io.Hidden.extra_pnginfo, io.Hidden.unique_id],
        )

    @classmethod
    def execute(cls, image, aspect_ratio, crop_x, crop_y, crop_width, crop_height) -> io.NodeOutput:
        hidden = cls.hidden
        workflow = ((hidden.extra_pnginfo if hidden else None) or {}).get("workflow") or {}
        key = _cache_key(workflow.get("id"), hidden.unique_id if hidden else None)
        try:
            _write_source_preview(image[0], key)
        except Exception as e:  # a failed preview must not fail the crop
            print(f"[MBNodes] crop source preview failed: {e}")

        height, width = image.shape[1], image.shape[2]
        left, top, right, bottom = crop_box(width, height, crop_x, crop_y, crop_width, crop_height)

        cropped = image[:, top:bottom, left:right, :]
        return io.NodeOutput(cropped, right - left, bottom - top)


# Lets the editor re-attach the cached source image after a restart, when the
# usual execution history is empty.
try:
    from server import PromptServer
    from aiohttp import web

    @PromptServer.instance.routes.get("/mbnodes/crop_source")
    async def _mbnodes_crop_source(request):
        key = _cache_key(request.query.get("workflow_id"), request.query.get("node_id"))
        filename = f"{key}.webp"
        if not os.path.isfile(os.path.join(_cache_dir(), filename)):
            return web.json_response({"image": None})

        size = {}
        try:
            with open(os.path.join(_cache_dir(), f"{key}.json"), encoding="utf-8") as f:
                size = json.load(f)
        except Exception:
            pass

        return web.json_response({
            "image": {"filename": filename, "subfolder": CACHE_DIR_NAME, "type": "output"},
            "width": size.get("width"),
            "height": size.get("height"),
        })
except Exception:  # server missing (unit runs) or route already registered
    pass


NODES = [MBImageCrop]

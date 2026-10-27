import hashlib
import io as _io
import os
import re
import string

import numpy as np
import torch
from PIL import Image, ImageOps

import comfy.utils
import node_helpers
from comfy_api.latest import io

from . import image_info
from .pad_image_node import _rgb

IMAGE_EXTENSIONS = {".png", ".jpg", ".jpeg", ".webp", ".bmp", ".gif", ".tif", ".tiff", ".jfif", ".avif"}
THUMB_SIZE = 192  # long side of the preview images handed to the frontend
RESIZE_MODES = ["list", "crop", "pad", "stretch"]


def _natural_key(name):
    """Sort "img2" before "img10"."""
    return [int(part) if part.isdigit() else part.lower() for part in re.split(r"(\d+)", name)]


def list_images(folder):
    """Image file names in `folder`, natural-sorted. Empty on a bad path."""
    if not folder or not os.path.isdir(folder):
        return []
    try:
        entries = os.listdir(folder)
    except OSError:
        return []
    names = [
        name for name in entries
        if os.path.splitext(name)[1].lower() in IMAGE_EXTENSIONS
        and os.path.isfile(os.path.join(folder, name))
    ]
    names.sort(key=_natural_key)
    return names


def parse_selection(text):
    """The selection widget holds one file name per line."""
    if not isinstance(text, str):
        return []
    return [line.strip() for line in text.splitlines() if line.strip()]


def chosen_files(folder, select_all, selection):
    """File names to load, always in folder order so the batch is deterministic."""
    available = list_images(folder)
    if select_all:
        return available
    picked = set(parse_selection(selection))
    return [name for name in available if name in picked]


def _load_rgb(path):
    img = node_helpers.pillow(Image.open, path)
    img = node_helpers.pillow(ImageOps.exif_transpose, img).convert("RGB")
    array = np.array(img).astype(np.float32) / 255.0
    return torch.from_numpy(array)[None,]


def _fit(tensor, width, height, mode, color):
    """Bring one [1, H, W, C] image to width x height so the batch stacks."""
    src_h, src_w = tensor.shape[1], tensor.shape[2]
    if (src_w, src_h) == (width, height):
        return tensor
    # common_upscale works on NCHW, the IMAGE type is NHWC.
    samples = tensor.movedim(-1, 1)
    if mode == "pad":
        scale = min(width / src_w, height / src_h)
        fit_w, fit_h = max(1, round(src_w * scale)), max(1, round(src_h * scale))
        samples = comfy.utils.common_upscale(samples, fit_w, fit_h, "lanczos", "disabled").clamp(0.0, 1.0)
        canvas = torch.tensor(color, dtype=samples.dtype, device=samples.device).view(1, 3, 1, 1).repeat(1, 1, height, width)
        top, left = (height - fit_h) // 2, (width - fit_w) // 2
        canvas[:, :, top:top + fit_h, left:left + fit_w] = samples
        return canvas.movedim(1, -1)
    # "center" crops to the target aspect before scaling, so nothing is distorted.
    crop = "center" if mode == "crop" else "disabled"
    samples = comfy.utils.common_upscale(samples, width, height, "lanczos", crop)
    return samples.movedim(1, -1).clamp(0.0, 1.0)


class MBLoadImagesFromFolder(io.ComfyNode):
    """Load every image in a folder, or a hand-picked subset of it. In list mode
    each image keeps its own size; the other modes bring every image to the
    largest one's size so they stack into one batch."""

    @classmethod
    def define_schema(cls) -> io.Schema:
        return io.Schema(
            node_id="MBLoadImagesFromFolder",
            display_name="Load Images from Folder (MB)",
            category="MBNodes",
            description="Load all images in a local folder, or a selection of them, as one image batch.",
            search_aliases=["load images", "folder", "batch load", "image folder"],
            inputs=[
                io.String.Input(
                    "folder",
                    default="",
                    tooltip="Absolute path of the folder to read images from.",
                ),
                io.Boolean.Input(
                    "select_all",
                    default=True,
                    label_on="all",
                    label_off="custom",
                    tooltip="Load every image in the folder, or only the ones clicked in the preview.",
                ),
                io.String.Input(
                    "selection",
                    default="",
                    multiline=True,
                    tooltip="File names to load, one per line. Managed by the preview grid.",
                ),
                io.Combo.Input(
                    "resize_mode",
                    options=RESIZE_MODES,
                    default="list",
                    tooltip="list: every image at its own size, downstream nodes run once per image. "
                            "crop / pad / stretch: one batch at the largest image's size, by center crop, "
                            "letterbox or distortion.",
                ),
                io.Color.Input("pad_color", default="#000000", tooltip="Border colour in pad mode."),
            ],
            outputs=[
                # Lists in every mode: list mode emits one entry per image, the
                # batch modes a single batch, which downstream reads as usual.
                io.Image.Output("images", is_output_list=True),
                image_info.ImageInfo.Output("image_info", is_output_list=True),
            ],
        )

    @classmethod
    def validate_inputs(cls, folder, select_all, selection, resize_mode, pad_color) -> bool | str:
        if not folder:
            return "No folder set."
        if not os.path.isdir(folder):
            return f"Not a folder: {folder}"
        return True

    @classmethod
    def fingerprint_inputs(cls, folder, select_all, selection, resize_mode, pad_color) -> str:
        hasher = hashlib.sha256()
        hasher.update(f"{folder}|{select_all}|{selection}".encode("utf-8"))
        # Names plus mtimes: re-runs pick up edited or replaced files without
        # reading every byte of a large folder.
        for name in chosen_files(folder, select_all, selection):
            path = os.path.join(folder, name)
            try:
                hasher.update(f"{name}|{os.path.getmtime(path)}".encode("utf-8"))
            except OSError:
                hasher.update(f"{name}|missing".encode("utf-8"))
        return hasher.hexdigest()

    @classmethod
    def execute(cls, folder, select_all, selection, resize_mode, pad_color) -> io.NodeOutput:
        names = chosen_files(folder, select_all, selection)
        if not names:
            raise ValueError(
                f"No images to load from {folder!r}."
                if select_all else
                "No images selected. Pick some in the preview or switch to 'all'."
            )

        images = [_load_rgb(os.path.join(folder, name)) for name in names]
        if resize_mode == "list":
            infos = [image_info.make(image, None, name) for image, name in zip(images, names)]
            return io.NodeOutput(images, infos)

        largest = max(images, key=lambda t: t.shape[1] * t.shape[2])
        height, width = largest.shape[1], largest.shape[2]
        color = _rgb(pad_color)
        batch = torch.cat([_fit(image, width, height, resize_mode, color) for image in images], dim=0)
        # One name per loaded file; `filename` is the first, matching the batch
        # order the images arrive in.
        return io.NodeOutput(
            [batch], [image_info.make(batch, None, names[0], filenames=names)]
        )


def _drives():
    """Roots to start the folder browser from."""
    if os.name != "nt":
        return ["/"]
    return [f"{letter}:\\" for letter in string.ascii_uppercase if os.path.exists(f"{letter}:\\")]


def _subdirectories(folder):
    try:
        names = [n for n in os.listdir(folder) if os.path.isdir(os.path.join(folder, n))]
    except OSError:
        return []
    names.sort(key=_natural_key)
    return names


# Routes backing the frontend: a folder browser, an image listing and thumbnails.
# Only directory names and images are ever handed back, and thumbnails are
# re-encoded rather than the original file being streamed.
try:
    from server import PromptServer
    from aiohttp import web

    @PromptServer.instance.routes.get("/mbnodes/folder/browse")
    async def _mbnodes_folder_browse(request):
        path = request.query.get("path", "")
        if not path:
            return web.json_response({"path": "", "parent": None, "dirs": [], "drives": _drives()})

        path = os.path.abspath(path)
        if not os.path.isdir(path):
            return web.json_response({"error": "not a folder", "path": path, "drives": _drives()}, status=404)

        parent = os.path.dirname(path.rstrip("\\/"))
        return web.json_response({
            "path": path,
            "parent": parent if parent and parent != path else None,
            "dirs": _subdirectories(path),
            "drives": _drives(),
            "images": len(list_images(path)),
        })

    @PromptServer.instance.routes.get("/mbnodes/folder/list")
    async def _mbnodes_folder_list(request):
        path = request.query.get("path", "")
        if not path or not os.path.isdir(path):
            return web.json_response({"path": path, "files": []})
        return web.json_response({"path": os.path.abspath(path), "files": list_images(path)})

    @PromptServer.instance.routes.get("/mbnodes/folder/thumb")
    async def _mbnodes_folder_thumb(request):
        folder = request.query.get("path", "")
        name = request.query.get("name", "")
        # Only a bare file name is accepted, so the folder cannot be escaped.
        if not folder or not name or name != os.path.basename(name):
            return web.Response(status=400)
        if os.path.splitext(name)[1].lower() not in IMAGE_EXTENSIONS:
            return web.Response(status=400)

        path = os.path.join(folder, name)
        if not os.path.isfile(path):
            return web.Response(status=404)

        # The thumbnail only changes when the file does, so the browser's cached
        # copy is confirmed without re-encoding it.
        stat = os.stat(path)
        etag = f'"{stat.st_mtime_ns:x}-{stat.st_size:x}-{THUMB_SIZE}"'
        headers = {"Cache-Control": "no-cache", "ETag": etag}
        if request.headers.get("If-None-Match") == etag:
            return web.Response(status=304, headers=headers)

        try:
            img = node_helpers.pillow(Image.open, path)
            img = node_helpers.pillow(ImageOps.exif_transpose, img).convert("RGB")
            img.thumbnail((THUMB_SIZE, THUMB_SIZE))
            buffer = _io.BytesIO()
            img.save(buffer, format="JPEG", quality=80)
        except Exception:
            return web.Response(status=415)

        return web.Response(
            body=buffer.getvalue(),
            content_type="image/jpeg",
            headers=headers,
        )
except Exception:  # server missing (unit runs) or routes already registered
    pass


NODES = [MBLoadImagesFromFolder]

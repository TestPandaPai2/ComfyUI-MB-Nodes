import json
import os
import re

import numpy as np
from PIL import Image
from PIL.PngImagePlugin import PngInfo

import folder_paths
from comfy.cli_args import args
from comfy_api.latest import io, ui

FORMATS = ["png", "jpg", "webp"]
CACHE_DIR_NAME = "MBNodesCache"  # lives inside the ComfyUI output folder
CACHE_SCALE = 0.5
CACHE_QUALITY = 80
KEY_SAFE = re.compile(r"[^A-Za-z0-9_.-]")

FORMAT_TOOLTIP = (
    "png: lossless, keeps alpha, embeds the prompt/workflow — biggest files.\n"
    "jpg: smallest files, no alpha and no embedded workflow — good for sharing.\n"
    "webp: close to png quality at a fraction of the size, alpha supported, "
    "workflow stored in EXIF; lossless mode available."
)


def _cache_dir():
    path = os.path.join(folder_paths.get_output_directory(), CACHE_DIR_NAME)
    os.makedirs(path, exist_ok=True)
    return path


def _cache_key(workflow_id, node_id):
    """One cache slot per node per workflow, so a restart can find it again."""
    return KEY_SAFE.sub("_", f"{workflow_id or 'default'}_{node_id or '0'}")


def _to_pil(image_tensor):
    array = np.clip(255.0 * image_tensor.cpu().numpy(), 0, 255).astype(np.uint8)
    return Image.fromarray(array)


def _png_metadata(cls):
    if args.disable_metadata or not cls.hidden:
        return None
    metadata = PngInfo()
    if cls.hidden.prompt:
        metadata.add_text("prompt", json.dumps(cls.hidden.prompt))
    for key, value in (cls.hidden.extra_pnginfo or {}).items():
        metadata.add_text(key, json.dumps(value))
    return metadata


def _webp_exif(pil_image, cls):
    exif = pil_image.getexif()
    if args.disable_metadata or not cls.hidden:
        return exif
    if cls.hidden.prompt is not None:
        exif[0x0110] = "prompt:{}".format(json.dumps(cls.hidden.prompt))  # Model
    tag = 0x010F  # Make, walking backwards for each extra entry
    for key, value in (cls.hidden.extra_pnginfo or {}).items():
        exif[tag] = "{}:{}".format(key, json.dumps(value))
        tag -= 1
    return exif


def _save_one(pil_image, path, fmt, quality, png_compress_level, webp_lossless, cls):
    if fmt == "png":
        pil_image.save(path, pnginfo=_png_metadata(cls), compress_level=png_compress_level)
    elif fmt == "jpg":
        pil_image.convert("RGB").save(path, quality=quality, optimize=True)
    else:
        pil_image.save(
            path, exif=_webp_exif(pil_image, cls), quality=quality, lossless=webp_lossless
        )


def _write_cache_preview(image_tensor, key):
    """Half-size webp copy kept in output/MBNodesCache so the node can show a
    preview again after a restart, whatever the real save path was."""
    pil = _to_pil(image_tensor)
    width = max(1, int(pil.width * CACHE_SCALE))
    height = max(1, int(pil.height * CACHE_SCALE))
    pil = pil.convert("RGB").resize((width, height), Image.LANCZOS)

    filename = f"{key}.webp"
    pil.save(os.path.join(_cache_dir(), filename), quality=CACHE_QUALITY)
    return ui.SavedResult(filename, CACHE_DIR_NAME, io.FolderType.output)


class MBSaveImage(io.ComfyNode):
    """Save images as png/jpg/webp to the output folder or any folder you point
    it at, or run in preview-only mode with a restart-proof cached preview."""

    @classmethod
    def define_schema(cls) -> io.Schema:
        return io.Schema(
            node_id="MBSaveImage",
            display_name="Save Image (MB)",
            category="MBNodes",
            description="Save or preview images with a format picker and a custom output folder.",
            search_aliases=["save image", "preview image", "export image"],
            is_output_node=True,
            inputs=[
                io.Image.Input("images"),
                io.Combo.Input(
                    "mode",
                    options=["save", "preview"],
                    default="save",
                    tooltip="save: write the image to disk. preview: show it only, nothing is written to the save folder.",
                ),
                io.Combo.Input("format", options=FORMATS, default="png", tooltip=FORMAT_TOOLTIP),
                io.String.Input("filename_prefix", default="MBNodes", socketless=True),
                io.String.Input(
                    "output_folder",
                    default="",
                    socketless=True,
                    tooltip="Blank = the ComfyUI output folder. Otherwise an absolute path, or a path relative to the output folder.",
                ),
                io.Int.Input(
                    "quality",
                    default=90,
                    min=1,
                    max=100,
                    tooltip="jpg/webp only. 100 is near-lossless.",
                ),
                io.Int.Input(
                    "png_compress_level",
                    default=4,
                    min=0,
                    max=9,
                    tooltip="png only. Higher is smaller but slower; the image is lossless either way.",
                ),
                io.Boolean.Input(
                    "webp_lossless",
                    default=False,
                    tooltip="webp only. Ignores quality and stores the image losslessly.",
                ),
            ],
            outputs=[],
            hidden=[io.Hidden.prompt, io.Hidden.extra_pnginfo, io.Hidden.unique_id],
        )

    @classmethod
    def validate_inputs(cls, **kwargs) -> bool | str:
        folder = (kwargs.get("output_folder") or "").strip()
        if folder and os.path.isabs(folder) and os.path.isfile(folder):
            return f"output_folder is a file, not a folder: {folder}"
        return True

    @classmethod
    def _resolve_folder(cls, output_folder):
        folder = (output_folder or "").strip()
        if not folder:
            return folder_paths.get_output_directory()
        if not os.path.isabs(folder):
            folder = os.path.join(folder_paths.get_output_directory(), folder)
        os.makedirs(folder, exist_ok=True)
        return folder

    @classmethod
    def execute(
        cls, images, mode, format, filename_prefix, output_folder, quality,
        png_compress_level, webp_lossless,
    ) -> io.NodeOutput:
        workflow = (cls.hidden.extra_pnginfo or {}).get("workflow") or {}
        key = _cache_key(workflow.get("id"), cls.hidden.unique_id)

        # The cached preview is written in both modes: it is what the node shows
        # after a restart, and the only previewable copy when saving elsewhere.
        preview = _write_cache_preview(images[0], key)

        if mode == "preview":
            return io.NodeOutput(ui=ui.SavedImages([preview]))

        base_dir = cls._resolve_folder(output_folder)
        full_folder, filename, counter, _subfolder, _prefix = folder_paths.get_save_image_path(
            filename_prefix, base_dir, images[0].shape[1], images[0].shape[0]
        )

        for batch_number, image_tensor in enumerate(images):
            pil = _to_pil(image_tensor)
            name = filename.replace("%batch_num%", str(batch_number))
            path = os.path.join(full_folder, f"{name}_{counter:05}_.{format}")
            _save_one(pil, path, format, quality, png_compress_level, webp_lossless, cls)
            counter += 1

        return io.NodeOutput(ui=ui.SavedImages([preview]))


# Lets the frontend re-attach a node's cached preview after a restart, when no
# execution has happened yet and the usual output history is empty.
try:
    from server import PromptServer
    from aiohttp import web

    @PromptServer.instance.routes.get("/mbnodes/preview_cache")
    async def _mbnodes_preview_cache(request):
        key = _cache_key(request.query.get("workflow_id"), request.query.get("node_id"))
        filename = f"{key}.webp"
        if not os.path.isfile(os.path.join(_cache_dir(), filename)):
            return web.json_response({"images": []})
        return web.json_response(
            {"images": [{"filename": filename, "subfolder": CACHE_DIR_NAME, "type": "output"}]}
        )
except Exception:  # server missing (unit runs) or route already registered
    pass


NODE_CLASS_MAPPINGS = {"MBSaveImage": MBSaveImage}
NODE_DISPLAY_NAME_MAPPINGS = {"MBSaveImage": "Save Image (MB)"}

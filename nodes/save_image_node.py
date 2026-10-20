import asyncio
import io as _io
import json
import os
import re

import numpy as np
from PIL import Image, features
from PIL.PngImagePlugin import PngInfo

import folder_paths
from comfy.cli_args import args
from comfy_api.latest import io, ui

from . import image_info

FORMATS = ["png", "jpg", "webp", "avif"]
CACHE_DIR_NAME = "MBNodesCache"  # lives inside the ComfyUI output folder
KEY_SAFE = re.compile(r"[^A-Za-z0-9_.-]")

# Per-format quality and the lossless switch (webp; avif has none in Pillow).
# png is lossless whatever the preset, so presets only push it to max effort.
PRESETS = {
    "lossless": ({"jpg": 100, "webp": 100, "avif": 100}, True),
    "visually_lossless": ({"jpg": 95, "webp": 95, "avif": 90}, False),
    "balanced": ({"jpg": 88, "webp": 85, "avif": 75}, False),
    "small": ({"jpg": 78, "webp": 75, "avif": 60}, False),
}
PRESET_NAMES = ["custom", *PRESETS]

FORMAT_TOOLTIP = (
    "png: lossless, keeps alpha, embeds the prompt/workflow — biggest files.\n"
    "jpg: small files, no alpha and no embedded workflow — good for sharing.\n"
    "webp: close to png quality at a fraction of the size, alpha supported, "
    "workflow stored in EXIF; lossless mode available.\n"
    "avif: smallest at the same visual quality, alpha supported, workflow stored in EXIF."
)
PRESET_TOOLTIP = (
    "custom: use the quality / png_compress_level / webp_lossless widgets.\n"
    "lossless: no loss for png/webp; jpg q100 and avif q100 4:4:4 are as close as those formats get.\n"
    "visually_lossless: no visible difference, much smaller (jpg 95, webp 95, avif 90).\n"
    "balanced: tiny artifacts on close inspection (jpg 88, webp 85, avif 75).\n"
    "small: smallest files, artifacts visible when zoomed (jpg 78, webp 75, avif 60)."
)


def _cache_dir():
    path = os.path.join(folder_paths.get_output_directory(), CACHE_DIR_NAME)
    os.makedirs(path, exist_ok=True)
    return path


def _cache_key(workflow_id, node_id):
    """One cache slot per node per workflow, so a restart can find it again."""
    return KEY_SAFE.sub("_", f"{workflow_id or 'default'}_{node_id or '0'}")


def _to_pil(image_tensor, mask_tensor=None):
    """RGB, or RGBA when a mask is supplied. The mask is inverted on the way in:
    1 means masked/transparent, which is 0 in an alpha channel."""
    array = np.clip(255.0 * image_tensor.cpu().numpy(), 0, 255).astype(np.uint8)
    pil = Image.fromarray(array)
    if mask_tensor is None:
        return pil

    alpha = np.clip(255.0 * (1.0 - mask_tensor.cpu().numpy()), 0, 255).astype(np.uint8)
    pil = pil.convert("RGBA")
    pil.putalpha(Image.fromarray(alpha, "L"))
    return pil


def _png_metadata(cls):
    if args.disable_metadata or cls is None or not cls.hidden:
        return None
    metadata = PngInfo()
    if cls.hidden.prompt:
        metadata.add_text("prompt", json.dumps(cls.hidden.prompt))
    for key, value in (cls.hidden.extra_pnginfo or {}).items():
        metadata.add_text(key, json.dumps(value))
    return metadata


def _exif(pil_image, cls):
    exif = pil_image.getexif()
    if args.disable_metadata or cls is None or not cls.hidden:
        return exif
    if cls.hidden.prompt is not None:
        exif[0x0110] = "prompt:{}".format(json.dumps(cls.hidden.prompt))  # Model
    tag = 0x010F  # Make, walking backwards for each extra entry
    for key, value in (cls.hidden.extra_pnginfo or {}).items():
        exif[tag] = "{}:{}".format(key, json.dumps(value))
        tag -= 1
    return exif


def _params(fmt, preset, quality, png_compress_level, webp_lossless):
    """(quality, png compress level, lossless) for this format and preset."""
    if preset == "custom":
        return quality, png_compress_level, webp_lossless
    qualities, lossless = PRESETS[preset]
    return qualities.get(fmt, 100), 9, lossless


def _encode(pil_image, fmt, quality, compress_level, lossless, cls=None):
    """Encoded file bytes. `cls` carries the prompt/workflow metadata; leave it
    out for preview-only encodes."""
    buffer = _io.BytesIO()
    if fmt == "png":
        pil_image.save(
            buffer, "PNG", pnginfo=_png_metadata(cls), compress_level=compress_level, optimize=compress_level == 9
        )
    elif fmt == "jpg":
        # Full chroma at the top qualities, where 4:2:0 color smearing would be the visible loss.
        pil_image.convert("RGB").save(
            buffer, "JPEG", quality=quality, optimize=True, subsampling=0 if quality >= 95 else -1
        )
    elif fmt == "webp":
        pil_image.save(buffer, "WEBP", exif=_exif(pil_image, cls), quality=quality, lossless=lossless, method=6)
    else:
        pil_image.save(
            buffer, "AVIF", exif=_exif(pil_image, cls), quality=quality,
            subsampling="4:4:4" if lossless or quality >= 90 else "4:2:0",
        )
    return buffer.getvalue()


# The cache holds, per node: the encoded previews, a lossless png source of each
# image for live re-encodes, the compare previews, and a manifest listing them.
def _manifest_path(key):
    return os.path.join(_cache_dir(), f"{key}.json")


def _read_manifest(key):
    try:
        with open(_manifest_path(key), encoding="utf-8") as f:
            return json.load(f)
    except (FileNotFoundError, json.JSONDecodeError):
        return None


def _write_file(name, data):
    with open(os.path.join(_cache_dir(), name), "wb") as f:
        f.write(data)


def _remove_files(names):
    for name in names:
        try:
            os.remove(os.path.join(_cache_dir(), name))
        except FileNotFoundError:
            pass


def _write_previews(key, manifest, fmt, encoded):
    _remove_files(manifest.get("images", []))
    manifest["images"] = [f"{key}.{index}.{fmt}" for index in range(len(encoded))]
    for name, data in zip(manifest["images"], encoded):
        _write_file(name, data)
    manifest["stats"] = [
        {"format": fmt, "bytes": len(data), "png_bytes": size}
        for data, size in zip(encoded, manifest["png_bytes"])
    ]
    with open(_manifest_path(key), "w", encoding="utf-8") as f:
        json.dump(manifest, f)
    return manifest


def _cache_run(key, fmt, encoded, sources, compare):
    old = _read_manifest(key)
    if old:
        _remove_files(old["images"] + old["sources"] + old["compare"])

    manifest = {
        "sources": [f"{key}.src.{index}.png" for index in range(len(sources))],
        "compare": [f"{key}.cmp.{index}.webp" for index in range(len(compare))],
        "png_bytes": [len(data) for data in sources],
    }
    for name, data in zip(manifest["sources"] + manifest["compare"], sources + compare):
        _write_file(name, data)
    return _write_previews(key, manifest, fmt, encoded)


def _reencode(key, fmt, quality, compress_level, lossless):
    manifest = _read_manifest(key)
    if not manifest:
        return None
    encoded = []
    for name in manifest["sources"]:
        with Image.open(os.path.join(_cache_dir(), name)) as source:
            encoded.append(_encode(source, fmt, quality, compress_level, lossless))
    return _write_previews(key, manifest, fmt, encoded)


def _ui(manifest):
    """The node's ui payload. With a compare image the previews go under mb_
    keys, so the stock preview stays out of the way of the compare slider."""
    def results(names):
        return [ui.SavedResult(name, CACHE_DIR_NAME, io.FolderType.output) for name in names]

    if manifest["compare"]:
        return {
            "mb_images": results(manifest["images"]),
            "mb_compare_images": results(manifest["compare"]),
            "mb_stats": manifest["stats"],
        }
    return {"images": results(manifest["images"]), "mb_stats": manifest["stats"]}


class MBSaveImage(io.ComfyNode):
    """Save images as png/jpg/webp/avif to the output folder or any folder you
    point it at, or run in preview-only mode with a restart-proof cached preview.
    An optional compare image turns the preview into a before/after slider."""

    @classmethod
    def define_schema(cls) -> io.Schema:
        return io.Schema(
            node_id="MBSaveImage",
            display_name="Save Image (MB)",
            category="MBNodes",
            description="Save, preview or compare images with a format picker, quality presets and a custom output folder.",
            search_aliases=["save image", "preview image", "export image", "compare image", "avif"],
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
                    tooltip="jpg/webp/avif, custom preset only. 100 is near-lossless.",
                ),
                io.Int.Input(
                    "png_compress_level",
                    default=4,
                    min=0,
                    max=9,
                    tooltip="png, custom preset only. Higher is smaller but slower; the image is lossless either way.",
                ),
                io.Boolean.Input(
                    "webp_lossless",
                    default=False,
                    tooltip="webp, custom preset only. Ignores quality and stores the image losslessly.",
                ),
                io.Mask.Input(
                    "mask",
                    optional=True,
                    tooltip="Written into the alpha channel for png, webp and avif, and carried on the image_info output. jpg has no alpha, so it is ignored there.",
                ),
                io.Combo.Input("preset", options=PRESET_NAMES, default="custom", tooltip=PRESET_TOOLTIP),
                io.Image.Input(
                    "compare_image",
                    optional=True,
                    tooltip="Before image for the compare slider. Only shown, never saved. Paired by batch index.",
                ),
            ],
            outputs=[
                io.Image.Output("images"),
                image_info.ImageInfo.Output("image_info"),
            ],
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
        png_compress_level, webp_lossless, mask=None, preset="custom", compare_image=None,
    ) -> io.NodeOutput:
        if format == "avif" and not features.check("avif"):
            raise RuntimeError("This Pillow build has no AVIF support. Update Pillow (11.3+) or pick another format.")

        hidden = cls.hidden
        workflow = ((hidden.extra_pnginfo if hidden else None) or {}).get("workflow") or {}
        key = _cache_key(workflow.get("id"), hidden.unique_id if hidden else None)

        # The mask always reaches the cached source, so a live switch from jpg to
        # png/webp/avif still shows it; the jpg encoder drops it.
        fitted = image_info.fit_mask(mask, images)
        pils = [_to_pil(image, fitted[i] if fitted is not None else None) for i, image in enumerate(images)]
        params = _params(format, preset, quality, png_compress_level, webp_lossless)
        encoded = [_encode(pil, format, *params, cls) for pil in pils]
        # The lossless sources double as the png baseline for the size badge.
        sources = encoded if format == "png" else [_encode(pil, "png", 0, 6, False) for pil in pils]
        compare = []
        if compare_image is not None:
            compare = [
                _encode(_to_pil(compare_image[i % len(compare_image)]), "webp", 95, 0, False)
                for i in range(len(images))
            ]

        # The cached previews are written in both modes: they are what the node
        # shows after a restart, and the only previewable copies when saving elsewhere.
        node_ui = _ui(_cache_run(key, format, encoded, sources, compare))

        if mode == "preview":
            # Nothing was written, so image_info reports no filename.
            return io.NodeOutput(images, image_info.make(images, mask, ""), ui=node_ui)

        base_dir = cls._resolve_folder(output_folder)
        full_folder, filename, counter, _subfolder, _prefix = folder_paths.get_save_image_path(
            filename_prefix, base_dir, images[0].shape[1], images[0].shape[0]
        )

        paths = []
        for batch_number, data in enumerate(encoded):
            name = filename.replace("%batch_num%", str(batch_number))
            path = os.path.join(full_folder, f"{name}_{counter:05}_.{format}")
            with open(path, "wb") as f:
                f.write(data)
            paths.append(path)
            counter += 1

        # `filename` is the first written, which is what the counter names the
        # run by; `filenames` keeps the rest of a batch.
        return io.NodeOutput(
            images,
            image_info.make(images, mask, paths[0] if paths else "", filenames=paths),
            ui=node_ui,
        )


try:
    from server import PromptServer
    from aiohttp import web

    # Lets the frontend re-attach a node's cached preview after a restart, when no
    # execution has happened yet and the usual output history is empty.
    @PromptServer.instance.routes.get("/mbnodes/preview_cache")
    async def _mbnodes_preview_cache(request):
        manifest = _read_manifest(_cache_key(request.query.get("workflow_id"), request.query.get("node_id")))
        return web.json_response(_ui(manifest) if manifest else {})

    # Live preview: re-encodes the cached sources with new format/preset settings
    # without running the workflow. Only the cache is written, never the save folder.
    @PromptServer.instance.routes.post("/mbnodes/save_image/reencode")
    async def _mbnodes_reencode(request):
        data = await request.json()
        fmt, preset = data.get("format"), data.get("preset")
        if fmt not in FORMATS or preset not in PRESET_NAMES:
            return web.json_response({"error": "unknown format or preset"}, status=400)
        if fmt == "avif" and not features.check("avif"):
            return web.json_response({"error": "Pillow has no AVIF support"}, status=400)

        params = _params(
            fmt, preset,
            min(100, max(1, int(data.get("quality", 90)))),
            min(9, max(0, int(data.get("png_compress_level", 4)))),
            bool(data.get("webp_lossless", False)),
        )
        key = _cache_key(data.get("workflow_id"), data.get("node_id"))
        manifest = await asyncio.get_running_loop().run_in_executor(None, _reencode, key, fmt, *params)
        return web.json_response(_ui(manifest) if manifest else {})
except Exception:  # server missing (unit runs) or route already registered
    pass


NODES = [MBSaveImage]

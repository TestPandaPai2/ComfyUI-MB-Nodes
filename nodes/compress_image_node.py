import io as _io
import os

from PIL import Image

import folder_paths
from comfy_api.latest import io, ui

from . import image_info
from .save_image_node import _to_pil

FORMATS = ["jpg", "webp", "png"]


def _encode(pil, fmt, quality, webp_lossless):
    buffer = _io.BytesIO()
    if fmt == "jpg":
        if pil.mode == "RGBA":
            flat = Image.new("RGB", pil.size, (255, 255, 255))
            flat.paste(pil, mask=pil.getchannel("A"))
            pil = flat
        pil.save(buffer, "JPEG", quality=quality, optimize=True, progressive=True)
    elif fmt == "webp":
        pil.save(buffer, "WEBP", quality=quality, lossless=webp_lossless, method=6)
    else:
        pil.save(buffer, "PNG", optimize=True, compress_level=9)
    return buffer.getvalue()


def _compress(pil, fmt, quality, target_kb, webp_lossless):
    """Encoded bytes and the quality used (None when quality does not apply).
    With a target, binary-search the highest quality up to `quality` that fits;
    if nothing fits, quality 1 is the smallest we can do."""
    if fmt == "png" or (fmt == "webp" and webp_lossless):
        return _encode(pil, fmt, quality, webp_lossless), None
    if target_kb <= 0:
        return _encode(pil, fmt, quality, webp_lossless), quality

    limit = target_kb * 1024
    low, high, best = 1, quality, None
    while low <= high:
        mid = (low + high) // 2
        data = _encode(pil, fmt, mid, webp_lossless)
        if len(data) <= limit:
            best = (data, mid)
            low = mid + 1
        else:
            high = mid - 1
    return best or (_encode(pil, fmt, 1, webp_lossless), 1)


def _fit(pil, max_dimension):
    longest = max(pil.size)
    if max_dimension <= 0 or longest <= max_dimension:
        return pil
    scale = max_dimension / longest
    size = (max(1, round(pil.width * scale)), max(1, round(pil.height * scale)))
    return pil.resize(size, Image.LANCZOS)


class MBCompressImage(io.ComfyNode):
    """Compress images to jpg/webp/png and save them to the output folder."""

    @classmethod
    def define_schema(cls) -> io.Schema:
        return io.Schema(
            node_id="MBCompressImage",
            display_name="Compress Image (MB)",
            category="MBNodes",
            description="Compress and convert images to jpg, webp or png, with quality, target size and resize controls.",
            search_aliases=["compress image", "convert image", "jpg", "webp", "png"],
            is_output_node=True,
            inputs=[
                io.Image.Input("images"),
                io.Combo.Input("format", options=FORMATS, default="jpg"),
                io.Int.Input(
                    "quality",
                    default=85,
                    min=1,
                    max=100,
                    tooltip="jpg/webp only. Ignored for png and lossless webp. With target_kb set, this is the upper limit.",
                ),
                io.Int.Input(
                    "target_kb",
                    default=0,
                    min=0,
                    max=100000,
                    tooltip="0 = off. Otherwise lowers quality until each file is at most this many KB (jpg / lossy webp only).",
                ),
                io.Int.Input(
                    "max_dimension",
                    default=0,
                    min=0,
                    max=16384,
                    tooltip="0 = off. Otherwise shrinks the longest side to this many pixels. Never upscales.",
                ),
                io.Boolean.Input("webp_lossless", default=False, tooltip="webp only. Ignores quality and target_kb."),
                io.String.Input("filename_prefix", default="MBNodes/compressed", socketless=True),
                io.Mask.Input(
                    "mask",
                    optional=True,
                    tooltip="Written as alpha for png and webp. jpg is flattened onto white.",
                ),
            ],
        )

    @classmethod
    def execute(
        cls, images, format, quality, target_kb, max_dimension, webp_lossless, filename_prefix, mask=None,
    ) -> io.NodeOutput:
        full_folder, filename, counter, subfolder, _prefix = folder_paths.get_save_image_path(
            filename_prefix, folder_paths.get_output_directory(), images[0].shape[1], images[0].shape[0]
        )
        fitted = image_info.fit_mask(mask, images)

        results, lines = [], []
        for batch_number, image_tensor in enumerate(images):
            pil = _fit(_to_pil(image_tensor, fitted[batch_number] if fitted is not None else None), max_dimension)
            data, used_quality = _compress(pil, format, quality, target_kb, webp_lossless)

            name = f"{filename.replace('%batch_num%', str(batch_number))}_{counter:05}_.{format}"
            with open(os.path.join(full_folder, name), "wb") as f:
                f.write(data)
            counter += 1

            results.append(ui.SavedResult(name, subfolder, io.FolderType.output))
            line = f"{name} — {pil.width}x{pil.height} — {len(data) / 1024:.1f} KB"
            lines.append(line if used_quality is None else f"{line} (q{used_quality})")

        return io.NodeOutput(ui={"images": results, "text": ["\n".join(lines)]})


NODES = [MBCompressImage]

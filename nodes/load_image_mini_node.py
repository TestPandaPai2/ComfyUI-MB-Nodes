import hashlib
import math

import comfy.utils
import folder_paths
from comfy_api.latest import io

from . import image_info
from .load_image_node import MEGAPIXELS, SNAP, _image_files, load_frames

# resize_mode option strings. Kept human-readable because they show verbatim in
# the gear panel; the JS mirror in web/load_image_mini_node.js uses the same set.
MODE_NONE = "none"
MODE_MEGAPIXELS = "max megapixels"
MODE_LONGEST = "longest side"
MODE_SCALE = "scale by"
MODE_FIT = "fit inside"
MODE_FILL = "crop to fill"
MODE_RATIO = "match ratio"
RESIZE_MODES = [
    MODE_NONE, MODE_MEGAPIXELS, MODE_LONGEST, MODE_SCALE,
    MODE_FIT, MODE_FILL, MODE_RATIO,
]

# common_upscale filters, best-quality first.
RESAMPLES = ["lanczos", "bicubic", "bilinear", "area", "nearest-exact"]
SNAP_OPTIONS = ["1", "2", "4", "8", "16", "32", "64"]

# Fixed aspect targets for "match ratio" — free/source make no sense when the
# whole point is to reach a named ratio.
MATCH_RATIOS = [
    "1:1", "4:3", "3:2", "16:10", "16:9", "1.85:1", "2:1", "21:9",
    "3:4", "2:3", "10:16", "9:16", "1:1.85", "1:2", "9:21",
]

MAX_SIDE = 16384


def _snap(value, multiple):
    multiple = max(1, int(multiple))
    return max(multiple, int(round(value / multiple)) * multiple)


def _ratio_value(name):
    """'16:9' -> 16/9. Falls back to 1.0 on anything unreadable."""
    try:
        w, h = name.split(":")
        w, h = float(w), float(h)
        return w / h if h else 1.0
    except (ValueError, AttributeError):
        return 1.0


def _rescale(output, mask, new_w, new_h, resample):
    """Resize the batched IMAGE (and its mask) to new_w x new_h."""
    # common_upscale works on NCHW, the IMAGE type is NHWC.
    samples = output.movedim(-1, 1)
    samples = comfy.utils.common_upscale(samples, new_w, new_h, resample, "disabled")
    output = samples.movedim(1, -1).clamp(0.0, 1.0)
    mask = image_info.resize_mask(mask, new_w, new_h)
    return output, mask


def _center_crop(output, mask, crop_w, crop_h):
    """Trim the batch to crop_w x crop_h, taking the centre."""
    height, width = output.shape[1], output.shape[2]
    crop_w = max(1, min(crop_w, width))
    crop_h = max(1, min(crop_h, height))
    left = (width - crop_w) // 2
    top = (height - crop_h) // 2
    right, bottom = left + crop_w, top + crop_h
    mask = image_info.crop_mask(mask, output, top, bottom, left, right)
    output = output[:, top:bottom, left:right, :]
    return output, mask


def _resize(output, mask, mode, megapixels, longest, scale,
            fit_w, fit_h, fill_w, fill_h, ratio, snap, resample, upscale):
    """Apply one resize mode. Returns (output, mask). Every branch snaps the
    scaled dimensions and honours `upscale` for the fit-to-target modes; the
    crop modes never pad — the image is only ever trimmed."""
    height, width = output.shape[1], output.shape[2]
    if width <= 0 or height <= 0 or mode == MODE_NONE:
        return output, mask

    if mode == MODE_MEGAPIXELS:
        factor = math.sqrt((float(megapixels) * 1e6) / (width * height))
        if factor > 1.0 and not upscale:
            return output, mask
        new_w = _snap(width * factor, snap)
        new_h = _snap(height * factor, snap)

    elif mode == MODE_LONGEST:
        factor = longest / max(width, height)
        if factor > 1.0 and not upscale:
            return output, mask
        new_w = _snap(width * factor, snap)
        new_h = _snap(height * factor, snap)

    elif mode == MODE_SCALE:
        new_w = _snap(width * scale, snap)
        new_h = _snap(height * scale, snap)

    elif mode == MODE_FIT:
        factor = min(fit_w / width, fit_h / height)
        if factor > 1.0 and not upscale:
            return output, mask
        new_w = _snap(width * factor, snap)
        new_h = _snap(height * factor, snap)

    elif mode == MODE_FILL:
        # Cover the box (aspect kept), then centre-crop the overflow so the
        # result is exactly the box. Filling always scales, up or down.
        factor = max(fill_w / width, fill_h / height)
        cover_w = max(fill_w, int(round(width * factor)))
        cover_h = max(fill_h, int(round(height * factor)))
        output, mask = _rescale(output, mask, cover_w, cover_h, resample)
        return _center_crop(output, mask, fill_w, fill_h)

    elif mode == MODE_RATIO:
        # Centre-crop to the target aspect; no scaling, no padding.
        target = _ratio_value(ratio)
        if width / height > target:
            crop_w, crop_h = int(round(height * target)), height
        else:
            crop_w, crop_h = width, int(round(width / target))
        return _center_crop(output, mask, crop_w, crop_h)

    else:
        return output, mask

    if (new_w, new_h) == (width, height):
        return output, mask
    return _rescale(output, mask, new_w, new_h, resample)


class MBLoadImageMini(io.ComfyNode):
    """A compact Load Image: a file picker, preview and two size cards on a
    small face, with the whole resize engine tucked into a gear panel. Loads a
    file from the input folder and emits just the image and its info bundle."""

    @classmethod
    def define_schema(cls) -> io.Schema:
        return io.Schema(
            node_id="MBLoadImageMini",
            display_name="Load Image Mini (MB)",
            category="MBNodes",
            description="Compact Load Image: pick or upload a file, with the full resize engine in a gear panel.",
            search_aliases=["load image mini", "mini load image", "compact load image"],
            inputs=[
                io.Combo.Input(
                    "image",
                    options=_image_files(),
                    upload=io.UploadType.image,
                    image_folder=io.FolderType.input,
                ),
                # Everything below is edited from the gear panel and hidden from
                # the node body by the frontend.
                io.Combo.Input("resize_mode", options=RESIZE_MODES, default=MODE_NONE, socketless=True),
                io.Combo.Input("megapixels", options=MEGAPIXELS, default="1.0", socketless=True),
                io.Int.Input("longest_side", default=1024, min=SNAP, max=MAX_SIDE, socketless=True),
                io.Float.Input("scale_by", default=1.0, min=0.05, max=8.0, step=0.05, socketless=True),
                io.Int.Input("fit_width", default=1024, min=SNAP, max=MAX_SIDE, socketless=True),
                io.Int.Input("fit_height", default=1024, min=SNAP, max=MAX_SIDE, socketless=True),
                io.Int.Input("fill_width", default=1024, min=SNAP, max=MAX_SIDE, socketless=True),
                io.Int.Input("fill_height", default=1024, min=SNAP, max=MAX_SIDE, socketless=True),
                io.Combo.Input("match_ratio", options=MATCH_RATIOS, default="1:1", socketless=True),
                io.Combo.Input("snap", options=SNAP_OPTIONS, default="8", socketless=True),
                io.Combo.Input("resample", options=RESAMPLES, default="lanczos", socketless=True),
                io.Boolean.Input("allow_upscale", default=False, socketless=True),
                # Per-node title colour override, managed entirely by the gear
                # panel. execute() ignores it; it rides along so it serializes.
                io.String.Input("accent", default="", socketless=True),
            ],
            outputs=[
                io.Image.Output("image"),
                image_info.ImageInfo.Output("image_info"),
            ],
        )

    @classmethod
    def validate_inputs(cls, **kwargs) -> bool | str:
        image = kwargs.get("image")
        if image and not folder_paths.exists_annotated_filepath(image):
            return f"Invalid image file: {image}"
        return True

    @classmethod
    def fingerprint_inputs(cls, image, resize_mode, megapixels, longest_side, scale_by,
                           fit_width, fit_height, fill_width, fill_height, match_ratio,
                           snap, resample, allow_upscale, accent) -> str:
        hasher = hashlib.sha256()
        path = folder_paths.get_annotated_filepath(image)
        with open(path, "rb") as f:
            hasher.update(f.read())
        # accent never changes a pixel, so it stays out of the fingerprint.
        settings = f"{resize_mode}|{megapixels}|{longest_side}|{scale_by}|" \
                   f"{fit_width}|{fit_height}|{fill_width}|{fill_height}|" \
                   f"{match_ratio}|{snap}|{resample}|{allow_upscale}"
        hasher.update(settings.encode("utf-8"))
        return hasher.hexdigest()

    @classmethod
    def execute(cls, image, resize_mode, megapixels, longest_side, scale_by,
                fit_width, fit_height, fill_width, fill_height, match_ratio,
                snap, resample, allow_upscale, accent) -> io.NodeOutput:
        path = folder_paths.get_annotated_filepath(image)
        output, mask = load_frames(path)

        output, mask = _resize(
            output, mask, resize_mode, megapixels, longest_side, scale_by,
            fit_width, fit_height, fill_width, fill_height, match_ratio,
            int(snap), resample, allow_upscale,
        )

        return io.NodeOutput(output, image_info.make(output, mask, image))


NODES = [MBLoadImageMini]

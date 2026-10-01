"""Load Image Crop (MB): load a file and crop it to the area drawn on the
node's preview. Drag to draw the box, drag inside it to move, drag a grip to
resize, click to clear. No box means the full image is output. The rect is
stored as fractions of the image, so swapping the file keeps the crop
meaningful; a zero-sized rect is the "no crop" state. The aspect preset only
locks the box in the editor; the backend crops whatever rect it is given."""

import hashlib
import math

import comfy.utils
import folder_paths
from comfy_api.latest import io

from .crop_image_node import RATIOS, crop_box
from .load_image_node import _image_files, load_frames


def has_crop(w, h):
    """A crop is drawn only when both sides have a size; zero is cleared."""
    return w > 0.0 and h > 0.0


UPSCALE_METHODS = ["nearest-exact", "bilinear", "area", "bicubic", "lanczos"]


def snap_step(value, step):
    """Nearest multiple of `step`, never below one step."""
    return max(step, int(round(value / step)) * step)


def output_size(width, height, max_megapixels, step):
    """Scale to `max_megapixels` (up or down, aspect kept; <= 0 keeps the size),
    then snap both sides to the nearest multiple of `step`."""
    if max_megapixels > 0:
        scale = math.sqrt(max_megapixels * 1_000_000 / (width * height))
        width, height = width * scale, height * scale
    return snap_step(width, step), snap_step(height, step)


class MBLoadImageCropArea(io.ComfyNode):
    @classmethod
    def define_schema(cls) -> io.Schema:
        return io.Schema(
            node_id="MBLoadImageCropArea",
            display_name="Load Image Crop (MB)",
            category="MBNodes",
            description=(
                "Load an image and crop it to the area selected on the preview. "
                "Drag to draw the crop area, drag inside it to move, drag its corners to resize, "
                "click to clear. With no crop drawn the full image is output. aspect locks the box "
                "to a preset. If max_megapixels is greater than 0 the output is scaled up or down "
                "to it, aspect preserved; both sides are then snapped to resolution_steps."
            ),
            search_aliases=["load image crop", "crop area", "load and crop", "select crop"],
            inputs=[
                io.Combo.Input(
                    "image",
                    options=_image_files(),
                    upload=io.UploadType.image,
                    image_folder=io.FolderType.input,
                ),
                io.Combo.Input(
                    "aspect",
                    options=RATIOS,
                    default="free",
                    tooltip="free: drag any box. source: keep the image's aspect. Otherwise the box is locked to the chosen ratio.",
                ),
                io.Float.Input(
                    "max_megapixels",
                    default=0.0,
                    min=0.0,
                    max=64.0,
                    step=0.05,
                    tooltip="Scale the output up or down to this many megapixels, aspect preserved. 0 keeps the cropped size.",
                ),
                io.Int.Input(
                    "resolution_steps",
                    default=8,
                    min=1,
                    max=256,
                    tooltip="Snap output width and height to the nearest multiple of this. 1 disables snapping.",
                ),
                io.Combo.Input(
                    "upscale_method",
                    options=UPSCALE_METHODS,
                    default="lanczos",
                    tooltip="Resampling used when the output size differs from the crop.",
                ),
                # Fractions of the image, driven by the crop editor on the node
                # body and hidden from the widget list by the frontend. A zero
                # width or height means no crop is drawn.
                io.Float.Input("crop_x", default=0.0, min=0.0, max=1.0, step=0.0001, socketless=True),
                io.Float.Input("crop_y", default=0.0, min=0.0, max=1.0, step=0.0001, socketless=True),
                io.Float.Input("crop_width", default=0.0, min=0.0, max=1.0, step=0.0001, socketless=True),
                io.Float.Input("crop_height", default=0.0, min=0.0, max=1.0, step=0.0001, socketless=True),
            ],
            outputs=[
                io.Image.Output("image"),
            ],
        )

    @classmethod
    def validate_inputs(cls, **kwargs) -> bool | str:
        image = kwargs.get("image")
        if image and not folder_paths.exists_annotated_filepath(image):
            return f"Invalid image file: {image}"
        return True

    @classmethod
    def fingerprint_inputs(cls, image, aspect, max_megapixels, resolution_steps, upscale_method,
                           crop_x, crop_y, crop_width, crop_height) -> str:
        hasher = hashlib.sha256()
        path = folder_paths.get_annotated_filepath(image)
        with open(path, "rb") as f:
            hasher.update(f.read())
        settings = f"{max_megapixels}|{resolution_steps}|{upscale_method}|{crop_x}|{crop_y}|{crop_width}|{crop_height}"
        hasher.update(settings.encode("utf-8"))
        return hasher.hexdigest()

    @classmethod
    def execute(cls, image, aspect, max_megapixels, resolution_steps, upscale_method,
                crop_x, crop_y, crop_width, crop_height) -> io.NodeOutput:
        path = folder_paths.get_annotated_filepath(image)
        output, _ = load_frames(path)
        height, width = output.shape[1], output.shape[2]

        if has_crop(crop_width, crop_height):
            left, top, right, bottom = crop_box(
                width, height, crop_x, crop_y, crop_width, crop_height
            )
            output = output[:, top:bottom, left:right, :]
            width, height = right - left, bottom - top

        new_w, new_h = output_size(width, height, float(max_megapixels), int(resolution_steps))
        if (new_w, new_h) != (width, height):
            # common_upscale works on NCHW, the IMAGE type is NHWC.
            samples = output.movedim(-1, 1)
            samples = comfy.utils.common_upscale(samples, new_w, new_h, upscale_method, "disabled")
            output = samples.movedim(1, -1).clamp(0.0, 1.0)

        return io.NodeOutput(output)


NODES = [MBLoadImageCropArea]

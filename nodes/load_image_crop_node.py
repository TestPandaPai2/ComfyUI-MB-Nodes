import hashlib

import comfy.utils
import folder_paths
from comfy_api.latest import io

from . import image_info
from .crop_image_node import DIVISORS, RATIOS, crop_box
from .load_image_node import (
    MEGAPIXELS,
    _image_files,
    aspect_ratio_string,
    load_frames,
    target_size,
)


class MBLoadImageCrop(io.ComfyNode):
    """Load Image (MB) with a crop step: the same file picker and megapixel
    resize, plus a Crop... button that opens a dialog to drag a box over the
    picked image. The rect is kept as fractions of the image, so swapping the
    file for one of another size leaves the crop meaningful."""

    @classmethod
    def define_schema(cls) -> io.Schema:
        return io.Schema(
            node_id="MBLoadImageCrop",
            display_name="Load Image with Crop (MB)",
            category="MBNodes",
            description="Load an image, crop it in a dialog, and optionally resize to a target megapixel count.",
            search_aliases=["load image crop", "crop image", "load and crop"],
            inputs=[
                io.Combo.Input(
                    "image",
                    options=_image_files(),
                    upload=io.UploadType.image,
                    image_folder=io.FolderType.input,
                ),
                io.Boolean.Input(
                    "resize",
                    default=False,
                    label_on="resize",
                    label_off="original",
                    tooltip="Resize the cropped image to the closest resolution matching the megapixel target.",
                ),
                io.Combo.Input(
                    "megapixels",
                    options=MEGAPIXELS,
                    default="1.0",
                    tooltip="Target pixel count of the resized image.",
                ),
                # Everything below is driven by the crop dialog and hidden from
                # the node body by the frontend.
                io.Combo.Input(
                    "aspect_ratio",
                    options=RATIOS,
                    default="free",
                    socketless=True,
                    tooltip="free: drag any box. source: keep the image's own aspect. Otherwise the box is locked to the chosen ratio.",
                ),
                io.Combo.Input(
                    "divisible_by",
                    options=DIVISORS,
                    default="1",
                    socketless=True,
                    tooltip="Round the cropped width and height down to a multiple of this, trimming evenly from both sides.",
                ),
                # Fractions of the image, so they stay valid whichever file is
                # picked.
                io.Float.Input("crop_x", default=0.0, min=0.0, max=1.0, step=0.0001, socketless=True),
                io.Float.Input("crop_y", default=0.0, min=0.0, max=1.0, step=0.0001, socketless=True),
                io.Float.Input("crop_width", default=1.0, min=0.0, max=1.0, step=0.0001, socketless=True),
                io.Float.Input("crop_height", default=1.0, min=0.0, max=1.0, step=0.0001, socketless=True),
            ],
            outputs=[
                io.Image.Output("image"),
                io.Int.Output("width"),
                io.Int.Output("height"),
                io.String.Output("aspect_ratio"),
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
    def fingerprint_inputs(cls, image, resize, megapixels, aspect_ratio, divisible_by,
                           crop_x, crop_y, crop_width, crop_height) -> str:
        hasher = hashlib.sha256()
        path = folder_paths.get_annotated_filepath(image)
        with open(path, "rb") as f:
            hasher.update(f.read())
        settings = f"{resize}|{megapixels}|{aspect_ratio}|{divisible_by}|" \
                   f"{crop_x}|{crop_y}|{crop_width}|{crop_height}"
        hasher.update(settings.encode("utf-8"))
        return hasher.hexdigest()

    @classmethod
    def execute(cls, image, resize, megapixels, aspect_ratio, divisible_by,
                crop_x, crop_y, crop_width, crop_height) -> io.NodeOutput:
        path = folder_paths.get_annotated_filepath(image)
        output, mask = load_frames(path)
        height, width = output.shape[1], output.shape[2]

        # Crop first: the megapixel target is meant to describe what comes out.
        left, top, right, bottom = crop_box(
            width, height, crop_x, crop_y, crop_width, crop_height, int(divisible_by)
        )
        # Crop the mask against the uncropped image: the box is in its pixels.
        mask = image_info.crop_mask(mask, output, top, bottom, left, right)
        output = output[:, top:bottom, left:right, :]
        width, height = right - left, bottom - top

        if resize:
            new_w, new_h = target_size(width, height, float(megapixels))
            if (new_w, new_h) != (width, height):
                # common_upscale works on NCHW, the IMAGE type is NHWC.
                samples = output.movedim(-1, 1)
                samples = comfy.utils.common_upscale(samples, new_w, new_h, "lanczos", "disabled")
                output = samples.movedim(1, -1).clamp(0.0, 1.0)
                mask = image_info.resize_mask(mask, new_w, new_h)
                width, height = new_w, new_h

        return io.NodeOutput(
            output,
            width,
            height,
            aspect_ratio_string(width, height),
            image_info.make(output, mask, image),
        )


NODES = [MBLoadImageCrop]

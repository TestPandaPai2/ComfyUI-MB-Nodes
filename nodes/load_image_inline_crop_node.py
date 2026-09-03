"""Load Image & Crop (MB): the loader with the crop box drawn straight on the
node body instead of behind a dialog button. The rect is dragged over a preview
of the picked file and stored as fractions of it, so swapping the file for one
of another size leaves the crop meaningful."""

import hashlib

import torch

import comfy.utils
import folder_paths
from comfy_api.latest import io

from . import image_info
from .crop_image_node import RATIOS, crop_box
from .load_image_node import MEGAPIXELS, _image_files, load_frames, target_size

# The megapixel widget doubles as the off switch, so no separate resize toggle
# is needed on a node whose body is mostly crop area.
NO_RESIZE = "original"
MEGAPIXEL_OPTIONS = [NO_RESIZE, *MEGAPIXELS]


class MBLoadImageInlineCrop(io.ComfyNode):
    """Load an image, drag the crop box on the node itself, and resize the crop
    to a target megapixel count."""

    @classmethod
    def define_schema(cls) -> io.Schema:
        return io.Schema(
            node_id="MBLoadImageInlineCrop",
            display_name="Load Image & Crop (MB)",
            category="MBNodes",
            description="Load an image, crop it by dragging a box on the node, and resize to a target megapixel count.",
            search_aliases=["load image crop", "drag crop", "load and crop", "inline crop"],
            inputs=[
                io.Combo.Input(
                    "image",
                    options=_image_files(),
                    upload=io.UploadType.image,
                    image_folder=io.FolderType.input,
                ),
                io.Combo.Input(
                    "megapixels",
                    options=MEGAPIXEL_OPTIONS,
                    default="1.0",
                    tooltip=f"Target pixel count of the cropped image. '{NO_RESIZE}' passes the crop through at its own size.",
                ),
                # Driven by the crop editor on the node body; the frontend hides
                # these from the widget list.
                io.Combo.Input(
                    "aspect_ratio",
                    options=RATIOS,
                    default="free",
                    socketless=True,
                    tooltip="free: drag any box. source: keep the image's own aspect. Otherwise the box is locked to the chosen ratio.",
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
                io.Mask.Output("mask"),
            ],
        )

    @classmethod
    def validate_inputs(cls, **kwargs) -> bool | str:
        image = kwargs.get("image")
        if image and not folder_paths.exists_annotated_filepath(image):
            return f"Invalid image file: {image}"
        return True

    @classmethod
    def fingerprint_inputs(cls, image, megapixels, aspect_ratio,
                           crop_x, crop_y, crop_width, crop_height) -> str:
        hasher = hashlib.sha256()
        path = folder_paths.get_annotated_filepath(image)
        with open(path, "rb") as f:
            hasher.update(f.read())
        settings = f"{megapixels}|{aspect_ratio}|{crop_x}|{crop_y}|{crop_width}|{crop_height}"
        hasher.update(settings.encode("utf-8"))
        return hasher.hexdigest()

    @classmethod
    def execute(cls, image, megapixels, aspect_ratio,
                crop_x, crop_y, crop_width, crop_height) -> io.NodeOutput:
        path = folder_paths.get_annotated_filepath(image)
        output, mask = load_frames(path)
        height, width = output.shape[1], output.shape[2]

        # Crop first: the megapixel target describes what comes out of the node.
        left, top, right, bottom = crop_box(
            width, height, crop_x, crop_y, crop_width, crop_height
        )
        # Crop the mask against the uncropped image: the box is in its pixels.
        mask = image_info.crop_mask(mask, output, top, bottom, left, right)
        output = output[:, top:bottom, left:right, :]
        width, height = right - left, bottom - top

        if megapixels != NO_RESIZE:
            new_w, new_h = target_size(width, height, float(megapixels))
            if (new_w, new_h) != (width, height):
                # common_upscale works on NCHW, the IMAGE type is NHWC.
                samples = output.movedim(-1, 1)
                samples = comfy.utils.common_upscale(samples, new_w, new_h, "lanczos", "disabled")
                output = samples.movedim(1, -1).clamp(0.0, 1.0)
                mask = image_info.resize_mask(mask, new_w, new_h)
                width, height = new_w, new_h

        # A downstream MASK input cannot take None, so a file without alpha gets
        # the fully-unmasked mask at the cropped size.
        mask = image_info.fit_mask(mask, output)
        if mask is None:
            mask = torch.zeros(
                (output.shape[0], output.shape[1], output.shape[2]), dtype=torch.float32
            )

        return io.NodeOutput(output, mask)


NODES = [MBLoadImageInlineCrop]

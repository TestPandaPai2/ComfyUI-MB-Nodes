"""MB Load Two Images: two files side by side on one node, each with its own
output and a shared megapixel cap. The face lives in web/load_two_images_node.js."""

import hashlib
import math

import torch

import comfy.utils
import folder_paths
from comfy_api.latest import io

from .load_image_node import SNAP, _image_files, load_frames
from .pad_image_node import _rgb


def fit_size(width, height, max_mp):
    """Largest SNAP-aligned size within max_mp, aspect kept. Never upscales;
    0 or an image already within the cap returns the input unchanged."""
    if max_mp <= 0 or width * height <= max_mp * 1e6:
        return width, height

    scale = math.sqrt((max_mp * 1e6) / (width * height))
    # Rounding down keeps the result inside the cap.
    return (
        max(SNAP, int(width * scale / SNAP) * SNAP),
        max(SNAP, int(height * scale / SNAP) * SNAP),
    )


def _load(name, max_mp):
    output, _ = load_frames(folder_paths.get_annotated_filepath(name))
    height, width = output.shape[1], output.shape[2]

    new_w, new_h = fit_size(width, height, max_mp)
    if (new_w, new_h) == (width, height):
        return output

    # common_upscale works on NCHW, the IMAGE type is NHWC.
    samples = comfy.utils.common_upscale(output.movedim(-1, 1), new_w, new_h, "lanczos", "disabled")
    return samples.movedim(1, -1).clamp(0.0, 1.0)


def pad_to(image, width, height, color):
    """Center image on a width x height canvas of color. An image too big for
    the canvas is scaled down to fit first, since padding alone can't shrink it."""
    h, w = image.shape[1], image.shape[2]
    if w > width or h > height:
        scale = min(width / w, height / h)
        new_w = min(width, max(1, round(w * scale)))
        new_h = min(height, max(1, round(h * scale)))
        samples = comfy.utils.common_upscale(image.movedim(-1, 1), new_w, new_h, "lanczos", "disabled")
        image = samples.movedim(1, -1).clamp(0.0, 1.0)
        h, w = new_h, new_w

    if (w, h) == (width, height):
        return image

    fill = torch.tensor(_rgb(color), dtype=image.dtype, device=image.device)
    canvas = fill.repeat(image.shape[0], height, width, 1)
    top, left = (height - h) // 2, (width - w) // 2
    canvas[:, top:top + h, left:left + w] = image
    return canvas


class MBLoadTwoImages(io.ComfyNode):
    @classmethod
    def define_schema(cls) -> io.Schema:
        files = _image_files()
        return io.Schema(
            node_id="MBLoadTwoImages",
            display_name="MB Load Two Images",
            category="MBNodes",
            description="Load two images in one node, with drag and drop, paste, and a shared megapixel cap.",
            search_aliases=["load two images", "load 2 images", "dual image", "image pair"],
            inputs=[
                io.Combo.Input("image1", options=files),
                io.Combo.Input("image2", options=files),
                io.Float.Input(
                    "max_mp",
                    default=0.0,
                    min=0.0,
                    max=64.0,
                    step=0.25,
                    tooltip="Downscale either image to fit this many megapixels, keeping its aspect. 0 is off. Never upscales.",
                ),
                io.Boolean.Input(
                    "pad_image2",
                    default=False,
                    tooltip="Center Image2 on a canvas matching Image1's size. A larger Image2 is scaled down to fit. Right-click the node to set the color.",
                ),
                io.Color.Input("pad_color", default="#000000"),
            ],
            outputs=[
                io.Image.Output("Image1", display_name="Image1"),
                io.Image.Output("Image2", display_name="Image2"),
            ],
        )

    @classmethod
    def validate_inputs(cls, **kwargs) -> bool | str:
        for key, label in (("image1", "Image1"), ("image2", "Image2")):
            # Absent means wired in, which ComfyUI validates itself.
            if key not in kwargs:
                continue
            name = kwargs[key]
            if not name:
                return f"{label} has no image"
            if not folder_paths.exists_annotated_filepath(name):
                return f"Invalid image file: {name}"
        return True

    @classmethod
    def fingerprint_inputs(cls, image1, image2, max_mp, pad_image2, pad_color) -> str:
        hasher = hashlib.sha256()
        for name in (image1, image2):
            with open(folder_paths.get_annotated_filepath(name), "rb") as f:
                hasher.update(f.read())
        hasher.update(f"{max_mp}|{pad_image2}|{pad_color}".encode("utf-8"))
        return hasher.hexdigest()

    @classmethod
    def execute(cls, image1, image2, max_mp, pad_image2, pad_color) -> io.NodeOutput:
        first, second = _load(image1, max_mp), _load(image2, max_mp)
        if pad_image2:
            second = pad_to(second, first.shape[2], first.shape[1], pad_color)
        return io.NodeOutput(first, second)


NODES = [MBLoadTwoImages]

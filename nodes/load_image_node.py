import hashlib
import math
import os

import numpy as np
import torch
from PIL import Image, ImageOps, ImageSequence

import comfy.utils
import folder_paths
import node_helpers
from comfy_api.latest import io

# Target sizes offered by the "megapixels" widget.
MEGAPIXELS = ["0.25", "0.5", "1.0", "1.25", "1.5", "2.0", "3.0", "4.0"]
SNAP = 8  # resized dimensions stay a multiple of this

# Nominal ratios a messy width/height is reported as when it is close enough.
COMMON_RATIOS = [
    ("1:1", 1 / 1), ("5:4", 5 / 4), ("4:3", 4 / 3), ("3:2", 3 / 2),
    ("16:10", 16 / 10), ("16:9", 16 / 9), ("1.85:1", 1.85), ("2:1", 2 / 1),
    ("21:9", 21 / 9),
]
RATIO_TOLERANCE = 0.01  # max |ln(actual / nominal)| to accept a nominal name


def _image_files():
    input_dir = folder_paths.get_input_directory()
    files = [f for f in os.listdir(input_dir) if os.path.isfile(os.path.join(input_dir, f))]
    return sorted(folder_paths.filter_files_content_types(files, ["image"]))


def aspect_ratio_string(width, height):
    """"16:9" for clean ratios, "1.85:1" style otherwise."""
    if width <= 0 or height <= 0:
        return "0:0"

    divisor = math.gcd(width, height)
    w, h = width // divisor, height // divisor
    if w <= 64 and h <= 64:
        return f"{w}:{h}"

    ratio = width / height
    for name, nominal in COMMON_RATIOS:
        value = nominal if ratio >= 1 else 1 / nominal
        if abs(math.log(ratio / value)) <= RATIO_TOLERANCE:
            return name if ratio >= 1 else name.split(":")[1] + ":" + name.split(":")[0]

    return f"{ratio:.2f}:1" if ratio >= 1 else f"1:{1 / ratio:.2f}"


def target_size(width, height, megapixels):
    """Closest width/height with the requested pixel count, aspect kept, snapped
    to SNAP. Returns the input unchanged when it is already on target."""
    if width <= 0 or height <= 0:
        return width, height

    scale = math.sqrt((megapixels * 1e6) / (width * height))
    new_w = max(SNAP, int(round(width * scale / SNAP)) * SNAP)
    new_h = max(SNAP, int(round(height * scale / SNAP)) * SNAP)
    return new_w, new_h


class MBLoadImage(io.ComfyNode):
    """Load an image from the input folder, optionally resized to the closest
    resolution hitting a target megapixel count."""

    @classmethod
    def define_schema(cls) -> io.Schema:
        return io.Schema(
            node_id="MBLoadImage",
            display_name="Load Image (MB)",
            category="MBNodes",
            description="Load an image with an optional resize to a target megapixel count.",
            search_aliases=["load image", "upload image", "image input"],
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
                    tooltip="Resize to the closest resolution matching the megapixel target.",
                ),
                io.Combo.Input(
                    "megapixels",
                    options=MEGAPIXELS,
                    default="1.0",
                    tooltip="Target pixel count of the resized image.",
                ),
            ],
            outputs=[
                io.Image.Output("image"),
                io.Int.Output("width"),
                io.Int.Output("height"),
                io.String.Output("aspect_ratio"),
            ],
        )

    @classmethod
    def validate_inputs(cls, **kwargs) -> bool | str:
        image = kwargs.get("image")
        if image and not folder_paths.exists_annotated_filepath(image):
            return f"Invalid image file: {image}"
        return True

    @classmethod
    def fingerprint_inputs(cls, image, resize, megapixels) -> str:
        hasher = hashlib.sha256()
        path = folder_paths.get_annotated_filepath(image)
        with open(path, "rb") as f:
            hasher.update(f.read())
        hasher.update(f"{resize}|{megapixels}".encode("utf-8"))
        return hasher.hexdigest()

    @classmethod
    def execute(cls, image, resize, megapixels) -> io.NodeOutput:
        path = folder_paths.get_annotated_filepath(image)
        img = node_helpers.pillow(Image.open, path)

        frames = []
        first_size = None
        for frame in ImageSequence.Iterator(img):
            frame = node_helpers.pillow(ImageOps.exif_transpose, frame).convert("RGB")
            if first_size is None:
                first_size = frame.size
            elif frame.size != first_size:
                continue  # animated frames of a different size cannot be stacked
            array = np.array(frame).astype(np.float32) / 255.0
            frames.append(torch.from_numpy(array)[None,])

        output = torch.cat(frames, dim=0)
        height, width = output.shape[1], output.shape[2]

        if resize:
            new_w, new_h = target_size(width, height, float(megapixels))
            if (new_w, new_h) != (width, height):
                # common_upscale works on NCHW, the IMAGE type is NHWC.
                samples = output.movedim(-1, 1)
                samples = comfy.utils.common_upscale(samples, new_w, new_h, "lanczos", "disabled")
                output = samples.movedim(1, -1).clamp(0.0, 1.0)
                width, height = new_w, new_h

        return io.NodeOutput(output, width, height, aspect_ratio_string(width, height))


NODES = [MBLoadImage]

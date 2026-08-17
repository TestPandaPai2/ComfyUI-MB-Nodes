"""The MB_IMAGE_INFO bundle: one dot carrying an image with everything the node
already knew about it, so a downstream node does not have to be wired five times
over. The payload is a plain dict, kept as its own io_type rather than a generic
one so it cannot be dropped onto an IMAGE socket by accident.

Masks follow the ComfyUI convention (1 = masked/transparent) and are None when
the source had no alpha and no mask was wired in.
"""

import numpy as np
import torch

from comfy_api.latest import io

ImageInfo = io.Custom("MB_IMAGE_INFO")


def alpha_mask(pil_image):
    """[1, H, W] mask from a Pillow image's alpha channel, or None when it has
    none. Inverted, so an opaque pixel reads 0 the way LoadImage reports it."""
    if "A" not in pil_image.getbands():
        return None

    alpha = np.array(pil_image.getchannel("A")).astype(np.float32) / 255.0
    return (1.0 - torch.from_numpy(alpha))[None,]


def fit_mask(mask, image):
    """A mask that lines up with `image`, or None. A mask of another resolution
    is resized onto the image rather than carried at its own size, and a batch
    that cannot be broadcast onto the image's is dropped: a silently misaligned
    mask is worse than no mask at all."""
    if mask is None or image is None:
        return None
    if mask.ndim != 3:
        return None

    height, width = int(image.shape[1]), int(image.shape[2])
    if tuple(mask.shape[1:]) != (height, width):
        mask = resize_mask(mask, width, height)

    batch = int(image.shape[0])
    if mask.shape[0] == batch:
        return mask
    if mask.shape[0] == 1:
        return mask.expand(batch, -1, -1)
    return None


def resize_mask(mask, width, height):
    """Nearest-neighbour resize of a [B, H, W] mask onto a new image size."""
    if mask is None:
        return None

    import comfy.utils

    resized = comfy.utils.common_upscale(
        mask.unsqueeze(1), width, height, "nearest-exact", "disabled"
    )
    return resized.squeeze(1).clamp(0.0, 1.0)


def make(image, mask=None, filename="", filenames=None):
    """Bundle a batched IMAGE tensor with its optional mask and source name.
    Width and height are read off the tensor so they cannot drift from it, and
    the mask is forced to line up with the image before it is stored."""
    height, width = int(image.shape[1]), int(image.shape[2])
    return {
        "image": image,
        "mask": fit_mask(mask, image),
        "width": width,
        "height": height,
        "filename": filename or "",
        # Every name behind a batch; `filename` stays the one that identifies it.
        "filenames": list(filenames) if filenames else ([filename] if filename else []),
    }


def crop_mask(mask, image, top, bottom, left, right):
    """Apply an image crop box to a mask, after making it match `image` — the
    box is in image pixels, so slicing a mask of another size would land the
    crop somewhere else entirely."""
    mask = fit_mask(mask, image)
    if mask is None:
        return None
    return mask[:, top:bottom, left:right]


class MBImageInfo(io.ComfyNode):
    """Split an image_info bundle back into its parts."""

    @classmethod
    def define_schema(cls) -> io.Schema:
        return io.Schema(
            node_id="MBImageInfo",
            display_name="Image Info (MB)",
            category="MBNodes",
            description="Unpack an image_info bundle into image, mask, width, height and filename.",
            search_aliases=["image info", "unpack image info", "image metadata"],
            inputs=[ImageInfo.Input("image_info")],
            outputs=[
                io.Image.Output("image"),
                io.Mask.Output("mask"),
                io.Int.Output("width"),
                io.Int.Output("height"),
                io.String.Output("filename"),
                io.String.Output("filenames"),
            ],
        )

    @classmethod
    def execute(cls, image_info) -> io.NodeOutput:
        info = image_info or {}
        image = info.get("image")
        mask = info.get("mask")

        # A downstream MASK input cannot take None, so an image without alpha
        # gets the fully-unmasked mask matching its own size.
        if mask is None and image is not None:
            mask = torch.zeros(
                (image.shape[0], image.shape[1], image.shape[2]), dtype=torch.float32
            )

        names = info.get("filenames") or ([info["filename"]] if info.get("filename") else [])

        return io.NodeOutput(
            image,
            mask,
            int(info.get("width") or 0),
            int(info.get("height") or 0),
            info.get("filename") or "",
            "\n".join(names),  # one per line, ready for a text node
        )


NODES = [MBImageInfo]

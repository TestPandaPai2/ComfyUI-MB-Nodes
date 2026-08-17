"""The MB_IMAGE_INFO bundle: one dot carrying an image with everything the node
already knew about it, so a downstream node does not have to be wired five times
over. The payload is a plain dict, kept as its own io_type rather than a generic
one so it cannot be dropped onto an IMAGE socket by accident.

Masks follow the ComfyUI convention (1 = masked/transparent) and are None when
the source had no alpha and no mask was wired in.
"""

import torch

from comfy_api.latest import io

ImageInfo = io.Custom("MB_IMAGE_INFO")


def alpha_mask(pil_image):
    """[1, H, W] mask from a Pillow image's alpha channel, or None when it has
    none. Inverted, so an opaque pixel reads 0 the way LoadImage reports it."""
    if "A" not in pil_image.getbands():
        return None
    import numpy as np

    alpha = np.array(pil_image.getchannel("A")).astype(np.float32) / 255.0
    return (1.0 - torch.from_numpy(alpha))[None,]


def make(image, mask=None, filename=""):
    """Bundle a batched IMAGE tensor with its optional mask and source name.
    Width and height are read off the tensor so they cannot drift from it."""
    height, width = int(image.shape[1]), int(image.shape[2])
    return {
        "image": image,
        "mask": mask,
        "width": width,
        "height": height,
        "filename": filename or "",
    }


def crop_mask(mask, top, bottom, left, right):
    """Apply an image crop box to a [B, H, W] mask, tolerating a mask whose size
    does not match the image (it is left alone rather than sliced wrongly)."""
    if mask is None:
        return None
    if mask.ndim != 3:
        return mask
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

        return io.NodeOutput(
            image,
            mask,
            int(info.get("width") or 0),
            int(info.get("height") or 0),
            info.get("filename") or "",
        )


NODES = [MBImageInfo]

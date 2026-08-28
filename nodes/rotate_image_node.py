"""Rotate an image by a quarter turn, chosen with one of three toggles."""

import torch

from comfy_api.latest import io, ui

from . import image_info as _info

# Quarter turns counter-clockwise, which is the direction torch.rot90 turns for
# a positive k on the (H, W) dims. Clockwise is the same count negated.
TURNS = {90: 1, 180: 2, 270: 3}


def _turns(rotate_90, rotate_180, rotate_270, clockwise):
    """k for torch.rot90, or 0 when no toggle is on. The toggles are meant to be
    mutually exclusive -- the frontend clears the others when one is switched on
    -- so an API call that sets several is resolved here by taking the first."""
    for on, degrees in ((rotate_90, 90), (rotate_180, 180), (rotate_270, 270)):
        if not on:
            continue
        if degrees == 180:
            return 2  # direction makes no difference to a half turn
        k = TURNS[degrees]
        return -k if clockwise else k
    return 0


def _rotate(tensor, k):
    """Quarter turns of a [B, H, W, ...] or [B, H, W] tensor."""
    return torch.rot90(tensor, k, dims=(1, 2)).contiguous()


class MBRotateImage(io.ComfyNode):
    """Rotate an image 90, 180 or 270 degrees, clockwise or anti-clockwise."""

    @classmethod
    def define_schema(cls) -> io.Schema:
        return io.Schema(
            node_id="MBRotateImage",
            display_name="Rotate Image (MB)",
            category="MBNodes",
            description="Rotate an image a quarter, half or three-quarter turn, either direction.",
            search_aliases=["rotate image", "turn", "90", "180", "270", "flip orientation"],
            inputs=[
                io.Image.Input("image"),
                io.Boolean.Input(
                    "rotate_90", default=False, socketless=True,
                    tooltip="Quarter turn. Switching one rotation on clears the other two.",
                ),
                io.Boolean.Input(
                    "rotate_180", default=False, socketless=True,
                    tooltip="Half turn. Direction makes no difference here.",
                ),
                io.Boolean.Input(
                    "rotate_270", default=False, socketless=True,
                    tooltip="Three-quarter turn. Switching one rotation on clears the other two.",
                ),
                io.Boolean.Input(
                    "clockwise", default=True, socketless=True,
                    label_on="clockwise", label_off="anti-clockwise",
                    tooltip="Direction of the turn. Ignored by rotate_180.",
                ),
                _info.ImageInfo.Input(
                    "image_info",
                    optional=True,
                    tooltip="Wire an upstream image_info to carry its filename and mask through the rotation.",
                ),
            ],
            outputs=[
                io.Image.Output("image"),
                _info.ImageInfo.Output("image_info"),
            ],
        )

    @classmethod
    def execute(
        cls, image, rotate_90, rotate_180, rotate_270, clockwise, image_info=None,
    ) -> io.NodeOutput:
        k = _turns(rotate_90, rotate_180, rotate_270, clockwise)

        source = image_info or {}
        mask = _info.fit_mask(source.get("mask"), image)

        if k:
            image = _rotate(image, k)
            if mask is not None:
                mask = _rotate(mask, k)

        info = _info.make(
            image, mask, source.get("filename", ""),
            filenames=source.get("filenames"),
        )

        return io.NodeOutput(image, info, ui=ui.PreviewImage(image, cls=cls))


NODES = [MBRotateImage]

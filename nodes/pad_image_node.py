import logging

import torch

from comfy_api.latest import io, ui

# Aliased: "image_info" is also this node's optional input, which would
# shadow the module inside execute().
from . import image_info as _info
from .resolution_node import RATIOS

RATIO_NAMES = [name for name, _ in RATIOS]
RATIO_BY_NAME = dict(RATIOS)
NO_RATIO = "none"
PAD_FROM = ["both", "first", "second"]
MAX_PAD = 8192


def _rgb(color):
    """'#rrggbb' (or 'rgb(r, g, b)') to three 0-1 floats; black if unreadable."""
    text = str(color or "").strip()

    if text.startswith("#"):
        digits = text[1:]
        if len(digits) == 3:
            digits = "".join(c * 2 for c in digits)
        if len(digits) >= 6:
            try:
                return [int(digits[i:i + 2], 16) / 255.0 for i in (0, 2, 4)]
            except ValueError:
                pass
    elif text.lower().startswith("rgb"):
        parts = text[text.find("(") + 1:text.rfind(")")].split(",")
        if len(parts) >= 3:
            try:
                return [min(255.0, max(0.0, float(p))) / 255.0 for p in parts[:3]]
            except ValueError:
                pass

    return [0.0, 0.0, 0.0]


def _split(extra, pad_from):
    """How much of `extra` goes to the first side vs. the second."""
    extra = min(max(0, extra), MAX_PAD * 2)
    if pad_from == "first":
        return min(extra, MAX_PAD), 0
    if pad_from == "second":
        return 0, min(extra, MAX_PAD)
    first = extra // 2
    return first, extra - first


def _ratio_padding(width, height, ratio, pad_from):
    """Padding on whichever axis reaches `ratio`; never crops. `pad_from`
    biases the split of that axis: first (left/top), second (right/bottom),
    or both (even)."""
    if width / height < ratio:
        extra = max(0, round(height * ratio) - width)
        left, right = _split(extra, pad_from)
        return 0, 0, left, right

    extra = max(0, round(width / ratio) - height)
    top, bottom = _split(extra, pad_from)
    return top, bottom, 0, 0


class MBPadImage(io.ComfyNode):
    """Pad an image with a solid colour, either by a pixel amount per side or up
    to an aspect ratio."""

    @classmethod
    def define_schema(cls) -> io.Schema:
        return io.Schema(
            node_id="MBPadImage",
            display_name="Pad Image (MB)",
            category="MBNodes",
            description="Pad an image by pixels per side or out to an aspect ratio, in any colour.",
            search_aliases=["pad image", "border", "letterbox", "extend canvas"],
            inputs=[
                io.Image.Input("image"),
                io.Int.Input("left", default=0, min=0, max=MAX_PAD, socketless=True),
                io.Int.Input("right", default=0, min=0, max=MAX_PAD, socketless=True),
                io.Int.Input("top", default=0, min=0, max=MAX_PAD, socketless=True),
                io.Int.Input("bottom", default=0, min=0, max=MAX_PAD, socketless=True),
                io.Combo.Input(
                    "aspect_ratio",
                    options=[NO_RATIO] + RATIO_NAMES,
                    default=NO_RATIO,
                    socketless=True,
                    tooltip="none: pad by the four pixel fields. Any other value: pad evenly until "
                            "the image reaches that ratio, ignoring the pixel fields. The image is "
                            "never cropped.",
                ),
                io.Combo.Input(
                    "pad_from",
                    options=PAD_FROM,
                    default="both",
                    socketless=True,
                    tooltip="aspect ratio mode only. Which side of the padded axis gets the extra "
                            "space: both (even), first (left/top) or second (right/bottom).",
                ),
                io.Color.Input("color", default="#000000", tooltip="Colour of the padding."),
                _info.ImageInfo.Input(
                    "image_info",
                    optional=True,
                    tooltip="Wire an upstream image_info to carry its filename and mask through the pad.",
                ),
            ],
            outputs=[
                io.Image.Output("image"),
                _info.ImageInfo.Output("image_info"),
            ],
        )

    @classmethod
    def execute(
        cls, image, left, right, top, bottom, aspect_ratio, pad_from, color,
        image_info=None,
    ) -> io.NodeOutput:
        height, width = image.shape[1], image.shape[2]

        if aspect_ratio != NO_RATIO:
            ratio = RATIO_BY_NAME.get(aspect_ratio)
            if ratio is None:
                # An unknown name (an old save, a hand-edited workflow) must not
                # quietly pad to some other shape, so it pads not at all.
                logging.warning(
                    "Pad Image (MB): unknown aspect_ratio %r; padding skipped.", aspect_ratio
                )
                top = bottom = left = right = 0
            else:
                top, bottom, left, right = _ratio_padding(width, height, ratio, pad_from)

        source = image_info or {}
        # The incoming mask may not match this image, so it is fitted first in
        # both branches; the pad branch then grows the fitted mask.
        mask = _info.fit_mask(source.get("mask"), image)

        if not (top or bottom or left or right):
            result = image
            info = _info.make(
                image, mask, source.get("filename", ""),
                filenames=source.get("filenames"),
            )
        else:
            channels = image.shape[3]
            fill = _rgb(color)
            if channels == 4:
                fill.append(1.0)  # opaque padding around an image that carries alpha
            elif channels == 1:
                fill = [sum(fill) / 3.0]

            # Allocated straight at the fill colour: broadcasting the per-channel
            # tensor over an empty buffer would touch every pixel twice.
            padded = torch.tensor(
                fill[:channels], dtype=image.dtype, device=image.device
            ).expand(
                image.shape[0], height + top + bottom, width + left + right, channels
            ).clone()
            padded[:, top:top + height, left:left + width, :] = image

            # The mask describes the original pixels, so it is padded to match
            # with 0 (unmasked) around the edge rather than stretched over the
            # border.
            if mask is not None:
                grown = torch.zeros(
                    (mask.shape[0], height + top + bottom, width + left + right),
                    dtype=mask.dtype, device=mask.device,
                )
                grown[:, top:top + height, left:left + width] = mask
                mask = grown

            result = padded
            info = _info.make(
                padded, mask, source.get("filename", ""),
                filenames=source.get("filenames"),
            )

        return io.NodeOutput(result, info, ui=ui.PreviewImage(result, cls=cls))


NODES = [MBPadImage]

import torch

from comfy_api.latest import io, ui

# Aliased: "image_info" is also this node's optional input, which would
# shadow the module inside execute().
from . import image_info as _info

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


class MBPadImage(io.ComfyNode):
    """Pad an image with a solid colour. The four sides and the colour are set
    by drawing in the Pad Image dialog (web/pad_image_node.js)."""

    @classmethod
    def define_schema(cls) -> io.Schema:
        return io.Schema(
            node_id="MBPadImage",
            display_name="Pad Image (MB)",
            category="MBNodes",
            description="Pad an image with a solid colour; draw the padded area in the dialog.",
            search_aliases=["pad image", "border", "letterbox", "extend canvas"],
            inputs=[
                io.Image.Input("image"),
                io.Int.Input("left", default=0, min=0, max=MAX_PAD, socketless=True),
                io.Int.Input("right", default=0, min=0, max=MAX_PAD, socketless=True),
                io.Int.Input("top", default=0, min=0, max=MAX_PAD, socketless=True),
                io.Int.Input("bottom", default=0, min=0, max=MAX_PAD, socketless=True),
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
        cls, image, left, right, top, bottom, color,
        image_info=None,
    ) -> io.NodeOutput:
        height, width = image.shape[1], image.shape[2]

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

import torch

from comfy_api.latest import io

from .resolution_node import RATIOS

MODES = ["pixels", "aspect ratio"]
RATIO_NAMES = [name for name, _ in RATIOS]
RATIO_BY_NAME = dict(RATIOS)
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


def _ratio_padding(width, height, ratio):
    """Even padding on one axis so the image reaches `ratio`; never crops."""
    if width / height < ratio:
        extra = max(0, round(height * ratio) - width)
        left = extra // 2
        return 0, 0, left, extra - left

    extra = max(0, round(width / ratio) - height)
    top = extra // 2
    return top, extra - top, 0, 0


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
                io.Combo.Input(
                    "mode",
                    options=MODES,
                    default="pixels",
                    tooltip="pixels: pad each side by hand. aspect ratio: pad evenly until the image reaches the ratio.",
                ),
                io.Int.Input("top", default=0, min=0, max=MAX_PAD, socketless=True),
                io.Int.Input("bottom", default=0, min=0, max=MAX_PAD, socketless=True),
                io.Int.Input("left", default=0, min=0, max=MAX_PAD, socketless=True),
                io.Int.Input("right", default=0, min=0, max=MAX_PAD, socketless=True),
                io.Combo.Input(
                    "aspect_ratio",
                    options=RATIO_NAMES,
                    default="16:9",
                    socketless=True,
                    tooltip="aspect ratio mode only. The image is padded, never cropped.",
                ),
                io.Boolean.Input(
                    "portrait",
                    default=False,
                    label_on="portrait",
                    label_off="landscape",
                    tooltip="aspect ratio mode only. Flips the target ratio.",
                ),
                io.Color.Input("color", default="#000000", tooltip="Colour of the padding."),
                # Declared last so the widget order of workflows saved before it
                # existed still lines up on load.
                io.Int.Input(
                    "all_sides",
                    default=0,
                    min=0,
                    max=MAX_PAD,
                    socketless=True,
                    tooltip="Above 0 this pads every side by this many pixels and the mode, the four side fields and the ratio are all ignored.",
                ),
            ],
            outputs=[io.Image.Output("image")],
        )

    @classmethod
    def execute(
        cls, image, mode, top, bottom, left, right, aspect_ratio, portrait, color, all_sides=0,
    ) -> io.NodeOutput:
        height, width = image.shape[1], image.shape[2]

        if all_sides > 0:
            top = bottom = left = right = all_sides
        elif mode == "aspect ratio":
            ratio = RATIO_BY_NAME.get(aspect_ratio, 1.0)
            if portrait:
                ratio = 1 / ratio
            top, bottom, left, right = _ratio_padding(width, height, ratio)

        if not (top or bottom or left or right):
            return io.NodeOutput(image)

        channels = image.shape[3]
        fill = _rgb(color)
        if channels == 4:
            fill.append(1.0)  # opaque padding around an image that carries alpha
        elif channels == 1:
            fill = [sum(fill) / 3.0]

        padded = torch.empty(
            (image.shape[0], height + top + bottom, width + left + right, channels),
            dtype=image.dtype,
            device=image.device,
        )
        padded[:] = torch.tensor(fill[:channels], dtype=image.dtype, device=image.device)
        padded[:, top:top + height, left:left + width, :] = image

        return io.NodeOutput(padded)


NODES = [MBPadImage]

import math

import torch
import torch.nn.functional as F

from comfy_api.latest import io, ui

# Aliased: "image_info" is also this node's optional input, which would
# shadow the module inside execute().
from . import image_info as _info

MAX_PAD = 8192
MAX_BLUR_SIGMA = 32.0

ANCHORS = ["center", "top", "bottom", "left", "right", "top-left", "top-right", "bottom-left", "bottom-right"]
RATIOS = {"1:1": (1, 1), "4:3": (4, 3), "3:4": (3, 4), "3:2": (3, 2), "2:3": (2, 3), "16:9": (16, 9), "9:16": (9, 16), "21:9": (21, 9)}
FILL_MODES = ["color", "replicate", "reflect", "blur edge"]
MULTIPLES = ["off", "8", "16", "32", "64"]


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


def _split(extra, anchor, low, high):
    """Share `extra` pixels between two sides; the anchor names where the image sits."""
    if low in anchor:
        return 0, extra
    if high in anchor:
        return extra, 0
    return extra // 2, extra - extra // 2


def _pads(size_mode, left, right, top, bottom, multiple, width, height):
    mode = size_mode["size_mode"]
    anchor = "top-left"  # manual mode: the snap to a multiple goes right/bottom
    if mode == "target size":
        anchor = size_mode["anchor"]
        left, right = _split(max(0, size_mode["width"] - width), anchor, "left", "right")
        top, bottom = _split(max(0, size_mode["height"] - height), anchor, "top", "bottom")
    elif mode == "aspect ratio":
        anchor = size_mode["anchor"]
        rw, rh = RATIOS[size_mode["ratio"]]
        if width * rh >= height * rw:
            out_w, out_h = width, -(-width * rh // rw)
        else:
            out_w, out_h = -(-height * rw // rh), height
        left, right = _split(out_w - width, anchor, "left", "right")
        top, bottom = _split(out_h - height, anchor, "top", "bottom")

    if multiple != "off":
        n = int(multiple)
        l, r = _split(-(width + left + right) % n, anchor, "left", "right")
        t, b = _split(-(height + top + bottom) % n, anchor, "top", "bottom")
        left, right, top, bottom = left + l, right + r, top + t, bottom + b
    return left, right, top, bottom


def _axis(low, size, high, device):
    """Per canvas column (or row): distance outside the original, distance inside
    it to the nearest padded edge, and the replicate / reflect source indices."""
    k = torch.arange(-low, size + high, device=device)
    outside = (torch.clamp(-k, min=0) + torch.clamp(k - (size - 1), min=0)).float()

    far = torch.full_like(outside, math.inf)
    inside = torch.minimum((k + 1).float() if low else far, (size - k).float() if high else far)

    replicate = k.clamp(0, size - 1)
    period = max(1, 2 * (size - 1))
    reflect = k.remainder(period)
    reflect = torch.where(reflect >= size, period - reflect, reflect)
    return outside, inside, replicate, reflect


def _blur(image, sigma):
    radius = math.ceil(sigma * 3)
    x = torch.arange(-radius, radius + 1, device=image.device, dtype=image.dtype)
    kernel = torch.exp(-x * x / (2 * sigma * sigma))
    kernel = kernel / kernel.sum()

    channels = image.shape[3]
    out = F.pad(image.permute(0, 3, 1, 2), (radius, radius, radius, radius), mode="replicate")
    out = F.conv2d(out, kernel.view(1, 1, 1, -1).expand(channels, 1, 1, -1), groups=channels)
    out = F.conv2d(out, kernel.view(1, 1, -1, 1).expand(channels, 1, -1, 1), groups=channels)
    return out.permute(0, 2, 3, 1)


class MBPadImage(io.ComfyNode):
    """Pad an image for outpainting or framing. In manual mode the four sides
    are drawn in the Pad Image dialog (web/pad_image_node.js)."""

    @classmethod
    def define_schema(cls) -> io.Schema:
        def anchor():
            return io.Combo.Input("anchor", options=ANCHORS, default="center", tooltip="Where the original image sits on the padded canvas.")

        return io.Schema(
            node_id="MBPadImage",
            display_name="Pad Image (MB)",
            category="MBNodes",
            description="Pad an image with a colour or stretched, mirrored or blurred edges; outputs an outpaint mask.",
            search_aliases=["pad image", "border", "letterbox", "extend canvas", "outpaint"],
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
                io.DynamicCombo.Input("size_mode", options=[
                    io.DynamicCombo.Option("manual", []),
                    io.DynamicCombo.Option("target size", [
                        io.Int.Input("width", default=1024, min=1, max=16384, tooltip="Pad up to this width; never crops."),
                        io.Int.Input("height", default=1024, min=1, max=16384, tooltip="Pad up to this height; never crops."),
                        anchor(),
                    ]),
                    io.DynamicCombo.Option("aspect ratio", [
                        io.Combo.Input("ratio", options=list(RATIOS), default="1:1"),
                        anchor(),
                    ]),
                ], tooltip="manual: pads drawn in the dialog. target size / aspect ratio: pads worked out from the image size."),
                io.Combo.Input("fill_mode", options=FILL_MODES, default="color", tooltip="color: solid colour. replicate: stretch the edge pixels. reflect: mirror the image. blur edge: blurred stretch."),
                io.Combo.Input("multiple_of", options=MULTIPLES, default="off", tooltip="Grow the canvas so width and height are multiples of this."),
                io.Boolean.Input("transparent", default=False, tooltip="Transparent padding; adds an alpha channel to RGB images."),
                io.Int.Input("mask_feather", default=0, min=0, max=512, tooltip="Fade the outpaint mask this many px into the original image."),
                io.Int.Input("seam_blend", default=0, min=0, max=512, tooltip="Fade from the image edge into the fill over this many px."),
            ],
            outputs=[
                io.Image.Output("image"),
                _info.ImageInfo.Output("image_info"),
                io.Mask.Output("outpaint_mask", tooltip="1 over the padding, 0 over the original image."),
            ],
        )

    @classmethod
    def execute(
        cls, image, left, right, top, bottom, color, size_mode, fill_mode, multiple_of,
        transparent, mask_feather, seam_blend, image_info=None,
    ) -> io.NodeOutput:
        batch, height, width = image.shape[0], image.shape[1], image.shape[2]
        left, right, top, bottom = _pads(size_mode, left, right, top, bottom, multiple_of, width, height)

        source = image_info or {}
        # The incoming mask may not match this image, so it is fitted first in
        # both branches; the pad branch then grows the fitted mask.
        mask = _info.fit_mask(source.get("mask"), image)

        if not (top or bottom or left or right):
            result = image
            outpaint = torch.zeros((batch, height, width), dtype=image.dtype, device=image.device)
        else:
            if transparent and image.shape[3] != 4:
                rgb = image[..., :3].expand(-1, -1, -1, 3)
                image = torch.cat([rgb, torch.ones_like(image[..., :1])], dim=-1)
            channels = image.shape[3]

            out_x, in_x, rep_x, ref_x = _axis(left, width, right, image.device)
            out_y, in_y, rep_y, ref_y = _axis(top, height, bottom, image.device)
            rep = image.index_select(1, rep_y).index_select(2, rep_x)

            if fill_mode == "replicate":
                fill = rep
            elif fill_mode == "reflect":
                fill = image.index_select(1, ref_y).index_select(2, ref_x)
            elif fill_mode == "blur edge":
                fill = _blur(rep, min(MAX_BLUR_SIGMA, max(1.0, max(left, right, top, bottom) / 8)))
            else:
                values = _rgb(color)
                if channels == 4:
                    values.append(1.0)  # opaque padding around an image that carries alpha
                elif channels == 1:
                    values = [sum(values) / 3.0]
                fill = torch.tensor(values, dtype=image.dtype, device=image.device).expand_as(rep)
            if transparent:
                fill = torch.cat([fill[..., :3], torch.zeros_like(fill[..., 3:])], dim=-1)

            # Distance outside the original drives the seam fade; lerp is exact
            # at weight 0 and 1, so original pixels and a hard edge stay untouched.
            outside = torch.maximum(out_x[None, :], out_y[:, None])
            weight = (outside / (seam_blend + 1)).clamp(max=1.0).to(image.dtype)
            result = torch.lerp(rep, fill, weight[None, :, :, None])

            inside = torch.minimum(in_x[None, :], in_y[:, None])
            feather = ((mask_feather + 1 - inside) / (mask_feather + 1)).clamp(0.0, 1.0)
            outpaint = torch.where(outside > 0, 1.0, feather).to(image.dtype).expand(batch, -1, -1).contiguous()

            # The image_info mask describes the original pixels, so it is padded
            # with 0 (unmasked) rather than stretched over the border.
            if mask is not None:
                grown = torch.zeros(
                    (mask.shape[0], height + top + bottom, width + left + right),
                    dtype=mask.dtype, device=mask.device,
                )
                grown[:, top:top + height, left:left + width] = mask
                mask = grown

        info = _info.make(
            result, mask, source.get("filename", ""),
            filenames=source.get("filenames"),
        )
        return io.NodeOutput(result, info, outpaint, ui=ui.PreviewImage(result, cls=cls))


NODES = [MBPadImage]

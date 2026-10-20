import math

import torch
import torch.nn.functional as F

import comfy.model_management
from comfy_api.latest import io

# intensity, grain_size, color_amount, luminance_response
PRESETS = {
    "Fine 35mm": (0.25, 1.0, 0.15, 0.7),
    "Kodak Portra 400": (0.35, 1.4, 0.35, 0.8),
    "Tri-X 400": (0.6, 1.8, 0.0, 0.6),
    "16mm": (0.7, 2.5, 0.3, 0.6),
    "Super 8": (1.0, 3.5, 0.5, 0.5),
}

# Maps intensity to pixel amplitude; intensity ~0.3 gives a natural 35mm look.
GRAIN_SCALE = 0.1


def add_grain(image, intensity, grain_size, color_amount, luminance_response, seed):
    device = comfy.model_management.get_torch_device()
    rgb = image[..., :3].to(device)
    b, h, w, _ = rgb.shape

    generator = torch.Generator(device=device).manual_seed(seed)
    small_h, small_w = math.ceil(h / grain_size), math.ceil(w / grain_size)
    noise = torch.randn((b, 3, small_h, small_w), generator=generator, device=device, dtype=rgb.dtype)
    noise = F.interpolate(noise, size=(h, w), mode="bicubic", align_corners=False)
    noise = noise / noise.std(dim=(1, 2, 3), keepdim=True).clamp_min(1e-6)
    noise = noise.permute(0, 2, 3, 1)

    grain = torch.lerp(noise[..., :1].expand_as(noise), noise, color_amount)

    luma = rgb[..., 0:1] * 0.299 + rgb[..., 1:2] * 0.587 + rgb[..., 2:3] * 0.114
    weight = torch.lerp(torch.ones_like(luma), 4 * luma * (1 - luma), luminance_response)

    out = torch.addcmul(rgb, grain, weight, value=intensity * GRAIN_SCALE).clamp_(0, 1)
    if image.shape[-1] == 4:
        out = torch.cat((out, image[..., 3:].to(device)), dim=-1)
    return out.to(comfy.model_management.intermediate_device())


class MBFilmGrain(io.ComfyNode):
    """Add film grain shaped by luminance, from a film stock preset or manual sliders."""

    @classmethod
    def define_schema(cls) -> io.Schema:
        return io.Schema(
            node_id="MBFilmGrain",
            display_name="Film Grain (MB)",
            category="MBNodes",
            description="Add realistic film grain. Pick a film stock preset or Custom to use the sliders.",
            search_aliases=["film grain", "grain", "noise", "film look"],
            inputs=[
                io.Image.Input("image"),
                io.Combo.Input(
                    "preset",
                    options=["Custom", *PRESETS],
                    default="Fine 35mm",
                    tooltip="Film stock look. Any preset other than Custom ignores the sliders below.",
                ),
                io.Float.Input("intensity", default=0.35, min=0.0, max=2.0, step=0.01, tooltip="Grain strength."),
                io.Float.Input("grain_size", default=1.5, min=0.5, max=8.0, step=0.1, tooltip="Grain clump size in pixels."),
                io.Float.Input(
                    "color_amount",
                    default=0.0,
                    min=0.0,
                    max=1.0,
                    step=0.01,
                    tooltip="0 = mono grain, 1 = independent grain per color channel.",
                ),
                io.Float.Input(
                    "luminance_response",
                    default=0.7,
                    min=0.0,
                    max=1.0,
                    step=0.01,
                    tooltip="0 = even grain everywhere, 1 = grain strongest in midtones and fading in shadows and highlights.",
                ),
                io.Int.Input("seed", default=0, min=0, max=0xffffffffffffffff, control_after_generate=True),
            ],
            outputs=[io.Image.Output()],
        )

    @classmethod
    def execute(cls, image, preset, intensity, grain_size, color_amount, luminance_response, seed) -> io.NodeOutput:
        if preset != "Custom":
            intensity, grain_size, color_amount, luminance_response = PRESETS[preset]
        if intensity == 0:
            return io.NodeOutput(image)
        return io.NodeOutput(add_grain(image, intensity, grain_size, color_amount, luminance_response, seed))


NODES = [MBFilmGrain]

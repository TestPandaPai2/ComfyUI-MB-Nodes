import io as _io
import os

import numpy as np
import resvg_py
import torch
import vtracer
from PIL import Image

import folder_paths
from comfy_api.latest import io

PRESETS = {
    "Accurate (photo)": dict(
        colors=256, colormode="color", hierarchical="stacked", mode="spline", filter_speckle=2, color_precision=8,
        layer_difference=4, corner_threshold=60, length_threshold=3.5, max_iterations=10, splice_threshold=45, path_precision=8,
    ),
    "Poster": dict(
        colors=32, colormode="color", hierarchical="stacked", mode="spline", filter_speckle=4, color_precision=6,
        layer_difference=16, corner_threshold=60, length_threshold=4.0, max_iterations=10, splice_threshold=45, path_precision=6,
    ),
    "Logo / flat": dict(
        colors=0, colormode="color", hierarchical="cutout", mode="spline", filter_speckle=8, color_precision=4,
        layer_difference=32, corner_threshold=90, length_threshold=4.0, max_iterations=10, splice_threshold=45, path_precision=4,
    ),
    "Black & white": dict(
        colors=0, colormode="binary", hierarchical="stacked", mode="spline", filter_speckle=4, color_precision=6,
        layer_difference=16, corner_threshold=60, length_threshold=4.0, max_iterations=10, splice_threshold=45, path_precision=6,
    ),
}
CUSTOM = "Custom"

CUSTOM_INPUTS = [
    io.Int.Input("colors", default=256, min=0, max=256, tooltip="Reduce to this many colors before tracing. vtracer flattens smooth gradients into one color; a palette keeps them as bands. 0 = off."),
    io.Combo.Input("colormode", options=["color", "binary"], default="color"),
    io.Combo.Input("hierarchical", options=["stacked", "cutout"], default="stacked", tooltip="stacked: shapes layered on top of each other (smaller, no gaps). cutout: shapes never overlap."),
    io.Combo.Input("mode", options=["spline", "polygon", "none"], default="spline", tooltip="Curve fitting. spline = smooth curves, polygon = straight segments, none = pixel-exact staircase."),
    io.Int.Input("filter_speckle", default=4, min=0, max=128, tooltip="Discard patches smaller than this many pixels (squared side). Lower keeps more detail."),
    io.Int.Input("color_precision", default=6, min=1, max=8, tooltip="Significant bits per RGB channel. Higher = more colors kept."),
    io.Int.Input("layer_difference", default=16, min=1, max=255, tooltip="Color difference between gradient layers. Lower = smoother gradients, more paths."),
    io.Int.Input("corner_threshold", default=60, min=0, max=180, tooltip="Minimum angle (degrees) treated as a corner."),
    io.Float.Input("length_threshold", default=4.0, min=3.5, max=10.0, step=0.5, tooltip="Segment length for spline subdivision. Lower = more accurate curves."),
    io.Int.Input("max_iterations", default=10, min=1, max=50),
    io.Int.Input("splice_threshold", default=45, min=0, max=180, tooltip="Minimum angle displacement (degrees) to splice a spline."),
    io.Int.Input("path_precision", default=8, min=1, max=10, tooltip="Decimal places in path coordinates."),
]


def _params(preset):
    name = preset["preset"]
    if name != CUSTOM:
        return PRESETS[name]
    return {inp.id: preset[inp.id] for inp in CUSTOM_INPUTS}


def _vectorize(image_tensor, colors, params):
    """SVG text for one [H,W,C] image, sized with a viewBox so it scales."""
    pixels = (image_tensor.cpu().numpy() * 255.0).clip(0, 255).astype(np.uint8)
    height, width = pixels.shape[:2]
    pil = Image.fromarray(pixels, "RGBA" if pixels.shape[2] == 4 else "RGB")
    if colors:
        method = Image.Quantize.FASTOCTREE if pil.mode == "RGBA" else Image.Quantize.MEDIANCUT
        pil = pil.quantize(colors, method=method, kmeans=3, dither=Image.Dither.NONE).convert(pil.mode)
    buffer = _io.BytesIO()
    pil.save(buffer, "PNG", compress_level=1)
    svg = vtracer.convert_raw_image_to_svg(buffer.getvalue(), img_format="png", **params)
    return svg.replace(
        f'width="{width}" height="{height}"', f'width="{width}" height="{height}" viewBox="0 0 {width} {height}"', 1
    )


def _rasterize(svg, width, height):
    png = resvg_py.svg_to_bytes(svg_string=svg, width=width, height=height, background="#ffffff", skip_system_fonts=True)
    with Image.open(_io.BytesIO(png)) as img:
        return torch.from_numpy(np.asarray(img.convert("RGB"), dtype=np.float32) / 255.0)


class MBImageToSVG(io.ComfyNode):
    """Trace images into color SVG with vtracer."""

    @classmethod
    def define_schema(cls) -> io.Schema:
        return io.Schema(
            node_id="MBImageToSVG",
            display_name="Image To SVG (MB)",
            category="MBNodes",
            description="Vectorize images into SVG with vtracer. Outputs one SVG string per image and a render of the SVG to compare against the source.",
            search_aliases=["image to svg", "vectorize", "vector", "trace", "svg", "vtracer"],
            is_output_node=True,
            inputs=[
                io.Image.Input("image"),
                io.DynamicCombo.Input("preset", options=[
                    *[io.DynamicCombo.Option(name, []) for name in PRESETS],
                    io.DynamicCombo.Option(CUSTOM, CUSTOM_INPUTS),
                ], tooltip="Accurate keeps the most detail. Custom exposes every vtracer setting."),
                io.Boolean.Input("save", default=True, tooltip="Write each SVG to the output folder."),
                io.String.Input("filename_prefix", default="MBNodes/svg", socketless=True),
            ],
            outputs=[
                io.String.Output("svg", is_output_list=True, tooltip="One SVG string per image in the batch."),
                io.Image.Output("preview", tooltip="The SVG rendered back at the source size, on white."),
            ],
        )

    @classmethod
    def execute(cls, image, preset, save, filename_prefix) -> io.NodeOutput:
        params = dict(_params(preset))
        colors = params.pop("colors")
        height, width = image.shape[1], image.shape[2]
        svgs = [_vectorize(img, colors, params) for img in image]
        preview = torch.stack([_rasterize(svg, width, height) for svg in svgs])

        ui = {"svg": svgs}
        if save:
            full_folder, filename, counter, subfolder, _prefix = folder_paths.get_save_image_path(
                filename_prefix, folder_paths.get_output_directory(), width, height
            )
            ui["saved"] = []
            for batch_number, svg in enumerate(svgs):
                name = f"{filename.replace('%batch_num%', str(batch_number))}_{counter:05}_.svg"
                with open(os.path.join(full_folder, name), "w", encoding="utf-8") as f:
                    f.write(svg)
                ui["saved"].append(os.path.join(subfolder, name))
                counter += 1
        return io.NodeOutput(svgs, preview, ui=ui)


NODES = [MBImageToSVG]

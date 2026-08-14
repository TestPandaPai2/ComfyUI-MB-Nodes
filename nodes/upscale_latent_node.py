import comfy.utils
from comfy_api.latest import io

METHODS = ["nearest-exact", "bilinear", "area", "bicubic", "bislerp"]
DEFAULT_MULTIPLIERS = [0.5, 1.0, 1.5, 2.0, 2.5, 3.0]
MIN_MULTIPLIER = 0.05
MAX_MULTIPLIER = 8.0


class MBUpscaleLatent(io.ComfyNode):
    """Scale a latent by a multiplier picked from a button grid. The grid's
    entries live in the frontend (MB Settings adds more); the backend only ever
    sees the chosen number."""

    @classmethod
    def define_schema(cls) -> io.Schema:
        return io.Schema(
            node_id="MBUpscaleLatent",
            display_name="Upscale Latent (MB)",
            category="MBNodes",
            description="Upscale a latent by a multiplier chosen from clickable buttons.",
            search_aliases=["upscale latent", "latent upscale by", "scale latent"],
            inputs=[
                io.Latent.Input("samples"),
                io.Float.Input(
                    "multiplier",
                    default=1.0,
                    min=MIN_MULTIPLIER,
                    max=MAX_MULTIPLIER,
                    step=0.05,
                    socketless=True,
                    tooltip="Scale factor applied to the latent's width and height.",
                ),
                io.Combo.Input(
                    "upscale_method",
                    options=METHODS,
                    default="nearest-exact",
                    tooltip="Interpolation used when resampling the latent.",
                ),
            ],
            outputs=[io.Latent.Output("LATENT")],
        )

    @classmethod
    def execute(cls, samples, multiplier, upscale_method) -> io.NodeOutput:
        if multiplier == 1.0:
            return io.NodeOutput(samples)

        tensor = samples["samples"]
        width = max(1, round(tensor.shape[-1] * multiplier))
        height = max(1, round(tensor.shape[-2] * multiplier))

        out = {key: value for key, value in samples.items() if key != "noise_mask"}
        out["samples"] = comfy.utils.common_upscale(
            tensor, width, height, upscale_method, "disabled"
        )
        return io.NodeOutput(out)


NODES = [MBUpscaleLatent]

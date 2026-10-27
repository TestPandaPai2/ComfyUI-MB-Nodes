import random

import comfy.samplers
import nodes
from comfy_api.latest import io

from .upscale_latent_node import METHODS, MAX_MULTIPLIER, MIN_MULTIPLIER, upscale

MAX_SEED = 0xFFFFFFFFFFFFFFFF
SEED_MODES = ["same", "+1", "random"]


def _second_seed(seed, mode):
    if mode == "+1":
        return (seed + 1) & MAX_SEED
    if mode == "random":
        # Drawn from the pass-1 seed, so a rerun gives the same second pass.
        return random.Random(seed).getrandbits(64)
    return seed


class MBSampler(io.ComfyNode):
    """KSampler with an optional hires second pass: latent upscale, then
    resample at a lower denoise with the same cfg, sampler and scheduler. Live
    sampling preview comes for free -- common_ksampler wires up the same
    latent_preview callback the core KSampler uses."""

    @classmethod
    def define_schema(cls) -> io.Schema:
        return io.Schema(
            node_id="MBSampler",
            display_name="Sampler (MB)",
            category="MBNodes",
            description="KSampler with an optional second pass that upscales the latent and samples it again.",
            search_aliases=["ksampler", "sampler", "sample", "generate", "hires fix", "two pass", "upscale sampler"],
            inputs=[
                io.Model.Input("model"),
                io.Conditioning.Input("positive"),
                io.Conditioning.Input("negative"),
                io.Latent.Input("latent_image"),
                io.Int.Input(
                    "seed",
                    default=0,
                    min=0,
                    max=MAX_SEED,
                    control_after_generate=True,
                    tooltip="The random seed used for creating the noise.",
                ),
                io.Int.Input("steps", default=20, min=1, max=10000),
                io.Float.Input("cfg", default=8.0, min=0.0, max=100.0, step=0.1),
                io.Combo.Input(
                    "sampler_name",
                    options=comfy.samplers.KSampler.SAMPLERS,
                    default=comfy.samplers.KSampler.SAMPLERS[0],
                ),
                io.Combo.Input(
                    "scheduler",
                    options=comfy.samplers.KSampler.SCHEDULERS,
                    default=comfy.samplers.KSampler.SCHEDULERS[0],
                ),
                io.Float.Input("denoise", default=1.0, min=0.0, max=1.0, step=0.01),
                io.DynamicCombo.Input(
                    "second_pass",
                    tooltip="On: upscale the pass-1 latent and sample it again at a lower denoise (hires fix).",
                    options=[
                        io.DynamicCombo.Option("off", []),
                        io.DynamicCombo.Option("on", [
                            io.Float.Input("upscale_by", default=1.5, min=MIN_MULTIPLIER, max=MAX_MULTIPLIER, step=0.05,
                                           tooltip="Scale factor for the latent's width and height before pass 2."),
                            io.Combo.Input("upscale_method", options=METHODS, default="bislerp"),
                            io.Int.Input("steps_2", default=0, min=0, max=10000, tooltip="0 uses the pass-1 steps."),
                            io.Float.Input("denoise_2", default=0.5, min=0.0, max=1.0, step=0.01),
                            io.Combo.Input("seed_2", options=SEED_MODES, default="+1",
                                           tooltip="Pass-2 seed: the pass-1 seed, that plus one, or a random one drawn from it."),
                        ]),
                    ],
                ),
            ],
            outputs=[
                io.Latent.Output("latent"),
                io.Latent.Output("latent_pass1"),
            ],
        )

    @classmethod
    def execute(
        cls, model, positive, negative, latent_image, seed, steps, cfg, sampler_name, scheduler,
        denoise, second_pass=None,
    ) -> io.NodeOutput:
        (pass1,) = nodes.common_ksampler(
            model, seed, steps, cfg, sampler_name, scheduler, positive, negative, latent_image, denoise=denoise,
        )
        if not second_pass or second_pass.get("second_pass") != "on":
            return io.NodeOutput(pass1, pass1)

        p = second_pass
        (out_latent,) = nodes.common_ksampler(
            model, _second_seed(seed, p["seed_2"]), p["steps_2"] or steps, cfg, sampler_name, scheduler,
            positive, negative, upscale(pass1, p["upscale_by"], p["upscale_method"]), denoise=p["denoise_2"],
        )
        return io.NodeOutput(out_latent, pass1)


NODES = [MBSampler]

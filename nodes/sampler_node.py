import comfy.samplers
import comfy.utils
import nodes
from comfy_api.latest import io

UPSCALE_METHOD = "nearest-exact"  # matches the fast/cheap default MBUpscaleLatent uses
MIN_MULTIPLIER = 0.05
MAX_MULTIPLIER = 8.0


class MBSampler(io.ComfyNode):
    """KSampler + VAE decode in one node. Live sampling preview comes for
    free -- common_ksampler wires up the same latent_preview callback the
    core KSampler uses, so the frontend's usual step-by-step preview overlay
    just works. Model/conditioning/vae pass straight through so a chain of
    these (e.g. base -> refiner) doesn't need re-wiring at every stage."""

    @classmethod
    def define_schema(cls) -> io.Schema:
        return io.Schema(
            node_id="MBSampler",
            display_name="Sampler (MB)",
            category="MBNodes",
            description="Unified KSampler: samples the latent and optionally decodes it to an image in one node.",
            search_aliases=["ksampler", "sampler", "sample", "generate", "unified sampler"],
            inputs=[
                io.Model.Input("model"),
                io.Conditioning.Input("positive"),
                io.Conditioning.Input("negative"),
                io.Latent.Input("latent_image"),
                io.Int.Input(
                    "seed",
                    default=0,
                    min=0,
                    max=0xFFFFFFFFFFFFFFFF,
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
                io.Boolean.Input(
                    "upscale_latent",
                    default=False,
                    label_on="upscale",
                    label_off="off",
                    tooltip="Upscale the incoming latent by the multiplier below before sampling.",
                ),
                io.Float.Input(
                    "upscale_multiplier",
                    default=1.5,
                    min=MIN_MULTIPLIER,
                    max=MAX_MULTIPLIER,
                    step=0.05,
                    display_mode=io.NumberDisplay.slider,
                    tooltip="Scale factor applied to the incoming latent's width and height.",
                ),
                io.Boolean.Input(
                    "decode_image",
                    default=True,
                    label_on="decode",
                    label_off="skip",
                    tooltip="Decode the sampled latent to an image using vae below. Off skips the decode (faster when only the latent is needed).",
                ),
                io.Vae.Input(
                    "vae",
                    optional=True,
                    tooltip="Required when decode_image is on.",
                ),
                io.Boolean.Input(
                    "tiled_vae_decoding",
                    default=False,
                    label_on="tiled",
                    label_off="normal",
                    tooltip="Decode through VAEDecodeTiled instead, for large images that would otherwise run out of memory.",
                ),
                io.Int.Input("tile_size", default=512, min=64, max=4096, step=32, advanced=True),
                io.Int.Input("overlap", default=64, min=0, max=4096, step=32, advanced=True),
            ],
            outputs=[
                io.Model.Output("model"),
                io.Conditioning.Output("positive"),
                io.Conditioning.Output("negative"),
                io.Latent.Output("latent"),
                io.Image.Output("image"),
                io.Vae.Output("vae"),
                io.Int.Output("seed"),
            ],
        )

    @classmethod
    def execute(
        cls, model, positive, negative, latent_image, seed, steps, cfg, sampler_name, scheduler,
        denoise, upscale_latent, upscale_multiplier, decode_image, vae, tiled_vae_decoding, tile_size, overlap,
    ) -> io.NodeOutput:
        if upscale_latent and upscale_multiplier != 1.0:
            tensor = latent_image["samples"]
            width = max(1, round(tensor.shape[-1] * upscale_multiplier))
            height = max(1, round(tensor.shape[-2] * upscale_multiplier))
            latent_image = {key: value for key, value in latent_image.items() if key != "noise_mask"}
            latent_image["samples"] = comfy.utils.common_upscale(tensor, width, height, UPSCALE_METHOD, "disabled")

        (out_latent,) = nodes.common_ksampler(
            model, seed, steps, cfg, sampler_name, scheduler, positive, negative, latent_image, denoise=denoise,
        )

        image = None
        if decode_image and vae is not None:
            if tiled_vae_decoding:
                image = nodes.VAEDecodeTiled().decode(vae, out_latent, tile_size, overlap)[0]
            else:
                image = nodes.VAEDecode().decode(vae, out_latent)[0]

        return io.NodeOutput(model, positive, negative, out_latent, image, vae, seed)


NODES = [MBSampler]

"""Combined diffusion model + CLIP + VAE loader. Logic ported verbatim from
core's UNETLoader, CLIPLoader, and VAELoader (nodes.py) into one node."""

import os

import torch

import comfy.sd
import comfy.utils
import folder_paths
from comfy_api.latest import io

WEIGHT_DTYPES = ["default", "fp8_e4m3fn", "fp8_e4m3fn_fast", "fp8_e5m2"]
CLIP_TYPES = [
    "stable_diffusion", "stable_cascade", "sd3", "stable_audio", "mochi", "ltxv",
    "pixart", "cosmos", "lumina2", "wan", "hidream", "chroma", "ace", "omnigen2",
    "qwen_image", "hunyuan_image", "flux2", "ovis", "longcat_image", "cogvideox",
    "lens", "pixeldit", "ideogram4", "boogu", "krea2", "joyimage", "mage", "minimax",
]
CLIP_DEVICES = ["default", "cpu"]

VIDEO_TAES = ["taehv", "lighttaew2_2", "lighttaew2_1", "lighttaehy1_5", "taeltx_2", "taeh3"]
IMAGE_TAES = ["taesd", "taesdxl", "taesd3", "taef1", "taef2"]


def _vae_list():
    vaes = folder_paths.get_filename_list("vae")
    approx_vaes = folder_paths.get_filename_list("vae_approx")
    have_img_encoder, have_img_decoder = set(), set()
    for v in approx_vaes:
        parts = v.split("_", 1)
        if len(parts) != 2 or parts[0] not in IMAGE_TAES:
            for tae in VIDEO_TAES:
                if v.startswith(tae):
                    vaes.append(v)
                    break
            continue
        if parts[1].startswith("encoder."):
            have_img_encoder.add(parts[0])
        elif parts[1].startswith("decoder."):
            have_img_decoder.add(parts[0])
    vaes += [k for k in have_img_decoder if k in have_img_encoder]
    vaes.append("pixel_space")
    return vaes


def _load_taesd(name):
    sd = {}
    approx_vaes = folder_paths.get_filename_list("vae_approx")

    encoder = next(filter(lambda a: a.startswith(f"{name}_encoder."), approx_vaes))
    decoder = next(filter(lambda a: a.startswith(f"{name}_decoder."), approx_vaes))

    enc = comfy.utils.load_torch_file(folder_paths.get_full_path_or_raise("vae_approx", encoder))
    for k in enc:
        sd[f"taesd_encoder.{k}"] = enc[k]

    dec = comfy.utils.load_torch_file(folder_paths.get_full_path_or_raise("vae_approx", decoder))
    for k in dec:
        sd[f"taesd_decoder.{k}"] = dec[k]

    if name == "taesd":
        sd["vae_scale"], sd["vae_shift"] = torch.tensor(0.18215), torch.tensor(0.0)
    elif name == "taesdxl":
        sd["vae_scale"], sd["vae_shift"] = torch.tensor(0.13025), torch.tensor(0.0)
    elif name == "taesd3":
        sd["vae_scale"], sd["vae_shift"] = torch.tensor(1.5305), torch.tensor(0.0609)
    elif name == "taef1":
        sd["vae_scale"], sd["vae_shift"] = torch.tensor(0.3611), torch.tensor(0.1159)
    return sd


def _load_vae(vae_name):
    metadata = None
    vae_path = None
    if vae_name == "pixel_space":
        sd = {"pixel_space_vae": torch.tensor(1.0)}
    elif vae_name in IMAGE_TAES:
        sd = _load_taesd(vae_name)
    else:
        if os.path.splitext(vae_name)[0] in VIDEO_TAES:
            vae_path = folder_paths.get_full_path_or_raise("vae_approx", vae_name)
        else:
            vae_path = folder_paths.get_full_path_or_raise("vae", vae_name)
        sd, metadata = comfy.utils.load_torch_file(vae_path, return_metadata=True)
    if vae_name == "taef2":
        metadata = metadata or {}
        metadata["tae_latent_channels"] = 128
    vae = comfy.sd.VAE(sd=sd, metadata=metadata)
    vae.throw_exception_if_invalid()
    if vae_path is not None:
        vae.patcher.cached_patcher_init = (comfy.sd.load_vae_patcher, (vae_path, metadata, None))
    return vae


class MBModelCombo(io.ComfyNode):
    """Load Diffusion Model + Load CLIP + Load VAE, combined into one node."""

    @classmethod
    def define_schema(cls) -> io.Schema:
        return io.Schema(
            node_id="MBModelCombo",
            display_name="Load Models Combo (MB)",
            category="MBNodes",
            description="Loads a diffusion model, CLIP, and VAE from one node.",
            search_aliases=["load models", "checkpoint", "unet", "clip", "vae", "combo loader"],
            inputs=[
                io.Combo.Input("unet_name", options=folder_paths.get_filename_list("diffusion_models")),
                io.Combo.Input("weight_dtype", options=WEIGHT_DTYPES, default="default", advanced=True),
                io.Combo.Input("clip_name", options=folder_paths.get_filename_list("text_encoders")),
                io.Combo.Input("clip_type", options=CLIP_TYPES, default="stable_diffusion"),
                io.Combo.Input("clip_device", options=CLIP_DEVICES, default="default", advanced=True),
                io.Combo.Input("vae_name", options=_vae_list()),
            ],
            outputs=[
                io.Model.Output("model"),
                io.Clip.Output("clip"),
                io.Vae.Output("vae"),
            ],
        )

    @classmethod
    def execute(cls, unet_name, weight_dtype, clip_name, clip_type, clip_device, vae_name) -> io.NodeOutput:
        model_options = {}
        if weight_dtype == "fp8_e4m3fn":
            model_options["dtype"] = torch.float8_e4m3fn
        elif weight_dtype == "fp8_e4m3fn_fast":
            model_options["dtype"] = torch.float8_e4m3fn
            model_options["fp8_optimizations"] = True
        elif weight_dtype == "fp8_e5m2":
            model_options["dtype"] = torch.float8_e5m2
        unet_path = folder_paths.get_full_path_or_raise("diffusion_models", unet_name)
        model = comfy.sd.load_diffusion_model(unet_path, model_options=model_options)

        clip_options = {}
        if clip_device == "cpu":
            clip_options["load_device"] = clip_options["offload_device"] = torch.device("cpu")
        clip_type_enum = getattr(comfy.sd.CLIPType, clip_type.upper(), comfy.sd.CLIPType.STABLE_DIFFUSION)
        clip_path = folder_paths.get_full_path_or_raise("text_encoders", clip_name)
        clip = comfy.sd.load_clip(
            ckpt_paths=[clip_path],
            embedding_directory=folder_paths.get_folder_paths("embeddings"),
            clip_type=clip_type_enum,
            model_options=clip_options,
        )

        vae = _load_vae(vae_name)

        return io.NodeOutput(model, clip, vae)


NODES = [MBModelCombo]

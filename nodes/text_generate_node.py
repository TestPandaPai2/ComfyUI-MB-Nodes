"""Text Generate: the native Generate Text node with the text encoder picked on the node, speed presets and any number of images."""

import torch

import comfy.sd
import comfy.utils
import folder_paths
from comfy_api.latest import io

CLIP_TYPES = ["stable_diffusion", "stable_cascade", "sd3", "stable_audio", "mochi", "ltxv", "pixart", "cosmos", "lumina2", "wan", "hidream", "chroma", "ace", "omnigen2", "qwen_image", "hunyuan_image", "flux2", "ovis", "longcat_image", "cogvideox", "lens", "pixeldit", "ideogram4", "boogu", "krea2", "joyimage", "mage", "minimax", "yue2", "flux3", "moss_image", "fibo2"]
MTP_OPTIONS = ["auto", "off", "2", "3", "4", "5", "tree2s1", "tree2s2", "tree3s1", "tree4s1m8"]

SAMPLING = {"temperature": 0.7, "top_k": 64, "top_p": 0.95, "min_p": 0.05, "repetition_penalty": 1.05, "presence_penalty": 0.0}
PRESETS = {
    "Fast": {"max_length": 256, "mtp": "auto", "sampling": None},
    "Balanced": {"max_length": 512, "mtp": "auto", "sampling": SAMPLING},
    "Quality": {"max_length": 1024, "mtp": "off", "sampling": SAMPLING},
}

# Last loaded encoder, so prompt edits don't reload it from disk.
_loaded = {"key": None, "clip": None}


def load_clip(clip_name, clip_type, device):
    path = folder_paths.get_full_path_or_raise("text_encoders", clip_name)
    key = (path, clip_type, device)
    if _loaded["key"] != key:
        _loaded["key"] = _loaded["clip"] = None
        model_options = {}
        if device == "cpu":
            model_options["load_device"] = model_options["offload_device"] = torch.device("cpu")
        _loaded["clip"] = comfy.sd.load_clip(ckpt_paths=[path], embedding_directory=folder_paths.get_folder_paths("embeddings"), clip_type=getattr(comfy.sd.CLIPType, clip_type.upper()), model_options=model_options)
        _loaded["key"] = key
    return _loaded["clip"]


def batch_images(images):
    images = [img for img in images.values() if img is not None]
    if not images:
        return None
    h, w = images[0].shape[1:3]
    images = [img if img.shape[1:3] == (h, w) else comfy.utils.common_upscale(img.movedim(-1, 1), w, h, "bilinear", "disabled").movedim(1, -1) for img in images]
    return torch.cat(images)


class MBTextGenerate(io.ComfyNode):
    @classmethod
    def define_schema(cls) -> io.Schema:
        sampling_options = [
            io.DynamicCombo.Option("on", [
                io.Float.Input("temperature", default=0.7, min=0.01, max=2.0, step=0.000001),
                io.Int.Input("top_k", default=64, min=0, max=1000),
                io.Float.Input("top_p", default=0.95, min=0.0, max=1.0, step=0.01),
                io.Float.Input("min_p", default=0.05, min=0.0, max=1.0, step=0.01),
                io.Float.Input("repetition_penalty", default=1.05, min=0.0, max=5.0, step=0.01),
                io.Float.Input("presence_penalty", default=0.0, min=0.0, max=5.0, step=0.01),
            ]),
            io.DynamicCombo.Option("off", []),
        ]
        return io.Schema(
            node_id="MBNodesTextGenerate",
            display_name="MB Text Generate",
            category="MBNodes",
            description="Generate text with a local text encoder LLM, from a prompt plus optional images, video and audio.",
            search_aliases=["LLM", "generate text", "qwen", "gemma", "caption"],
            inputs=[
                io.Clip.Input("clip", optional=True, tooltip="Share a loaded CLIP with other nodes instead of loading one here. It must be an LLM (Qwen, Gemma, ...)."),
                io.Combo.Input("clip_name", options=folder_paths.get_filename_list("text_encoders"), tooltip="Text encoder file from models/text_encoders. It must be an LLM (Qwen, Gemma, ...). Ignored when clip is linked."),
                io.Combo.Input("type", options=CLIP_TYPES, default="qwen_image", tooltip="Same as the type on CLIP Loader. Ignored when clip is linked."),
                io.Combo.Input("device", options=["default", "cpu"], advanced=True, tooltip="Ignored when clip is linked."),
                io.String.Input("system_prompt", multiline=True, default="", tooltip="Replaces the model's system prompt. Ignored when use_default_template is off."),
                io.String.Input("prompt", multiline=True, dynamic_prompts=True, default=""),
                io.Autogrow.Input("images", optional=True, template=io.Autogrow.TemplatePrefix(
                    input=io.Image.Input("image"), prefix="image_", min=0, max=32), tooltip="Images of other sizes are resized to the first image."),
                io.Image.Input("video", optional=True, tooltip="Video frames as image batch. Assumed to be 24 FPS; subsampled to 1 FPS internally."),
                io.Audio.Input("audio", optional=True),
                io.DynamicCombo.Input("preset", options=[
                    io.DynamicCombo.Option("Custom", [
                        io.Int.Input("max_length", default=512, min=1, max=32768),
                        io.DynamicCombo.Input("sampling_mode", options=sampling_options),
                        io.Combo.Input("mtp", options=MTP_OPTIONS, default="auto", tooltip="Speculative decoding with the checkpoint's multi-token-prediction head. No effect without MTP weights."),
                    ]),
                ] + [io.DynamicCombo.Option(name, []) for name in PRESETS], tooltip="Fast: short greedy output with MTP. Balanced: sampled, 512 tokens. Quality: sampled, 1024 tokens, no MTP. Custom: set everything yourself."),
                io.Int.Input("seed", default=0, min=0, max=0xFFFFFFFFFFFFFFFF, control_after_generate=io.ControlAfterGenerate.fixed, tooltip="Only affects sampled output. Fast and sampling off are greedy, so the seed changes nothing there."),
                io.Boolean.Input("thinking", default=False, tooltip="Operate in thinking mode if the model supports it."),
                io.Boolean.Input("use_default_template", default=True, advanced=True, tooltip="Use the built in system prompt/template if the model has one."),
            ],
            outputs=[io.String.Output("text")],
        )

    @classmethod
    def execute(cls, clip_name, type, device, system_prompt, prompt, preset, seed, thinking, use_default_template, clip=None, images=None, video=None, audio=None) -> io.NodeOutput:
        if clip is None:
            clip = load_clip(clip_name, type, device)
        else:
            _loaded["key"] = _loaded["clip"] = None
        if preset["preset"] == "Custom":
            max_length, mtp = preset["max_length"], preset["mtp"]
            sampling = preset["sampling_mode"] if preset["sampling_mode"]["sampling_mode"] == "on" else None
        else:
            max_length, mtp, sampling = PRESETS[preset["preset"]].values()
        mtp = {"off": False, "auto": True}.get(mtp, mtp)
        sampling = sampling or {}

        tokens = clip.tokenize(prompt, image=batch_images(images or {}), skip_template=not use_default_template, min_length=1, thinking=thinking, video=video, audio=audio, system_prompt=system_prompt if use_default_template else "")
        generated_ids = clip.generate(
            tokens,
            do_sample=bool(sampling),
            max_length=max_length,
            temperature=sampling.get("temperature", 1.0),
            top_k=sampling.get("top_k", 50),
            top_p=sampling.get("top_p", 1.0),
            min_p=sampling.get("min_p", 0.0),
            repetition_penalty=sampling.get("repetition_penalty", 1.0),
            presence_penalty=sampling.get("presence_penalty", 0.0),
            seed=seed if sampling else None,
            mtp=mtp,
        )
        text = clip.decode(generated_ids)

        # Same split as native Generate Text: </think> ends reasoning; without one, reasoning opened by the output or prompt was cut off by max_length
        reasoning, sep, answer = text.partition("</think>")
        if not sep and not reasoning.lstrip().startswith("<think>"):
            if isinstance(tokens, dict):
                tokens = next(iter(tokens.values()))
            prompt_ids = [t[0] for t in tokens[-1] if isinstance(t, tuple) and isinstance(t[0], int)]
            if not prompt.rstrip().endswith("<think>") and not clip.decode(prompt_ids[-4:]).rstrip().endswith("<think>"):
                answer = text
        return io.NodeOutput(answer.strip())


NODES = [MBTextGenerate]

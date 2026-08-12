import os
import random
import shutil
from fractions import Fraction

import folder_paths
from comfy.cli_args import args
from comfy_api.latest import InputImpl, Types, io, ui


def _resolve_folder(output_folder):
    """Blank means the ComfyUI output folder; a relative path hangs off it."""
    folder = (output_folder or "").strip()
    if not folder:
        return folder_paths.get_output_directory()
    if not os.path.isabs(folder):
        folder = os.path.join(folder_paths.get_output_directory(), folder)
    os.makedirs(folder, exist_ok=True)
    return folder


def _previewable(path):
    """A SavedResult the frontend can actually fetch. Files saved outside the
    servable folders are copied into temp so the preview still works."""
    for base, folder_type in (
        (folder_paths.get_output_directory(), io.FolderType.output),
        (folder_paths.get_temp_directory(), io.FolderType.temp),
    ):
        if folder_paths.is_within_directory(base, path):
            subfolder = os.path.relpath(os.path.dirname(path), base)
            return ui.SavedResult(
                os.path.basename(path), "" if subfolder == "." else subfolder, folder_type
            )

    temp_dir = folder_paths.get_temp_directory()
    os.makedirs(temp_dir, exist_ok=True)
    copy_name = f"mbmp4_{random.randint(0, 0xFFFFFFFF):08x}_{os.path.basename(path)}"
    shutil.copyfile(path, os.path.join(temp_dir, copy_name))
    return ui.SavedResult(copy_name, "", io.FolderType.temp)


def _trim(images, audio, fps):
    """Cut video and audio down to whichever of the two ends first."""
    if audio is None:
        return images, audio

    waveform = audio["waveform"]
    sample_rate = audio["sample_rate"]
    audio_seconds = waveform.shape[-1] / sample_rate

    frames = max(1, min(images.shape[0], int(round(audio_seconds * fps))))
    images = images[:frames]

    samples = min(waveform.shape[-1], int(round((frames / fps) * sample_rate)))
    return images, {"waveform": waveform[..., :samples], "sample_rate": sample_rate}


class MBSaveMP4(io.ComfyNode):
    """Encode a batch of images (plus optional audio) to an mp4, saved where you
    point it or previewed only, with the player shown on the node."""

    @classmethod
    def define_schema(cls) -> io.Schema:
        return io.Schema(
            node_id="MBSaveMP4",
            display_name="SaveMP4 (MB)",
            category="MBNodes",
            description="Write images and audio to an mp4, with a preview player on the node.",
            search_aliases=["save mp4", "save video", "export video"],
            is_output_node=True,
            inputs=[
                io.Image.Input("images"),
                io.Audio.Input("audio", optional=True),
                io.Float.Input(
                    "fps",
                    default=24.0,
                    min=0.01,
                    max=1000.0,
                    step=0.01,
                    tooltip="Frame rate of the encoded video.",
                ),
                io.Boolean.Input(
                    "preview_only",
                    default=False,
                    label_on="preview",
                    label_off="save",
                    tooltip="preview: encode to the temp folder only. save: write to the folder below.",
                ),
                io.String.Input("filename_prefix", default="MBNodes", socketless=True),
                io.String.Input(
                    "output_folder",
                    default="",
                    socketless=True,
                    tooltip="Blank = the ComfyUI output folder. Otherwise an absolute path, or a path relative to the output folder.",
                ),
                io.Boolean.Input(
                    "trim_to_audio",
                    default=False,
                    tooltip="Drop frames past the end of the audio, so the video stops when the audio does.",
                ),
            ],
            outputs=[],
            hidden=[io.Hidden.prompt, io.Hidden.extra_pnginfo],
        )

    @classmethod
    def validate_inputs(cls, **kwargs) -> bool | str:
        folder = (kwargs.get("output_folder") or "").strip()
        if folder and os.path.isabs(folder) and os.path.isfile(folder):
            return f"output_folder is a file, not a folder: {folder}"
        return True

    @classmethod
    def execute(
        cls, images, fps, preview_only, filename_prefix, output_folder, trim_to_audio, audio=None
    ) -> io.NodeOutput:
        if trim_to_audio:
            images, audio = _trim(images, audio, fps)

        metadata = None
        if not args.disable_metadata:
            metadata = dict(cls.hidden.extra_pnginfo or {})
            if cls.hidden.prompt is not None:
                metadata["prompt"] = cls.hidden.prompt
            metadata = metadata or None

        if preview_only:
            base_dir = folder_paths.get_temp_directory()
            prefix = f"mbmp4_preview_{random.randint(0, 0xFFFFFFFF):08x}"
        else:
            base_dir = _resolve_folder(output_folder)
            prefix = filename_prefix

        full_folder, filename, counter, _subfolder, _prefix = folder_paths.get_save_image_path(
            prefix, base_dir, images.shape[2], images.shape[1]
        )
        path = os.path.join(full_folder, f"{filename}_{counter:05}_.mp4")

        video = InputImpl.VideoFromComponents(
            Types.VideoComponents(
                images=images,
                audio=audio,
                frame_rate=Fraction(round(fps * 1000), 1000),
            )
        )
        video.save_to(
            path,
            format=Types.VideoContainer.MP4,
            codec=Types.VideoCodec.H264,
            metadata=metadata,
        )

        return io.NodeOutput(ui=ui.PreviewVideo([_previewable(path)]))


NODE_CLASS_MAPPINGS = {"MBSaveMP4": MBSaveMP4}
NODE_DISPLAY_NAME_MAPPINGS = {"MBSaveMP4": "SaveMP4 (MB)"}

import os
import random

import torch

import folder_paths
from comfy_api.input import VideoInput
from comfy_api.latest import Types, io, ui


class MBPreviewAnything(io.ComfyNode):
    """Shows a live preview of whatever comes in -- image, mask, audio and
    video get a real preview, everything else falls back to a text repr --
    and passes the value through unchanged."""

    @classmethod
    def define_schema(cls) -> io.Schema:
        return io.Schema(
            node_id="MBPreviewAnything",
            display_name="Preview Anything (MB)",
            category="MBNodes",
            description="Preview any input on the node -- image/mask/audio/video get a real preview, everything else a text repr -- and pass it through unchanged.",
            search_aliases=["preview anything", "show anything", "print anything", "debug"],
            inputs=[io.AnyType.Input("value")],
            outputs=[io.AnyType.Output("value")],
            is_output_node=True,
        )

    @classmethod
    def execute(cls, value) -> io.NodeOutput:
        return io.NodeOutput(value, ui=cls._make_preview(value))

    @classmethod
    def _make_preview(cls, value):
        if isinstance(value, VideoInput):
            return cls._preview_video(value)
        if isinstance(value, dict) and "waveform" in value and "sample_rate" in value:
            return ui.PreviewAudio(value, cls=cls)
        if torch.is_tensor(value):
            if value.ndim == 4 and value.shape[-1] in (1, 3, 4):
                return ui.PreviewImage(value, cls=cls)
            if value.ndim in (2, 3):
                return ui.PreviewMask(value, cls=cls)
        return ui.PreviewText(str(value))

    @classmethod
    def _preview_video(cls, video: VideoInput) -> ui.PreviewVideo:
        temp_dir = folder_paths.get_temp_directory()
        os.makedirs(temp_dir, exist_ok=True)
        name = "MBPreviewAnything_" + "".join(random.choice("abcdefghijklmnopqrstuvwxyz") for _ in range(5))
        ext = Types.VideoContainer.get_extension(Types.VideoContainer.AUTO)
        file = f"{name}.{ext}"
        video.save_to(os.path.join(temp_dir, file), format=Types.VideoContainer.AUTO)
        return ui.PreviewVideo([ui.SavedResult(file, "", io.FolderType.temp)])


NODES = [MBPreviewAnything]

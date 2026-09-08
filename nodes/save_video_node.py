import os
from fractions import Fraction

import folder_paths
from comfy.cli_args import args
from comfy_api.latest import InputImpl, Types, io


def _resolve_folder(output_folder):
    """Blank means the ComfyUI output folder; a relative path hangs off it;
    an absolute path can point anywhere on disk."""
    folder = (output_folder or "").strip()
    if not folder:
        return folder_paths.get_output_directory()
    if not os.path.isabs(folder):
        folder = os.path.join(folder_paths.get_output_directory(), folder)
    os.makedirs(folder, exist_ok=True)
    return folder


class MBSaveVideo(io.ComfyNode):
    """Encode a batch of images (plus optional audio) straight to disk. No
    preview, no player — just a save."""

    @classmethod
    def define_schema(cls) -> io.Schema:
        return io.Schema(
            node_id="MBSaveVideo",
            display_name="Save Video (MB)",
            category="MBNodes",
            description="Write images and audio to an mp4 with no preview.",
            search_aliases=["save video", "save mp4", "export video"],
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
                io.String.Input("filename_prefix", default="MBNodes", socketless=True),
                io.String.Input(
                    "output_folder",
                    default="",
                    socketless=True,
                    tooltip="Blank = the ComfyUI output folder. Otherwise an absolute path (anywhere on disk), or a path relative to the output folder.",
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
    def execute(cls, images, fps, filename_prefix, output_folder, audio=None) -> io.NodeOutput:
        metadata = None
        if not args.disable_metadata:
            metadata = dict(cls.hidden.extra_pnginfo or {})
            if cls.hidden.prompt is not None:
                metadata["prompt"] = cls.hidden.prompt
            metadata = metadata or None

        base_dir = _resolve_folder(output_folder)
        full_folder, filename, counter, _subfolder, _prefix = folder_paths.get_save_image_path(
            filename_prefix, base_dir, images.shape[2], images.shape[1]
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

        return io.NodeOutput()


NODES = [MBSaveVideo]

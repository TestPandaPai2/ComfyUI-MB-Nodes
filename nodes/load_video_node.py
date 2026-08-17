import os

import torch

import folder_paths
from comfy_api.latest import io, InputImpl

SILENT_SAMPLE_RATE = 44100


def _video_files():
    input_dir = folder_paths.get_input_directory()
    files = [f for f in os.listdir(input_dir) if os.path.isfile(os.path.join(input_dir, f))]
    return sorted(folder_paths.filter_files_content_types(files, ["video"]))


def _silent_audio():
    """Stand-in for a video with no audio track, so nodes downstream get a
    well-formed AUDIO dict instead of None."""
    return {"waveform": torch.zeros(1, 2, 1), "sample_rate": SILENT_SAMPLE_RATE}


class MBLoadVideo(io.ComfyNode):
    """Load a video from the input folder and split it into frames, audio,
    frame rate and duration."""

    @classmethod
    def define_schema(cls) -> io.Schema:
        return io.Schema(
            node_id="MBLoadVideo",
            display_name="Load Video (MB)",
            category="MBNodes",
            description="Load a video and output its frames, audio, frame rate and length in seconds.",
            search_aliases=["load video", "upload video", "video input", "video to frames"],
            inputs=[
                io.Combo.Input(
                    "file",
                    options=_video_files(),
                    upload=io.UploadType.video,
                ),
            ],
            outputs=[
                io.Image.Output("images"),
                io.Audio.Output("audio"),
                io.Float.Output("fps"),
                io.Float.Output("seconds"),
                io.Video.Output("video"),
            ],
        )

    @classmethod
    def validate_inputs(cls, file) -> bool | str:
        if not folder_paths.exists_annotated_filepath(file):
            return f"Invalid video file: {file}"
        return True

    @classmethod
    def fingerprint_inputs(cls, file) -> float:
        # Modification time rather than a hash: video files are large.
        return os.path.getmtime(folder_paths.get_annotated_filepath(file))

    @classmethod
    def execute(cls, file) -> io.NodeOutput:
        path = folder_paths.get_annotated_filepath(file)
        video = InputImpl.VideoFromFile(path)

        components = video.get_components()
        audio = components.audio if components.audio is not None else _silent_audio()
        fps = float(components.frame_rate)

        # Prefer the frame count over the container duration: the two disagree
        # on files whose header length is wrong, and the frames are what the
        # rest of the graph actually works on.
        frames = components.images.shape[0]
        seconds = frames / fps if fps > 0 else float(video.get_duration())

        return io.NodeOutput(components.images, audio, fps, seconds, video)


NODES = [MBLoadVideo]

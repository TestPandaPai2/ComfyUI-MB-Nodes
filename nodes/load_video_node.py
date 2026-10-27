import os

import torch

import folder_paths
from comfy_api.latest import io, InputImpl

from . import image_info

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
                io.Int.Input("start_frame", default=0, min=0, tooltip="First source frame to load."),
                io.Int.Input("frame_cap", default=0, min=0, tooltip="Most frames to output. 0 loads to the end."),
                io.Float.Input("force_fps", default=0.0, min=0.0, max=240.0, step=0.01,
                               tooltip="Resample to this frame rate, dropping or repeating frames. 0 keeps the source rate."),
            ],
            outputs=[
                io.Image.Output("images"),
                io.Audio.Output("audio"),
                io.Float.Output("fps"),
                io.Float.Output("seconds"),
                io.Video.Output("video"),
                image_info.ImageInfo.Output("image_info"),
            ],
        )

    @classmethod
    def validate_inputs(cls, file, **kwargs) -> bool | str:
        if not folder_paths.exists_annotated_filepath(file):
            return f"Invalid video file: {file}"
        return True

    @classmethod
    def fingerprint_inputs(cls, file, **kwargs) -> float:
        # Modification time rather than a hash: video files are large. The
        # other inputs are already part of the cache key.
        return os.path.getmtime(folder_paths.get_annotated_filepath(file))

    @classmethod
    def execute(cls, file, start_frame=0, frame_cap=0, force_fps=0.0) -> io.NodeOutput:
        path = folder_paths.get_annotated_filepath(file)

        # Core decodes only the trimmed window and trims the audio to match.
        # Half a frame of slack so rounding never comes up one frame short.
        src_fps = float(InputImpl.VideoFromFile(path).get_frame_rate())
        out_fps = force_fps or src_fps
        start_time = start_frame / src_fps if start_frame else 0
        duration = (frame_cap + 0.5) / out_fps if frame_cap else 0
        video = InputImpl.VideoFromFile(path, start_time=start_time, duration=duration)

        components = video.get_components()
        images = components.images
        audio = components.audio if components.audio is not None else _silent_audio()
        fps = float(components.frame_rate)

        if force_fps and fps > 0:
            count = max(1, int(images.shape[0] / fps * force_fps))
            images = images[[min(round(k * fps / force_fps), images.shape[0] - 1) for k in range(count)]]
            fps = force_fps
        if frame_cap:
            images = images[:frame_cap]

        # Prefer the frame count over the container duration: the two disagree
        # on files whose header length is wrong, and the frames are what the
        # rest of the graph actually works on.
        frames = images.shape[0]
        seconds = frames / fps if fps > 0 else float(video.get_duration())

        return io.NodeOutput(
            images, audio, fps, seconds, video,
            image_info.make(images, None, file),
        )


NODES = [MBLoadVideo]

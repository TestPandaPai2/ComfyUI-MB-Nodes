import os
import re

import av
import torchaudio

import folder_paths
from comfy_api.latest import io

CACHE_DIR_NAME = "MBNodesCache"  # shared with the other MB save/preview nodes

FORMATS = ["flac", "mp3", "opus", "wav"]
QUALITIES = ["V0", "64k", "96k", "128k", "192k", "320k"]
BITRATES = {"64k": 64000, "96k": 96000, "128k": 128000, "192k": 192000, "320k": 320000}
OPUS_RATES = [8000, 12000, 16000, 24000, 48000]

KEY_SAFE = re.compile(r"[^A-Za-z0-9_.-]")
INVALID_FILENAME = re.compile(r'[\\/:*?"<>|]')


def _cache_dir():
    path = os.path.join(folder_paths.get_output_directory(), CACHE_DIR_NAME)
    os.makedirs(path, exist_ok=True)
    return path


def _cache_key(workflow_id, node_id):
    """One cache slot per node per workflow, so a restart can find it again."""
    return KEY_SAFE.sub("_", f"audio_{workflow_id or 'default'}_{node_id or '0'}")


def _write_audio(waveform, sample_rate, path, fmt, quality):
    """Encode one waveform (channels, samples) to `path`. wav goes through
    torchaudio; the compressed formats go through PyAV, same encoder settings
    ComfyUI's own SaveAudio nodes use."""
    if fmt == "wav":
        torchaudio.save(path, waveform.cpu(), sample_rate, format="wav")
        return

    orig_rate = sample_rate
    if fmt == "opus":
        if sample_rate > 48000:
            sample_rate = 48000
        elif sample_rate not in OPUS_RATES:
            sample_rate = next((r for r in OPUS_RATES if r > sample_rate), 48000)
        if sample_rate != orig_rate:
            waveform = torchaudio.functional.resample(waveform, orig_rate, sample_rate)

    layout = "mono" if waveform.shape[0] == 1 else "stereo"
    container = av.open(path, mode="w", format=fmt)
    if fmt == "opus":
        stream = container.add_stream("libopus", rate=sample_rate, layout=layout)
        stream.bit_rate = BITRATES.get(quality, 128000)
    elif fmt == "mp3":
        stream = container.add_stream("libmp3lame", rate=sample_rate, layout=layout)
        if quality == "V0":
            stream.codec_context.qscale = 1
        else:
            stream.bit_rate = BITRATES.get(quality, 128000)
    else:  # flac
        stream = container.add_stream("flac", rate=sample_rate, layout=layout)

    frame = av.AudioFrame.from_ndarray(
        waveform.movedim(0, 1).reshape(1, -1).float().numpy(), format="flt", layout=layout,
    )
    frame.sample_rate = sample_rate
    frame.pts = 0
    container.mux(stream.encode(frame))
    container.mux(stream.encode(None))  # flush
    container.close()


def _resolve_folder(output_folder):
    folder = (output_folder or "").strip()
    if not folder:
        return folder_paths.get_output_directory()
    if not os.path.isabs(folder):
        folder = os.path.join(folder_paths.get_output_directory(), folder)
    os.makedirs(folder, exist_ok=True)
    return folder


class MBPreviewAudio(io.ComfyNode):
    """Play the incoming audio on the node, with its own volume slider that only
    affects that playback. The audio passes through unchanged, and can also be
    saved to disk in mp3/opus/wav/flac."""

    @classmethod
    def define_schema(cls) -> io.Schema:
        return io.Schema(
            node_id="MBPreviewAudio",
            display_name="Preview Audio (MB)",
            category="MBNodes",
            description="Preview audio with a node-side volume slider, and optionally save it as mp3/opus/wav/flac.",
            search_aliases=["preview audio", "play audio", "save audio", "export audio"],
            inputs=[
                io.Audio.Input("audio"),
                io.Float.Input(
                    "volume",
                    default=100.0,
                    min=0.0,
                    max=100.0,
                    step=1.0,
                    display_mode=io.NumberDisplay.slider,
                    tooltip="Preview player volume, in percent. Only affects playback on the node — the output audio and any saved file are untouched.",
                ),
                io.Boolean.Input(
                    "save_to_file",
                    default=False,
                    label_on="save",
                    label_off="preview",
                    tooltip="preview: play on the node only. save: also write the file below.",
                ),
                io.Combo.Input(
                    "format", options=FORMATS, default="flac",
                    tooltip="File format used when save mode is on.",
                ),
                io.Combo.Input(
                    "quality",
                    options=QUALITIES,
                    default="192k",
                    tooltip="mp3/opus only. V0 is mp3's variable-bitrate top quality. Ignored for wav/flac.",
                ),
                io.String.Input(
                    "filename",
                    default="",
                    socketless=True,
                    tooltip="save mode only. Blank = auto-numbered using filename_prefix below. Otherwise the exact file name — the format's extension is added automatically.",
                ),
                io.String.Input("filename_prefix", default="MBNodes", socketless=True),
                io.String.Input(
                    "output_folder",
                    default="",
                    socketless=True,
                    tooltip="save mode only. Blank = the ComfyUI output folder. Otherwise an absolute path, or a path relative to the output folder.",
                ),
            ],
            outputs=[
                io.Audio.Output("audio"),
            ],
            hidden=[io.Hidden.extra_pnginfo, io.Hidden.unique_id],
        )

    @classmethod
    def validate_inputs(cls, **kwargs) -> bool | str:
        folder = (kwargs.get("output_folder") or "").strip()
        if folder and os.path.isabs(folder) and os.path.isfile(folder):
            return f"output_folder is a file, not a folder: {folder}"
        return True

    @classmethod
    def execute(
        cls, audio, volume, save_to_file, format, quality, filename, filename_prefix, output_folder,
    ) -> io.NodeOutput:
        hidden = cls.hidden
        workflow = ((hidden.extra_pnginfo if hidden else None) or {}).get("workflow") or {}
        key = _cache_key(workflow.get("id"), hidden.unique_id if hidden else None)

        waveform = audio["waveform"][0]
        sample_rate = audio["sample_rate"]

        # A quick lossless copy the node can always play, whether or not this run
        # also saves a real file — kept in the shared cache dir so it survives a
        # restart, the same way the crop/save nodes' previews do.
        try:
            _write_audio(waveform, sample_rate, os.path.join(_cache_dir(), f"{key}.wav"), "wav", quality)
        except Exception as e:
            print(f"[MBNodes] preview audio cache failed: {e}")

        if save_to_file:
            base_dir = _resolve_folder(output_folder)
            clean_name = INVALID_FILENAME.sub("_", filename.strip()) if filename.strip() else ""
            if clean_name:
                suffix = f".{format}"
                if clean_name.lower().endswith(suffix):
                    clean_name = clean_name[: -len(suffix)]
                path = os.path.join(base_dir, f"{clean_name}{suffix}")
            else:
                full_folder, name, counter, _sub, _prefix = folder_paths.get_save_image_path(
                    filename_prefix, base_dir
                )
                path = os.path.join(full_folder, f"{name}_{counter:05}_.{format}")
            _write_audio(waveform, sample_rate, path, format, quality)

        return io.NodeOutput(audio)


# Lets the frontend re-attach the cached preview after a restart, when the
# usual execution history is empty.
try:
    from server import PromptServer
    from aiohttp import web

    @PromptServer.instance.routes.get("/mbnodes/preview_audio_source")
    async def _mbnodes_preview_audio_source(request):
        key = _cache_key(request.query.get("workflow_id"), request.query.get("node_id"))
        filename = f"{key}.wav"
        if not os.path.isfile(os.path.join(_cache_dir(), filename)):
            return web.json_response({"audio": None})
        return web.json_response(
            {"audio": {"filename": filename, "subfolder": CACHE_DIR_NAME, "type": "output"}}
        )
except Exception:  # server missing (unit runs) or route already registered
    pass


NODES = [MBPreviewAudio]

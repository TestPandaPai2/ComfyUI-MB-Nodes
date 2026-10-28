import os
import re

import folder_paths
from comfy_api.latest import io

DELIMITERS = {
    "blank line": re.compile(r"\n[ \t]*\n"),
    "newline": re.compile(r"\n"),
    "---": re.compile(r"^[ \t]*---[ \t]*$", re.MULTILINE),
    "<>": re.compile(r"<>"),
}


def text_files():
    input_dir = folder_paths.get_input_directory()
    files = [f for f in os.listdir(input_dir) if f.lower().endswith(".txt") and os.path.isfile(os.path.join(input_dir, f))]
    return sorted(files)


def resolve(file):
    """Combo values are untrusted: only .txt files inside input/ are read."""
    input_dir = os.path.abspath(folder_paths.get_input_directory())
    path = os.path.abspath(os.path.join(input_dir, file))
    if not file.lower().endswith(".txt") or os.path.commonpath([input_dir, path]) != input_dir:
        raise ValueError(f"Invalid prompt file: {file}")
    return path


class MBLoadPromptsFromFile(io.ComfyNode):
    """Splits an uploaded .txt file into prompts and outputs them as a list, so
    everything downstream runs once per prompt in a single queue."""

    @classmethod
    def define_schema(cls) -> io.Schema:
        return io.Schema(
            node_id="MBLoadPromptsFromFile",
            display_name="Load Prompts From File (MB)",
            category="MBNodes",
            description="Load a .txt of prompts, split by a delimiter, and batch run each one.",
            search_aliases=["prompts from file", "prompt list", "batch prompts", "load txt"],
            inputs=[
                io.Combo.Input("file", options=text_files(), tooltip="A .txt file in ComfyUI's input folder. Use the upload button to add one."),
                io.Combo.Input("delimiter", options=list(DELIMITERS), default="blank line", tooltip="What separates prompts inside the file."),
                io.Int.Input("start", default=0, min=0, tooltip="Index of the first prompt to output (0 = first)."),
                io.Int.Input("limit", default=0, min=0, tooltip="Most prompts to output. 0 = all."),
            ],
            outputs=[
                io.String.Output("prompts", is_output_list=True),
                io.Int.Output("count"),
            ],
        )

    @classmethod
    def fingerprint_inputs(cls, file, delimiter, start, limit) -> str:
        path = resolve(file)
        return f"{os.path.getmtime(path) if os.path.isfile(path) else 0}|{file}|{delimiter}|{start}|{limit}"

    @classmethod
    def execute(cls, file, delimiter, start, limit) -> io.NodeOutput:
        with open(resolve(file), encoding="utf-8", errors="replace") as f:
            text = f.read().replace("\r\n", "\n").replace("\r", "\n")
        prompts = [p.strip() for p in DELIMITERS[delimiter].split(text)]
        prompts = [p for p in prompts if p][start:]
        if limit:
            prompts = prompts[:limit]
        if not prompts:
            raise ValueError(f"No prompts found in {file} (delimiter '{delimiter}', start {start}).")
        return io.NodeOutput(prompts, len(prompts))


NODES = [MBLoadPromptsFromFile]

"""View All (MB): pick a file from ComfyUI's wildcards folder and output its
whole text, unchanged, plus how many items it holds."""

import os

import folder_paths
from comfy_api.latest import io, ui

from .wildcard_select_node import WILDCARD_FOLDER, read_items, wildcard_files


class MBWildcardViewAll(io.ComfyNode):
    @classmethod
    def define_schema(cls) -> io.Schema:
        files = wildcard_files()
        return io.Schema(
            node_id="MBWildcardViewAll",
            display_name="View All (MB)",
            category="MBNodes",
            description="Output the full text of a wildcard file and show it on the node.",
            search_aliases=["view all", "wildcard text", "read wildcard", "show wildcard"],
            is_output_node=True,
            inputs=[
                io.Combo.Input(
                    "wildcard",
                    options=files,
                    default=files[0] if files else None,
                    socketless=True,
                    tooltip="A .txt file from ComfyUI's wildcards folder.",
                ),
            ],
            outputs=[
                io.String.Output("text"),
                io.Int.Output("item_count", tooltip="Non-blank lines that are not # comments."),
            ],
        )

    @classmethod
    def execute(cls, wildcard) -> io.NodeOutput:
        path = folder_paths.get_full_path(WILDCARD_FOLDER, wildcard) if wildcard else None
        text = ""
        if path:
            try:
                with open(path, "r", encoding="utf-8", errors="replace") as f:
                    text = f.read()
            except OSError:
                pass
        return io.NodeOutput(text, len(read_items(wildcard)), ui=ui.PreviewText(text))

    @classmethod
    def fingerprint_inputs(cls, wildcard):
        # Editing the file has to re-run the node.
        path = folder_paths.get_full_path(WILDCARD_FOLDER, wildcard) if wildcard else None
        try:
            mtime = os.path.getmtime(path) if path else 0
        except OSError:
            mtime = 0
        return f"{wildcard}|{mtime}"


NODES = [MBWildcardViewAll]

"""Replace Text Advanced (MB): run any number of find/replace pairs over one
text, in order. The pair rows are drawn by web/replace_text_advanced_node.js,
which grows a new empty row whenever the last one is filled, and stores the
pairs as JSON in the hidden `pairs` widget. Each row widget also has a socket;
a linked `find_N` / `replace_N` arrives as an extra input and wins over the
typed value of row N."""

import json
import re

from comfy_api.latest import io

ROW_INPUT = re.compile(r"(find|replace)_(\d+)")


class MBReplaceTextAdvanced(io.ComfyNode):
    @classmethod
    def define_schema(cls) -> io.Schema:
        return io.Schema(
            node_id="MBReplaceTextAdvanced",
            display_name="Replace Text Advanced",
            category="MBNodes",
            description=(
                "Replace text using any number of Text To Replace / Replaced Text pairs, "
                "applied top to bottom. Filling the last pair adds a new one."
            ),
            search_aliases=["replace text", "find and replace", "substitute", "text replace"],
            # Linked row sockets (find_N / replace_N) are added by the frontend.
            accept_all_inputs=True,
            inputs=[
                io.String.Input("text", multiline=True, tooltip="The text to edit."),
                # JSON list of {"find", "replace"}, written by the pair rows on
                # the node and hidden from the widget list by the frontend.
                io.String.Input("pairs", default="[]", socketless=True),
            ],
            outputs=[io.String.Output("text")],
        )

    @classmethod
    def execute(cls, text, pairs, **linked) -> io.NodeOutput:
        rows = [{"find": p.get("find", ""), "replace": p.get("replace", "")} for p in json.loads(pairs or "[]")]
        for name, value in linked.items():
            match = ROW_INPUT.fullmatch(name)
            if not match or value is None:
                continue
            index = int(match.group(2)) - 1
            while len(rows) <= index:
                rows.append({"find": "", "replace": ""})
            rows[index][match.group(1)] = value

        for row in rows:
            if row["find"]:
                text = text.replace(row["find"], row["replace"])
        return io.NodeOutput(text)


NODES = [MBReplaceTextAdvanced]

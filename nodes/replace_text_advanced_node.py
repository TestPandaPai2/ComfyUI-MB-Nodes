"""Replace Text Advanced (MB): run up to 10 find/replace pairs over one text,
in order. Each pair slot is a regular widget that can also be linked."""

from comfy_api.latest import io

SLOTS = 10


class MBReplaceTextAdvanced(io.ComfyNode):
    @classmethod
    def define_schema(cls) -> io.Schema:
        inputs = [io.String.Input("text", force_input=True, tooltip="The text to edit.")]
        for n in range(1, SLOTS + 1):
            inputs.append(io.String.Input(f"find_{n}", default="", display_name=f"Text To Replace {n}"))
            inputs.append(io.String.Input(f"replace_{n}", default="", display_name=f"Replaced Text {n}"))
        return io.Schema(
            node_id="MBReplaceTextAdvanced",
            display_name="Replace Text Advanced",
            category="MBNodes",
            description=f"Replace text using up to {SLOTS} Text To Replace / Replaced Text pairs, applied top to bottom.",
            search_aliases=["replace text", "find and replace", "substitute", "text replace"],
            inputs=inputs,
            outputs=[io.String.Output("text")],
        )

    @classmethod
    def execute(cls, text, **slots) -> io.NodeOutput:
        for n in range(1, SLOTS + 1):
            find = slots.get(f"find_{n}", "")
            if find:
                text = text.replace(find, slots.get(f"replace_{n}", ""))
        return io.NodeOutput(text)


NODES = [MBReplaceTextAdvanced]

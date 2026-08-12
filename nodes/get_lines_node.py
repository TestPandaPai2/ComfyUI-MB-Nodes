from comfy_api.latest import io

MAX_LINES = 32  # hard cap on the outputs the node can offer


def split_lines(text):
    """Non-blank lines with trailing whitespace stripped."""
    if not isinstance(text, str):
        text = "" if text is None else str(text)
    return [line.rstrip() for line in text.splitlines() if line.strip()]


class MBGetLines(io.ComfyNode):
    """Splits incoming text into one output per line. The frontend shows only as
    many output slots as the text has lines, rechecked every few seconds."""

    @classmethod
    def define_schema(cls) -> io.Schema:
        return io.Schema(
            node_id="MBGetLines",
            display_name="Get Lines (MB)",
            category="MBNodes",
            description="Split text into one output per non-blank line.",
            search_aliases=["get lines", "split lines", "text to lines"],
            inputs=[io.String.Input("text", force_input=True)],
            outputs=[io.String.Output(f"line_{i + 1}") for i in range(MAX_LINES)],
        )

    @classmethod
    def execute(cls, text) -> io.NodeOutput:
        lines = split_lines(text)[:MAX_LINES]
        return io.NodeOutput(*(lines + [""] * (MAX_LINES - len(lines))))


NODE_CLASS_MAPPINGS = {"MBGetLines": MBGetLines}
NODE_DISPLAY_NAME_MAPPINGS = {"MBGetLines": "Get Lines (MB)"}

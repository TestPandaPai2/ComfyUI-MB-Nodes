from comfy_api.latest import io

from .get_lines_node import split_lines

MAX_SEED = 0xFFFFFFFFFFFFFFFF


class MBRandomLine(io.ComfyNode):
    """Picks one line out of incoming text. `seed` is a KSampler-style seed
    widget (with a randomize/increment/decrement control) mapped onto the
    line count via modulo, so any seed value always lands on a real line."""

    @classmethod
    def define_schema(cls) -> io.Schema:
        return io.Schema(
            node_id="MBNodesRandomLine",
            display_name="Random Line Select (MB)",
            category="MBNodes",
            description="Select a single line from text using a seed.",
            search_aliases=["random line", "line select", "pick line"],
            inputs=[
                io.String.Input("text", force_input=True),
                io.Int.Input(
                    "seed",
                    default=0,
                    min=0,
                    max=MAX_SEED,
                    control_after_generate=True,
                    tooltip="Line index, wrapped to however many lines the text has.",
                ),
            ],
            outputs=[
                io.String.Output("line"),
                io.Int.Output("line_number", display_name="line_number"),
                io.Int.Output("line_count", display_name="line_count"),
            ],
        )

    @classmethod
    def execute(cls, text, seed) -> io.NodeOutput:
        lines = split_lines(text)
        if not lines:
            return io.NodeOutput("", 0, 0)

        index = seed % len(lines)
        return io.NodeOutput(lines[index], index + 1, len(lines))


NODES = [MBRandomLine]

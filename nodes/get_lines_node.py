from comfy_api.latest import io

MAX_LINES = 32  # hard cap on the outputs the node can offer


def split_lines(text, keep_blank=False):
    """Lines with trailing whitespace stripped; blank ones dropped unless kept."""
    if not isinstance(text, str):
        text = "" if text is None else str(text)
    lines = [line.rstrip() for line in text.splitlines()]
    return lines if keep_blank else [line for line in lines if line.strip()]


class MBGetLines(io.ComfyNode):
    """Splits incoming text into one output per line. The frontend shows only as
    many output slots as the text has lines; the count also comes back after a
    run, for text it can't read from a widget."""

    @classmethod
    def define_schema(cls) -> io.Schema:
        return io.Schema(
            node_id="MBGetLines",
            display_name="Get Lines (MB)",
            category="MBNodes",
            description="Split text into one output per non-blank line.",
            search_aliases=["get lines", "split lines", "text to lines"],
            inputs=[
                io.String.Input("text", force_input=True),
                io.Boolean.Input(
                    "keep_blank_lines",
                    default=False,
                    tooltip="Give blank lines their own (empty) output, so later lines keep their position.",
                ),
            ],
            outputs=[io.String.Output(f"line_{i + 1}") for i in range(MAX_LINES)],
        )

    @classmethod
    def execute(cls, text, keep_blank_lines=False) -> io.NodeOutput:
        lines = split_lines(text, keep_blank_lines)[:MAX_LINES]
        return io.NodeOutput(
            *(lines + [""] * (MAX_LINES - len(lines))),
            ui={"line_count": [len(lines)]},
        )


NODES = [MBGetLines]

from comfy_api.latest import io, ui


class MBShowText(io.ComfyNode):
    """Displays incoming text on the node itself, live after every run, and
    passes it through unchanged so it can still feed downstream nodes."""

    @classmethod
    def define_schema(cls) -> io.Schema:
        return io.Schema(
            node_id="MBShowText",
            display_name="Show Text (MB)",
            category="MBNodes",
            description="Preview text on the node and pass it through.",
            search_aliases=["show text", "preview text", "print text", "display text"],
            inputs=[io.String.Input("text", force_input=True)],
            outputs=[io.String.Output("text")],
            is_output_node=True,
        )

    @classmethod
    def execute(cls, text) -> io.NodeOutput:
        value = "" if text is None else str(text)
        return io.NodeOutput(value, ui=ui.PreviewText(value))


NODES = [MBShowText]

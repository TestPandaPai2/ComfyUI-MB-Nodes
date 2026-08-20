from comfy_api.latest import io


class MBText(io.ComfyNode):
    """Plain multiline text box with the dynamic prompt system (wildcards,
    {a|b|c} random choices) enabled by default."""

    @classmethod
    def define_schema(cls) -> io.Schema:
        return io.Schema(
            node_id="MBNodesText",
            display_name="Text (MB)",
            category="MBNodes",
            description="Multiline text box with dynamic prompts enabled.",
            search_aliases=["text", "string", "prompt text"],
            inputs=[
                io.String.Input("text", multiline=True, default="", dynamic_prompts=True),
            ],
            outputs=[io.String.Output("text")],
        )

    @classmethod
    def execute(cls, text) -> io.NodeOutput:
        return io.NodeOutput(text or "")


NODES = [MBText]

from comfy_api.latest import io

DELIMITERS = {
    "newline": "\n",
    "comma": ", ",
    "space": " ",
    "dash": " - ",
    "blank line": "\n\n",
}

MAX_INPUTS = 32


class MBCombineText(io.ComfyNode):
    """Joins any number of text inputs with a chosen delimiter. The input list
    grows a slot at a time as the existing ones are connected."""

    @classmethod
    def define_schema(cls) -> io.Schema:
        template = io.Autogrow.TemplatePrefix(
            input=io.String.Input("text", force_input=True),
            prefix="text",
            min=0,
            max=MAX_INPUTS,
        )
        return io.Schema(
            node_id="MBCombineText",
            display_name="Combine Text (MB)",
            category="MBNodes",
            description="Join several text inputs with a chosen delimiter.",
            search_aliases=["combine text", "join text", "concat", "merge text"],
            inputs=[
                io.Autogrow.Input(
                    "texts",
                    template=template,
                    tooltip="Texts to join, in slot order.",
                ),
                io.Combo.Input(
                    "delimiter",
                    options=list(DELIMITERS.keys()),
                    default="newline",
                    socketless=True,
                    tooltip="What is placed between the texts.",
                ),
            ],
            outputs=[io.String.Output("text")],
        )

    @classmethod
    def execute(cls, texts: io.Autogrow.Type, delimiter) -> io.NodeOutput:
        # Blank inputs are kept, so an unconnected or empty slot still produces
        # its delimiter and the spacing of the result stays predictable.
        parts = ["" if value is None else str(value) for value in texts.values()]
        sep = DELIMITERS.get(delimiter, "\n")
        return io.NodeOutput(sep.join(parts))


NODES = [MBCombineText]

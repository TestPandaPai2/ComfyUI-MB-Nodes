from comfy_api.latest import io

SEPARATORS = {
    "newline": "\n",
    "comma": ", ",
    "space": " ",
    "none": "",
}


class MBText(io.ComfyNode):
    """Text box with clipboard paste/replace buttons and an optional text input
    whose content is placed before or after the typed text."""

    @classmethod
    def define_schema(cls) -> io.Schema:
        return io.Schema(
            node_id="MBText",
            display_name="Text (MB)",
            category="MBNodes",
            description="Text box that merges an optional incoming string with the typed text.",
            search_aliases=["text", "string", "prompt text"],
            inputs=[
                io.String.Input("text", multiline=True, default=""),
                io.Combo.Input(
                    "separator",
                    options=list(SEPARATORS.keys()),
                    default="newline",
                    socketless=True,
                    tooltip="What is placed between the two pieces of text.",
                ),
                io.Combo.Input(
                    "priority",
                    options=["after", "before"],
                    default="after",
                    socketless=True,
                    tooltip="Where the incoming text goes relative to the typed text.",
                ),
                io.String.Input(
                    "text_in",
                    optional=True,
                    force_input=True,
                    tooltip="When connected, this is merged with the typed text.",
                ),
            ],
            outputs=[io.String.Output("text")],
        )

    @classmethod
    def execute(cls, text, separator, priority, text_in=None) -> io.NodeOutput:
        own = text or ""
        if text_in is None:
            incoming = ""
        elif isinstance(text_in, str):
            incoming = text_in
        else:
            incoming = str(text_in)

        if not incoming.strip():
            return io.NodeOutput(own)
        if not own.strip():
            return io.NodeOutput(incoming)

        sep = SEPARATORS.get(separator, "\n")
        parts = (incoming, own) if priority == "before" else (own, incoming)
        return io.NodeOutput(sep.join(parts))


NODES = [MBText]

SEPARATORS = {
    "newline": "\n",
    "comma": ", ",
    "space": " ",
    "none": "",
}


class MBText:
    """Text box with clipboard paste/replace buttons and an optional text input
    whose content is placed before or after the typed text."""

    @classmethod
    def INPUT_TYPES(cls):
        return {
            "required": {
                "text": ("STRING", {"multiline": True, "default": ""}),
                "separator": (list(SEPARATORS.keys()), {"default": "newline"}),
                "priority": (["after", "before"], {"default": "after"}),
            },
            "optional": {
                "text_in": ("STRING", {"forceInput": True}),
            },
        }

    RETURN_TYPES = ("STRING",)
    RETURN_NAMES = ("text",)
    FUNCTION = "run"
    CATEGORY = "MBNodes"

    def run(self, text, separator, priority, text_in=None):
        own = text or ""
        if text_in is None:
            incoming = ""
        elif isinstance(text_in, str):
            incoming = text_in
        else:
            incoming = str(text_in)

        if not incoming.strip():
            return (own,)
        if not own.strip():
            return (incoming,)

        sep = SEPARATORS.get(separator, "\n")
        parts = (incoming, own) if priority == "before" else (own, incoming)
        return (sep.join(parts),)


NODE_CLASS_MAPPINGS = {"MBText": MBText}
NODE_DISPLAY_NAME_MAPPINGS = {"MBText": "Text (MB)"}

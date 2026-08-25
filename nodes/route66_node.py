from comfy_api.latest import io

# Max lane pairs the node can ever hold. Backend must declare all of them up
# front because V3 output slots are fixed by the schema -- the frontend JS only
# ever *shows* the used lanes plus one trailing empty, so the node still looks
# minimal like a native reroute.
MAX_LANES = 20


class MBRoute66(io.ComfyNode):
    """Multi-lane reroute. Each lane passes its input straight to the matching
    output, untouched. Lanes grow as you connect more wires (frontend), so one
    tidy node can carry many wires across the graph instead of a pile of
    single reroute dots."""

    @classmethod
    def define_schema(cls) -> io.Schema:
        return io.Schema(
            node_id="MBRoute66",
            display_name="Route 66 (MB)",
            category="MBNodes",
            description="Multi-lane reroute -- pass many wires through one tidy node, one lane per wire, lanes grow as you connect. Keeps big workflows clean.",
            search_aliases=["reroute", "multi reroute", "route", "route 66", "passthrough", "bus"],
            inputs=[
                io.AnyType.Input(f"value_{i}", optional=True)
                for i in range(MAX_LANES)
            ],
            outputs=[
                io.AnyType.Output(f"out_{i}", display_name="")
                for i in range(MAX_LANES)
            ],
        )

    @classmethod
    def execute(cls, **kwargs) -> io.NodeOutput:
        # Pass lane i in -> lane i out, unchanged. Unconnected lanes -> None.
        values = [kwargs.get(f"value_{i}") for i in range(MAX_LANES)]
        return io.NodeOutput(*values)


NODES = [MBRoute66]

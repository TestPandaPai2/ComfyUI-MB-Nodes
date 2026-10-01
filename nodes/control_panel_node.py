from comfy_api.latest import io

# Backend is a formality -- the frontend marks this node isVirtualNode and
# implements applyToGraph(), the same mechanism ComfyUI's own Primitive node
# uses to write each lane's value straight into whatever widget it's wired to
# before the prompt is serialized. execute() never actually runs.
MAX_CONTROLS = 16


class MBControlPanel(io.ComfyNode):
    """Up to 16 controls (slider/switch/dropdown/seed/text) in one node, each
    output wired straight to whatever it drives. A control is typeless until
    connected; the frontend adopts the shape of whatever it's plugged into and
    reverts to blank on disconnect."""

    @classmethod
    def define_schema(cls) -> io.Schema:
        return io.Schema(
            node_id="MBControlPanel",
            display_name="Control Panel (MB)",
            category="MBNodes",
            description=(
                "Up to 16 controls (slider, switch, dropdown, seed, text) in one node. "
                "Each output becomes whatever it's wired into and reverts to blank on disconnect."
            ),
            search_aliases=["control panel", "primitive", "widget", "dashboard", "dials", "controls"],
            inputs=[],
            outputs=[io.AnyType.Output(f"value_{i + 1}") for i in range(MAX_CONTROLS)],
        )

    @classmethod
    def execute(cls) -> io.NodeOutput:
        # Count must match define_schema()'s outputs (MAX_CONTROLS), not the
        # frontend's current lane count -- this only runs if isVirtualNode
        # somehow fails to register, so keep it schema-aligned, not lane-aligned.
        return io.NodeOutput(*([None] * MAX_CONTROLS))


NODES = [MBControlPanel]

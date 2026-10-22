from comfy_api.latest import io


class MBGroupRunner(io.ComfyNode):
    """Lists the workflow's groups that hold output nodes, each with a Run
    button (queue just that group's outputs) and a Fit button (frame it on the
    canvas). All of it lives in the frontend, which marks the node virtual so
    it is never sent with a prompt; execute() exists only for registration."""

    @classmethod
    def define_schema(cls) -> io.Schema:
        return io.Schema(
            node_id="MBGroupRunner",
            display_name="Group Runner (MB)",
            category="MBNodes",
            description=(
                "Lists every group with output nodes. Run queues only that group's "
                "outputs; Fit pans and zooms the canvas onto the group."
            ),
            search_aliases=["group runner", "run group", "queue group", "groups", "fit group"],
            inputs=[
                io.Int.Input(
                    "runs",
                    default=1,
                    min=1,
                    max=100,
                    socketless=True,
                    tooltip="How many times Run queues the group.",
                ),
            ],
            outputs=[],
        )

    @classmethod
    def execute(cls, runs) -> io.NodeOutput:
        return io.NodeOutput()


NODES = [MBGroupRunner]

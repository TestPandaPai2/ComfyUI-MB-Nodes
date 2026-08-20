from comfy_api.latest import io


class MBBranchRunner(io.ComfyNode):
    """A sink for the end of a branch. It does nothing with what it receives
    -- it exists to be an execution root (`is_output_node`), so the Run
    Branch button the frontend adds to it can queue just the nodes connected
    to it, leaving the rest of the workflow alone."""

    @classmethod
    def define_schema(cls) -> io.Schema:
        return io.Schema(
            node_id="MBBranchRunner",
            display_name="Branch Runner (MB)",
            category="MBNodes",
            description=(
                "Drop this at the end of a branch and hit Run Branch to queue "
                "just that branch, without running the rest of the workflow."
            ),
            search_aliases=["run branch", "partial execution", "queue branch"],
            is_output_node=True,
            inputs=[
                io.AnyType.Input(
                    "value",
                    tooltip="Anything. Only used to give the branch something to run into -- the value itself is discarded.",
                ),
            ],
            outputs=[],
        )

    @classmethod
    def execute(cls, value) -> io.NodeOutput:
        return io.NodeOutput()


NODES = [MBBranchRunner]

# ComfyUI-MB-Nodes

Just a bunch of comfy nodes. All of them live under the **MBNodes** category.

## Nodes

### Text (MB)
A multiline text box with clipboard paste/append and replace buttons. An optional
`text_in` input is merged with the typed text using a chosen separator (newline,
comma, space or none), and `priority` decides whether the incoming text lands
before or after your own.

### Resolution (MB)
Pick a resolution from a grid of presets grouped by aspect ratio (1:1 through
21:9). Every size is a multiple of 64 and stays inside a sane area window, with a
portrait toggle to flip the orientation. Outputs width, height, an empty latent
and the batch size.

### Slider (MB)
A slider with an editable range and step. Turn `live` on and the prompt re-queues
while you drag, so you can watch a parameter change in real time. Outputs the
value as float, int and string.

### Load Image (MB)
Select an image from the input folder or upload a new one, with a preview on the
node. Flip `resize` on to scale the image to the closest resolution matching a
target megapixel count, keeping the aspect ratio. Outputs the image, its width
and height, and the aspect ratio as a string such as `16:9`.

### Crop Image (MB)
Crops whatever comes in on the `image` dot — there is no file picker, the image
always arrives from another node. Drag a box over the preview on the node to set
the crop: drag inside it to move, grab a corner or edge to resize, or drag on
empty image to start a fresh box. The `aspect_ratio` widget locks the box to a
preset (1:1 through 21:9, portrait ones too), `source` keeps the input's own
aspect and `free` lets you drag anything. The crop is stored as fractions of the
image, so it stays correct if the input resolution changes. `divisible_by` rounds
the cropped width and height down to a multiple of 8, 16, 32 or 64, trimming
evenly from both sides so the crop keeps its centre — the readout on the image
shows the size you will actually get. Outputs the cropped image, its width and
its height.

The editor draws the image the node saw on its last run, cached in
`output/MBNodesCache`, so it comes back after a restart. Before the first run it
borrows the preview from the upstream node if that node has one.

### Save Image (MB)
Saves images as png, jpg or webp — png is lossless and carries the workflow,
jpg is the smallest and drops alpha and metadata, webp sits in between with an
optional lossless mode. It writes to the ComfyUI output folder by default, or to
any folder you type in (absolute, or relative to the output folder). Switch
`mode` to `preview` and nothing is written to that folder at all. Either way a
half-size copy is cached in `output/MBNodesCache`, and the node pulls it back in
after a ComfyUI restart so the preview never goes blank.

### SaveMP4 (MB)
Encodes an image batch into an h264 mp4 at the fps you set, with optional audio
muxed in. `trim_to_audio` cuts the video down to whichever of the two tracks ends
first, so it stops when the music does. It writes to the ComfyUI output folder by
default or to any folder you type in, and the `preview_only` switch keeps the
file in temp instead. Either way the finished video plays back on the node.

### Prompt Pad (MB)
A scratchpad for prompts. Type into the text box, put a name in the filename
field, and the Save button writes it to the `SavedPrompts` folder inside the node
pack as a .txt file — it asks before overwriting one that already exists. The
optional `text_in` dot takes over the output when connected, so a generated
prompt can be piped in and kept. Outputs the text.

### Get Lines (MB)
Takes a text input and hands back one output per line. It has no text box of its
own: it reads whatever is feeding it and grows or shrinks its output dots to
match the number of lines, rechecking every 3 seconds. Blank lines are skipped
and trailing spaces are trimmed. Up to 32 lines.

Right-click the node for **MB Settings**, which opens a small dialog: leave it
detecting lines by itself, or pin it to a fixed number of outputs, which turns
the 3 second recheck off. The choice is saved with the workflow.

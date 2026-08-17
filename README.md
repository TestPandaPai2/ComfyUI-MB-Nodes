# ComfyUI-MB-Nodes

Just a bunch of comfy nodes. All of them live under the **MBNodes** category.

## Nodes

### Text (MB)
A multiline text box with clipboard paste/append and replace buttons. An optional
`text_in` input is merged with the typed text using a chosen separator (newline,
comma, space or none), and `priority` decides whether the incoming text lands
before or after your own.

### Resolution (MB)
Pick an aspect ratio from the dropdown (1:1 through 21:9) and a resolution from
the presets it offers. Every size is a multiple of 64 and stays inside a sane area window, with a
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

**📋 Paste from clipboard** takes whatever image you copied last — a screenshot,
a crop from another app, an image copied out of a browser — writes it into the
input folder as `clipboard-<date>-<time>.png` and selects it, so nothing is
overwritten and the paste is still there next session. The browser asks for
clipboard permission the first time.

### Load Image with Crop (MB)
Load Image (MB) with a crop step built in. Same file picker, upload button,
clipboard paste and megapixel resize, plus a **Crop...** button that opens a dialog holding the
picked image: drag inside the box to move it, grab a corner or edge to resize,
or drag on empty image to start a fresh one. The dialog also carries the
`aspect` preset (1:1 through 21:9, portrait ones too, plus `source` and `free`)
and `divisible by`, and a Reset button. Nothing is written to the node until you
hit Apply crop.

The crop is stored as fractions of the image, so picking a file of another size
keeps it meaningful. Cropping happens first and the megapixel resize is applied
to the result, so the target describes what comes out. The readout on the node
shows the chain — source size, cropped size, resized size — with the aspect
ratio and megapixels of the final image. Outputs the image, its width and
height, and the aspect ratio as a string.

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

The preview appears as soon as something is plugged into the `image` dot — no
run needed. The node walks back up the chain (through reroutes and anything else
that has no image of its own) until it finds a node that can hand one over,
including a loader that has only picked a file. Change the file or reroute the
link and the preview follows within a second. Behind a sampler, where nothing
upstream has an image yet, it falls back to the copy cached in
`output/MBNodesCache` on the last run, so the crop box still has its picture
after a restart.

### Save Image (MB)
Saves images as png, jpg or webp — png is lossless and carries the workflow,
jpg is the smallest and drops alpha and metadata, webp sits in between with an
optional lossless mode. It writes to the ComfyUI output folder by default, or to
any folder you type in (absolute, or relative to the output folder). Switch
`mode` to `preview` and nothing is written to that folder at all. Either way a
copy is cached in `output/MBNodesCache` — full size in `save` mode, half size in
`preview` mode — and the node pulls it back in after a ComfyUI restart so the
preview never goes blank.

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
Load button opens the same picker as System Prompt (MB) below. The optional
`text_in` dot takes over the output when connected, so a generated prompt can be
piped in and kept. Outputs the text.

### System Prompt (MB)
The same idea aimed at LLM system prompts, with its own library. Save writes the
box to the `SystemPrompts` folder inside the node pack, asking before it
overwrites. Load opens a picker: choose a folder, choose a file, and the text
drops into the box — a double click loads it straight away.

The folder dropdown lists **System Prompts** and **Saved Prompts** to start
with, and **Add folder...** takes the full path of any other folder — a prompt
library kept elsewhere, a repo, a synced drive. Folders you add are remembered
in the browser and can be dropped again with **Forget**. Only `.txt` and `.md`
files are listed. Outputs the text as `system_prompt`.

### Get Lines (MB)
Takes a text input and hands back one output per line. It has no text box of its
own: it reads whatever is feeding it and grows or shrinks its output dots to
match the number of lines, rechecking every 3 seconds. Blank lines are skipped
and trailing spaces are trimmed. Up to 32 lines.

Right-click the node for **MB Settings**, which opens a small dialog: leave it
detecting lines by itself, or pin it to a fixed number of outputs, which turns
the 3 second recheck off. The choice is saved with the workflow.

### Pad Image (MB)
Adds a solid colour border around an image. In `pixels` mode you set top,
bottom, left and right yourself; in `aspect ratio` mode you pick a ratio (1:1
through 21:9, with a portrait toggle) and the node pads the short axis evenly
until the image reaches it — it never crops. The colour comes from a colour
picker, and the fields for the other mode stay hidden.

`all_sides` is the shortcut: set it above 0 and every side gets that many pixels,
with the mode, the four side fields and the ratio all ignored and hidden until it
goes back to 0.

### Restart button
Not a node: the pack adds a red restart icon to the ComfyUI top bar, at the
right-hand end of its controls. One click restarts the ComfyUI server — no confirmation — and the page
reloads by itself once the new process answers.

### Upscale Latent (MB)
Takes a latent and scales it by a multiplier picked from a row of clickable
buttons — 0.5x, 1x, 1.5x, 2x, 2.5x and 3x out of the box. `upscale_method`
chooses the interpolation. 1x passes the latent straight through.

Right-click the node for **MB Settings** to edit the button list: it shows one
row per multiplier, **Add New** appends another and the × next to a row removes
it, with a reset back to the defaults. The node updates as you type, and the list
is saved with the workflow.

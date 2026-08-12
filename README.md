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

### Save Image (MB)
Saves images as png, jpg or webp — png is lossless and carries the workflow,
jpg is the smallest and drops alpha and metadata, webp sits in between with an
optional lossless mode. It writes to the ComfyUI output folder by default, or to
any folder you type in (absolute, or relative to the output folder). Switch
`mode` to `preview` and nothing is written to that folder at all. Either way a
half-size copy is cached in `output/MBNodesCache`, and the node pulls it back in
after a ComfyUI restart so the preview never goes blank.

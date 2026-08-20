# ComfyUI-MB-Nodes

Just a bunch of comfy nodes. All of them live under the **MBNodes** category.

## Nodes

### Text (MB)
Plain multiline text box with dynamic prompts (`{a|b|c}` wildcards) on by default.

### Combine Text (MB)
Joins any number of text inputs with a chosen delimiter. Input slots auto-grow up to 32.

### Random Line Select (MB)
Splits text into lines, outputs one picked by a seed widget (wraps to the line count).

### Show Text (MB)
Live read-only preview of incoming text, passed through as output. Runnable standalone.

### Resolution (MB)
Aspect ratio + resolution presets, multiples of 64, portrait toggle. Outputs width, height, empty latent, batch size.

### Slider (MB)
Editable-range slider with a `live` toggle that re-queues while dragging. Outputs float, int and string.

### Load Image (MB)
Picks or uploads an image, with a preview and optional megapixel-target resize. **📋 Paste from clipboard** saves whatever you last copied into the input folder and selects it.

### Load Image with Crop (MB)
Load Image (MB) plus a crop dialog (drag/resize box, aspect presets, divisible-by). Crop applies before the megapixel resize.

### Crop Image (MB)
Same crop dialog as above, but for an `image` input instead of a file picker. Crop is stored as fractions of the image so it survives resolution changes; falls back to a cached preview when nothing upstream has an image yet.

### Image Compare (MB)
Wipe-slider comparison between two images, direction configurable, follows the cursor on hover.

### Save Image (MB)
Saves png/jpg/webp to the output folder or anywhere you type. `preview` mode skips the write; a cached copy always survives a restart.

### SaveMP4 (MB)
Encodes an image batch to h264 mp4 with optional muxed audio; `trim_to_audio` and `preview_only` included.

### Preview Audio (MB)
Plays incoming audio on the node (own volume slider, doesn't touch output) and can optionally save it as mp3/opus/wav/flac.

### Prompt Pad (MB)
Prompt scratchpad — save/load `.txt` files from a `SavedPrompts` folder. `text_in` overrides the output when connected.

### System Prompt (MB)
Same idea for LLM system prompts, with its own library folder, an "Add folder..." picker for outside libraries, and `.txt`/`.md` loading.

### Get Lines (MB)
Grows one output per line of incoming text (up to 32), auto-detected or pinned via right-click settings.

### Pad Image (MB)
Adds a solid-colour border, either exact pixels per side or padded to an aspect ratio. `all_sides` is a shortcut for uniform padding.

### Upscale Latent (MB)
Scales a latent by a multiplier from a row of clickable buttons (customizable via right-click settings).

### Sampler (MB)
KSampler + VAE decode in one node, with model/positive/negative/vae pass-through for chaining stages. Live sampling preview included. `upscale_latent` scales the incoming latent before sampling; `decode_image` toggles the VAE decode (skipped gracefully if no vae is connected); `tiled_vae_decoding` swaps in tiled decode for large images.

### Branch Runner (MB)
A no-op sink with a **Run Branch** button that queues only the branch connected to it (via ComfyUI's partial execution), or the branch under whichever output node you last clicked if left unwired.

## Settings

Open ComfyUI's settings dialog and pick the **MB** panel.

### Theme → Accent colour
Recolours every MB node's title bar — **Green** (default), **Pink**, **Purple**, **Teal**, **Gold**.

### Links → Link render mode
Custom routing for every link on the canvas, on top of ComfyUI's own three styles:

- **Default** — hands back to whatever ComfyUI is set to.
- **Manhattan** — right angles, rounded corners.
- **Mitred** — right angles, 45° cut corners.
- **Diagonal Bus** — horizontal runs joined by a true 45° diagonal.
- **Bezier Snap** — a flattened spline, level at each slot.
- **Circuit** — Manhattan routing with square corners.
- **Telephone Line** — sags between its two slots like a strung cable; tunable sag and max-dip.
- **Claude** — flat bezier in Claude's terracotta, solid colour, six-spoke asterisk centre marker.
- **Dashed** — flat bezier with a static (non-animated) dash pattern.
- **Ghost Wire** — a Telephone Line that only draws fully while one of its nodes is selected; otherwise just a short nub at each end.

Links on a reroute keep ComfyUI's own rendering. Custom-mode links are coloured by the input type they land on.

### Links → Link opacity
Opacity of links in whichever mode is picked above, 0–100% (default 100), live.

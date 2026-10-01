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

### Load Image Mini (MB)
Compact Load Image with a custom face: toolbar (upload/paste/settings), arrow + thumbnail file picker, preview, and two size cards (input/output). The full resize engine — max megapixels, longest side, scale by, fit inside, crop to fill, match ratio, plus snap/resample/upscale and a per-node accent — lives in the ⚙ gear. Outputs image and image_info only.

### Load Image Crop (MB)
Loads an image and crops it to the area selected on the node's preview: drag to draw the crop area, drag inside it to move, drag its corners to resize, click to clear. With no crop drawn the full image is output. `aspect` locks the box to a preset (free, source, 1:1, 16:9, …). `max_megapixels` > 0 scales the output up or down to that size (aspect preserved; 0 keeps the crop size), then both sides snap to the nearest multiple of `resolution_steps`, resampled with `upscale_method`. Outputs image.

### Crop Image (MB)
Crop dialog (drag/resize box, aspect presets, divisible-by) for an `image` input instead of a file picker. Crop is stored as fractions of the image so it survives resolution changes; falls back to a cached preview when nothing upstream has an image yet.

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

### Rotate Image (MB)
Rotates an image 90, 180 or 270 degrees. The three toggles behave like radio buttons, and `clockwise` flips the direction (ignored by 180).

### Upscale Latent (MB)
Scales a latent by a multiplier from a row of clickable buttons (customizable via right-click settings).

### Sampler (MB)
KSampler + VAE decode in one node, with model/positive/negative/vae pass-through for chaining stages. Live sampling preview included. `upscale_latent` scales the incoming latent before sampling; `decode_image` toggles the VAE decode (skipped gracefully if no vae is connected); `tiled_vae_decoding` swaps in tiled decode for large images.

### Branch Runner (MB)
A no-op sink with a **Run Branch** button that queues only the branch connected to it (via ComfyUI's partial execution), or the branch under whichever output node you last clicked if left unwired.

### Preview Anything (MB)
Accepts any input type. Image/mask/audio/video get a real live preview on the node; everything else shows its text repr. Passes the value through unchanged. Runnable standalone.

### Krea2 Styles (MB)
Category + style dropdowns over the bundled Krea2 prompt-styles table (286 styles, 15 categories). Outputs `"StyleName: Prompt"`. `randomize` picks a random style within the selected category only; `bypass` outputs an empty string.

### Route 66 (MB)
Multi-lane reroute. Each lane passes its input straight through to the matching output; a fresh empty lane appears as you connect more wires (up to 20), and each socket takes the colour/type of what plugs in. One tidy node to carry many wires across the graph instead of a pile of single reroute dots.

### Control Panel (MB)
Up to 16 controls (slider, switch, dropdown, seed, text) in one node. Each control is blank until you wire its output to something — it then adopts that input's shape (drag-slider, toggle, filtered dropdown, seed with randomize/reroll, or text) and reverts to blank on disconnect. Right-click for settings: add/remove/rename controls, slider ranges, switch labels, dropdown option filtering, and node colour.

### Load Models Combo (MB)
Load Diffusion Model + Load CLIP + Load VAE combined into one node. Outputs MODEL, CLIP, and VAE.

### Wildcard Select (MB)
Picks one item out of a `.txt` in ComfyUI's `wildcards` folder and wraps it in a prompt weight. `seed` is a KSampler-style widget mapped onto the item count, `weight` is a 0–5 slider, and `weight_format` decides whether the parentheses appear at weight 1.0 (`auto`), always, or never. Blank lines and `#` comments are skipped; `bypass` outputs an empty string.

### Civitai Info (MB)
Reads Civitai metadata for a model file. `folder` picks the model directory (checkpoints, diffusion_models, loras, text_encoders, vae) and `model` narrows to that folder's files. Sources are tried in order: the `.civitai.info` sidecar, a manager-written `.metadata.json`, the safetensors header's own `__metadata__`, and finally civitai.com by SHA256 when `online_lookup` is on (`allow_hashing` additionally lets it hash the file when no hash is known yet). Outputs model/version names, base model, creator, trained words, tags, plain-text description, model and download URLs, preview image URLs, AIR, SHA256, ids, an nsfw flag and the raw JSON. Nothing found means empty strings and `found` false, never an error.

### Saree Randomizer (MB)
Outputs a saree prompt: style name plus `details` seeded-random fragments from that style's 40. `category` picks the style, or `random_category` picks it from `seed`; `color` prefixes a seeded-random color.

### High Heels Randomizer (MB)
Same as Saree Randomizer for high heels: 33 styles with 40 detail fragments each, plus `details`, `random_category`, `color` and `seed`.

### Bodycon Randomizer (MB)
Same as Saree Randomizer for bodycon dresses: 28 styles with 40 detail fragments each, plus `details`, `random_category`, `color` and `seed`.

## Settings

Open ComfyUI's settings dialog and pick the **MB** panel.

### Theme → Accent colour
Recolours every MB node's title bar — **Green** (default), **Pink**, **Purple**, **Teal**, **Gold**, **Blue**, **Red**, **Orange**, **Indigo**, **Slate**, **Orchid**.

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
- **Tension** — the reverse of Telephone Line: short links bow like loose rope, links stretched past a tunable reach pull straight and thin.

Links on a reroute keep ComfyUI's own rendering. Custom-mode links are coloured by the input type they land on.

### Links → Link opacity
Opacity of links in whichever mode is picked above, 0–100% (default 100), live.

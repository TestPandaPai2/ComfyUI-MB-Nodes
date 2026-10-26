# ComfyUI-MB-Nodes

Just a bunch of comfy nodes. All of them live under the **MBNodes** category.

## Nodes

### Text (MB)
Plain multiline text box with dynamic prompts (`{a|b|c}` wildcards) on by default.

### Combine Text (MB)
Joins any number of text inputs with a chosen delimiter. Input slots auto-grow up to 32.

### Prompt Combiner (MB)
Joins prompt parts (auto-growing slots) in order between a prefix and suffix. `tidy` cleans each part into a sentence; weighted parts are left alone. Preview shows the result after each run.

### Random Line Select (MB)
Splits text into lines, outputs one picked by a seed widget (wraps to the line count).

### Show Text (MB)
Live read-only preview of incoming text, passed through as output. Runnable standalone.

### Resolution (MB)
Aspect ratio and resolution presets (multiples of 64) picked from button grids, landscape/portrait buttons, a batch stepper, and a to-scale preview showing final size, megapixels and latent size. Sizes near 1 MP are marked with a dot. Outputs width, height, empty latent, batch size.

### Slider (MB)
Just a slider. Its single output takes the type (INT or FLOAT), step and, when the span is under 1,000,000, the range and current value of the input it is connected to. Right-click → ⚙ Slider Settings sets min, max and step.

### Load Image (MB)
Picks or uploads an image, with a preview and optional megapixel-target resize. **📋 Paste from clipboard** saves whatever you last copied into the input folder and selects it.

### Load Image Mini (MB)
Compact Load Image with a custom face: toolbar (upload/paste/settings), arrow + thumbnail file picker, preview, and two size cards (input/output). The full resize engine — max megapixels, longest side, scale by, fit inside, crop to fill, match ratio, plus snap/resample/upscale and a per-node accent — lives in the ⚙ gear. Outputs image and image_info only.

### Load Image Crop (MB)
Loads an image and crops it to the area selected on the node's preview: drag to draw the crop area, drag inside it to move, drag its corners to resize, double-click to clear. Wheel zooms the preview (Ctrl-wheel still zooms the graph), Alt-drag pans it; the corner chips fill (`Full`), center, flip the ratio (`Swap`) or reset the zoom (`Fit`). With no crop drawn the full image is output. `aspect` locks the box to a preset (free, source, 1:1, 16:9, …). `max_megapixels` > 0 scales the output up or down to that size (aspect preserved; 0 keeps the crop size), then both sides snap to the nearest multiple of `resolution_steps`, resampled with `upscale_method`. Outputs image.

### Crop Image (MB)
Crop dialog (drag/resize box, aspect presets, divisible-by) for an `image` input instead of a file picker. Crop is stored as fractions of the image so it survives resolution changes; falls back to a cached preview when nothing upstream has an image yet.

### Save Image (MB)
Saves png/jpg/webp/avif to the output folder or anywhere you type, and passes the images through. Once an image is showing, resizing the node keeps the preview in the image's proportions (width drives, height follows), for both the normal preview and the compare_image slider; a new image shape snaps the node to it. `preview` mode skips the write; a cached copy always survives a restart. `preset` (lossless / visually_lossless / balanced / small) sets the per-format quality; `custom` uses the quality widgets. Changing format or preset re-encodes the last run live, and a badge shows the file size and the saving vs png. Connect `compare_image` for a before/after slider (hover to move it, click to step through a batch).

### Compress Image (MB)
Compresses and converts images to jpg, webp or png in the output folder. Set a quality, a target size in KB (quality drops until the file fits), a max dimension to downscale, or lossless webp. An optional mask becomes alpha for png/webp; jpg is flattened on white. Shows the preview and each file's size.

### Image To SVG (MB)
Vectorizes images into color SVG with vtracer. Presets: Accurate (photo), Poster, Logo / flat, Black & white, or Custom for every tracer setting. Outputs one SVG string per image plus the SVG rendered back as an image to compare against the source, and shows the SVG in the node. `save` (on by default) writes each SVG to the output folder under `filename_prefix`. Needs `vtracer` and `resvg-py`.

### Film Grain (MB)
Adds film grain to images or video frames. Presets: Fine 35mm, Kodak Portra 400, Tri-X 400, 16mm, Super 8, or Custom to use the sliders for intensity, grain size, color amount and luminance response (grain strongest in midtones). Each frame in a batch gets its own grain; the seed keeps results repeatable.

### Load Video (MB)
Loads a video from the input folder and outputs its frames, audio, fps, length in seconds, the VIDEO and image info. `start_frame` skips the first frames, `frame_cap` limits how many are output (0 = all), and `force_fps` resamples to a new frame rate by dropping or repeating frames (0 = source rate). Only the selected stretch is decoded, and the audio is trimmed to match.

### SaveMP4 (MB)
Encodes an image batch to h264 mp4 with optional muxed audio; `trim_to_audio` and `preview_only` included.

### Preview Audio (MB)
Plays incoming audio on the node (own volume slider, doesn't touch output) and can optionally save it as mp3/opus/wav/flac.

### Prompt (MB)
Save prompts as tags and reuse them by writing `@name`; tags expand recursively when the graph runs, and `@name:1.2` expands to `(prompt:1.2)`. Turn on `dynamic_prompts` to pick one option from each `{a|b|c}` (nested allowed, `{|shiny}` for an optional word) after tags expand, so choices inside saved tags work too; `seed` decides the picks (fixed by default, set its control to randomize for a new pick every run). Braces without a `|` are left as typed. The output is tidied (repeated spaces, empty comma slots and stray commas at line ends removed). **Save Tag** asks for the name (pre-filled from `tag_name`) and, if the name exists, shows the saved and new text side by side before overwriting. **Insert Tag** opens a searchable list and inserts the pick at the cursor; typing `@` pops the same list at the cursor. The line under the buttons shows the expanded word count and any unresolved `@names` (also counted in the title bar); click it to see and copy the full expanded prompt. **Manage Tags** edits, renames and deletes tags, saving only what changed, so tags saved elsewhere meanwhile are kept. Search matches names and prompt text (highlighted); tags sharing a prefix (`style_…`, `char-…`) group under collapsible headers; sort by name, recently edited (in this browser) or most used by other tags. Deleted tags stay struck through with **Undo** until you save. `@refs` in the prompt box are highlighted (red when unknown) and typing `@` offers tags. Closing with unsaved changes warns first; close again to discard. Keys: ↑↓ move, Del delete, Ctrl+N new, Ctrl+S save. The dialog can be resized and the prompt box fills its height.

### Prompt Pad (MB)
Prompt scratchpad — save/load `.txt` files from a `SavedPrompts` folder. `text_in` overrides the output when connected.

### System Prompt (MB)
Same idea for LLM system prompts, with its own library folder, an "Add folder..." picker for outside libraries, and `.txt`/`.md` loading.

### Prompt Expander (MB)
Expands a short prompt with a local Ollama model (`url`, default `http://127.0.0.1:11434`). Picking a `preset` fills the system prompt box, which is what gets sent, edits included. Eight presets are built in, including **System prompt creator**: describe the expander you want as the prompt, and it writes a system prompt you can paste into the box and save; **Save Preset** stores the box under `preset_name` in `ExpanderPresets.json`, **Delete Preset** removes a custom one, **Pick Model** lists installed models. `max_tokens` caps the reply (0 = no limit). `keep_alive` 0 unloads the model after each call to free VRAM.

### Get Lines (MB)
Grows one output per line of incoming text (up to 32). In auto mode the count follows the text widget feeding it as you type, or the real count after a run when the text comes from another node; connected outputs are never removed. `keep_blank_lines` gives blank lines their own empty output. Right-click → **Lines** to pin a fixed count (1–32) or go back to Auto. The title bar shows the current count.

### Pad Image (MB)
Pads an image for outpainting or framing and outputs an `outpaint_mask` (1 on the pad, optional `mask_feather`). `size_mode`: manual (the `Pad Image` button opens a dialog: drag any edge or corner outward, with aspect-ratio lock and colour picker), target size or aspect ratio with an anchor. Fill with a colour, replicated, reflected or blurred edges; snap to a multiple of 8–64, transparent padding, and `seam_blend` to fade the edge into the fill.

### Rotate Image (MB)
Rotates an image 90, 180 or 270 degrees. The three toggles behave like radio buttons, and `clockwise` flips the direction (ignored by 180).

### Upscale Latent (MB)
Scales a latent by a multiplier from a grid of clickable buttons (customizable via right-click → MB Settings), or any value via **Custom…**. The upscale method is a button row too. A readout shows input → output latent size and approximate pixels, taken from the upstream width/height or the last run.

### Sampler (MB)
KSampler with an optional hires second pass. Live sampling preview included. Set `second_pass` to **on** to upscale the pass-1 latent by `upscale_by` (`upscale_method`, same methods as Upscale Latent) and sample it again at `denoise_2` with the same cfg, sampler and scheduler. `steps_2` at 0 reuses the pass-1 steps; `seed_2` picks the pass-1 seed, +1, or a random one drawn from it. Outputs `latent` and `latent_pass1` (the same latent when the second pass is off).

### Branch Runner (MB)
A no-op sink with a **Run Branch** button that queues only this node and everything feeding it (via ComfyUI's partial execution). The button shows how many nodes that is, and hovering it outlines them on the canvas. `runs` (1–100) queues the branch that many times; the button reads `Running…` until the queue drains. **Alt+Enter** runs the selected Branch Runners. Left unwired it does nothing and doesn't block a normal Queue.

### Preview Anything (MB)
Accepts any input type. Image/mask/audio/video get a real live preview on the node; everything else shows its text repr. Passes the value through unchanged. Runnable standalone.

### Krea2 Styles (MB)
Category + style dropdowns over the bundled Krea2 prompt-styles table (286 styles, 15 categories). Outputs `"StyleName: Prompt"`. `randomize` picks a random style within the selected category only; `bypass` outputs an empty string.

### Route 66 (MB)
Multi-lane reroute. Each lane passes its input straight through to the matching output; a fresh empty lane appears as you connect more wires (up to 20), and each socket takes the colour/type of what plugs in. Each lane is labelled with its type, or a name you set by double-clicking its output. A wire dropped on the node body goes to the first free lane. Right-click → `Tidy lanes` closes gaps and orders lanes by where their wires come from; `Compact` hides the title bar (otherwise it shows the lane count). One tidy node to carry many wires across the graph instead of a pile of single reroute dots.

### WiFi Send (MB) / WiFi Receive (MB)
Route 66 without the wire. **WiFi Send** takes up to 20 lanes under a `channel` name (lanes grow as you connect; double-click a lane to name it). **WiFi Receive** picks a channel from senders anywhere in the workflow (root graph or any subgraph) and outputs the same lanes, with the same types, colours and names, updating live. Both are frontend-only: when you queue, receiver outputs resolve straight to whatever feeds the sender, so the server sees plain links. Selecting either draws dashed ghost wires between a sender and its receivers on the same level; nodes on a channel share a title colour; right-click → **Go to sender** / **Go to receiver** (opens the subgraph if needed). Two senders on one channel, or a sender inside a subgraph placed more than once, are flagged "duplicate channel", and a receiver with no sender shows "no signal"; either blocks the queue with a message naming the channel.

### Control Panel (MB)
Up to 16 controls (slider, switch, dropdown, seed, text) in one node. Each control is blank until you wire its output to something — it then adopts that input's shape (drag-slider, toggle, filtered dropdown, seed with randomize/reroll, or text) and reverts to blank on disconnect. Right-click for settings: add/remove/rename controls, slider ranges, switch labels, dropdown option filtering, and node colour.

### Load Models Combo (MB)
Load Diffusion Model + Load CLIP + Load VAE combined into one node. Outputs MODEL, CLIP, and VAE. Clicking the model, CLIP or VAE dropdown opens a grouped menu: starred files (★), the last 5 picked (🕒), **Search all…** (the stock filterable list), then files grouped by subfolder; the arrows still step through the list. Right-click the node to star or unstar the current files. **Presets** saves and applies the whole set (model, dtype, CLIP, CLIP type/device, VAE). A file the workflow points at but that isn't on disk is outlined red, with "missing file" in the title bar. Favorites, recents and presets are kept in your ComfyUI user settings.

### LoRA Stack (MB)
Applies any number of LoRAs to MODEL, and to CLIP when one is connected (leave CLIP empty for model-only LoRAs). **+ Add LoRA** picks a file and adds a row: ⋮⋮ handle (drag to reorder), on/off pill, file name (click to change), and strength as ◀ 1.00 ▶ (arrows step 0.05, drag to scrub, click to type). The header toggles every row and shows how many are on. Right-click a row to move, duplicate or remove it. Outputs the patched model and clip, the enabled LoRAs' trigger words (from the `.civitai.info` / `.metadata.json` sidecar, else the safetensors header) joined by `separator`, and a `name @ strength` line per LoRA. `online_lookup` asks civitai.com by SHA256 when nothing local has trigger words; `allow_hashing` lets it hash the file first. A row whose file isn't on disk is outlined red.

### Wildcard Select (MB)
Picks one item out of a `.txt` in ComfyUI's `wildcards` folder and wraps it in a prompt weight. `seed` is a KSampler-style widget mapped onto the item count, `weight` is a 0–5 slider, and `weight_format` decides whether the parentheses appear at weight 1.0 (`auto`), always, or never. `prefix` and `suffix` are added outside the weight on `string`; `raw` stays the bare item. Blank lines and `#` comments are skipped; `bypass` outputs an empty string.

### Civitai Info (MB)
Reads Civitai metadata for a model file. `folder` picks the model directory (checkpoints, diffusion_models, loras, text_encoders, vae) and `model` narrows to that folder's files. Sources are tried in order: the `.civitai.info` sidecar, a manager-written `.metadata.json`, the safetensors header's own `__metadata__`, and finally civitai.com by SHA256 when `online_lookup` is on (`allow_hashing` additionally lets it hash the file when no hash is known yet). Outputs model/version names, base model, creator, trained words, tags, plain-text description, model and download URLs, preview image URLs, AIR, SHA256, ids, an nsfw flag and the raw JSON. Nothing found means empty strings and `found` false, never an error.

### Saree Randomizer (MB)
Outputs a saree prompt: style name plus `details` seeded-random fragments from that style's 40. `category` picks the style, or `random_category` picks it from `seed`; `color` prefixes a seeded-random color. Extra outputs: `blouse` (blouse-only details) and `drape` (drape, pallu and fabric details).

### High Heels Randomizer (MB)
Same as Saree Randomizer for high heels: 33 styles with 40 detail fragments each, plus `details`, `random_category`, `color` and `seed`.

### Bodycon Randomizer (MB)
Same as Saree Randomizer for bodycon dresses: 28 styles with 40 detail fragments each, plus `details`, `random_category`, `color` and `seed`.

### Body Type (MB)
Dropdown of 37 body types (Rectangle, Hourglass, Spoon, ...). Outputs the full body type description.

### Style Modifier (MB)
Dropdown of 43 art styles (Cinematic Realism, Watercolor, Anime, Claymation, ...), or a seeded-random pick. Outputs the style prompt fragment with optional weight.

### Woman's Wardrobe Selector (MB)
Outfit description from a chosen or seeded-random category and style, including Pants, Shorts and Jeans. Extra outputs: `topwear` and `bottomwear` (empty for one-piece outfits; Gymwear sets split into both). `mix_outfit` pairs a random top with a random bottom.

### Category outputs
Every randomizer and selector also outputs the picked names on their own: `category`, plus `style` on nodes with a style inside the category.

### Simple Standing Poses (MB)
Dropdown of 30 simple standing poses, or a seeded-random one with `randomize_pose`. Outputs the full pose description with optional `weight`. `closeup` swaps in a chest-up close-up version of the same pose.

## Replace Nodes

Right-click a node (or a selection) → **Replace Node...** and pick a type from the search list. Each node is swapped in place: links are reconnected by slot name, then index, then first compatible type; widget values with matching names carry over; title, colour and mode are kept. Links with no matching slot are dropped and reported. One Ctrl+Z undoes it.

## Restart Button

Power icon in the top action bar. One click restarts the ComfyUI server the page is connected to, with no confirmation; the page reconnects once it is back. Works with comfy-cli and plain launches (including the Windows portable build).

## Colour Palettes

11 palettes added to ComfyUI's own list (Settings → Appearance → Color Palette): **MB Graphite**, **MB OLED**, **MB Slate**, **MB Plum**, **MB Forest**, and true-black OLED palettes with soft accents: **MB Arctic**, **MB Deep Indigo**, **MB Glacier Mint**, **MB Ember**, **MB Ruby**, **MB Rose**. The palette icon in the top bar cycles through them.

## Settings

Open ComfyUI's settings dialog and pick the **MB** panel.

### About
Pack version, node count and a link to this README.

### Features
On/off switches, all on by default and applied live: **Node count badge**, **Restart button**, **Palette switcher**, **Replace Node menu**, **Clipboard paste** (the button on Load Image (MB)).

### Node defaults
Starting values for newly added nodes; saved workflows keep their own: **Branch Runner: runs** (1–100), **Get Lines: start mode** (Auto or Fixed 1–32), **Load Image Crop: aspect**.

### Theme → Accent colour
MB nodes use the stock ComfyUI look. Accent for active buttons, selections and highlights: **Pink** (default), **Green**, **Purple**, **Teal**, **Gold**, **Blue**, **Red**, **Orange**, **Indigo**, **Slate**, **Orchid**, or **Custom** — any colour from **Theme → Custom accent colour**.

### Theme → Palette switcher cycle
Tick the MB palettes the top-bar palette button steps through. None ticked means all.

### Theme → Accent tints UI
Off by default. When on, the accent also colours node selection outlines, the wire being dragged and the UI's primary highlight, over any colour palette.

### Theme → Style polish
Off by default. Rounder node corners, rounded menus and dialogs, thin scrollbars.

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
- **PCB Trace** — 45° diagonal routing with a via dot at each bend and a pad ring at each end.
- **Spotlight** — links dim except those touching the selected or hovered node.
- **Fade Mid** — links fade out toward their middle, solid only near the slots; full strength on hover.
- **Hairline** — 1px lines with no border or centre marker.
- **Teleport** — links longer than a tunable distance collapse to short stubs tagged with matching letters (A, B, … AA); hover a stub or select either node to see the full link.
- **Bundle** — every link off one output shares a straight trunk before splitting, so many links leave the slot as one wire.

Links on a reroute keep ComfyUI's own rendering. Custom-mode links are coloured by the input type they land on.

### Links → Link opacity
Opacity of links in whichever mode is picked above, 0–100% (default 100), live.

### Links: Telephone Line / Ghost Wire, Links: Tension, Links: Teleport
Per-mode tuning, grouped under the mode it affects: **Sag** and **Max dip** for Telephone Line and Ghost Wire, **Bow** and **Reach** for Tension, **Distance** for Teleport.

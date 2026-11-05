# ComfyUI-MB-Nodes

Just a bunch of comfy nodes. All of them live under the **MBNodes** category.

## Nodes

### MB Text
Plain multiline text box with dynamic prompts (`{a|b|c}` wildcards) on by default.

### MB Combine Text
Joins any number of text inputs with a chosen delimiter. Input slots auto-grow up to 32.

### MB Replace Text Advanced
Up to ten find and replace pairs, applied top to bottom. Each field can be typed in or linked from another node. Empty find fields are skipped.

### MB Prompt Combiner
Joins prompt parts (auto-growing slots) in order between a prefix and suffix. `tidy` cleans each part into a sentence; weighted parts are left alone. Preview shows the result after each run.

### MB Random Line Select
Splits text into lines, outputs one picked by a seed widget (wraps to the line count).

### MB Show Text
Live read-only preview of incoming text, passed through as output. Runnable standalone.

### MB Resolution
Aspect ratio dropdown and resolution preset buttons from 0.25 to 2 MP in 0.25 steps, then 3 and 4 MP (`multiple_of` rounds the output, shown in the preview), landscape/portrait buttons that switch to the mirrored ratio (picking a ratio sets them too), a batch stepper, and a to-scale preview showing final size, megapixels and latent size. Sizes near 1 MP are marked with a dot. Outputs width, height, empty latent, batch size.

### MB Slider
Just a slider. Its single output takes the type (INT or FLOAT), step and, when the span is under 1,000,000, the range and current value of the input it is connected to. Right-click → ⚙ Slider Settings sets min, max and step.

### MB Load Image
Picks or uploads an image, with a preview and optional megapixel-target resize. **📋 Paste from clipboard** saves whatever you last copied into the input folder and selects it.

### MB Load Two Images
Two images side by side, each with its own picker, upload button, preview and output (`Image1`, `Image2`). Drop a file on either side. Ctrl+V with the node selected pastes into the side you clicked, otherwise the first empty side, otherwise Image1. `max_mp` caps both images, downscaling only and keeping aspect (0 is off). `pad_image2` centers Image2 on a canvas matching Image1's size, scaling it down first if it's too big; right-click → **Pad color…** sets the color.

### MB Load Images from Folder
Loads every image in a folder (picked with **Browse…** or typed) or only the ones clicked in the thumbnail grid. All / None / Invert, shift-click ranges, ⟳ to rescan; clicking a tile in `all` mode switches to custom. `resize_mode`: `list` keeps each image at its own size (downstream runs once per image); `crop`, `pad` (with `pad_color`) and `stretch` bring every image to the largest one's size as one batch.

### MB Load Image Mini
Compact Load Image with a custom face: toolbar (upload/paste/settings), arrow + thumbnail file picker, preview, and two size cards (input/output). The full resize engine — max megapixels, longest side, scale by, fit inside, crop to fill, match ratio, plus snap/resample/upscale and a per-node accent — lives in the ⚙ gear. Outputs image and image_info only.

### MB Load Image Crop
Loads an image and crops it to the area selected on the node's preview: drag to draw the crop area, drag inside it to move, drag its corners to resize, double-click to clear. Wheel zooms the preview (Ctrl-wheel still zooms the graph), Alt-drag pans it; the corner chips fill (`Full`), center, flip the ratio (`Swap`) or reset the zoom (`Fit`). With no crop drawn the full image is output. `aspect` locks the box to a preset (free, source, 1:1, 16:9, …). `max_megapixels` > 0 scales the output up or down to that size (aspect preserved; 0 keeps the crop size), then both sides snap to the nearest multiple of `resolution_steps`, resampled with `upscale_method`. Outputs image.

### MB Save Image
Saves png/jpg/webp/avif to the output folder or anywhere you type, and passes the images through. Once an image is showing, resizing the node keeps the preview in the image's proportions (width drives, height follows), for both the normal preview and the compare_image slider; a new image shape snaps the node to it. `preview` mode skips the write; a cached copy always survives a restart. `preset` (lossless / visually_lossless / balanced / small) sets the per-format quality; `custom` uses the quality widgets. Changing format or preset re-encodes the last run live, and a badge shows the file size and the saving vs png. Connect `compare_image` for a before/after slider (hover to move it, click to step through a batch).

### MB Compress Image
Compresses and converts images to jpg, webp or png in the output folder. Set a quality, a target size in KB (quality drops until the file fits), a max dimension to downscale, or lossless webp. An optional mask becomes alpha for png/webp; jpg is flattened on white. Shows the preview and each file's size.

### MB Image To SVG
Vectorizes images into color SVG with vtracer. Presets: Accurate (photo), Poster, Logo / flat, Black & white, or Custom for every tracer setting. Outputs one SVG string per image plus the SVG rendered back as an image to compare against the source, and shows the SVG in the node. `save` (on by default) writes each SVG to the output folder under `filename_prefix`. Needs `vtracer` and `resvg-py`.

### MB Film Grain
Adds film grain to images or video frames. Presets: Fine 35mm, Kodak Portra 400, Tri-X 400, 16mm, Super 8, or Custom to use the sliders for intensity, grain size, color amount and luminance response (grain strongest in midtones). Each frame in a batch gets its own grain; the seed keeps results repeatable.

### MB Load Video
Loads a video from the input folder and outputs its frames, audio, fps, length in seconds, the VIDEO and image info. `start_frame` skips the first frames, `frame_cap` limits how many are output (0 = all), and `force_fps` resamples to a new frame rate by dropping or repeating frames (0 = source rate). Only the selected stretch is decoded, and the audio is trimmed to match.

### MB SaveMP4
Encodes an image batch to h264 mp4 with optional muxed audio; `trim_to_audio` and `preview_only` included.

### MB Preview Audio
Plays incoming audio on the node (own volume slider, doesn't touch output) and can optionally save it as mp3/opus/wav/flac.

### MB Prompt
Save prompts as tags and reuse them by writing `@name`; tags expand recursively when the graph runs, and `@name:1.2` expands to `(prompt:1.2)`. Turn on `dynamic_prompts` to pick one option from each `{a|b|c}` (nested allowed, `{|shiny}` for an optional word) after tags expand, so choices inside saved tags work too; `seed` decides the picks (fixed by default, set its control to randomize for a new pick every run). Braces without a `|` are left as typed. The output is tidied (repeated spaces, empty comma slots and stray commas at line ends removed). The node shows only its text box: typing `@` pops up your tags at the cursor, and unresolved `@names` are counted in the title bar. Right-click → **Tag manager…** holds everything else. Its top strip sets `dynamic_prompts`, `seed` and the seed control for this node, and shows the expanded word count (click it to copy the expanded prompt). **Insert into node** adds the selected tag at the cursor, **Load into node** replaces the node's text, and **Save node prompt as tag** adds the node's text as a new tag. The dialog edits, renames and deletes tags, saving only what changed, so tags saved elsewhere meanwhile are kept. Search matches names and prompt text (highlighted); tags sharing a prefix (`style_…`, `char-…`) group under collapsible headers; sort by name, recently edited (in this browser) or most used by other tags. Deleted tags stay struck through with **Undo** until you save. `@refs` in the prompt box are highlighted (red when unknown) and typing `@` offers tags. Closing with unsaved changes warns first; close again to discard. Keys: ↑↓ move, Del delete, Ctrl+N new, Ctrl+S save. The dialog can be resized and the prompt box fills its height.

### MB Prompt Pad
Prompt scratchpad — save/load `.txt` files from a `SavedPrompts` folder. `text_in` overrides the output when connected.

### MB System Prompt
Same idea for LLM system prompts, with its own library folder, an "Add folder..." picker for outside libraries, and `.txt`/`.md` loading.

### MB Prompt Expander
Expands a short prompt with a local Ollama model (`url`, default `http://127.0.0.1:11434`). Right-click the node to save or load system prompt presets, the same as MB Text Generate, or to pick an installed model. Loading fills the system prompt box, which is what gets sent, edits included. Eight presets are built in, including **System prompt creator**: describe the expander you want as the prompt, and it writes a system prompt you can paste into the box and save. `max_tokens` caps the reply (0 = no limit). `keep_alive` 0 unloads the model after each call to free VRAM.

### MB Load Prompts From File
Upload a .txt with the **Upload .txt** button, pick what separates prompts (blank line, newline, `---`, `<>`), and every prompt goes out as a list so downstream nodes run once per prompt in one queue. `start`/`limit` pick a range (limit 0 = all); `count` outputs how many were sent.

### MB Get Lines
Grows one output per line of incoming text (up to 32). In auto mode the count follows the text widget feeding it as you type, or the real count after a run when the text comes from another node; connected outputs are never removed. `keep_blank_lines` gives blank lines their own empty output. Right-click → **Lines** to pin a fixed count (1–32) or go back to Auto. The title bar shows the current count.

### MB Pad Image
Pads an image for outpainting or framing and outputs an `outpaint_mask` (1 on the pad, optional `mask_feather`). `size_mode`: manual (the `Pad Image` button opens a dialog: drag any edge or corner outward or type per-side values, one-click +25% extend, size presets, fill mode with live preview, aspect-ratio lock, colour picker and undo/redo), target size or aspect ratio with an anchor. Fill with a colour, replicated, reflected or blurred edges; snap to a multiple of 8–64, transparent padding, and `seam_blend` to fade the edge into the fill.

### MB Rotate Image
Rotates an image 90, 180 or 270 degrees. The three toggles behave like radio buttons, and `clockwise` flips the direction (ignored by 180).

### MB Upscale Latent
Scales a latent by a multiplier from a grid of clickable buttons (customizable via right-click → MB Settings), or any value via **Custom…**. The upscale method is a button row too. A readout shows input → output latent size and approximate pixels, taken from the upstream width/height or the last run.

### MB Sampler
KSampler with an optional hires second pass. Live sampling preview included. Set `second_pass` to **on** to upscale the pass-1 latent by `upscale_by` (`upscale_method`, same methods as Upscale Latent) and sample it again at `denoise_2` with the same cfg, sampler and scheduler. `steps_2` at 0 reuses the pass-1 steps; `seed_2` picks the pass-1 seed, +1, or a random one drawn from it. Outputs `latent` and `latent_pass1` (the same latent when the second pass is off).

### MB Branch Runner
A no-op sink with a **Run Branch** button that queues only this node and everything feeding it (via ComfyUI's partial execution). The button shows how many nodes that is, and hovering it outlines them on the canvas. `runs` (1–100) queues the branch that many times; the button reads `Running…` until the queue drains. **Alt+Enter** runs the selected Branch Runners. Left unwired it does nothing and doesn't block a normal Queue.

### MB Preview Anything
Accepts any input type. Image/mask/audio/video get a real live preview on the node; everything else shows its text repr. Passes the value through unchanged. Runnable standalone.

### MB Krea2 Styles
Category + style dropdowns over the bundled Krea2 prompt-styles table (1506 styles, 16 categories). Outputs `"StyleName: Prompt"`. `randomize` picks a random style within the selected category only; `bypass` outputs an empty string.

### MB Route 66
Multi-lane reroute. Each lane passes its input straight through to the matching output; a fresh empty lane appears as you connect more wires (up to 20), and each socket takes the colour/type of what plugs in. Each lane is labelled with its type, or a name you set by double-clicking its output. A wire dropped on the node body goes to the first free lane. Right-click → `Tidy lanes` closes gaps and orders lanes by where their wires come from; `Compact` hides the title bar (otherwise it shows the lane count). One tidy node to carry many wires across the graph instead of a pile of single reroute dots.

### MB WiFi Send / MB WiFi Receive
Route 66 without the wire. **WiFi Send** takes up to 20 lanes under a `channel` name (lanes grow as you connect; double-click a lane to name it). **WiFi Receive** picks a channel from senders anywhere in the workflow (root graph or any subgraph) and outputs the same lanes, with the same types, colours and names, updating live. Both are frontend-only: when you queue, receiver outputs resolve straight to whatever feeds the sender, so the server sees plain links. Selecting either draws dashed ghost wires between a sender and its receivers on the same level; nodes on a channel share a title colour; right-click → **Go to sender** / **Go to receiver** (opens the subgraph if needed). Two senders on one channel, or a sender inside a subgraph placed more than once, are flagged "duplicate channel", and a receiver with no sender shows "no signal"; either blocks the queue with a message naming the channel.

### MB Control Panel
Up to 16 controls (slider, switch, dropdown, seed, text) in one node. Each control is blank until you wire its output to something — it then adopts that input's shape (drag-slider, toggle, filtered dropdown, seed with randomize/reroll, or text) and reverts to blank on disconnect. Right-click for settings: add/remove/rename controls, slider ranges, switch labels, dropdown option filtering, and node colour.

### MB Load Models Combo
Load Diffusion Model + Load CLIP + Load VAE combined into one node. Outputs MODEL, CLIP, and VAE. Clicking the model, CLIP or VAE dropdown opens a grouped menu: starred files (★), the last 5 picked (🕒), **Search all…** (the stock filterable list), then files grouped by subfolder; the arrows still step through the list. Right-click the node to star or unstar the current files. **Presets** saves and applies the whole set (model, dtype, CLIP, CLIP type/device, VAE). A file the workflow points at but that isn't on disk is outlined red, with "missing file" in the title bar. Favorites, recents and presets are kept in your ComfyUI user settings.

### MB LoRA Stack
Applies any number of LoRAs to MODEL, and to CLIP when one is connected (leave CLIP empty for model-only LoRAs). **+ Add LoRA** picks a file and adds a row: ⋮⋮ handle (drag to reorder), on/off pill, file name (click to change), and strength as ◀ 1.00 ▶ (arrows step 0.05, drag to scrub, click to type) over a fill bar. The header toggles every row and shows how many are on. Right-click a row to move, duplicate or remove it. Click the file name for a searchable list. The **ⓘ** button lists that LoRA's trigger words (`.civitai.info` / `.metadata.json` sidecar, else the safetensors header, else civitai.com by SHA256, looked up once when the popup opens and cached next to the LoRA); tick the ones to use and add your own, which are saved per LoRA file. Outputs the patched model and clip, the ticked trigger words of enabled rows joined by `separator`, and a `name @ strength` line per LoRA. A row whose file isn't on disk is outlined red.

### MB Wildcard Select
Picks one item out of a `.txt` in ComfyUI's `wildcards` folder and wraps it in a prompt weight. `seed` is a KSampler-style widget mapped onto the item count, `weight` is a 0–5 slider, and `weight_format` decides whether the parentheses appear at weight 1.0 (`auto`), always, or never. `prefix` and `suffix` are added outside the weight on `string`; `raw` stays the bare item. Blank lines and `#` comments are skipped; `bypass` outputs an empty string.

### MB Civitai Info
Reads Civitai metadata for a model file. `folder` picks the model directory (checkpoints, diffusion_models, loras, text_encoders, vae) and `model` narrows to that folder's files. Sources are tried in order: the `.civitai.info` sidecar, a manager-written `.metadata.json`, the safetensors header's own `__metadata__`, and finally civitai.com by SHA256 when `online_lookup` is on (`allow_hashing` additionally lets it hash the file when no hash is known yet). Outputs model/version names, base model, creator, trained words, tags, plain-text description, model and download URLs, preview image URLs, AIR, SHA256, ids, an nsfw flag and the raw JSON. Nothing found means empty strings and `found` false, never an error.

### MB Saree Randomizer
Outputs a saree prompt: style name plus `details` seeded-random fragments from that style's 40. `category` picks the style, or `random_category` picks it from `seed`; `color` prefixes a seeded-random color. Extra outputs: `blouse` (blouse-only details) and `drape` (drape, pallu and fabric details).

### MB Bodycon Randomizer
Same as Saree Randomizer for bodycon dresses: 28 styles with 40 detail fragments each, plus `details`, `random_category`, `color` and `seed`.

### MB Body Type
Dropdown of 37 body types (Rectangle, Hourglass, Spoon, ...). Outputs the full body type description.

### MB Style Modifier
Dropdown of 43 art styles (Cinematic Realism, Watercolor, Anime, Claymation, ...), or a seeded-random pick. Outputs the style prompt fragment with optional weight.

### MB Woman's Wardrobe Selector
Outfit description from a chosen or seeded-random category and style, including Pants, Shorts, Jeans and swimwear (bikinis, one-pieces, cover-ups and more). Extra outputs: `topwear` and `bottomwear` (empty for one-piece outfits; Gymwear sets split into both). `mix_outfit` pairs a random top with a random bottom. The randomizer toggles show as a grid of buttons.

### MB Makeup Mod Prompt
Makeup edit prompt picked by category (Everyday, Glam / Bold, Gothic, Regional / Trend; 20 styles each) and style, or seeded-random within the category or your favorites.

### MB Text Generate
Generate Text with the text encoder picked on the node (`clip_name` + `type`, like CLIP Loader), a `system_prompt` box, any number of images (resized to the first), optional video and audio. `preset`: Fast, Balanced, Quality or Custom (all native options). Outputs the answer text only. Right-click to save the system prompt as a preset in a full-height editor or load a saved one (shared with MB System Prompt), or for How to Use.

### Live model lists (MB Load Models Combo, MB LoRA Stack)
New files in the diffusion model, text encoder, VAE and LoRA folders appear within a few seconds without reloading node definitions, and removed ones drop out. A new file joins once its size stops changing, so unfinished downloads stay hidden. Only names and sizes are read, so loaded models stay loaded.

### Pipe em! (all links)
Right-click the canvas, pick **Pipe em!**, then drag a box over two or more links and release to bundle them into a pipe. Add as many pipes to a cluster as you like. Drag a pipe's tie to move it, right-click the tie to remove it. Pipes are visual only, so wiring doesn't change. Links with reroutes are skipped. Esc cancels.

### Auto Connect (all nodes)
Right-click an input dot: "Connect to nearest …" (preferring a matching name) or pick any output of that type. Right-click an output dot: "Connect to all empty … inputs" or pick any input of that type. Connect to all needs a matching type and name, so `width` only finds `width` and `latent` finds `latent_image`; with no name match it isn't offered. Works in the current graph; one Ctrl+Z undoes it.

### MB Accessories Selector
One dropdown per accessory, each set to none, random (from the seed) or a style, and every picked piece says where it's worn. Slots: `waist_chain`, `necklace`, `bracelet`, `body_jewelry`, 50 styles each, and `jhumka`, `nose_ring` with 51 each. `remove_prefix` drops the leading "She wears" from every piece. `prompt` joins the picked pieces; each slot also has its own output, and `styles` lists the picks. `metal` adds one gold, silver, rose gold or seeded-random finish to the whole set, or keeps the descriptions as written.

### Category outputs
Every randomizer and selector also outputs the picked names on their own: `category`, plus `style` on nodes with a style inside the category.

### MB Simple Standing Poses
Dropdown of 30 simple standing poses, or a seeded-random one with `randomize_pose`. Outputs the full pose description with optional `weight`. `closeup` swaps in a chest-up close-up version of the same pose.

## Replace Nodes

Right-click a node (or a selection) → **Replace Node...** and pick a type from the search list. Each node is swapped in place: links are reconnected by slot name, then index, then first compatible type; widget values with matching names carry over; title, colour and mode are kept. Links with no matching slot are dropped and reported. One Ctrl+Z undoes it.

## MB Nodes Sidebar

Box icon pinned to the top of the left sidebar. Lists only this pack's nodes by category, with search. Drag a node onto the canvas to place it there, or click to add it at the canvas centre.

## Restart Button

Power icon in the top action bar. One click restarts the ComfyUI server the page is connected to, with no confirmation; the page reconnects once it is back. Works with comfy-cli and plain launches (including the Windows portable build).

## Colour Palettes

11 palettes added to ComfyUI's own list (Settings → Appearance → Color Palette): **MB Graphite**, **MB OLED**, **MB Slate**, **MB Plum**, **MB Forest**, and true-black OLED palettes with soft accents: **MB Arctic**, **MB Deep Indigo**, **MB Glacier Mint**, **MB Ember**, **MB Ruby**, **MB Rose**. The palette icon in the top bar cycles through them.

## Settings

Open ComfyUI's settings dialog and pick the **MB** panel.

### About
Pack version, node count and a link to this README.

### Features
On/off switches, all on by default and applied live: **Node count badge**, **Restart button**, **Palette switcher**, **Replace Node menu**, **Clipboard paste** (the button on MB Load Image), **Notify on finish**.

### Notify on finish
Plays a sound after every finished prompt and a lower one when a prompt fails; cancelling stays silent. **Volume** sets the loudness. **Success sound** and **Error sound** each use a built-in chime, or an mp3 attached with **Choose mp3** (stored in your ComfyUI user data); **Reset** goes back to the chime and **Test** plays it.

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

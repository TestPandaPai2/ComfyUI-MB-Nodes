"""Style modifier: one combo of art styles (fixed or seeded-random), outputs
the style's prompt fragment."""

import random

from comfy_api.latest import io

from .common import FAVORITES, MAX_SEED, pick_favorite, weighted


STYLES = {
    "Cinematic Realism": "photorealistic, cinematic lighting, shallow depth of field, film grain, rich contrast, true-to-life skin texture, dramatic color grading, high detail",
    "Soft Editorial": "fashion editorial photography, soft diffused light, muted neutral palette, clean composition, smooth skin retouching, magazine quality, minimal background",
    "Digital Painting": "digital painting, painterly brushstrokes, blended colors, soft rendering, textured canvas feel, semi-realistic, rich color depth",
    "Gouache Illustration": "gouache painting, opaque matte color, flat layered brushwork, soft visible strokes, warm muted palette, hand-painted texture",
    "Watercolor": "watercolor painting, translucent washes, soft bleeding edges, wet-on-wet blooms, paper texture, delicate pigment granulation, airy white space",
    "Sketchbook": "pencil sketch, loose graphite lines, cross-hatching shading, construction lines, unfinished edges, sketchbook paper texture",
    "Ink Line Art": "black ink line art, clean confident linework, varied line weight, high contrast, no shading, white background",
    "Minimalist Line": "single continuous line drawing, minimal strokes, thin uniform lines, abstract simplicity, generous negative space",
    "Fashion Illustration": "fashion illustration, elongated elegant proportions, loose expressive marker strokes, bold ink outlines, stylish flat color accents",
    "Pop Art": "pop art, bold black outlines, halftone dots, flat saturated primary colors, comic print look, high contrast graphic",
    "Retro 70s": "1970s retro illustration, warm orange and mustard palette, sunburst stripes, grainy print texture, vintage groovy aesthetic",
    "Vintage Poster": "vintage poster art, aged paper texture, limited muted palette, screen-print look, faded ink, distressed edges",
    "Comic Book": "western comic book art, bold inked outlines, dynamic shading, crosshatching, flat cel colors, dramatic graphic panels",
    "Anime": "anime style, large expressive eyes, clean cel shading, crisp line art, vibrant flat colors, soft highlight gradients",
    "Manga": "manga style, black and white ink, screentone shading, dynamic speed lines, sharp linework, dramatic panel composition",
    "Manhwa": "Korean webtoon manhwa style, polished digital coloring, soft glow lighting, sleek linework, glossy cinematic rendering",
    "Webtoon": "webtoon style, bright cheerful colors, simple clean lines, soft cel shading, vertical comic panel feel, modern digital comic",
    "Chibi": "chibi style, oversized head, tiny body, big sparkling eyes, rounded simplified features, cute exaggerated proportions",
    "Kawaii": "kawaii style, pastel colors, soft rounded shapes, tiny dot eyes, blush cheeks, adorable simplicity, sweet and innocent",
    "Oil Painting": "oil painting, thick impasto brushstrokes, rich layered pigment, classical shading, visible canvas texture, deep luminous color",
    "Acrylic Texture": "acrylic painting, bold textured strokes, palette knife marks, layered vibrant color, matte finish, expressive abstract background",
    "Mixed Media Collage": "mixed media collage, torn paper layers, newsprint scraps, paint splatters, layered textures, cut-and-paste composition",
    "Charcoal Drawing": "charcoal drawing, rich smudged blacks, soft tonal gradients, gritty texture, expressive dramatic shading, rough paper grain",
    "Pastel Drawing": "soft pastel drawing, chalky texture, blended soft colors, gentle strokes, warm muted tones, velvety finish",
    "Dreamy Glow": "ethereal dreamy glow, soft haze, warm bokeh lights, luminous highlights, pastel light flares, magical soft focus",
    "Celestial Cosmic": "celestial cosmic art, deep starry night sky, moons and constellations, glowing stardust, midnight blue and gold palette",
    "Neon Glow": "neon glow aesthetic, vivid magenta and electric blue light, dark background, glowing rim lighting, cyberpunk vibrance",
    "Boho Aesthetic": "boho aesthetic, earthy terracotta and sage palette, dried botanical motifs, soft paper texture, organic hand-drawn feel",
    "Black & White Minimal": "black and white minimal graphic, pure silhouette shapes, solid fills, stark contrast, no gradients, stencil-like simplicity",
    "Hand-Painted Fantasy Animation": "hand-painted 2D animation style, lush painted backgrounds, soft natural light, nostalgic whimsical mood, gentle watercolor palette",
    "3D Cartoon": "stylized 3D cartoon, smooth rounded forms, soft studio lighting, clean simplified features, polished CGI render",
    "Feature 3D Animation": "feature film 3D animation style, expressive oversized eyes, warm cinematic lighting, detailed textures, heartwarming storybook mood",
    "Classic 2D Animation": "classic hand-drawn 2D animation, smooth ink outlines, cel-painted color, fairytale elegance, vintage film warmth",
    "Claymation": "claymation, handmade modeling clay texture, fingerprint details, stop-motion feel, chunky rounded shapes, soft studio lighting",
    "Paper Cutout": "layered paper cutout art, stacked depth layers, crisp cut edges, soft drop shadows, monochrome tonal gradient, papercraft diorama",
    "Felt Craft": "felt craft, soft fuzzy fabric texture, visible stitching, handmade textile look, cozy muted colors",
    "Plush Toy": "plush toy style, soft fuzzy fabric, stuffed rounded shapes, stitched seams, cuddly squishy look, gentle studio lighting",
    "Designer Toy Figure": "designer vinyl toy, glossy collectible figure, simplified blocky shapes, smooth plastic finish, product photography",
    "Vinyl Collectible Figure": "collectible vinyl figure, oversized head, small body, black button eyes, glossy plastic, boxed packaging display",
    "Brick-Built": "toy brick construction style, interlocking plastic blocks, studded surfaces, bright primary colors, modular blocky forms",
    "Miniature Diorama": "miniature diorama, tilt-shift photography, tiny scale models, shallow depth of field, handcrafted detailed scenery",
    "Storybook Illustration": "storybook illustration, hand-drawn textures, soft warm colors, whimsical composition, painterly classic book art",
    "Children's Book Art": "children's book art, simple bright shapes, bold flat colors, friendly rounded characters, playful clean composition",
}


class MBStyleModifier(io.ComfyNode):
    @classmethod
    def define_schema(cls) -> io.Schema:
        return io.Schema(
            node_id="MBNodesStyleModifier",
            display_name="Style Modifier (MB)",
            category="MBNodes",
            description="Pick an art style, or a seeded-random one; outputs the style's prompt fragment.",
            search_aliases=["style", "art style", "aesthetic", "medium", "look"],
            inputs=[
                io.Combo.Input("style", options=[*STYLES, FAVORITES], tooltip="Style used when randomize is off."),
                io.Boolean.Input("randomize", default=False, tooltip="Pick the style from the seed instead of the style widget."),
                io.Int.Input("seed", default=0, min=0, max=MAX_SEED, control_after_generate=True),
                io.Float.Input("weight", default=1.0, min=0.0, max=2.0, step=0.05, display_mode=io.NumberDisplay.slider, tooltip="Prompt weight. At 1.0 the text is output as-is, otherwise as (text:weight)."),
            ],
            outputs=[io.String.Output("prompt"), io.String.Output("category")],
        )

    @classmethod
    def execute(cls, style, randomize, seed, weight) -> io.NodeOutput:
        style = pick_favorite("MBNodesStyleModifier", style, STYLES, seed)
        name = random.Random(seed).choice(list(STYLES)) if randomize else style
        return io.NodeOutput(weighted(STYLES[name], weight), name)


NODES = [MBStyleModifier]

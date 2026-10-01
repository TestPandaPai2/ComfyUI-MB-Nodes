"""Makeup Mod Prompt picker: one combo of makeup styles, outputs that style's edit prompt."""

from comfy_api.latest import io

MAKEUP_TYPES = {
    "Natural / \"no-makeup\" makeup": "Modify the subject's makeup to a natural, barely-there look, with even skin, a light sheer foundation, soft cream blush, lightly groomed brows, a touch of mascara, and a sheer tinted lip balm.",
    "Soft glam": "Modify the subject's makeup to a soft glam look, with a smooth satin base, warm champagne and taupe eyeshadow blended softly, defined lashes, a peachy blush, subtle highlight, and a rosy nude lip.",
    "Full glam": "Modify the subject's makeup to a full glam look, with flawless full-coverage foundation, sculpted contour, a bold blended smoky eye, dramatic lashes, defined brows, bright highlight, and a polished lip.",
    "Classic red lip": "Modify the subject's makeup to a classic red lip look, with a bold, precisely lined true-red lip, clean matte skin, softly defined brows, a neutral eye with black mascara, and minimal blush.",
    "Smoky eye": "Modify the subject's makeup to a smoky eye look, with charcoal and black shadow blended outward and upward, smudged liner on the upper and lower lash lines, full black lashes, and a neutral nude lip.",
    "Winged liner": "Modify the subject's makeup to a winged liner look, with a sharp black cat-eye wing on both eyes, defined lashes, neutral shadow, groomed brows, and a soft pink or nude lip.",
    "Dewy glow": "Modify the subject's makeup to a dewy glow look, with luminous, skin-like radiance, glossy highlight on the cheekbones and nose bridge, a cream blush, a light shimmer on the lids, and a glossy lip.",
    "Matte and sculpted": "Modify the subject's makeup to a matte, sculpted look, with a velvety matte foundation, defined contour and cheekbones, a muted blush, matte neutral eyeshadow, and a matte nude lip.",
    "Peach monochrome": "Modify the subject's makeup to a peach monochrome look, using coordinated warm peach tones on the eyelids, cheeks, and lips, with a soft glow and a light coat of mascara.",
    "Pink monochrome": "Modify the subject's makeup to a pink monochrome look, using coordinated rosy pink on the eyes, cheeks, and lips, with a fresh, flushed complexion and soft lashes.",
    "Bronzed summer glow": "Modify the subject's makeup to a bronzed summer look, with a sun-kissed bronzer across the cheeks and forehead, golden shimmer on the lids, sun-freckled skin, and a glossy coral lip.",
    "Korean glass skin": "Modify the subject's makeup to a Korean glass skin look, with a translucent, dewy complexion, a gradient peachy-pink lip, straight soft brows, subtle shimmer on the lids, and a youthful blush on the apples of the cheeks.",
    "Douyin": "Modify the subject's makeup to a Douyin look, with a bright, luminous base, soft glitter on the lids, aegyo-sal highlights, long fluttery lashes, a flushed blush across the nose, and a juicy gradient lip.",
    "Soft smoky": "Modify the subject's makeup to a soft smoky look, with brown and bronze shadow gently blended on the lids, a smudged lower lash line, defined lashes, a warm blush, and a muted rose lip.",
    "Bold colorful eyes": "Modify the subject's makeup to bold colorful eyes, with vivid blended shadow in blue, purple, or green, bright liner, full lashes, a clean complexion, and a neutral lip to balance the color.",
    "Graphic liner": "Modify the subject's makeup to a graphic liner look, with a bold geometric liner shape in black or a bright color, clean negative space, minimal shadow, and a neutral lip.",
    "Glitter / festival": "Modify the subject's makeup to a festival glitter look, with sparkling glitter on the lids and inner corners, face gems or highlights on the cheekbones, bright shadow, and a glossy lip.",
    "Gothic / dark": "Modify the subject's makeup to a gothic look, with a pale matte complexion, heavy black smoky eyes, sharp black liner, defined dark brows, and a deep burgundy or black lip.",
    "Vintage 1950s": "Modify the subject's makeup to a 1950s vintage look, with a flawless matte base, softly arched brows, a subtle cat-eye wing, rosy cheeks, and a classic red lip.",
    "1960s mod": "Modify the subject's makeup to a 1960s mod look, with a bold graphic crease line, thick false lashes, pale matte lips, a light neutral lid, and sharply defined brows.",
    "1970s disco": "Modify the subject's makeup to a 1970s disco look, with shimmery gold and bronze eyeshadow, glossy peach lips, a warm sun-kissed blush, and long, defined lashes.",
    "1980s bold": "Modify the subject's makeup to a 1980s bold look, with vivid blue or pink eyeshadow, strong bright blush swept high on the cheekbones, thick brows, and a bright magenta or coral lip.",
    "1990s grunge": "Modify the subject's makeup to a 1990s grunge look, with smudged dark brown liner, thin, overdrawn brows, a matte brown-toned lip, and a minimal, slightly undone complexion.",
    "Y2K": "Modify the subject's makeup to a Y2K look, with frosted shimmer on the lids, thin arched brows, glossy lips with a lip-liner outline, light blush, and a touch of body shimmer on the cheekbones.",
    "Clean girl": "Modify the subject's makeup to a clean girl look, with glowing skin, a dewy cream blush, fluffy, brushed-up brows, defined lashes, and a glossy neutral lip.",
    "Latte makeup": "Modify the subject's makeup to a latte look, with warm brown and caramel tones across the eyes, soft bronzer, a creamy nude-brown lip, and a golden, warm-toned complexion.",
    "Sunburn blush": "Modify the subject's makeup to a sunburn blush look, with a wide band of rosy-red blush across the cheeks and nose, a natural bare base, and a lightly tinted lip.",
    "Strawberry girl": "Modify the subject's makeup to a strawberry girl look, with rosy-flushed cheeks, a soft pink blush on the nose, glossy strawberry-red lips, and subtle pink shimmer on the lids.",
    "Cherry cola": "Modify the subject's makeup to a cherry cola look, with deep red-brown tones on the eyes, cheeks, and lips, a glossy burgundy lip, and a rich, warm glow.",
    "Bridal": "Modify the subject's makeup to a bridal look, with a long-wearing radiant base, soft champagne shimmer on the lids, defined natural lashes, a rosy blush, subtle highlight, and a soft pink lip.",
    "Editorial high fashion": "Modify the subject's makeup to an editorial look, with artistic, unconventional color placement, sculpted shapes, strong contrast, and a polished finish that feels like a fashion magazine shoot.",
    "Barbie pink": "Modify the subject's makeup to a Barbie pink look, with bright pink blush, shimmery pink eyeshadow, long voluminous lashes, and a glossy hot-pink lip.",
    "Siren eyes": "Modify the subject's makeup to a siren eye look, with elongated, upturned eyeliner, smoky brown shadow extended outward, long wispy lashes, and a soft nude lip.",
    "Doll eyes": "Modify the subject's makeup to a doll eye look, with lashes concentrated on the outer corners, lighter shadow on the center of the lids, subtle lower lash definition, and a soft pink blush for a wide, innocent look.",
    "Cut crease": "Modify the subject's makeup to a cut crease look, with a sharply defined crease line, a bright or metallic lid, contrasting darker shadow above, winged liner, and a nude lip.",
    "Halo eye": "Modify the subject's makeup to a halo eye look, with a bright shimmer centered on the lid, darker shadow blended on the inner and outer corners, and subtle highlight on the brow bone.",
    "Metallic / chrome": "Modify the subject's makeup to a metallic look, with liquid chrome shadow in silver, gold, or copper on the lids, a clean complexion, a subtle highlight, and a neutral lip.",
    "Ombré / gradient lips": "Modify the subject's makeup to an ombré lip look, with a deeper shade at the outer edges that fades into a lighter, softer center, paired with a natural eye and a light blush.",
    "Bold brow focus": "Modify the subject's makeup to a bold brow look, with thick, sculpted, feathered brows, a minimal eye, light mascara, a natural complexion, and a soft nude lip.",
    "Freckled natural": "Modify the subject's makeup to a freckled look, with softly drawn faux freckles across the nose and cheeks, a sheer skin-like base, a warm cream blush, and a peachy lip.",
}


class MBMakeupModPrompt(io.ComfyNode):
    @classmethod
    def define_schema(cls) -> io.Schema:
        return io.Schema(
            node_id="MBNodesMakeupModPrompt",
            display_name="Makeup Mod Prompt (MB)",
            category="MBNodes",
            description="Pick a makeup style; outputs its makeup modification prompt.",
            search_aliases=["makeup", "makeup style", "makeup modification"],
            inputs=[
                io.Combo.Input("types", options=list(MAKEUP_TYPES), default="Soft glam"),
            ],
            outputs=[
                io.String.Output("prompt"),
            ],
        )

    @classmethod
    def execute(cls, types) -> io.NodeOutput:
        return io.NodeOutput(MAKEUP_TYPES[types])


NODES = [MBMakeupModPrompt]

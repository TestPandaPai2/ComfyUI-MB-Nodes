"""Makeup Mod Prompt picker: makeup styles grouped by category, outputs that style's edit prompt."""

import random

from comfy_api.latest import io

from .common import FAVORITES, all_names, from_favorites

MAKEUP_TYPES = {
    "Everyday": {
        "Natural / \"no-makeup\" makeup": "Modify the subject's makeup to a natural, barely-there look, with even skin, a light sheer foundation, soft cream blush, lightly groomed brows, a touch of mascara, and a sheer tinted lip balm.",
        "Soft glam": "Modify the subject's makeup to a soft glam look, with a smooth satin base, warm champagne and taupe eyeshadow blended softly, defined lashes, a peachy blush, subtle highlight, and a rosy nude lip.",
        "Dewy glow": "Modify the subject's makeup to a dewy glow look, with luminous, skin-like radiance, glossy highlight on the cheekbones and nose bridge, a cream blush, a light shimmer on the lids, and a glossy lip.",
        "Matte and sculpted": "Modify the subject's makeup to a matte, sculpted look, with a velvety matte foundation, defined contour and cheekbones, a muted blush, matte neutral eyeshadow, and a matte nude lip.",
        "Peach monochrome": "Modify the subject's makeup to a peach monochrome look, using coordinated warm peach tones on the eyelids, cheeks, and lips, with a soft glow and a light coat of mascara.",
        "Pink monochrome": "Modify the subject's makeup to a pink monochrome look, using coordinated rosy pink on the eyes, cheeks, and lips, with a fresh, flushed complexion and soft lashes.",
        "Bronzed summer glow": "Modify the subject's makeup to a bronzed summer look, with a sun-kissed bronzer across the cheeks and forehead, golden shimmer on the lids, sun-freckled skin, and a glossy coral lip.",
        "Soft smoky": "Modify the subject's makeup to a soft smoky look, with brown and bronze shadow gently blended on the lids, a smudged lower lash line, defined lashes, a warm blush, and a muted rose lip.",
        "Clean girl": "Modify the subject's makeup to a clean girl look, with glowing skin, a dewy cream blush, fluffy, brushed-up brows, defined lashes, and a glossy neutral lip.",
        "Latte makeup": "Modify the subject's makeup to a latte look, with warm brown and caramel tones across the eyes, soft bronzer, a creamy nude-brown lip, and a golden, warm-toned complexion.",
        "Bridal": "Modify the subject's makeup to a bridal look, with a long-wearing radiant base, soft champagne shimmer on the lids, defined natural lashes, a rosy blush, subtle highlight, and a soft pink lip.",
        "Bold brow focus": "Modify the subject's makeup to a bold brow look, with thick, sculpted, feathered brows, a minimal eye, light mascara, a natural complexion, and a soft nude lip.",
        "Freckled natural": "Modify the subject's makeup to a freckled look, with softly drawn faux freckles across the nose and cheeks, a sheer skin-like base, a warm cream blush, and a peachy lip.",
        "Ombré / gradient lips": "Modify the subject's makeup to an ombré lip look, with a deeper shade at the outer edges that fades into a lighter, softer center, paired with a natural eye and a light blush.",
        "Tinted minimal": "Modify the subject's makeup to a minimal tinted look, with a sheer skin tint, concealer only where needed, brushed brows, one coat of brown mascara, and a balm-tinted lip.",
        "Rosy everyday": "Modify the subject's makeup to a rosy everyday look, with a light even base, soft rose blush on the cheeks, a wash of dusty rose on the lids, defined lashes, and a rose-tinted lip.",
        "Office polished": "Modify the subject's makeup to a polished office look, with a smooth natural-finish base, neatly groomed brows, a matte taupe lid, thin brown liner, light mascara, and a satin nude-pink lip.",
        "Satin skin": "Modify the subject's makeup to a satin skin look, with a soft-focus satin foundation, gently blurred pores, a sheer powder blush, a neutral eye, and a creamy nude lip.",
        "Brown liner everyday": "Modify the subject's makeup to an everyday brown liner look, with a soft smudged brown liner along the upper lash line, a neutral shimmer lid, brown mascara, a warm blush, and a nude lip.",
        "Mauve neutral": "Modify the subject's makeup to a mauve neutral look, with cool mauve shadow on the lids, a muted mauve blush, softly defined lashes, a natural base, and a mauve-nude lip.",
    },
    "Glam / Bold": {
        "Full glam": "Modify the subject's makeup to a full glam look, with flawless full-coverage foundation, sculpted contour, a bold blended smoky eye, dramatic lashes, defined brows, bright highlight, and a polished lip.",
        "Classic red lip": "Modify the subject's makeup to a classic red lip look, with a bold, precisely lined true-red lip, clean matte skin, softly defined brows, a neutral eye with black mascara, and minimal blush.",
        "Smoky eye": "Modify the subject's makeup to a smoky eye look, with charcoal and black shadow blended outward and upward, smudged liner on the upper and lower lash lines, full black lashes, and a neutral nude lip.",
        "Winged liner": "Modify the subject's makeup to a winged liner look, with a sharp black cat-eye wing on both eyes, defined lashes, neutral shadow, groomed brows, and a soft pink or nude lip.",
        "Bold colorful eyes": "Modify the subject's makeup to bold colorful eyes, with vivid blended shadow in blue, purple, or green, bright liner, full lashes, a clean complexion, and a neutral lip to balance the color.",
        "Graphic liner": "Modify the subject's makeup to a graphic liner look, with a bold geometric liner shape in black or a bright color, clean negative space, minimal shadow, and a neutral lip.",
        "Glitter / festival": "Modify the subject's makeup to a festival glitter look, with sparkling glitter on the lids and inner corners, face gems or highlights on the cheekbones, bright shadow, and a glossy lip.",
        "Editorial high fashion": "Modify the subject's makeup to an editorial look, with artistic, unconventional color placement, sculpted shapes, strong contrast, and a polished finish that feels like a fashion magazine shoot.",
        "Siren eyes": "Modify the subject's makeup to a siren eye look, with elongated, upturned eyeliner, smoky brown shadow extended outward, long wispy lashes, and a soft nude lip.",
        "Cut crease": "Modify the subject's makeup to a cut crease look, with a sharply defined crease line, a bright or metallic lid, contrasting darker shadow above, winged liner, and a nude lip.",
        "Halo eye": "Modify the subject's makeup to a halo eye look, with a bright shimmer centered on the lid, darker shadow blended on the inner and outer corners, and subtle highlight on the brow bone.",
        "Metallic / chrome": "Modify the subject's makeup to a metallic look, with liquid chrome shadow in silver, gold, or copper on the lids, a clean complexion, a subtle highlight, and a neutral lip.",
        "Red carpet glam": "Modify the subject's makeup to a red carpet glam look, with a camera-ready luminous base, softly sculpted cheekbones, a shimmering bronze lid, fluttery lashes, and a satin berry-rose lip.",
        "Drag-inspired": "Modify the subject's makeup to a drag-inspired look, with heavily sculpted contour, an exaggerated cut crease, oversized dramatic lashes, high arched brows, intense highlight, and an overlined glossy lip.",
        "Neon pop": "Modify the subject's makeup to a neon pop look, with electric neon pink, yellow, or green liner and shadow, a clean matte complexion, bold lashes, and a bright neon-tinted lip.",
        "Black lip vamp": "Modify the subject's makeup to a vamp look, with a glossy or matte black lip, a sharp black wing, a soft smoky lower lash line, sculpted cheekbones, and a pale porcelain base.",
        "Jewel-tone eyes": "Modify the subject's makeup to a jewel-tone eye look, with rich emerald, sapphire, or amethyst shimmer blended across the lids, dark liner, full lashes, and a neutral satin lip.",
        "Berry vamp lip": "Modify the subject's makeup to a berry vamp look, with a deep, precisely lined berry-plum lip, a soft taupe eye, defined lashes, sculpted cheeks, and a matte, even base.",
        "Gold leaf": "Modify the subject's makeup to a gold leaf look, with flakes of gold foil on the lids and cheekbones, warm bronze shadow, a glowing golden highlight, defined lashes, and a nude-gold lip.",
        "Ruby glitter lip": "Modify the subject's makeup to a ruby glitter lip look, with a deep red lip topped with fine ruby glitter, a softly sculpted base, a warm bronze lid, and long defined lashes.",
    },
    "Gothic": {
        "Gothic / dark": "Modify the subject's makeup to a gothic look, with a pale matte complexion, heavy black smoky eyes, sharp black liner, defined dark brows, and a deep burgundy or black lip.",
        "Victorian goth": "Modify the subject's makeup to a Victorian goth look, with a porcelain matte base, softly smudged charcoal eyes, delicate dark brows, a hint of ashen contour, and a deep oxblood lip.",
        "Trad goth": "Modify the subject's makeup to a trad goth look, with a stark white base, dramatic black liner flicked into sharp points and swirls, heavily shadowed eyes, and a black lip.",
        "Romantic goth": "Modify the subject's makeup to a romantic goth look, with a pale satin base, plum and burgundy blended on the lids, soft black liner, a rose-tinted cheek, and a velvety wine lip.",
        "Vampire": "Modify the subject's makeup to a vampire look, with a cold pale complexion, reddened inner rims and lower lash line, smoky crimson shadow, sharp brows, and a blood-red stained lip.",
        "Corpse paint": "Modify the subject's makeup to a corpse paint look, with a solid white face, black painted eye sockets, sharp black markings around the mouth and cheeks, and a black lip.",
        "Pastel goth": "Modify the subject's makeup to a pastel goth look, with a pale base, lavender and baby-pink shadow edged in sharp black liner, black lashes, and a lilac or black lip.",
        "Cyber goth": "Modify the subject's makeup to a cyber goth look, with neon green or UV-blue graphic liner over black smoky eyes, a pale matte base, geometric face accents, and a black glossy lip.",
        "Witchy": "Modify the subject's makeup to a witchy look, with deep forest-green and black smoky eyes, a dark smudged waterline, a bronzed hollow under the cheekbones, and a dark plum lip.",
        "Gothic bride": "Modify the subject's makeup to a gothic bride look, with a luminous ivory base, soft smoky grey eyes, delicate black lashes, a faint silver highlight, and a deep merlot lip.",
        "Black widow": "Modify the subject's makeup to a black widow look, with a matte pale base, sharp black winged liner, a black-veiled smoky lid, sculpted hollow cheeks, and a glossy black-cherry lip.",
        "Raven": "Modify the subject's makeup to a raven look, with glossy blue-black shadow on the lids, feathery black lashes, an iridescent sheen at the center of the lid, and a deep grey-black lip.",
        "Grunge goth": "Modify the subject's makeup to a grunge goth look, with heavily smudged black kohl around the eyes, a slightly undone pale base, messy brows, and a worn-in dark berry lip.",
        "Blood tears": "Modify the subject's makeup to a blood tears look, with dark smoky eyes, thin trails of red tears running down from the lower lash line, a ghostly pale base, and a deep red lip.",
        "Dark fairy": "Modify the subject's makeup to a dark fairy look, with black and violet shimmer on the lids, scattered dark glitter on the cheekbones, a pale glowing base, and a deep violet lip.",
        "Gothic Lolita": "Modify the subject's makeup to a Gothic Lolita look, with a doll-like porcelain base, rounded black-lined eyes, long lower lashes, a soft rosy cheek, and a small dark red pout.",
        "Deathrock": "Modify the subject's makeup to a deathrock look, with exaggerated black liner shapes extending to the temples, a white powdered face, dark hollowed cheeks, and a black lip.",
        "Ethereal goth": "Modify the subject's makeup to an ethereal goth look, with a translucent pale glow, soft grey and silver smoky eyes, frosted inner corners, wispy lashes, and a muted plum lip.",
        "Venom": "Modify the subject's makeup to a venom look, with poison-green and black blended on the lids, sharp black liner, a pale matte base, and a deep green-black lip.",
        "Occult": "Modify the subject's makeup to an occult look, with a pale matte face, black-rimmed eyes, small drawn symbols near the temples, sculpted dark contour, and a black matte lip.",
    },
    "Regional / Trend": {
        "Korean glass skin": "Modify the subject's makeup to a Korean glass skin look, with a translucent, dewy complexion, a gradient peachy-pink lip, straight soft brows, subtle shimmer on the lids, and a youthful blush on the apples of the cheeks.",
        "Douyin": "Modify the subject's makeup to a Douyin look, with a bright, luminous base, soft glitter on the lids, aegyo-sal highlights, long fluttery lashes, a flushed blush across the nose, and a juicy gradient lip.",
        "Vintage 1950s": "Modify the subject's makeup to a 1950s vintage look, with a flawless matte base, softly arched brows, a subtle cat-eye wing, rosy cheeks, and a classic red lip.",
        "1960s mod": "Modify the subject's makeup to a 1960s mod look, with a bold graphic crease line, thick false lashes, pale matte lips, a light neutral lid, and sharply defined brows.",
        "1970s disco": "Modify the subject's makeup to a 1970s disco look, with shimmery gold and bronze eyeshadow, glossy peach lips, a warm sun-kissed blush, and long, defined lashes.",
        "1980s bold": "Modify the subject's makeup to a 1980s bold look, with vivid blue or pink eyeshadow, strong bright blush swept high on the cheekbones, thick brows, and a bright magenta or coral lip.",
        "1990s grunge": "Modify the subject's makeup to a 1990s grunge look, with smudged dark brown liner, thin, overdrawn brows, a matte brown-toned lip, and a minimal, slightly undone complexion.",
        "Y2K": "Modify the subject's makeup to a Y2K look, with frosted shimmer on the lids, thin arched brows, glossy lips with a lip-liner outline, light blush, and a touch of body shimmer on the cheekbones.",
        "Sunburn blush": "Modify the subject's makeup to a sunburn blush look, with a wide band of rosy-red blush across the cheeks and nose, a natural bare base, and a lightly tinted lip.",
        "Strawberry girl": "Modify the subject's makeup to a strawberry girl look, with rosy-flushed cheeks, a soft pink blush on the nose, glossy strawberry-red lips, and subtle pink shimmer on the lids.",
        "Cherry cola": "Modify the subject's makeup to a cherry cola look, with deep red-brown tones on the eyes, cheeks, and lips, a glossy burgundy lip, and a rich, warm glow.",
        "Barbie pink": "Modify the subject's makeup to a Barbie pink look, with bright pink blush, shimmery pink eyeshadow, long voluminous lashes, and a glossy hot-pink lip.",
        "Doll eyes": "Modify the subject's makeup to a doll eye look, with lashes concentrated on the outer corners, lighter shadow on the center of the lids, subtle lower lash definition, and a soft pink blush for a wide, innocent look.",
        "Japanese igari": "Modify the subject's makeup to a Japanese igari look, with a soft pink-red blush placed high under the eyes, a light glowing base, soft brown liner, natural lashes, and a sheer cherry lip.",
        "Bollywood glam": "Modify the subject's makeup to a Bollywood glam look, with thick kohl-lined eyes, a dramatic winged liner, a warm shimmering smoky lid, bold full brows, a radiant base, and a deep rosy-brown lip.",
        "Arabic glam": "Modify the subject's makeup to an Arabic glam look, with intense black kohl winged eyes, a richly blended smoky eye with gold shimmer, full voluminous lashes, sculpted contour, and a nude-brown lip.",
        "Latina glam": "Modify the subject's makeup to a Latina glam look, with a sharp brown lip liner around a glossy nude lip, defined arched brows, a warm bronzed contour, a winged liner, and full lashes.",
        "French girl": "Modify the subject's makeup to a French girl look, with a bare, slightly undone complexion, groomed natural brows, a smudge of mascara, a hint of flushed cheek, and a blotted red lip.",
        "1920s flapper": "Modify the subject's makeup to a 1920s flapper look, with a pale matte base, thin downturned brows, dark smoky round eyes, a defined cupid's bow in deep red, and a soft rosy cheek.",
        "Cold girl": "Modify the subject's makeup to a cold girl look, with a rosy flush across the nose and cheeks as if from cold air, a dewy fresh base, a light glossy lip, soft lashes, and a frosted shimmer on the lids.",
    },
}


class MBMakeupModPrompt(io.ComfyNode):
    @classmethod
    def define_schema(cls) -> io.Schema:
        return io.Schema(
            node_id="MBNodesMakeupModPrompt",
            display_name="MB Makeup Mod Prompt",
            category="MBNodes",
            description="Pick a makeup style; outputs its makeup modification prompt.",
            search_aliases=["makeup", "makeup style", "makeup modification"],
            inputs=[
                io.DynamicCombo.Input("category", options=[
                    io.DynamicCombo.Option(name, [io.Combo.Input("style", options=list(items))])
                    for name, items in MAKEUP_TYPES.items()
                ] + [io.DynamicCombo.Option(FAVORITES, [io.Combo.Input("style", options=all_names(MAKEUP_TYPES))])]),
                io.Boolean.Input("randomize", default=False, tooltip="Pick the style within the category (or favorites) from the seed."),
                io.Int.Input("seed", default=0, min=0, max=0xFFFFFFFFFFFFFFFF, control_after_generate=True),
            ],
            outputs=[
                io.String.Output("prompt"),
            ],
        )

    @classmethod
    def execute(cls, category, randomize, seed) -> io.NodeOutput:
        rng = random.Random(seed)
        category, randomize = from_favorites("MBNodesMakeupModPrompt", MAKEUP_TYPES, category, "style", rng, randomize)
        items = MAKEUP_TYPES[category["category"]]
        style = rng.choice(list(items)) if randomize else category["style"]
        return io.NodeOutput(items[style])


NODES = [MBMakeupModPrompt]

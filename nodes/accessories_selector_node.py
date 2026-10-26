"""Accessories picker: one dropdown per category (none, seeded-random, or a
style), all picked pieces joined into one description, with an optional
metal finish shared by every piece."""

import random

from comfy_api.latest import io

from .common import MAX_SEED, weighted
from .wardrobe_selector_node import _sections

ACCESSORIES = _sections("""
WAIST CHAINS

Simple Chain: She wears a simple waist chain made of a single, fine cable-link chain that sits low on her hips just below the navel, finished with a tiny lobster clasp and a short adjustable extender at the side, minimal, lightweight, and elegantly understated.
Layered Chain: She wears a layered waist chain with three to four fine chains of graduated lengths joined at the sides, the top strand at her natural waist and each strand below draping a little lower toward her hips, so they fall in soft, delicate tiers.
Beaded Waist Chain: She wears a beaded waist chain at her natural waist, with small round pearls spaced evenly along a thin chain, each bead secured by tiny links so the pearls sit neatly in a row around the narrowest part of her waist, soft, bohemian, and romantic.
Heart Chain: She wears a heart waist chain that sits low on her hips, with tiny puffed heart charms dangling at regular intervals from a fine chain, the little hearts swinging gently with each step for a cute, sweet, feminine touch.
Dangle Chain: She wears a dangle waist chain at her natural waist, with small teardrop and bead charms hanging from short drop links along a fine chain, creating a fringe of tiny pendants that sway and shimmer as she moves.
Butterfly Chain: She wears a butterfly waist chain slung low on her hips, with small flat butterfly charms threaded along a delicate chain, each butterfly spaced apart so they look like they are fluttering around her hips, dreamy and Y2K-inspired.
Coin Chain: She wears a coin waist chain draped over the waistband of her skirt, lined with round stamped coin discs hanging from small jump rings along a fine chain, the engraved coins clinking softly as she walks, bohemian, vintage, and festival-ready.
Shell Chain: She wears a shell waist chain low on her bare hips, with natural cowrie shells hung from small rings along a thin chain, the smooth shells lying flat against the skin for an easy, tropical, beachy summer look.
Rhinestone Chain: She wears a rhinestone waist chain cinched over her dress at the natural waist, made of a continuous line of small crystals set in claw settings, forming a slim sparkling band that glitters and catches the light.
Waist Chain Belt: She wears a chunky waist chain belt of thick, polished curb links fastened with a hook clasp over the waistband of her clothing, with a long chain tail hanging down the front, bold and statement-making.
Body Chain: She wears a waist-style body chain with fine strands that loop around her natural waist and crisscross over her stomach in an X pattern, meeting at a small center connector with a dangling drop charm, dramatic and eye-catching.
Custom Name Chain: She wears a custom name waist chain that sits low on her hips, with small block letter charms spelling a name or word spaced evenly along a delicate chain, personal and unique.
Belly Button Drop Chain: She wears a belly button drop chain with a fine chain around her natural waist and a single long vertical strand that falls from the center down toward her navel, ending in a small pendant charm.
Star Charm Chain: She wears a star charm waist chain set high on her waist just under the bust, with tiny star-shaped charms and miniature crescent moons alternating along a thin chain, celestial, whimsical, and dainty.
Paperclip Chain: She wears a paperclip waist chain at her natural waist, made of flat, elongated rectangular links that sit smoothly against the skin, modern, sleek, and minimalist.
Satellite Bead Chain: She wears a satellite bead waist chain low on her hips, a fine chain dotted with tiny polished metal beads at small, even intervals, giving a subtle shimmer and a clean, delicate finish.
Multi-Strand Belly Chain: She wears a multi-strand belly chain with five or more thin chains bundled at the sides of her natural waist and draping in a loose cascade across her stomach, glamorous and bold.
Crystal Drop Chain: She wears a crystal drop waist chain over her dress at the natural waist, with sparkling teardrop crystals hanging from a fine chain, each crystal catching the light like a tiny droplet, glamorous and evening-ready.
Gemstone Chain: She wears a gemstone waist chain low on her hips, with small polished colored stones set in bezel frames and linked along a delicate chain, earthy, vibrant, and bohemian.
Turquoise Bead Chain: She wears a turquoise bead waist chain slung over the waistband of her jeans, strung with small turquoise beads and tiny metal spacers, carrying a free-spirited, southwestern, desert-boho feel.
Seed Bead Waist Strand: She wears a seed bead waist strand, a row of tiny glass seed beads threaded on a stretch or tie cord that sits snugly at her natural waist, colorful and handmade.
Tassel Chain: She wears a tassel waist chain low on her hips, with small fringed chain tassels hanging at the sides and front from a fine chain, swaying with movement for a playful, dance-inspired look.
Y-Drop Lariat Chain: She wears a Y-drop lariat waist chain with a chain around her natural waist and two strands meeting at a central ring, from which a longer chain falls down the front of her hips.
Snake Chain: She wears a snake waist chain set high on her waist just under the ribs, made of smooth, tightly linked flexible tubing that lies flat against the skin with a liquid, glossy shine, sleek and modern.

NECKLACES

Chain Necklace: She wears a chunky chain necklace made of large, polished oval links that sit just below the collarbone, bold and versatile on its own or layered with finer pieces.
Pendant Necklace: She wears a pendant necklace with a single sparkling teardrop gem hanging from a fine chain, resting delicately at the center of her chest.
Layered Necklace: She wears a layered necklace with three fine chains of graduated lengths, the shortest at her collarbone and the longest on her upper chest, each carrying a small charm or pendant, creating a dimensional, trendy tiered look.
Multi-Strand Necklace: She wears a multi-strand necklace with five or more fine chains joined at a single clasp, draping in close, parallel rows from her collarbone down across her upper chest.
Choker Necklace: She wears a choker necklace, a snug band that sits tightly around the base of her neck, finished with a small dangling charm at the center front.
Collar Necklace: She wears a collar necklace, a rigid, crescent-shaped metal piece that rests flat on her collarbones with a sculpted, modern, structured look.
Princess Necklace: She wears a princess-length necklace, a fine chain that falls just at the collarbone with a single small solitaire stone at the center, timeless for everyday wear.
Matinee Necklace: She wears a matinee-length necklace that falls to the upper chest, made of a fine chain dotted with small stones or links, ideal over tops and dresses.
Opera Necklace: She wears an opera-length necklace, a long strand of lustrous pearls falling to the bust, worn single or looped double for an elegant effect.
Rope Necklace: She wears a rope necklace with tightly twisted strands forming a thick, textured braid of metal that falls to her upper chest, long enough to wrap twice.
Bib Necklace: She wears a bib necklace, an elaborate cluster of jewels and crystals arranged in a wide fan that covers her upper chest like a decorative collar.
Y-Necklace: She wears a Y-necklace with a fine chain around the base of her neck meeting at a central point, from which a single vertical drop strand falls down the front of her chest toward her bust to form a Y shape.
Lariat Necklace: She wears a lariat necklace, a long clasp-free chain that loops through a ring or knot at the base of her throat, with the loose ends hanging down vertically over her chest.
Station Necklace: She wears a station necklace that falls just below her collarbone, with small gemstones or charms spaced evenly along a fine chain, each sparkling like a tiny stop along the strand.
Tennis Necklace: She wears a tennis necklace at her collarbone, a continuous line of identical small diamonds or crystals set side by side in a flexible row around her neck.
Pearl Necklace: She wears a classic pearl necklace with a single strand of round, lustrous pearls of equal size sitting at the collarbone, graceful and refined.
Beaded Necklace: She wears a beaded necklace falling to her upper chest, strung with polished colored stone beads and tiny metal spacers, adding color, texture, and personality.
Initial Necklace: She wears an initial necklace with a single letter pendant hanging from a fine chain, resting just below the hollow of her throat, personal, meaningful, and perfect for everyday wear.
Statement Necklace: She wears a statement necklace sitting across her collarbones, with oversized jeweled flowers and clustered crystals forming a bold, eye-catching centerpiece.
Kundan Necklace: She wears a kundan necklace resting along her collarbones and upper chest, with glass gems set in gold foil within an ornate collar design, finished with pearl drops along the edge, regal and traditional.
Temple Necklace: She wears a temple necklace in antique gold falling to her upper chest, with deity motifs, intricate carved detailing, and a large ornate center pendant at the center of her chest, rich and traditional.
Solitaire Necklace: She wears a solitaire necklace with a single brilliant diamond set on a whisper-thin chain, resting at the hollow of her throat, minimal, timeless, and elegant.
Charm Necklace: She wears a charm necklace at her collarbone, with an assortment of small charms like stars, hearts, shells, and coins hanging along a fine chain, playful and personal.
Lock Necklace: She wears a lock necklace with a polished padlock pendant hanging from a fine chain just below her collarbone, sleek, modern, and symbolic.
Torque Necklace: She wears a torque necklace, a rigid open-ended metal ring that wraps around the base of her neck with small ball-capped ends at the front.
""")

# Input name for each category's slot.
SLOTS = {"Waist Chains": "waist_chain", "Necklaces": "necklace"}
NONE, RANDOM = "none", "random"
METALS = ["gold", "silver", "rose gold"]
METAL_OPTIONS = ["as written", *METALS, RANDOM]


class MBAccessoriesSelector(io.ComfyNode):
    @classmethod
    def define_schema(cls) -> io.Schema:
        return io.Schema(
            node_id="MBNodesAccessoriesSelector",
            display_name="Accessories Selector (MB)",
            category="MBNodes",
            description="Output an accessory description from a chosen or random category and style.",
            search_aliases=["accessories", "jewelry", "waist chain", "belly chain", "body chain", "random prompt"],
            inputs=[
                *(
                    io.Combo.Input(SLOTS[name], options=[NONE, RANDOM, *items], default=NONE,
                                   tooltip=f"{name} style, a seeded-random one, or none.")
                    for name, items in ACCESSORIES.items()
                ),
                io.Combo.Input("metal", options=METAL_OPTIONS, default="as written", tooltip="Add one metal finish for every accessory, or keep them as written."),
                io.Int.Input("seed", default=0, min=0, max=MAX_SEED, control_after_generate=True),
                io.Float.Input("weight", default=1.0, min=0.0, max=2.0, step=0.05, display_mode=io.NumberDisplay.slider, tooltip="Prompt weight. At 1.0 the text is output as-is, otherwise as (text:weight)."),
            ],
            outputs=[
                io.String.Output("prompt"),
                *(io.String.Output(slot, tooltip=f"The {name.lower()} text on its own. Empty when none.") for name, slot in SLOTS.items()),
                io.String.Output("styles", tooltip="The picked styles, e.g. \"Waist Chains: Heart Chain / Necklaces: Pearl Necklace\"."),
            ],
        )

    @classmethod
    def execute(cls, metal, seed, weight, **picks) -> io.NodeOutput:
        rng = random.Random(seed)
        texts, styles = [], []
        for name, items in ACCESSORIES.items():
            style = picks[SLOTS[name]]
            if style == RANDOM:
                style = rng.choice(list(items))
            texts.append(items.get(style, ""))
            if style != NONE:
                styles.append(f"{name}: {style}")

        prompt = " ".join(t for t in texts if t)
        if prompt and metal != "as written":
            prompt += f" The metalwork is polished {rng.choice(METALS) if metal == RANDOM else metal}."
        return io.NodeOutput(
            weighted(prompt, weight),
            *(weighted(t, weight) for t in texts),
            " / ".join(styles),
        )


NODES = [MBAccessoriesSelector]

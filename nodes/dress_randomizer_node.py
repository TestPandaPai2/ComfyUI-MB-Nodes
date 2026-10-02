"""Dress prompt picker: a dress style (fixed or seeded-random) as its full
description, plus a seeded sample of extra detail fragments and an optional
seeded color."""

import random

from comfy_api.latest import io

from .bodycon_randomizer_node import COLORS, MAX_SEED, weighted


def _lines(block):
    return [line.strip() for line in block.strip().splitlines() if line.strip()]


DRESSES = {
    "A-Line Dress": ("She wears an A-line dress with a fitted bodice that gently widens from the waist into a smooth, triangular skirt ending around the knee, flattering and timeless.", _lines("""
        cap sleeves
        sleeveless cut
        round neckline
        V-neckline
        thin belt at the waist
        side seam pockets
        concealed back zip
        crisp cotton fabric
        subtle polka dot print
        hidden pleats in the skirt
    """)),
    "Bodycon Dress": ("She wears a short, stretchy bodycon dress that hugs her curves closely from neckline to hem, giving her a sleek, bold silhouette.", _lines("""
        ribbed knit fabric
        scoop neckline
        long fitted sleeves
        sleeveless cut
        ruched side seams
        exposed back zip
        square neckline
        glossy satin finish
        thigh-skimming hem
        open back
    """)),
    "Ball Gown": ("She wears a grand, floor-length ball gown with a tightly fitted bodice and an enormous, full skirt layered with tulle, perfect for a fairytale evening.", _lines("""
        sweetheart neckline
        off-shoulder sleeves
        beaded bodice
        sparkling sequin scatter on the skirt
        sweeping train
        lace-up corset back
        embroidered floral appliques
        satin waist sash
        crystal-studded straps
        layered petticoat underneath
    """)),
    "Wrap Dress": ("She wears a soft wrap dress that crosses over at the front and ties at her waist, creating a natural V-neckline and a cinched, flattering shape.", _lines("""
        flutter sleeves
        long bishop sleeves
        jersey fabric
        floral print
        midi length hem
        ruffled hem
        side split in the skirt
        knotted waist tie
        silky crepe fabric
        three-quarter sleeves
    """)),
    "Maxi Dress": ("She wears a long, breezy maxi dress that sweeps down to her ankles in a light, summery print, ideal for a relaxed vacation stroll.", _lines("""
        thin spaghetti straps
        smocked bodice
        tiered skirt
        front thigh slit
        halter neckline
        flowing chiffon fabric
        paisley print
        tropical leaf print
        tie-back straps
        lightweight cotton gauze
    """)),
    "Mini Dress": ("She wears a short, youthful mini dress with a hemline well above the knee and puffed sleeves, giving her a fun, flirty look.", _lines("""
        square neckline
        gingham check print
        smocked back
        ruffled hem
        sweetheart neckline
        tiny floral print
        tie front detail
        button-down front
        A-line skirt
        corduroy fabric
    """)),
    "Shirt Dress": ("She wears a shirt dress styled like a lengthened button-up shirt, complete with a collar, front buttons, rolled sleeves, and a belt at her waist.", _lines("""
        crisp poplin cotton
        pinstripe pattern
        chest patch pockets
        curved shirttail hem
        knee-length hem
        oversized relaxed fit
        linen fabric
        tortoiseshell buttons
        drawstring waist
        side slits
    """)),
    "Slip Dress": ("She wears a sleek, silky slip dress with thin straps and a smooth bias cut that skims her body gracefully like a vintage lingerie slip.", _lines("""
        cowl neckline
        lace trim along the neckline
        adjustable straps
        midi length hem
        open back
        V-neckline
        liquid satin sheen
        side thigh slit
        lace hem trim
        cross-back straps
    """)),
    "Cocktail Dress": ("She wears a polished, knee-length cocktail dress with elegant draping and a ruffled hem, ready for an evening party.", _lines("""
        one-shoulder neckline
        sequin embellishment
        satin fabric
        sweetheart neckline
        fitted bodice
        bow detail at the waist
        sheer illusion sleeves
        beaded neckline
        velvet fabric
        structured peplum
    """)),
    "Tube Dress": ("She wears a strapless tube dress cut straight and close to her body, held up by a snug, structured neckline.", _lines("""
        ribbed knit fabric
        mini length hem
        midi length hem
        straight-across neckline
        ruched front
        side slit
        stretch jersey fabric
        elastic bandeau top
        seamless finish
        smocked bodice
    """)),
    "Peplum Dress": ("She wears a fitted peplum dress with a short flared ruffle at the waist that falls playfully over her hips.", _lines("""
        pencil skirt below the peplum
        square neckline
        cap sleeves
        crepe fabric
        exposed back zip
        knee-length hem
        sleeveless cut
        sweetheart neckline
        long fitted sleeves
        structured tailoring
    """)),
    "Tunic Dress": ("She wears a loose, relaxed tunic dress with a straight cut, wide sleeves, and embroidered trim, giving her an easy bohemian feel.", _lines("""
        split neckline
        tasseled neck ties
        mid-thigh hem
        linen fabric
        side slits
        block print pattern
        mirror work details
        drawstring waist
        cotton voile fabric
        geometric embroidery
    """)),
    "Sheath Dress": ("She wears a tailored sheath dress that follows her natural lines without clinging, sleeveless and knee-length, perfect for the office.", _lines("""
        boat neckline
        back vent in the skirt
        crepe fabric
        princess seams
        thin waist belt
        jewel neckline
        concealed back zip
        textured tweed fabric
        V-neckline
        clean, minimalist finish
    """)),
    "Mermaid Dress": ("She wears a long mermaid dress fitted tightly through her bodice, hips, and thighs before flaring dramatically below the knee into a sweeping hem.", _lines("""
        strapless sweetheart neckline
        all-over sequins
        lace overlay
        sheer illusion back
        long train
        off-shoulder neckline
        satin fabric
        beaded bodice
        deep V-neckline
        tulle flare at the hem
    """)),
    "Empire Waist Dress": ("She wears an empire waist dress with a raised waistline just under her bust and a long, softly flowing skirt with a romantic feel.", _lines("""
        puff sleeves
        ribbon tie under the bust
        chiffon fabric
        square neckline
        floral print
        V-neckline
        smocked back
        flutter sleeves
        lace trim
        sleeveless cut
    """)),
    "Off-Shoulder Dress": ("She wears an off-shoulder dress with a ruffled neckline sitting below her shoulders, baring her collarbones elegantly.", _lines("""
        elasticated neckline
        bell sleeves
        midi length hem
        tiered skirt
        cotton eyelet fabric
        floral print
        fitted waist
        mini length hem
        side slit
        long flowing skirt
    """)),
    "Halter Neck Dress": ("She wears a halter neck dress with straps tied around the back of her neck, leaving her shoulders and upper back open.", _lines("""
        maxi length hem
        midi length hem
        pleated skirt
        keyhole front
        satin fabric
        floral print
        fitted bodice
        flowing chiffon skirt
        side slit
        open back
    """)),
    "One-Shoulder Dress": ("She wears an asymmetrical one-shoulder dress with a single strap and a thigh slit, looking sleek and elegant.", _lines("""
        draped bodice
        floor-length skirt
        satin fabric
        ruffled shoulder strap
        cut-out at the waist
        jersey fabric
        sequin finish
        balloon sleeve on one arm
        fitted silhouette
        brooch at the shoulder
    """)),
    "Ruffle Dress": ("She wears a romantic ruffle dress decorated with soft, cascading ruffles on the sleeves and skirt.", _lines("""
        tiered skirt
        V-neckline
        chiffon fabric
        midi length hem
        mini length hem
        floral print
        fitted waist
        long sleeves
        off-shoulder neckline
        polka dot print
    """)),
    "High-Low Dress": ("She wears a high-low dress with a hemline short in the front and dramatically longer in the back, flowing beautifully as she walks.", _lines("""
        sweetheart neckline
        fitted bodice
        chiffon skirt
        halter neckline
        tulle layers
        floral print
        cap sleeves
        satin fabric
        strapless cut
        ruffled hem
    """)),
    "Pleated Dress": ("She wears a pleated dress with neat, evenly folded pleats in the skirt that sway and flutter with every step.", _lines("""
        accordion pleats
        metallic finish
        midi length hem
        V-neckline
        long sleeves
        sleeveless cut
        belted waist
        satin fabric
        mock neck
        knife pleats
    """)),
    "Blazer Dress": ("She wears a sharp blazer dress styled like a long double-breasted jacket with lapels and buttons, belted at the waist for a powerful look.", _lines("""
        gold buttons
        padded shoulders
        mini length hem
        long sleeves
        pinstripe fabric
        flap pockets
        deep V-neckline
        tweed fabric
        single-breasted front
        houndstooth pattern
    """)),
    "Corset Dress": ("She wears a corset dress with a structured, boned bodice that cinches her waist tightly, flowing into a flared skirt.", _lines("""
        lace-up back
        sweetheart neckline
        thin straps
        satin fabric
        mini length hem
        midi length hem
        lace overlay
        visible boning
        off-shoulder sleeves
        busk front closure
    """)),
    "Kaftan Dress": ("She wears a loose, flowing kaftan dress with wide, draped sleeves and a bold pattern, effortlessly elegant in warm weather.", _lines("""
        deep V-neckline
        silk fabric
        maxi length hem
        tassel trim
        geometric print
        beaded neckline
        drawstring waist
        side slits
        sheer chiffon fabric
        embroidered neckline
    """)),
    "Tiered Dress": ("She wears a tiered dress with a skirt built from stacked horizontal layers that add volume and bouncy movement.", _lines("""
        maxi length hem
        mini length hem
        smocked bodice
        puff sleeves
        cotton fabric
        floral print
        square neckline
        thin straps
        ruffled edges
        V-neckline
    """)),
    "Babydoll Dress": ("She wears a sweet babydoll dress with a high waistline just under her bust, puff sleeves, and a loose, swingy skirt.", _lines("""
        mini length hem
        Peter Pan collar
        lace trim
        bow at the neckline
        gingham print
        floral print
        square neckline
        smocked bodice
        ruffled hem
        satin fabric
    """)),
    "Denim Dress": ("She wears a casual denim dress with front buttons, pockets, a collar, and a belted waist.", _lines("""
        light wash denim
        dark wash denim
        short sleeves
        sleeveless cut
        mini length hem
        midi length hem
        raw frayed hem
        contrast stitching
        silver snap buttons
        A-line skirt
    """)),
    "Lace Dress": ("She wears a delicate lace dress with intricate patterns, long sheer sleeves, and a scalloped hem.", _lines("""
        high neckline
        V-neckline
        opaque lining underneath
        open back
        midi length hem
        mini length hem
        floral lace motif
        keyhole back
        fitted silhouette
        satin waist ribbon
    """)),
    "Tulle Dress": ("She wears a dreamy tulle dress with a skirt made from soft layers of netted tulle that float lightly around her.", _lines("""
        sweetheart neckline
        fitted satin bodice
        glitter tulle
        off-shoulder sleeves
        midi length hem
        floor-length hem
        embroidered stars
        thin straps
        corset back
        ruffled tulle sleeves
    """)),
    "Jumpsuit Dress": ("She wears a jumpsuit dress that combines a fitted top with wide-leg trousers, elegant yet easy to move in.", _lines("""
        halter neckline
        V-neckline
        belted waist
        crepe fabric
        satin fabric
        sleeveless cut
        one-shoulder neckline
        off-shoulder neckline
        palazzo legs
        open back
    """)),
    "Spaghetti Strap A-Line Dress": ("She wears a spaghetti strap A-line dress with thin straps, a ruched bodice, side lace-up details, and a softly flaring midi skirt.", _lines("""
        sweetheart neckline
        V-neckline
        satin fabric
        floral print
        cotton fabric
        side slit
        adjustable straps
        smocked back
        polka dot print
        ruffled hem
    """)),
    "Bodycon Midi Dress": ("She wears a bodycon midi dress that hugs her figure down to mid-calf, featuring a ruched, printed fabric.", _lines("""
        long sleeves
        sleeveless cut
        square neckline
        side slit
        ribbed knit fabric
        mesh fabric
        V-neckline
        cut-out at the waist
        abstract print
        one-shoulder neckline
    """)),
    "Tie Strap Midi Dress": ("She wears a tie strap midi dress with bow-tied shoulder straps, a ruched bodice, and a full, flowing skirt.", _lines("""
        square neckline
        sweetheart neckline
        floral print
        linen fabric
        tiered skirt
        smocked back
        side slit
        gingham print
        ruffled hem
        satin fabric
    """)),
    "Ruched Ruffle Dress": ("She wears a fitted ruched ruffle dress with a vertical ruffle running down the front and a soft watercolor print.", _lines("""
        mesh fabric
        long sleeves
        sleeveless cut
        mini length hem
        midi length hem
        V-neckline
        one-shoulder neckline
        asymmetric hem
        side drawstring
        square neckline
    """)),
    "Wrap Front Bodycon Dress": ("She wears a wrap front bodycon dress with a crossover bodice and draped ruching along her side, flattering her waist.", _lines("""
        long sleeves
        short sleeves
        mini length hem
        midi length hem
        jersey fabric
        satin fabric
        deep V-neckline
        side slit
        gold buckle at the waist
        asymmetric hem
    """)),
    "Ruched Bodycon Dress": ("She wears a ruched bodycon dress made from fabric gathered into soft horizontal folds that sculpt her figure.", _lines("""
        mesh fabric
        long sleeves
        sleeveless cut
        square neckline
        one-shoulder neckline
        mini length hem
        midi length hem
        side drawstring
        V-neckline
        off-shoulder neckline
    """)),
    "Floral Ruched Dress": ("She wears a floral ruched dress, fitted and gathered throughout, with a delicate flower print.", _lines("""
        mesh fabric
        long sleeves
        thin straps
        square neckline
        V-neckline
        mini length hem
        midi length hem
        side slit
        ruffled hem
        off-shoulder neckline
    """)),
    "Off-Shoulder Ruffle Dress": ("She wears an off-shoulder ruffle dress with a halter tie, ruched sides, and an asymmetrical ruffled hem.", _lines("""
        floral print
        polka dot print
        chiffon fabric
        mini length hem
        midi length hem
        bell sleeves
        fitted bodice
        satin fabric
        tiered ruffles
        side slit
    """)),
    "Sweetheart Ruched Dress": ("She wears a sweetheart ruched dress with a heart-shaped neckline, tightly gathered body, and a side slit.", _lines("""
        thin straps
        strapless cut
        long sleeves
        puff sleeves
        mesh fabric
        satin fabric
        mini length hem
        midi length hem
        corset boning
        open back
    """)),
    "Off-Shoulder Bodycon Dress": ("She wears an off-shoulder bodycon dress with a bare-shouldered neckline and ruched fabric hugging her figure.", _lines("""
        long sleeves
        short sleeves
        mini length hem
        midi length hem
        ribbed knit fabric
        satin fabric
        side slit
        fold-over neckline
        twist front detail
        bandage fabric
    """)),
    "Puff Sleeve Dress": ("She wears a puff sleeve dress with full, rounded sleeves, a fitted bodice, and a flared skirt.", _lines("""
        square neckline
        sweetheart neckline
        V-neckline
        mini length hem
        midi length hem
        floral print
        gingham print
        smocked back
        satin fabric
        tiered skirt
    """)),
    "Spaghetti Strap Dress": ("She wears a lightweight spaghetti strap dress with very thin straps, a ruched bodice, and a flared skirt.", _lines("""
        V-neckline
        sweetheart neckline
        mini length hem
        midi length hem
        floral print
        satin fabric
        cotton fabric
        side slit
        smocked back
        ruffled hem
    """)),
    "Strapless Bodycon Dress": ("She wears a strapless bodycon dress that clings closely to her body, with ruching across the bust and a short fitted skirt.", _lines("""
        sweetheart neckline
        straight-across neckline
        satin fabric
        ribbed knit fabric
        bandage fabric
        side slit
        corset boning
        sequin finish
        midi length hem
        twist front detail
    """)),
    "Square Neck Dress": ("She wears a square neck dress with a straight, squared-off neckline, wide straps, and a flared skirt.", _lines("""
        puff sleeves
        long sleeves
        mini length hem
        midi length hem
        floral print
        gingham print
        smocked back
        linen fabric
        satin fabric
        tiered skirt
    """)),
    "Fit & Flare Dress": ("She wears a fit and flare dress, snug through the bust and waist before flaring into a full, swingy skirt.", _lines("""
        sweetheart neckline
        V-neckline
        cap sleeves
        long sleeves
        sleeveless cut
        mini length hem
        midi length hem
        floral print
        pleated skirt
        thin waist belt
    """)),
    "Spaghetti Strap Bodycon Dress": ("She wears a spaghetti strap bodycon dress, a body-hugging mini with thin straps and ruched side ties.", _lines("""
        V-neckline
        square neckline
        cowl neckline
        satin fabric
        ribbed knit fabric
        mesh fabric
        side slit
        open back
        cross-back straps
        midi length hem
    """)),
    "One Shoulder Bodycon Dress": ("She wears a one shoulder bodycon dress with a single strap and asymmetrical draping down to a wrapped hem.", _lines("""
        long single sleeve
        sleeveless cut
        cut-out at the waist
        ribbed knit fabric
        satin fabric
        mini length hem
        midi length hem
        side slit
        ruffled shoulder
        sequin finish
    """)),
    "Square Neck Bodycon Dress": ("She wears a square neck bodycon dress with long sleeves and a squared neckline that frames her collarbones.", _lines("""
        ribbed knit fabric
        satin fabric
        mini length hem
        midi length hem
        side slit
        puff shoulders
        ruched sides
        corset seams
        open back
        mesh fabric
    """)),
    "Halter Neck Bodycon Dress": ("She wears a halter neck bodycon dress with straps tied behind her neck and a plunging V-neckline.", _lines("""
        open back
        ribbed knit fabric
        satin fabric
        mini length hem
        midi length hem
        side slit
        ruched sides
        cut-out at the waist
        keyhole front
        sequin finish
    """)),
    "High Neck Bodycon Dress": ("She wears a sleeveless high neck bodycon dress with a mock-style collar that shows off her arms.", _lines("""
        ribbed knit fabric
        mini length hem
        midi length hem
        side slit
        open back
        cut-out shoulders
        ruched sides
        zip-up collar
        mesh panels
        satin fabric
    """)),
    "Turtleneck Bodycon Dress": ("She wears a long-sleeve turtleneck bodycon dress with a folded collar, cozy yet sleek.", _lines("""
        ribbed knit fabric
        cable knit fabric
        mini length hem
        midi length hem
        side slit
        cut-out back
        fine merino knit
        ruched sleeves
        sweater dress feel
        belted waist
    """)),
    "Wrap Bodycon Dress": ("She wears a long-sleeve wrap bodycon dress with a wrapped V-neck and a side tie at her waist.", _lines("""
        jersey fabric
        satin fabric
        mini length hem
        midi length hem
        side slit
        ruched sides
        puff shoulders
        gold buckle at the waist
        asymmetric hem
        ribbed knit fabric
    """)),
    "Cut-Out Bodycon Dress": ("She wears a cut-out bodycon dress featuring open panels at the waist, adding a bold, modern edge.", _lines("""
        long sleeves
        sleeveless cut
        one-shoulder neckline
        halter neckline
        mini length hem
        midi length hem
        ring hardware details
        ribbed knit fabric
        side slit
        open back
    """)),
    "Mesh Panel Bodycon Dress": ("She wears a mesh panel bodycon dress with sheer sleeves and see-through panels across the chest.", _lines("""
        mini length hem
        midi length hem
        sheer side panels
        sheer hem panel
        mock neck
        V-neckline
        satin fabric
        ribbed knit fabric
        flocked dot mesh
        corset seams
    """)),
    "Corset Bodycon Dress": ("She wears a corset bodycon dress, a fitted mini with a structured, visibly boned bodice cinching her waist.", _lines("""
        sweetheart neckline
        square neckline
        thin straps
        strapless cut
        satin fabric
        lace-up back
        midi length hem
        side slit
        mesh corset panels
        long sleeves
    """)),
    "Sweetheart Neck Bodycon Dress": ("She wears a sweetheart neck bodycon dress with a heart-shaped neckline and a ruched, fitted body.", _lines("""
        thin straps
        strapless cut
        long sleeves
        puff sleeves
        satin fabric
        ribbed knit fabric
        mini length hem
        midi length hem
        side slit
        corset boning
    """)),
    "Criss Cross Bodycon Dress": ("She wears a criss cross bodycon dress with straps crossing over at her neck for an eye-catching strappy detail.", _lines("""
        open back
        mini length hem
        midi length hem
        ribbed knit fabric
        satin fabric
        side slit
        cut-out at the waist
        lace-up back
        bandage fabric
        V-neckline
    """)),
    "Cowl Neck Bodycon Dress": ("She wears a cowl neck bodycon dress with a softly draped neckline that falls in graceful folds.", _lines("""
        satin fabric
        jersey fabric
        thin straps
        long sleeves
        mini length hem
        midi length hem
        side slit
        open back
        cowl back
        bias cut
    """)),
    "Asymmetrical Bodycon Dress": ("She wears an asymmetrical bodycon dress with one long sleeve and an uneven cut-out at the waist.", _lines("""
        asymmetric hem
        mini length hem
        midi length hem
        ribbed knit fabric
        satin fabric
        side slit
        ruched sides
        ring hardware detail
        one-shoulder neckline
        draped panel
    """)),
    "Keyhole Bodycon Dress": ("She wears a long-sleeve keyhole bodycon dress with a teardrop-shaped opening at the neckline.", _lines("""
        mock neck
        ribbed knit fabric
        satin fabric
        mini length hem
        midi length hem
        side slit
        ruched sides
        open back
        gold ring at the keyhole
        sleeveless cut
    """)),
    "Tank Style Bodycon Dress": ("She wears a tank style bodycon dress, a simple fitted ribbed dress with wide straps, casual and sleek.", _lines("""
        scoop neckline
        square neckline
        racerback
        mini length hem
        midi length hem
        maxi length hem
        side slit
        cotton jersey fabric
        ruched sides
        U-neck back
    """)),
    "Long Sleeve Bodycon Dress": ("She wears a long sleeve bodycon dress with a round neckline, minimalist and versatile.", _lines("""
        ribbed knit fabric
        jersey fabric
        mini length hem
        midi length hem
        side slit
        ruched sides
        open back
        square neckline
        thumbhole cuffs
        mock neck
    """)),
    "Tie-Front Dress": ("She wears a tie-front dress with ribbon ties at the neckline and a ruffled hem.", _lines("""
        puff sleeves
        long sleeves
        sleeveless cut
        mini length hem
        midi length hem
        floral print
        cotton fabric
        smocked back
        tiered skirt
        cut-out under the tie
    """)),
    "Backless Dress": ("She wears a backless dress that leaves most of her back open, held together by thin straps and a tied bow.", _lines("""
        cowl front neckline
        halter neckline
        satin fabric
        mini length hem
        midi length hem
        floor-length hem
        side slit
        cross-back straps
        lace-up back
        bias cut
    """)),
    "Vintage Dress": ("She wears a vintage dress with a fitted bodice and a full, swingy circle skirt in pastel stripes, straight out of the 1950s.", _lines("""
        sweetheart neckline
        Peter Pan collar
        cap sleeves
        halter neckline
        petticoat underneath
        thin waist belt
        polka dot print
        cherry print
        button-down front
        tea length hem
    """)),
    "Party Dress": ("She wears a festive party dress with a fitted bodice and a full tiered skirt trimmed with eyelet lace.", _lines("""
        puff sleeves
        thin straps
        sweetheart neckline
        square neckline
        mini length hem
        midi length hem
        bow at the waist
        glitter accents
        smocked back
        satin fabric
    """)),
    "Sundress": ("She wears a light, airy sundress with thin straps, a ruched bust, and a flowing skirt in a cheerful yellow.", _lines("""
        square neckline
        sweetheart neckline
        mini length hem
        midi length hem
        maxi length hem
        floral print
        gingham print
        cotton fabric
        tie straps
        tiered skirt
    """)),
    "Slit Dress": ("She wears a slit dress with a high slit running up one side of the skirt, adding movement and elegance.", _lines("""
        one-shoulder neckline
        V-neckline
        halter neckline
        thin straps
        satin fabric
        jersey fabric
        maxi length hem
        midi length hem
        fitted bodice
        open back
    """)),
}


class MBDressRandomizer(io.ComfyNode):
    """One seed drives every pick: the style (when randomized), the color and
    which of the style's detail fragments land in the prompt."""

    @classmethod
    def define_schema(cls) -> io.Schema:
        styles = list(DRESSES)
        return io.Schema(
            node_id="MBNodesDressRandomizer",
            display_name="Dress Randomizer (MB)",
            category="MBNodes",
            description="Build a dress prompt from a chosen or random style's description with random extra details and an optional random color.",
            search_aliases=["dress", "outfit", "random prompt"],
            inputs=[
                io.Combo.Input("category", options=styles, default=styles[0], tooltip="Dress style used when random_category is off."),
                io.Boolean.Input("random_category", default=False, tooltip="Pick the style from the seed instead of the category widget."),
                io.Boolean.Input("color", default=False, tooltip="Add a seeded-random color for the dress."),
                io.Boolean.Input("skip_prefix", default=False, tooltip="Drop the leading \"She wears\" from the description."),
                io.Int.Input("details", default=3, min=0, max=10, tooltip="How many random detail fragments to add after the description."),
                io.Int.Input("seed", default=0, min=0, max=MAX_SEED, control_after_generate=True),
                io.Float.Input("weight", default=1.0, min=0.0, max=2.0, step=0.05, display_mode=io.NumberDisplay.slider, tooltip="Prompt weight. At 1.0 the text is output as-is, otherwise as (text:weight)."),
            ],
            outputs=[io.String.Output("prompt")],
        )

    @classmethod
    def execute(cls, category, random_category, color, details, seed, weight, skip_prefix) -> io.NodeOutput:
        rng = random.Random(seed)
        name = rng.choice(list(DRESSES)) if random_category else category
        text, fragments = DRESSES[name]
        if skip_prefix:
            text = text.removeprefix("She wears ")
            text = text[0].upper() + text[1:]
        if color:
            text += f" The dress is {rng.choice(COLORS)}."
        picks = rng.sample(fragments, min(details, len(fragments)))
        if picks:
            text += f" It features {', '.join(picks)}."
        return io.NodeOutput(weighted(text, weight))


NODES = [MBDressRandomizer]

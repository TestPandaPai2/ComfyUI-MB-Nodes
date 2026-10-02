"""Bodycon dress prompt picker: a dress style (fixed or seeded-random), a
seeded sample of that style's detail fragments, and an optional seeded color."""

import random

from comfy_api.latest import io


def weighted(text, weight):
    return text if weight == 1.0 else f"({text}:{weight:.2f})"

MAX_SEED = 0xFFFFFFFFFFFFFFFF


def _lines(block):
    return [line.strip() for line in block.strip().splitlines() if line.strip()]


DRESSES = {
    "Ultra Sheer Mesh Bodycon Dress": _lines("""
        ultra-sheer stretch mesh hugging every curve
        translucent fabric over a nude slip
        long mesh sleeves
        sleeveless sheer bodice
        mock neck collar
        scoop neckline
        mini length hem
        midi length hem
        ankle-length column
        ruched mesh along the sides
        rhinestone scatter across the mesh
        fine fishnet texture
        flocked polka dots on the mesh
        opaque lining panels at the bust
        visible seam lines
        mesh gloves attached to the sleeves
        high-cut side panels
        corset boning under the mesh
        sheer back panel
        second-skin fit
        matte finish mesh
        shimmering metallic threads in the mesh
        embroidered florals on sheer tulle
        ombre mesh fading dark to light
        layered double mesh
        lettuce-edge hem
        thumbhole cuffs
        open back with a keyhole
        side cutouts
        bralette silhouette underneath
        smooth stretch without seams
        clubwear styling
        runway editorial look
        glossy highlights on the mesh
        barely-there effect
        sculpted waist
        tight around the hips
        fluted hem flare
        mesh ruffle at the shoulder
        daring evening statement
    """),
    "Kanchipuram Zari Embellished Bodycon Dress": _lines("""
        Kanchipuram silk shaped into a fitted bodycon
        rich gold zari borders at the hem
        zari border outlining the neckline
        temple motifs woven across the bodice
        peacock motifs in gold zari
        mango buttas scattered on the silk
        checked kattam pattern body
        contrast color border panel
        lustrous heavy silk
        deep jewel tones
        magenta silk with gold zari
        emerald silk with gold zari
        maroon silk with antique zari
        mustard silk with gold border
        royal blue silk with silver zari
        sleeveless fitted bodice
        elbow-length sleeves with zari cuffs
        sweetheart neckline
        square neckline
        boat neckline
        knee-length hem
        midi pencil length
        floor-length column
        side slit framed by zari
        back zip hidden in the border
        structured darts at the waist
        festive wedding styling
        temple jewelry pairing
        zari belt at the waist
        tassels at the hem slit
        brocade texture across the body
        yazhi motifs on the border
        annam swan motifs
        reverse zari border
        half-and-half two-tone panels
        pleated border detail at the hip
        indo-western fusion silhouette
        regal South Indian heritage
        sculpted curve-hugging fit
        radiant festive glow
    """),
    "Sequined Glamour Bodycon Dress": _lines("""
        allover sequins
        fitted sequin sheath
        gold sequins
        silver sequins
        rose gold sequins
        black sequins
        iridescent sequins
        champagne sequins
        ombre sequin gradient
        sequin stripes
        geometric sequin pattern
        spaghetti straps
        long sleeves
        off-shoulder neckline
        one-shoulder neckline
        deep v neckline
        halter neckline
        mini length
        midi length
        floor-length gown
        high thigh slit
        open back
        cutout waist
        sequin fringe hem
        feather trim hem
        crystal embellishment at the neckline
        bugle beads
        sparkling light reflections
        disco ball shimmer
        red-carpet glamour
        cocktail party look
        new year's eve style
        mirror sequins
        sequin paillettes
        body-sculpting stretch base
        structured shoulders
        ruched side seam
        corset bodice
        sweetheart neckline
        dazzling showstopper finish
    """),
    "Wet Look Vinyl Bodycon Dress": _lines("""
        high-gloss vinyl
        wet-look sheen
        liquid shine
        latex-like finish
        black vinyl
        red vinyl
        silver vinyl
        nude vinyl
        clear vinyl panels
        front zipper
        exposed back zipper
        square neckline
        sweetheart neckline
        strapless bodice
        spaghetti straps
        long sleeves
        mini length
        midi length
        corset seaming
        panelled construction
        side cutouts
        high slit
        mirror-like reflections
        slick silhouette
        edgy clubwear
        futuristic look
        editorial styling
        cinched waist
        tight hips
        structured bust
        halter neckline
        mock neck
        buckle details
        O-ring details
        belted waist
        body-sculpting fit
        glossy highlights
        bold statement
        night out style
        sleek finish
    """),
    "High Slit Bodycon Dress": _lines("""
        thigh-high slit
        side slit
        front slit
        double slits
        leg-revealing stride
        fitted sheath
        stretch crepe fabric
        satin fabric
        jersey fabric
        ribbed knit fabric
        one-shoulder neckline
        halter neckline
        square neckline
        sweetheart neckline
        deep v neckline
        long sleeves
        spaghetti straps
        maxi length
        midi length
        ruched side seam
        wrap detail
        slit edged with piping
        crystal trim along slit
        open back
        cutout waist
        belted waist
        asymmetric hem
        draped bodice
        corset bodice
        red-carpet look
        evening gown vibe
        cocktail look
        elegant silhouette
        sexy style
        body-hugging fit
        sleek lines
        glossy satin sheen
        matte jersey finish
        monochrome look
        graceful movement
    """),
    "Lace Sheer Bodycon Dress": _lines("""
        sheer lace
        stretch lace
        nude lining
        black lace
        ivory lace
        red lace
        floral lace
        scalloped lace hem
        scalloped neckline
        long lace sleeves
        cap sleeves
        sleeveless
        high neck
        sweetheart neckline
        v neckline
        illusion neckline
        open back
        keyhole back
        mini length
        midi length
        maxi length
        corset boning
        lace cutouts
        lace appliqué
        eyelash lace
        chantilly lace
        corded lace
        sheer skin-showing panels
        romantic style
        bridal vibe
        vintage vibe
        sensual look
        body-hugging fit
        satin trim
        pearl accents
        delicate details
        tonal embroidery
        elegant evening wear
        soft feminine allure
        dreamy look
    """),
    "Mirror Work Bodycon Dress": _lines("""
        mirror-work embellishment
        tiny mirror pieces
        abhla embroidery
        thread-framed mirrors
        mirror border hem
        mirror neckline
        mirror sleeves
        mirror scatter across the body
        mirror clusters
        geometric mirror layout
        paisley mirror layout
        multicolor thread work
        kutch embroidery
        black base
        red base
        navy base
        pastel base
        sleeveless
        halter neckline
        square neckline
        v neckline
        long sleeves
        mini length
        midi length
        maxi length
        side slit
        open back
        tassels
        beadwork
        sequins
        festive look
        navratri style
        boho vibe
        party look
        shimmering reflections
        light-catching sparkle
        fitted silhouette
        stretch cotton base
        handcrafted feel
        dazzling finish
    """),
    "One-Shoulder Bodycon Dress": _lines("""
        one bare shoulder
        asymmetric neckline
        single long sleeve
        single strap
        sculpted shoulder
        ruffled shoulder
        draped shoulder
        bow on the shoulder
        crystal strap
        cutout waist
        side cutout
        ruched side seam
        high slit
        mini length
        midi length
        maxi length
        satin fabric
        jersey fabric
        crepe fabric
        sequin fabric
        velvet fabric
        ribbed knit
        corset bodice
        feather trim
        cape detail
        asymmetric hem
        open back
        belted waist
        monochrome look
        red-carpet look
        cocktail look
        elegant style
        body-hugging fit
        sleek lines
        bare collarbone
        graceful asymmetry
        statement earrings styling
        sculptural silhouette
        modern glam
        evening wear
    """),
    "V-Neck Deep Plunge Bodycon Dress": _lines("""
        deep plunging v neckline
        neckline to the waist
        mesh insert in the plunge
        wrap-style bodice
        halter plunge
        long sleeves
        sleeveless
        spaghetti straps
        cap sleeves
        mini length
        midi length
        maxi length
        high slit
        open back
        v back
        cutout waist
        ruched side
        corset bodice
        belted waist
        satin fabric
        jersey fabric
        sequin fabric
        velvet fabric
        crepe fabric
        crystal trim neckline
        gold hardware at the plunge
        chain detail
        red-carpet look
        evening glam
        cocktail look
        sexy style
        body-hugging fit
        structured shoulders
        draped bodice
        monochrome look
        bold neckline
        sleek silhouette
        daring look
        confident style
        elegant plunge
    """),
    "Butterfly Drape Bodycon Dress": _lines("""
        butterfly drape panels
        draped sleeves like wings
        flutter sleeves
        wing-shaped cape
        chiffon drape over fitted base
        georgette drape
        draped front pleats
        asymmetric drape
        fitted bodycon base
        mini length
        midi length
        maxi length
        high slit
        open back
        halter neckline
        one-shoulder neckline
        v neckline
        butterfly motif embroidery
        crystal butterfly
        sequin butterflies
        iridescent fabric
        ombre drape
        pastel tones
        jewel tones
        feather-light drape
        drape fluttering with movement
        cape extending from the back
        tiered drape
        scalloped edges
        sheer wings
        belted waist
        cutout waist
        whimsical style
        playful glam
        party look
        fairy-tale vibe
        romantic look
        graceful movement
        sculpted fit
        statement drape
    """),
    "Cropped Hem Bodycon Dress": _lines("""
        cropped mini hem
        micro-mini length
        above-the-knee hem
        asymmetric cropped hem
        cutout midriff
        two-piece effect
        crop top illusion
        long sleeves
        sleeveless
        spaghetti straps
        halter neckline
        square neckline
        high neck
        off-shoulder neckline
        ribbed knit
        jersey fabric
        vinyl fabric
        sequin fabric
        satin fabric
        stretch denim
        ruched side
        side slit
        open back
        belted waist
        lettuce hem
        fringe hem
        ruffle hem
        youthful style
        party look
        clubwear
        summer style
        street style
        body-hugging fit
        leg-lengthening effect
        playful vibe
        flirty look
        bold look
        casual chic
        festival style
        fun silhouette
    """),
    "Empire Waist Bodycon Dress": _lines("""
        high empire waistline
        seam under the bust
        fitted skirt below
        sweetheart neckline
        v neckline
        square neckline
        halter neckline
        puff sleeves
        cap sleeves
        long sleeves
        sleeveless
        spaghetti straps
        smocked bodice
        ruched bodice
        corset bodice
        empire band with embroidery
        satin ribbon at the empire seam
        pearl trim
        crystal trim
        mini length
        midi length
        maxi length
        side slit
        open back
        jersey fabric
        crepe fabric
        satin fabric
        knit fabric
        pastel color
        jewel tone
        romantic style
        vintage vibe
        elegant look
        feminine style
        lengthening silhouette
        body-hugging skirt
        soft sheen
        chic look
        grecian touch
        refined style
    """),
    "X-Pleated Bodycon Dress": _lines("""
        x-shaped pleats
        crisscross pleating
        pleats meeting at the waist
        diagonal pleats
        knife pleats
        origami folds
        architectural pleating
        structured bodice
        fitted skirt
        mini length
        midi length
        maxi length
        high slit
        sleeveless
        long sleeves
        one-shoulder neckline
        halter neckline
        square neckline
        v neckline
        high neck
        satin fabric
        crepe fabric
        jersey fabric
        taffeta fabric
        metallic fabric
        two-tone pleats
        contrast lining
        cutout waist
        belted waist
        open back
        graphic lines
        sculptural silhouette
        avant-garde style
        runway look
        bold look
        modern design
        monochrome look
        body-hugging fit
        crisp finish
        fashion-forward vibe
    """),
    "Zari Embellished Bodycon Dress": _lines("""
        gold zari embroidery
        silver zari embroidery
        zari motifs across the body
        zari border at the hem
        zari neckline
        zari sleeves
        zari buttas
        zari jaal
        zari paisleys
        zari florals
        zari stripes
        antique zari
        rose gold zari
        silk base
        velvet base
        georgette base
        brocade panels
        sleeveless
        long sleeves
        elbow sleeves
        sweetheart neckline
        square neckline
        high neck
        v neckline
        mini length
        midi length
        maxi length
        side slit
        open back
        zari belt
        tassels
        crystal accents
        pearl accents
        festive look
        wedding style
        jewel tones
        regal look
        indo-western style
        body-hugging fit
        opulent finish
    """),
    "Yoke Neckline Bodycon Dress": _lines("""
        yoke neckline
        sheer yoke
        lace yoke
        beaded yoke
        embroidered yoke
        mirror-work yoke
        contrast yoke
        tonal yoke
        high-neck yoke
        round yoke
        square yoke
        v yoke
        sleeveless
        cap sleeves
        long sleeves
        puff sleeves
        keyhole back
        button back
        zip back
        mini length
        midi length
        maxi length
        side slit
        crepe fabric
        jersey fabric
        satin fabric
        knit fabric
        pearl yoke
        sequin yoke
        crystal yoke
        structured shoulders
        polished look
        elegant style
        classic look
        modern chic
        body-hugging fit
        office chic
        evening style
        refined silhouette
        clean lines
    """),
    "Pastel Organza Bodycon Dress": _lines("""
        pastel organza overlay
        fitted stretch base
        blush pink
        mint green
        baby blue
        lavender
        peach
        butter yellow
        sheer organza sleeves
        puff organza sleeves
        organza ruffles
        organza cape
        organza bow
        floral embroidery
        pearl embellishment
        crystal embellishment
        sequin scatter
        sweetheart neckline
        square neckline
        v neckline
        off-shoulder neckline
        mini length
        midi length
        maxi length
        side slit
        open back
        corset bodice
        scalloped hem
        tiered organza
        translucent sheen
        dreamy look
        romantic style
        garden party style
        spring look
        summer wedding guest
        soft feminine style
        airy feel
        whimsical vibe
        body-hugging fit
        fresh elegance
    """),
    "Pre-Draped Bodycon Dress": _lines("""
        pre-draped panels
        stitched drape
        draped front
        draped side
        draped shoulder
        ruched drape
        cowl neckline
        wrap effect
        gathered waist
        twist detail
        knot detail
        asymmetric drape
        sash drape
        cape drape
        one-shoulder neckline
        halter neckline
        v neckline
        sleeveless
        long sleeves
        mini length
        midi length
        maxi length
        high slit
        open back
        jersey fabric
        satin fabric
        crepe fabric
        chiffon drape
        sequin fabric
        hidden zip
        body-hugging fit
        effortless style
        evening look
        cocktail look
        elegant silhouette
        fluid lines
        sculpted fit
        polished finish
        sophisticated vibe
        refined glam
    """),
    "Quilted Fabric Bodycon Dress": _lines("""
        quilted fabric
        diamond quilting
        channel quilting
        padded panels
        quilted bodice
        quilted skirt
        quilted sleeves
        puffy texture
        satin quilting
        leather-look quilting
        velvet quilting
        metallic quilting
        sleeveless
        long sleeves
        square neckline
        high neck
        strapless
        v neckline
        mini length
        midi length
        side slit
        zip front
        gold hardware
        chain belt
        black
        cream
        pastel
        metallic
        structured shoulders
        sculptural silhouette
        body-hugging fit
        luxe look
        designer vibe
        winter style
        textured look
        avant-garde style
        runway look
        modern chic
        statement look
        plush finish
    """),
    "Reimagined Banarasi Bodycon Dress": _lines("""
        Banarasi silk
        brocade weave
        kadhua motifs
        jangla floral jaal
        butidar buttas
        meenakari weave
        tanchoi weave
        shikargah motifs
        gold zari
        silver zari
        minimal zari
        pastel Banarasi
        jewel-tone Banarasi
        contrast border
        sleeveless
        long sleeves
        elbow sleeves
        sweetheart neckline
        square neckline
        high neck
        boat neck
        mini length
        midi length
        maxi length
        side slit
        open back
        Banarasi belt
        tassels
        Mughal motifs
        antique finish
        modern cut
        contemporary silhouette
        festive look
        wedding guest style
        indo-western style
        regal look
        body-hugging fit
        subtle opulence
        heritage refreshed
        luxe finish
    """),
    "Fusion Modern Bodycon Dress": _lines("""
        traditional motifs on a modern cut
        mixed fabrics
        digital print
        abstract print
        ethnic print
        geometric embroidery
        block print
        ikat pattern
        cape overlay
        jacket overlay
        belt at the waist
        dupatta drape
        sleeveless
        long sleeves
        bell sleeves
        high neck
        mandarin collar
        v neckline
        mini length
        midi length
        maxi length
        side slit
        asymmetric hem
        cutout waist
        open back
        color-block panels
        mirror accents
        tassels
        metallic accents
        organza panels
        jersey base
        crepe base
        indo-western style
        street style
        trendy look
        creative look
        versatile style
        day-to-night look
        body-hugging fit
        bold modern vibe
    """),
    "High Neck Structured Bodycon Dress": _lines("""
        high neck
        mock neck
        turtleneck
        funnel neck
        halter high neck
        structured shoulders
        padded shoulders
        sleeveless
        long sleeves
        cap sleeves
        tailored darts
        princess seams
        panelled construction
        corset seaming
        mini length
        midi length
        maxi length
        pencil silhouette
        back slit
        side slit
        keyhole back
        open back
        zip back
        crepe fabric
        scuba fabric
        ponte knit
        ribbed knit
        leather-look fabric
        black
        white
        red
        camel
        monochrome look
        power dressing
        office chic
        evening look
        sophisticated style
        sleek silhouette
        body-hugging fit
        minimal elegance
    """),
    "Sheer Mesh One-Piece Bodycon Dress": _lines("""
        one-piece sheer mesh
        seamless construction
        stretch mesh
        nude underlay
        black mesh
        white mesh
        red mesh
        fishnet mesh
        dotted mesh
        embroidered mesh
        crystal mesh
        glitter mesh
        long sleeves
        sleeveless
        high neck
        scoop neck
        v neck
        mini length
        midi length
        maxi length
        high slit
        open back
        cutout waist
        ruched sides
        opaque panels
        layered mesh
        lettuce hem
        thumbhole sleeves
        gloves attached
        sheer skin-showing look
        clubwear
        runway look
        edgy style
        sensual vibe
        body-hugging fit
        second-skin fit
        modern look
        barely-there effect
        sleek silhouette
        daring style
    """),
    "Tissue Silk Bodycon Dress": _lines("""
        tissue silk
        metallic tissue
        gold tissue
        silver tissue
        rose gold tissue
        crushed tissue
        pastel tissue
        zari border
        zari stripes
        zari checks
        woven buttas
        sheer tissue overlay
        fitted lining
        sleeveless
        long sleeves
        elbow sleeves
        sweetheart neckline
        square neckline
        v neckline
        high neck
        mini length
        midi length
        maxi length
        side slit
        open back
        tissue ruffles
        tissue cape
        pearl accents
        crystal accents
        gota trim
        festive look
        wedding style
        shimmering finish
        soft glow
        radiant look
        indo-western style
        body-hugging fit
        luxe feel
        elegant style
        lightweight luxury
    """),
    "Vinyl Wet-Look Bodycon Dress": _lines("""
        vinyl fabric
        wet-look shine
        high-gloss finish
        patent vinyl
        stretch vinyl
        black
        red
        white
        silver
        purple
        clear vinyl panels
        zip front
        zip back
        strapless
        spaghetti straps
        halter neckline
        square neckline
        long sleeves
        mini length
        micro-mini length
        midi length
        corset seams
        lace-up back
        side cutouts
        high slit
        buckle straps
        O-ring details
        belted waist
        glossy reflections
        latex-like look
        clubwear
        edgy style
        futuristic look
        editorial look
        bold style
        body-hugging fit
        sculpted curves
        slick finish
        night out look
        statement shine
    """),
    "Metallic Mirror-Work Bodycon Dress": _lines("""
        metallic fabric
        mirror-work embellishment
        mirror mosaic
        chrome finish
        liquid metal look
        gold metallic
        silver metallic
        rose gold metallic
        bronze metallic
        holographic finish
        mirror sequins
        mirror border
        mirror neckline
        mirror sleeves
        sleeveless
        long sleeves
        halter neckline
        one-shoulder neckline
        v neckline
        mini length
        midi length
        maxi length
        high slit
        open back
        cutout waist
        crystal accents
        disco look
        party look
        futuristic look
        festive look
        light-reflecting surface
        dazzling shine
        stage-ready style
        body-hugging fit
        bold statement
        sleek silhouette
        glam finish
        runway look
        mirror-ball sparkle
        radiant glow
    """),
    "Lace Overlaid Bodycon Dress": _lines("""
        lace overlay
        contrast lining
        nude lining
        black lace
        ivory lace
        red lace
        navy lace
        floral lace
        guipure lace
        chantilly lace
        corded lace
        scalloped hem
        scalloped neckline
        lace sleeves
        sleeveless
        cap sleeves
        long sleeves
        high neck
        sweetheart neckline
        v neckline
        square neckline
        mini length
        midi length
        maxi length
        back slit
        side slit
        open back
        keyhole back
        satin trim
        pearl accents
        crystal accents
        lace appliqué
        romantic style
        vintage vibe
        bridal vibe
        evening style
        elegant look
        body-hugging fit
        feminine style
        refined finish
    """),
    "X-Strap Detail Bodycon Dress": _lines("""
        crisscross X straps
        X-strap back
        X-strap front
        strappy cutouts
        cage straps
        lace-up straps
        chain straps
        thin straps
        wide straps
        asymmetric straps
        halter neckline
        square neckline
        v neckline
        sleeveless
        long sleeves
        mini length
        midi length
        maxi length
        high slit
        open back
        cutout waist
        buckle details
        O-ring details
        gold hardware
        silver hardware
        jersey fabric
        vinyl fabric
        satin fabric
        ribbed knit
        sequin fabric
        clubwear
        edgy style
        evening look
        bold style
        body-hugging fit
        graphic lines
        sexy style
        modern design
        statement back
        fierce vibe
    """),
    "Yoke Strap Bodycon Dress": _lines("""
        yoke strap
        yoke neckline
        halter yoke
        strappy yoke
        cutout yoke
        sheer yoke
        beaded yoke
        embroidered yoke
        crystal yoke
        lace yoke
        wide straps
        thin straps
        crossover straps
        sleeveless
        cap sleeves
        square neckline
        high neck
        v neckline
        mini length
        midi length
        maxi length
        side slit
        open back
        keyhole back
        button back
        jersey fabric
        crepe fabric
        satin fabric
        knit fabric
        gold hardware
        pearl trim
        structured shoulders
        polished look
        elegant style
        modern chic
        body-hugging fit
        evening style
        clean lines
        refined silhouette
        balanced look
    """),
}

COLORS = [
    "black", "white", "ivory", "red", "crimson", "wine", "burgundy", "blush pink",
    "hot pink", "fuchsia", "nude", "champagne", "gold", "silver", "rose gold",
    "royal blue", "navy", "cobalt", "emerald green", "sage", "mint", "lavender",
    "purple", "plum", "chocolate brown", "camel", "mustard", "orange", "teal", "coral",
]


class MBBodyconRandomizer(io.ComfyNode):
    """One seed drives every pick: the style (when randomized), the color and
    which of the style's detail fragments land in the prompt."""

    @classmethod
    def define_schema(cls) -> io.Schema:
        styles = list(DRESSES)
        return io.Schema(
            node_id="MBNodesBodyconRandomizer",
            display_name="Bodycon Randomizer (MB)",
            category="MBNodes",
            description="Build a bodycon dress prompt from a chosen or random style with random details and an optional random color.",
            search_aliases=["bodycon", "dress", "outfit", "random prompt"],
            inputs=[
                io.Combo.Input("category", options=styles, default=styles[0], tooltip="Dress style used when random_category is off."),
                io.Boolean.Input("random_category", default=False, tooltip="Pick the style from the seed instead of the category widget."),
                io.Boolean.Input("color", default=False, tooltip="Put a seeded-random color before the dress name."),
                io.Int.Input("details", default=3, min=1, max=40, tooltip="How many random detail fragments to add."),
                io.Int.Input("seed", default=0, min=0, max=MAX_SEED, control_after_generate=True),
                io.Float.Input("weight", default=1.0, min=0.0, max=2.0, step=0.05, display_mode=io.NumberDisplay.slider, tooltip="Prompt weight. At 1.0 the text is output as-is, otherwise as (text:weight)."),
            ],
            outputs=[io.String.Output("prompt")],
        )

    @classmethod
    def execute(cls, category, random_category, color, details, seed, weight) -> io.NodeOutput:
        rng = random.Random(seed)
        name = rng.choice(list(DRESSES)) if random_category else category
        subject = f"{rng.choice(COLORS)} {name}" if color else name
        fragments = DRESSES[name]
        picks = rng.sample(fragments, min(details, len(fragments)))
        return io.NodeOutput(weighted(", ".join([subject, *picks]), weight))


NODES = [MBBodyconRandomizer]

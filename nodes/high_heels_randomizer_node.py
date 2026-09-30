"""High heels prompt picker: a heel style (fixed or seeded-random), a seeded
sample of that style's detail fragments, and an optional seeded color."""

import random

from comfy_api.latest import io

MAX_SEED = 0xFFFFFFFFFFFFFFFF


def _lines(block):
    return [line.strip() for line in block.strip().splitlines() if line.strip()]


HEELS = {
    "Very Sexy Toe-Thrust High Heels": _lines("""
        steep arch thrusting the toes forward
        open toe framing the front of the foot
        slim 5-inch stiletto
        low-cut vamp showing toe cleavage
        glossy patent finish
        pointed toe silhouette
        sharply angled instep
        thin ankle strap with a tiny buckle
        barely-there toe band
        high-shine lacquered heel
        sleek unlined upper
        foot arched on tiptoe
        peep-toe opening
        red lacquered sole
        pencil-thin heel tip
        curved sculpted arch
        backless mule variation
        slingback strap at the heel
        suede upper with a soft nap
        square toe box
        metallic heel cap
        long elegant toe line
        seductive forward-leaning stance
        narrow tapered toe
        smooth satin upper
        crystal accent on the toe strap
        cushioned insole
        high-cut sides exposing the arch
        bold evening silhouette
        nude-toned upper lengthening the leg
        black patent drama
        polished almond toe
        leg-lengthening pitch
        minimal hardware
        slim d'orsay cut
        heel counter hugging the heel
        mirror-polished finish
        dramatic strut-ready pose
        tall stiletto casting a long shadow
        confident runway attitude
    """),
    "Sexy Ankle-Buckle Strappy Heels": _lines("""
        thin strap buckled at the ankle
        gold buckle hardware
        silver buckle hardware
        barely-there straps across the toes
        slim stiletto heel
        open toe
        single toe strap
        double ankle wrap
        adjustable buckle closure
        skinny leather straps
        patent straps with shine
        suede straps
        straps crisscrossing the instep
        heel cup cradling the heel
        4-inch heel height
        block heel variation
        square toe front
        pointed toe front
        exposed arch
        buckle resting at the outer ankle
        dainty minimal look
        nude straps for leg lengthening
        black straps for contrast
        metallic straps
        crystal-studded buckle
        padded footbed
        evening cocktail styling
        strappy summer sandal feel
        ankle cuff with a buckle
        T-bar strap to the ankle
        slingback strap
        heel wrapped in matching leather
        delicate sculpted arch
        thin sole
        polished heel tip
        elongated leg line
        feminine flirty vibe
        straps casting fine shadows
        clean minimal hardware
        party-ready glamour
    """),
    "Ultra High Platform Stiletto Heels": _lines("""
        towering 7-inch stiletto
        thick front platform
        2-inch platform sole
        extreme arch pitch
        chunky platform with slim heel
        glossy patent platform
        clear acrylic platform
        pointed toe platform
        peep-toe platform
        closed-toe pump shape
        ankle strap for support
        stage-ready height
        metallic platform
        black lacquered finish
        red platform variation
        dramatic runway height
        platform wrapped in leather
        suede platform upper
        crystal-studded platform
        lug-style platform sole
        slim stiletto spike
        cushioned platform insole
        heel counter reinforcement
        hidden inner platform
        dual-tone platform
        bold vertical silhouette
        leg-lengthening stance
        towering nightclub look
        platform with a rounded toe
        platform ankle boot variation
        mirror-finish heel
        heel spike in gold
        platform sandal with straps
        wide toe box
        chunky sole edge
        dramatic lift
        tilted foot on tiptoe
        statement footwear
        glamorous showgirl vibe
        bold fashion statement
    """),
    "Sequin Sparkle Mini Heels": _lines("""
        allover sequin upper
        low kitten heel
        2-inch mini heel
        sparkling party finish
        gold sequins
        silver sequins
        rose gold sequins
        black sequins
        iridescent sequins
        rounded toe
        pointed toe
        slingback strap
        ankle strap
        sequin bow on the toe
        glittering heel
        shimmer catching the light
        comfortable dance-ready height
        festive holiday look
        sequin mule variation
        mary jane strap
        padded insole
        sequin-covered heel block
        sparkle with each step
        playful cute style
        mini block heel
        metallic heel tip
        sequin stripes
        ombre sequins
        crystal buckle
        sequin d'orsay cut
        low-cut vamp
        disco glam
        sequin toe cap
        satin lining
        soft sequin texture
        chic cocktail footwear
        mirror-like shine
        sparkling scattered reflections
        compact dainty silhouette
        fun glamorous vibe
    """),
    "Clear Vinyl Wet-Look Heels": _lines("""
        transparent vinyl upper
        wet-look glossy finish
        clear PVC toe strap
        perspex heel
        lucite block heel
        clear stiletto heel
        see-through vamp
        foot visible through the vinyl
        glassy shine
        clear ankle strap
        pointed toe mule
        peep-toe clear pump
        slingback clear strap
        high-shine reflections
        crystal clear platform
        clear heel with gold cap
        illusion barefoot effect
        vinyl panels with leather trim
        nude sole
        black sole contrast
        slick futuristic look
        clear straps crossing the toes
        slim 4-inch heel
        tinted vinyl variation
        glossy wet sheen
        clear upper with a metallic edge
        clear heel with glitter inside
        slick editorial vibe
        minimal clean silhouette
        rain-slick finish
        clear square toe
        floating foot illusion
        sculpted clear heel
        mirror reflections
        clear T-strap
        clear mule slide
        bold modern design
        glass slipper effect
        sleek polished style
        high-gloss fashion statement
    """),
    "Lace Sheer Ankle Straps Heels": _lines("""
        delicate lace upper
        sheer mesh base
        lace ankle strap
        floral lace pattern
        black lace
        ivory lace
        nude lace
        scalloped lace edge
        stiletto heel
        pointed toe
        peep toe
        lace bow at the ankle
        satin trim
        sheer vamp
        lace heel covering
        romantic feminine vibe
        lace appliqué
        corded lace
        chantilly lace
        pearl accents
        sheer skin-showing panels
        lace slingback
        lace d'orsay pump
        lace mule
        adjustable buckle
        tonal stitching
        bridal lace heels
        vintage-inspired style
        embroidered flowers
        sheer toe box
        lace pump shape
        lace wraps around the ankle
        crystal ankle buckle
        4-inch heel
        satin lining
        delicate details
        elegant evening look
        soft translucent texture
        dreamy romantic style
        graceful footwear
    """),
    "Metallic Mirror-Work Platform Heels": _lines("""
        metallic mirror finish
        mirror-work embellishment
        chunky platform
        chrome heel
        gold metallic upper
        silver metallic upper
        mirror pieces on the straps
        reflective platform
        high-shine patent
        platform sandal
        ankle strap
        pointed toe
        peep toe
        block heel
        stiletto heel
        mirrored heel block
        disco mirror effect
        metallic straps
        glittering reflections
        gold hardware
        mirror-studded vamp
        holographic finish
        rose gold metallic
        bronze metallic
        liquid metal look
        mirror-work border
        platform wrapped in foil
        crystal accents
        party glam
        futuristic look
        sleek silhouette
        chunky sole
        festive sparkle
        light-reflecting surface
        mirror mosaic heel
        stage-ready style
        bold statement
        metallic sheen
        mirror embellished ankle cuff
        dazzling finish
    """),
    "Butterfly Wing Strappy Heels": _lines("""
        butterfly wing detail at the ankle
        wing-shaped straps
        strappy upper
        stiletto heel
        wings rising at the heel
        crystal butterfly
        embroidered butterfly
        metallic butterfly
        sheer wing panels
        pastel wings
        iridescent wings
        feather wings
        butterfly on the toe strap
        ankle wrap
        open toe
        pointed toe
        satin straps
        lace straps
        glitter wings
        whimsical style
        playful vibe
        fairy-tale look
        wing appliqué
        dainty straps
        gold wings
        silver wings
        wings fluttering with steps
        butterfly buckle
        colorful wings
        beaded wings
        strap wrapping the ankle
        4-inch heel
        mule variation
        slingback variation
        wing-cutout heel
        soft suede
        pearl accents
        party-ready
        garden-party style
        romantic whimsy
    """),
    "X-Strap Gladiator High Heels": _lines("""
        crisscross X straps
        gladiator styling
        straps up the leg
        knee-high lacing
        ankle cage
        stiletto heel
        block heel
        open toe
        leather straps
        suede straps
        metallic hardware
        buckles along the straps
        zip back
        lace-up front
        bold warrior look
        black leather
        tan leather
        gold straps
        silver studs
        cutout cage design
        mid-calf height
        caged upper
        strappy silhouette
        platform variation
        pointed toe
        square toe
        chain accents
        fringe details
        edgy style
        festival look
        wraparound straps
        wide straps
        thin straps
        corset lacing
        braided straps
        strap tips with tassels
        heavy hardware
        leg-hugging fit
        dramatic structure
        fierce attitude
    """),
    "One-Shoe Barefoot-Effect Heels": _lines("""
        barefoot illusion
        single thin toe strap
        clear heel
        nude upper
        minimal sole
        stiletto heel
        naked sandal style
        invisible straps
        clear PVC straps
        skin-toned straps
        open sides
        open toe
        barely-there look
        slim ankle strap
        foot almost bare
        lightweight design
        illusion heel
        thin sole edge
        elegant minimalism
        mule variation
        4-inch heel
        clear heel counter
        transparent footbed
        leg-lengthening effect
        simple buckle
        gold thin strap
        silver thin strap
        crystal toe strap
        slide style
        soft padding
        clean lines
        summer evening style
        barefoot glam
        effortless chic
        understated luxury
        floating foot look
        slim heel
        natural look
        pared-back silhouette
        modern minimal vibe
    """),
    "Zari Embellished Crystal Heels": _lines("""
        zari embroidery
        gold zari
        silver zari
        crystal embellishments
        rhinestone upper
        stiletto heel
        block heel
        pointed toe
        closed toe pump
        mojari-inspired toe
        ethnic motifs
        paisley zari
        floral zari
        bridal style
        velvet upper
        silk upper
        crystal heel
        pearl accents
        beadwork
        kundan stones
        festive look
        wedding heels
        ankle strap
        slingback
        mule variation
        brocade fabric
        gold heel
        crystal buckle
        antique zari
        jewel tones
        royal look
        mirror accents
        tassel details
        ornate design
        heritage craft
        shimmering finish
        rich embellishment
        regal elegance
        traditional glam
        opulent style
    """),
    "Pastel Organza Strappy Heels": _lines("""
        pastel organza straps
        sheer organza
        blush pink
        mint green
        baby blue
        lavender
        peach
        butter yellow
        strappy upper
        stiletto heel
        block heel
        open toe
        ankle bow
        organza ruffles
        pearl accents
        crystal accents
        sheer toe strap
        ankle wrap
        soft pastel look
        dreamy vibe
        garden party
        spring wedding
        organza bow on the toe
        floral appliqué
        translucent straps
        satin trim
        4-inch heel
        kitten heel variation
        mule variation
        slingback
        feather-light look
        romantic style
        tie-up ankle
        pastel heel
        clear heel
        delicate straps
        airy feminine feel
        whimsical charm
        soft sheen
        fresh style
    """),
    "Pre-Buckle Draped Heels": _lines("""
        draped fabric upper
        pre-buckled straps
        ruched satin
        draped vamp
        slip-on ease
        elastic backstrap
        stiletto heel
        block heel
        pointed toe
        open toe
        draped ankle wrap
        knotted detail
        soft pleats
        silk drape
        satin finish
        buckle accents
        gold buckle
        silver buckle
        crystal buckle
        mule style
        slingback
        pump shape
        easy wear
        elegant drape
        evening style
        cocktail look
        jewel tone
        black satin
        nude satin
        draped bow
        gathered fabric
        twist detail
        4-inch heel
        cushioned insole
        polished look
        sophisticated design
        fluid lines
        drape framing the foot
        refined elegance
        glamorous finish
    """),
    "Quilted Fabric Strappy Heels": _lines("""
        quilted fabric straps
        diamond quilting
        padded straps
        strappy upper
        stiletto heel
        block heel
        open toe
        square toe
        ankle strap
        chunky quilted strap
        leather quilting
        satin quilting
        velvet quilting
        puffy straps
        channel quilting
        gold hardware
        chain detail
        buckle closure
        mule style
        slide style
        platform variation
        padded footbed
        soft comfort
        texture detail
        luxe look
        designer vibe
        black quilted
        cream quilted
        pastel quilted
        metallic quilted
        wide toe strap
        thin ankle strap
        4-inch heel
        stitched detail
        structured look
        plush straps
        modern chic
        statement straps
        tactile finish
        polished style
    """),
    "Reimagined Leather Strappy Heels": _lines("""
        modern leather straps
        soft nappa leather
        patent leather
        suede leather
        croc-embossed leather
        snake-embossed leather
        strappy upper
        stiletto heel
        sculpted heel
        block heel
        open toe
        square toe
        pointed toe
        ankle strap
        knotted straps
        woven straps
        twisted straps
        asymmetric straps
        cutout heel
        architectural heel
        gold hardware
        minimal buckle
        black leather
        tan leather
        white leather
        red leather
        two-tone leather
        leather wrapped heel
        padded footbed
        4-inch heel
        mule variation
        slingback
        contemporary design
        sleek look
        minimal style
        classic reimagined
        luxe craftsmanship
        polished finish
        modern edge
        timeless appeal
    """),
    "Fusion Vinyl Glitter Heels": _lines("""
        vinyl upper
        glitter details
        clear vinyl
        glitter heel
        mixed materials
        glitter sole
        stiletto heel
        block heel
        platform
        pointed toe
        open toe
        ankle strap
        vinyl straps
        glitter straps
        holographic glitter
        gold glitter
        silver glitter
        rainbow glitter
        pink glitter
        black glitter
        clear heel with glitter
        glitter-filled heel
        glossy finish
        sparkle
        party style
        futuristic vibe
        fun look
        bold statement
        mule style
        slingback
        mary jane
        glitter toe cap
        vinyl panels
        crystal buckle
        4-inch heel
        disco vibe
        playful attitude
        eye-catching sparkle
        modern fusion
        glam finish
    """),
    "High Slit Effect Ankle Heels": _lines("""
        slit-cut vamp
        split upper
        ankle strap
        stiletto heel
        cutout sides
        high-cut design
        open side slit
        pointed toe
        open toe
        leg-lengthening look
        sleek silhouette
        black patent
        nude leather
        metallic finish
        satin upper
        suede upper
        slim heel
        4-inch heel
        buckle closure
        gold hardware
        crystal trim
        slit along the heel
        asymmetric cut
        d'orsay cut
        cutout vamp
        dramatic cut
        evening style
        red-carpet look
        bold style
        sexy silhouette
        slit revealing the arch
        cut edges
        thin straps
        slingback
        mule variation
        wrap ankle
        clean lines
        edgy glam
        polished finish
        sleek look
    """),
    "Kanchipuram Zari Strappy Heels": _lines("""
        Kanchipuram silk straps
        zari borders
        gold zari
        silver zari
        temple motifs
        peacock motifs
        strappy upper
        stiletto heel
        block heel
        open toe
        ankle strap
        brocade straps
        silk upper
        jewel tones
        contrast border
        festive look
        wedding style
        bridal heels
        kundan accents
        pearl accents
        crystal accents
        tassels
        ethnic style
        rich colors
        magenta silk
        emerald silk
        mustard silk
        maroon silk
        royal blue silk
        gold heel
        4-inch heel
        mule variation
        slingback
        traditional motifs
        heritage craft
        luxe finish
        festive glam
        regal style
        vibrant look
        South Indian style
    """),
    "Lace Sheer Vamp Heels": _lines("""
        lace vamp
        sheer vamp
        mesh upper
        pointed toe
        stiletto heel
        pump shape
        lace overlay
        black lace
        ivory lace
        nude mesh
        floral lace
        scalloped edge
        satin trim
        peep toe
        slingback
        ankle strap
        sheer sides
        lace heel
        crystal accents
        pearl accents
        embroidery
        romantic style
        bridal style
        vintage vibe
        sensual look
        4-inch heel
        kitten heel variation
        d'orsay cut
        lace bow
        tonal lace
        sheer skin showing
        delicate details
        lace appliqué
        silk lining
        soft finish
        elegant look
        feminine style
        evening glam
        dreamy vibe
        refined finish
    """),
    "Mirror Work Toe Box Heels": _lines("""
        mirror-work toe box
        mirror pieces
        embroidered toe
        closed toe
        pointed toe
        round toe
        stiletto heel
        block heel
        kitten heel
        mirror border
        thread embroidery
        colorful threads
        gold mirrors
        silver mirrors
        ethnic style
        festive look
        Gujarati style
        kutch embroidery
        mirrored heel
        tassel details
        beadwork
        sequins
        slingback
        ankle strap
        mule variation
        suede upper
        velvet upper
        silk upper
        navratri style
        boho vibe
        party look
        reflective sparkle
        mirror mosaic
        handcrafted look
        vibrant colors
        4-inch heel
        embellished toe cap
        folk art style
        playful sparkle
        dazzling finish
    """),
    "One-Strap Bare Foot Heels": _lines("""
        single strap
        barefoot look
        thin toe strap
        minimal design
        stiletto heel
        open sides
        open toe
        clear strap
        nude strap
        black strap
        gold strap
        silver strap
        crystal strap
        slide style
        mule style
        4-inch heel
        slim heel
        clear heel
        minimal sole
        exposed foot
        barely-there look
        leg lengthening
        elegant minimal
        summer style
        evening style
        chic look
        simple silhouette
        cushioned insole
        wide strap variation
        square toe
        pointed sole
        smooth leather
        patent strap
        satin strap
        suede strap
        knotted strap
        twisted strap
        effortless look
        clean lines
        modern chic
    """),
    "Pastel Vinyl Strappy Heels": _lines("""
        pastel vinyl straps
        glossy vinyl
        blush pink
        mint green
        baby blue
        lavender
        peach
        lemon yellow
        clear vinyl
        tinted vinyl
        strappy upper
        stiletto heel
        block heel
        clear heel
        open toe
        ankle strap
        mule style
        slingback
        candy colors
        glossy finish
        wet look
        playful vibe
        fun style
        summer look
        spring look
        pastel heel
        4-inch heel
        crystal buckle
        gold buckle
        shiny straps
        thin straps
        wide straps
        crisscross straps
        square toe
        pointed toe
        modern look
        youthful vibe
        sweet style
        cute look
        fresh finish
    """),
    "Pre-Draped Ankle Straps Heels": _lines("""
        pre-draped ankle strap
        draped fabric
        ankle wrap
        stiletto heel
        block heel
        open toe
        pointed toe
        satin drape
        silk drape
        ruched fabric
        knotted ankle
        bow ankle
        elastic back
        easy slip-on
        mule style
        slingback
        pump shape
        4-inch heel
        cushioned insole
        buckle accent
        gold buckle
        crystal accent
        jewel tone
        nude drape
        black drape
        pastel drape
        evening style
        cocktail style
        elegant look
        soft pleats
        twisted fabric
        gathered detail
        fluid lines
        draped vamp
        sophisticated style
        polished look
        effortless glam
        refined elegance
        comfortable fit
        luxe finish
    """),
    "Quilted Vinyl Strappy Heels": _lines("""
        quilted vinyl straps
        glossy quilting
        diamond pattern
        padded vinyl
        strappy upper
        stiletto heel
        block heel
        open toe
        square toe
        ankle strap
        puffy straps
        wet-look finish
        black vinyl
        white vinyl
        red vinyl
        pastel vinyl
        metallic vinyl
        chain detail
        gold hardware
        silver hardware
        buckle closure
        mule style
        slide style
        platform variation
        4-inch heel
        padded footbed
        sleek look
        futuristic vibe
        bold style
        glossy sheen
        textured look
        chunky straps
        thin straps
        stitched detail
        edgy style
        modern chic
        statement look
        luxe finish
        high-gloss
        eye-catching
    """),
    "Reimagined Patent Strappy Heels": _lines("""
        patent leather straps
        high-gloss patent
        strappy upper
        stiletto heel
        sculpted heel
        block heel
        open toe
        square toe
        pointed toe
        ankle strap
        crisscross straps
        knotted straps
        asymmetric straps
        black patent
        red patent
        nude patent
        white patent
        metallic patent
        two-tone patent
        gold hardware
        minimal buckle
        slingback
        mule variation
        4-inch heel
        padded footbed
        mirror shine
        modern design
        sleek look
        polished finish
        glossy look
        bold look
        classic reimagined
        architectural heel
        cutout heel
        contemporary vibe
        chic style
        refined edge
        luxe finish
        timeless appeal
        statement shine
    """),
    "Sequined Strappy Heels": _lines("""
        sequined straps
        sparkling upper
        strappy design
        stiletto heel
        block heel
        open toe
        ankle strap
        gold sequins
        silver sequins
        rose gold sequins
        black sequins
        iridescent sequins
        multicolor sequins
        sequin heel
        glitter sole
        crystal buckle
        party look
        disco vibe
        festive look
        evening glam
        light-catching sparkle
        thin straps
        wide straps
        crisscross straps
        slingback
        mule style
        4-inch heel
        sequin bow
        sequin fringe
        mirror sequins
        dazzling look
        shimmer
        glam style
        cocktail style
        bold sparkle
        fun vibe
        sequin toe strap
        sparkle with steps
        eye-catching
        glamorous finish
    """),
    "Tissue Silk Strappy Heels": _lines("""
        tissue silk straps
        metallic tissue
        gold tissue
        silver tissue
        rose gold tissue
        sheer tissue
        strappy upper
        stiletto heel
        block heel
        open toe
        ankle strap
        zari trim
        crystal accents
        pearl accents
        festive look
        wedding style
        shimmering finish
        lightweight straps
        delicate look
        glossy sheen
        pastel tissue
        crushed tissue
        tissue bow
        tissue wrap
        slingback
        mule style
        4-inch heel
        gold heel
        clear heel
        soft glow
        elegant style
        ethnic touch
        luxe finish
        radiant look
        thin straps
        twisted straps
        knotted straps
        refined glam
        airy feel
        glowing finish
    """),
    "Ultra-Sheer Mesh Strappy Heels": _lines("""
        ultra-sheer mesh straps
        transparent mesh
        fishnet mesh
        mesh upper
        strappy design
        stiletto heel
        block heel
        open toe
        pointed toe
        ankle strap
        mesh sock variation
        nude mesh
        black mesh
        crystal mesh
        embroidered mesh
        sheer panels
        skin showing
        barely-there look
        sensual vibe
        edgy style
        modern look
        mesh wraps ankle
        slingback
        mule style
        4-inch heel
        gold hardware
        silver hardware
        crystal buckle
        polka dot mesh
        glitter mesh
        stretch mesh
        sleek silhouette
        lightweight design
        delicate straps
        evening style
        runway style
        futuristic vibe
        bold look
        airy feel
        sheer glam
    """),
    "V-Cut Toe Strappy Heels": _lines("""
        V-cut toe strap
        V-shaped vamp
        strappy upper
        stiletto heel
        block heel
        open toe
        pointed toe
        square toe
        ankle strap
        deep V-cut
        leg-lengthening effect
        sleek look
        patent straps
        leather straps
        suede straps
        metallic straps
        crystal V-strap
        gold hardware
        buckle closure
        slingback
        mule style
        4-inch heel
        cushioned insole
        black strap
        nude strap
        red strap
        white strap
        asymmetric V
        double V straps
        thin straps
        wide straps
        elegant silhouette
        evening style
        modern design
        minimal design
        bold look
        chic style
        polished finish
        sharp lines
        refined edge
    """),
    "Wet Look Vinyl Strappy Heels": _lines("""
        wet-look vinyl straps
        high-gloss finish
        slick shine
        strappy upper
        stiletto heel
        block heel
        clear heel
        open toe
        pointed toe
        ankle strap
        black vinyl
        red vinyl
        nude vinyl
        clear vinyl
        metallic vinyl
        glossy reflections
        liquid look
        latex-like gloss
        sleek silhouette
        edgy style
        futuristic vibe
        night-out look
        crisscross straps
        thin straps
        wide straps
        slingback
        mule style
        platform variation
        4-inch heel
        gold hardware
        silver hardware
        crystal buckle
        bold look
        sexy vibe
        editorial style
        mirror shine
        slick finish
        eye-catching
        statement style
        glossy glam
    """),
    "X-Strappy Fusion Heels": _lines("""
        X-strap design
        crisscross straps
        fusion style
        mixed materials
        strappy upper
        stiletto heel
        block heel
        platform
        open toe
        square toe
        ankle strap
        leather and vinyl
        suede and satin
        metallic and matte
        embroidered straps
        beaded straps
        chain straps
        gold hardware
        silver hardware
        buckle closure
        slingback
        mule style
        4-inch heel
        bold look
        modern design
        edgy style
        contemporary vibe
        graphic lines
        asymmetric straps
        double X straps
        thin straps
        wide straps
        colorblock straps
        textured straps
        festival style
        runway look
        statement design
        eye-catching
        creative fusion
        fashion forward
    """),
    "Zari Crystal Ankle Straps Heels": _lines("""
        zari ankle straps
        crystal ankle straps
        gold zari
        silver zari
        rhinestones
        stiletto heel
        block heel
        open toe
        pointed toe
        ankle cuff
        crystal buckle
        pearl accents
        kundan stones
        beadwork
        embroidery
        festive look
        wedding style
        bridal heels
        jewel tones
        velvet straps
        silk straps
        gold heel
        crystal heel
        clear heel
        slingback
        mule variation
        4-inch heel
        ethnic style
        glam look
        shimmering finish
        sparkle
        regal style
        ornate design
        luxe finish
        traditional glam
        antique zari
        tassels
        rich embellishment
        royal elegance
        opulent style
    """),
    "Yoke Ankle Strap Heels": _lines("""
        yoke ankle strap
        structured ankle cuff
        yoke-shaped vamp
        stiletto heel
        block heel
        open toe
        pointed toe
        closed toe
        T-bar strap
        buckle closure
        gold buckle
        silver buckle
        leather upper
        suede upper
        patent upper
        satin upper
        black
        nude
        red
        tan
        metallic
        crystal trim
        pearl trim
        embroidered yoke
        cutout yoke
        mary jane style
        slingback
        4-inch heel
        cushioned insole
        classic style
        modern style
        elegant look
        structured look
        polished finish
        refined style
        timeless design
        chic look
        sophisticated vibe
        clean lines
        balanced silhouette
    """),
}

COLORS = [
    "black", "nude", "red", "crimson", "wine", "blush pink", "hot pink", "fuchsia",
    "white", "ivory", "gold", "silver", "rose gold", "champagne", "bronze",
    "royal blue", "navy", "emerald green", "mint", "lavender", "purple",
    "tan", "camel", "chocolate brown", "leopard print", "yellow", "orange",
    "teal", "turquoise", "coral",
]


class MBHighHeelsRandomizer(io.ComfyNode):
    """One seed drives every pick: the style (when randomized), the color and
    which of the style's detail fragments land in the prompt."""

    @classmethod
    def define_schema(cls) -> io.Schema:
        styles = list(HEELS)
        return io.Schema(
            node_id="MBNodesHighHeelsRandomizer",
            display_name="High Heels Randomizer (MB)",
            category="MBNodes",
            description="Build a high heels prompt from a chosen or random style with random details and an optional random color.",
            search_aliases=["heels", "high heels", "shoes", "random prompt", "footwear"],
            inputs=[
                io.Combo.Input("category", options=styles, default=styles[0], tooltip="Heel style used when random_category is off."),
                io.Boolean.Input("random_category", default=False, tooltip="Pick the style from the seed instead of the category widget."),
                io.Boolean.Input("color", default=False, tooltip="Put a seeded-random color before the heel name."),
                io.Int.Input("details", default=3, min=1, max=40, tooltip="How many random detail fragments to add."),
                io.Int.Input("seed", default=0, min=0, max=MAX_SEED, control_after_generate=True),
            ],
            outputs=[io.String.Output("prompt")],
        )

    @classmethod
    def execute(cls, category, random_category, color, details, seed) -> io.NodeOutput:
        rng = random.Random(seed)
        name = rng.choice(list(HEELS)) if random_category else category
        subject = f"{rng.choice(COLORS)} {name}" if color else name
        fragments = HEELS[name]
        picks = rng.sample(fragments, min(details, len(fragments)))
        return io.NodeOutput(", ".join([subject, *picks]))


NODES = [MBHighHeelsRandomizer]

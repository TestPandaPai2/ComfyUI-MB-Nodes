"""Saree prompt picker: a saree style (fixed or seeded-random), a seeded
sample of that style's detail fragments, and an optional seeded color."""

import random

from comfy_api.latest import io

MAX_SEED = 0xFFFFFFFFFFFFFFFF


def _lines(block):
    return [line.strip() for line in block.strip().splitlines() if line.strip()]


SAREES = {
    "A-Line Draped Saree": _lines("""
        full A-line skirt flaring from the waist
        skirt cinched at the back for a defined waist
        short attached blouse baring the midriff
        structured silhouette with soft volume at the hem
        box pleats fanning out below the hips
        crisp taffeta skirt holding its flare
        pallu pinned neatly at the left shoulder
        contrast piping along the waistband
        fitted princess-seam blouse
        hem brushing the floor in a clean circle
        satin sash tied at the natural waist
        stiffened can-can layer under the skirt
        scalloped border running around the hem
        thin gold trim tracing the A-line seams
        sweetheart neckline blouse
        cap-sleeve blouse with tailored shoulders
        pallu falling straight down the back
        subtle sheen on raw silk fabric
        geometric block print across the skirt
        wide embroidered border at the hem
        soft georgette overlay on a structured base
        side zip hidden within the pleats
        pleats stitched down at the waist, released below
        petal-shaped hem panels
        corseted back lacing on the blouse
        tonal thread embroidery on the bodice
        skirt swaying in a bell shape with each step
        modern cocktail-length variation of the drape
        high-waisted skirt elongating the legs
        pallu draped as a short cape over one arm
        embroidered belt at the waist
        banded collar blouse
        kalidar paneled skirt
        bias-cut flare with fluid movement
        ombre shading from waist to hem
        tiny buttons down the blouse back
        pleated pallu with tasseled ends
        brocade panels inset into the skirt
        crisp organza hem trim
        balanced silhouette framing the waistline
    """),
    "Backless Corset Blouse Saree": _lines("""
        fully open back blouse
        structured corset bodice with boning
        criss-cross laces down the spine
        long flowing skirt pooling at the floor
        pallu draped low across the lower back
        sweetheart corset neckline
        tie-up dori strings with tassels at the back
        satin corset with a sculpted waist
        sheer net panels on the corset sides
        embroidered corset cups
        plunging back cut to the waist
        chain-link strap across the bare back
        pallu slung over the elbow to reveal the back
        velvet corset in a rich tone
        metallic eyelets on the lacing
        halter-neck corset variation
        spaghetti straps on a boned bodice
        pearl strings draped across the back
        mirror-work edging on the corset
        georgette skirt falling in soft folds
        high slit skirt paired with the corset
        overbust corset with a straight neckline
        tonal sequin scatter over the bodice
        backless blouse held by a single hook
        zardozi embroidery on the corset panels
        crystal-studded back drawstring
        corset peplum flaring at the hips
        deep U-shaped back cut
        thin gold chain belt at the waist
        pallu pinned at the shoulder with a brooch
        leather-look corset in a fusion styling
        sculpted bodice defining the torso
        shimmering satin skirt
        ruched corset panels
        off-shoulder corset sleeves
        seamless boned bustier
        pleats tucked sharply at the hip
        lace-trimmed corset edge
        bold evening silhouette
        embroidered border framing the open back
    """),
    "Butterfly Drape Saree": _lines("""
        dramatic central pleat forming butterfly wings
        loose side drapes fluttering with movement
        fitted blouse exposing the midriff
        wide pleated fan across the front
        pallu split into two wing-like panels
        chiffon layers catching the air
        pleats fanned symmetrically from the navel
        playful glamorous silhouette
        thin waist chain accenting the drape
        light georgette in fluid layers
        butterfly motif embroidery on the pallu
        pleats pinned at the center waist
        wing drapes falling to mid-calf
        scalloped wing edges
        sequin scatter along the wing borders
        halter blouse with a keyhole cutout
        drape crossing over both shoulders
        tiered chiffon wings
        ombre wings fading lighter at the edges
        cutdana beadwork along the pleats
        airy organza wing panels
        sleeveless blouse with a high neck
        pallu fluttering behind the shoulders
        cape-like drape extending from the back
        front pleats layered like petals
        delicate lace trim on the wing edges
        backless blouse with dori ties
        wings sweeping out when turning
        soft pastel tones layered together
        metallic tissue wing panels
        wide pleated front with a slim back
        feather-light fabric with gentle sheen
        embroidered belt pinning the wings
        asymmetric wing lengths
        mirror sequins glinting on the wings
        crystal brooch at the drape center
        bell-sleeve blouse variation
        fluid chiffon skirt beneath the wings
        drape knotted loosely at the shoulder
        whimsical party-ready styling
    """),
    "Cropped Blouse Saree": _lines("""
        short fitted blouse baring the midriff
        pallu draped over one shoulder
        navel-focused drape set low on the hips
        youthful modern styling
        crop blouse with a square neckline
        puff-sleeve crop blouse
        low-slung pleats at the hip
        pallu pinned high to show the waist
        halter crop blouse
        crop blouse with a knotted front
        sleeveless crop top with a round neck
        bralette-style blouse
        slim waist chain across the midriff
        embroidered hem on the crop blouse
        georgette saree with a light sheen
        contrast crop blouse in a bold color
        mirror-work crop blouse
        pallu wrapped around the waist once
        sweetheart crop blouse
        fringe trim along the blouse hem
        one-shoulder crop blouse
        printed crop top paired with plain saree
        backless crop blouse with tie strings
        puff sleeves with elastic cuffs
        sheer sleeves on a fitted crop
        belt worn over the cropped drape
        embellished neckline on the crop
        chiffon pleats falling straight
        cropped jacket-style blouse
        pallu loosely draped over the arm
        broad border on the saree hem
        festive sequined crop blouse
        corset-seamed crop top
        striped saree with a solid crop blouse
        cutout detail at the blouse front
        high-neck crop blouse
        drape held in place with a brooch
        bias-cut skirt skimming the hips
        casual chic daywear styling
        balance of coverage and bare midriff
    """),
    "Dhoti Style Saree": _lines("""
        loose wide-leg draped skirt
        dhoti pants pleated at the front
        fitted blouse over the dhoti drape
        relaxed ethnic-fusion look
        pallu attached at the shoulder
        cowl folds between the legs
        cotton silk dhoti fabric
        drape tucked at the back like a traditional dhoti
        ankle-length hem with a clean border
        pallu flowing freely from the shoulder
        jacket-style blouse
        asymmetric overlay over the dhoti pants
        belted waist over the pleats
        soft crinkled fabric texture
        contrast piping on the dhoti hem
        sleeveless blouse with a mandarin collar
        pre-stitched dhoti base
        dhoti in a solid color with printed pallu
        khadi fabric with a rustic weave
        gold border running down the legs
        low crotch drape for easy movement
        cape pallu over both shoulders
        angrakha-style wrap blouse
        mirror-work belt
        dhoti drape gathered at the ankles
        loose fall of fabric at the sides
        high-neck blouse with keyhole back
        ikat pattern on the dhoti
        pleats stitched flat at the waist
        tasseled drawstring at the side
        structured shoulders on the blouse
        indo-western festive styling
        layered drape with a sash
        lightweight linen blend
        embroidered cuffs on the blouse
        dhoti with a subtle sheen
        pallu tucked into a waist belt
        cropped blouse with the dhoti drape
        striking androgynous silhouette
        comfortable flowing movement
    """),
    "Empire Waist Drape Saree": _lines("""
        drape starting just below the bust
        no waist cinching
        loose flowing skirt from the bust
        romantic voluminous silhouette
        high empire seam with embroidered band
        soft georgette in cascading folds
        pallu floating from the shoulder
        fitted bodice above the empire line
        pleats released from the underbust
        chiffon layers with gentle movement
        pearl trim along the empire seam
        sheer sleeves on the bodice
        pastel palette for a dreamy look
        long pallu trailing behind
        smocked bodice detail
        sweetheart neckline bodice
        grecian-inspired drape
        sash tied under the bust
        tiered skirt panels
        flutter sleeves on the blouse
        floral embroidery on the bust band
        floor-length skirt with soft train
        gathered skirt with fullness
        empire drape with a slight sheen
        pallu gathered at one shoulder
        light organza overlay
        tonal sequin scatter on the skirt
        v-neck bodice with a deep neckline
        ruched bodice gathering
        satin ribbon at the empire seam
        embroidered border at the hem
        effortless elegant flow
        cap sleeves on the bodice
        pallu draped as a stole
        crystal buttons on the bodice back
        soft cotton silk for daywear
        maternity-friendly loose fit
        vintage-inspired romantic mood
        subtle shimmer in the skirt
        balanced drape lengthening the frame
    """),
    "Fitted Sheath Saree": _lines("""
        sleek one-piece sheath silhouette
        drape tapering from hip to hem
        minimal blouse
        body-hugging elegance
        stretch satin fabric
        pleats flattened against the body
        pallu drawn tight across the torso
        column-like silhouette
        high neck minimal blouse
        pencil-slim hem
        pre-stitched mermaid finish at the knee
        monochrome sophisticated look
        subtle side slit for movement
        smooth crepe fabric
        sleeveless fitted blouse
        pallu falling straight down the back
        clean lines with no embellishment
        thin metallic border along the edge
        tailored darts shaping the waist
        long-sleeve sheath blouse
        jersey knit drape
        pallu pinned sharply at the shoulder
        sculpted hip line
        glossy satin sheen
        boat-neck blouse
        drape wrapped twice for a snug fit
        modern gala silhouette
        structured shoulder on the blouse
        seamless drape with hidden pleats
        minimal gold hardware at the waist
        slim fishtail hem
        single-tone tonal embroidery
        backless minimal blouse
        pallu wrapped around the neck like a scarf
        metallic lamé fabric
        sharp tailoring at the bodice
        drape in a deep jewel tone
        sophisticated red-carpet feel
        velvet sheath variation
        elongated statuesque silhouette
    """),
    "Fusion Modern Saree": _lines("""
        traditional motifs with contemporary cuts
        organza and silk blend fabric
        fitted blouse
        adjustable pallu
        saree paired with a cropped jacket
        belt cinching the pallu at the waist
        saree worn over slim trousers
        shirt-style blouse
        pre-pleated skirt with pockets
        asymmetric hemline
        digital print of classic motifs
        structured cape pallu
        denim-accented blouse
        corset belt over the drape
        ruffled pallu edge
        tie-dye pattern
        off-shoulder blouse
        sheer organza pallu with a solid skirt
        metallic foil print
        turtleneck blouse
        sneaker-friendly ankle-length drape
        geometric embroidery
        layered drape with a waistcoat
        lehenga-style pleated skirt
        blazer worn over the saree
        pallu draped over both shoulders
        mixed-fabric panels
        minimal jewelry styling
        abstract print on silk
        peplum blouse
        tulle overlay on the pallu
        leather belt at the waist
        drape pinned with a statement brooch
        balloon-sleeve blouse
        dhoti-pant fusion base
        color-blocked panels
        cape-sleeve blouse
        embroidered patches on the pallu
        trendy ethnic street style
        versatile day-to-night look
    """),
    "High Slit Saree": _lines("""
        deep thigh-high slit on one side
        double slits on both sides of the skirt
        revealing leg with each stride
        structured blouse
        pre-stitched skirt with a clean slit
        pallu flowing opposite the slit
        slit edged with gold piping
        sequin trim along the slit
        satin skirt with a fluid fall
        corset blouse
        crepe skirt holding a sharp line
        slit framed by pleats
        halter-neck blouse
        tassels at the top of the slit
        metallic skirt with a high slit
        one-shoulder blouse
        embroidered border along the slit edge
        pallu draped as a cape
        velvet skirt with a front slit
        drape knotted at the hip above the slit
        georgette skirt with airy movement
        crystal embellishment at the slit
        long-sleeve structured blouse
        slit revealing strappy heels
        wrap-style skirt with an open front
        pleats gathered on the opposite hip
        contrast lining inside the slit
        sleek evening silhouette
        pallu pinned high at the shoulder
        sheer net panel near the slit
        deep plunge blouse
        waist chain over the drape
        mermaid skirt with a slit
        confident red-carpet styling
        silk skirt with a subtle sheen
        slit bordered with mirror-work
        backless blouse with ties
        cocktail-ready glamour
        cape sleeves on the blouse
        graceful stride-friendly drape
    """),
    "Kanchipuram Modern Saree": _lines("""
        rich zari borders
        gold temple motifs
        lighter shorter design
        cropped blouse
        modern draping
        vibrant festive colors
        contrast korvai border
        mayil peacock motifs in zari
        checked kattam pattern body
        rudraksha buttas scattered across the body
        heavy zari pallu
        mango motifs along the border
        silk with a lustrous sheen
        pleats fanning crisply at the front
        elbow-length brocade blouse
        sleeveless blouse with zari trim
        pallu pinned in neat pleats
        pastel Kanchipuram with silver zari
        temple border in reverse zari
        yazhi motifs on the pallu
        annam swan motifs in gold
        broad border framing the hem
        lightweight soft silk variant
        puff-sleeve brocade blouse
        belted waist for a modern twist
        stripes of zari along the body
        pallu draped open over the arm
        deep jewel-toned silk
        contemporary geometric zari layout
        high-neck blouse with a keyhole
        vairaoosi fine dotted weave
        gold tissue border
        crisp silk with structured pleats
        off-shoulder blouse
        half-and-half two-tone body
        tassels at the pallu corners
        muted zari for understated glamour
        rich temple jewelry styling
        backless blouse with dori tassels
        bridal festive radiance
    """),
    "Lace Sheer Saree": _lines("""
        delicate lace overlays
        transparent base fabric
        romantic skin-baring drape
        semi-fitted blouse
        scalloped lace border
        chantilly lace panels
        floral lace appliqué on the pallu
        sheer net skirt
        lace sleeves on the blouse
        tonal lace on a nude base
        eyelash lace edging
        pearl beads within the lace motifs
        lace yoke on the blouse
        sheer pallu revealing the arm
        corded lace motifs
        lace cutwork hem
        soft tulle base
        lace trim along the pleats
        high-neck lace blouse
        sequin-dusted lace
        vintage ivory lace
        guipure lace border
        lace back panel on the blouse
        illusion neckline
        lace pallu with a scalloped end
        embroidered lace flowers
        lace cuffs on long sleeves
        airy ethereal drape
        lace inserts in the skirt
        sleeveless lace blouse
        champagne-toned lace
        subtle shimmer threads in the lace
        lace motifs scattered across the body
        allure without full exposure
        delicate floral pattern throughout
        georgette lining under the lace
        lace bodice with a satin trim
        draped pallu over both shoulders
        bridal-inspired softness
        dreamy romantic mood
    """),
    "Mirror Work Saree": _lines("""
        hundreds of tiny mirror pieces
        shimmering reflections in movement
        dazzling party-ready look
        abhla mirror embroidery
        mirror-work blouse
        mirrors bordered in thread stitching
        mirror clusters along the border
        round and square mirror pieces
        Gujarati-style mirror embroidery
        mirror scatter across the pallu
        multicolor thread around the mirrors
        mirror-studded belt
        georgette base with mirror motifs
        backless mirror-work blouse
        mirrors glinting under light
        geometric mirror patterns
        mirror work on a black base
        halter mirror blouse
        mirror-lined hem
        kutch embroidery with mirrors
        tassels ending in mirrors
        mirror-work cape pallu
        mirrors framed by sequins
        festive navratri styling
        mirror florals on the skirt
        sleeveless mirror blouse
        light cotton base for comfort
        silver mirror sparkle
        mirror-work sleeves
        dense mirror panel at the pallu end
        mirrors mixed with beadwork
        bohemian mirror detailing
        mirror border on both edges
        crop blouse with mirror work
        playful sparkle with every turn
        mirror motifs in a paisley layout
        contrast colored thread work
        mirrors along the neckline
        mirror embellished pleats
        radiant reflective finish
    """),
    "One Shoulder Saree": _lines("""
        one shoulder bare
        opposite shoulder covered
        fitted blouse
        flowing skirt
        asymmetric neckline
        pallu draped over the covered shoulder
        sculpted single strap
        off-shoulder asymmetry
        ruffled one-shoulder blouse
        pallu falling from one side only
        draped cowl on the shoulder
        embellished strap
        one-shoulder cape detail
        satin blouse with a single sleeve
        asymmetric hemline
        pleats aligned to the covered side
        crystal brooch on the shoulder
        chiffon skirt with soft flow
        one full sleeve and one bare arm
        sequin one-shoulder blouse
        bow detail on the shoulder
        pleated shoulder drape
        georgette pallu cascading down the back
        bare collarbone on one side
        structured one-shoulder bodice
        feather trim on the shoulder
        metallic one-shoulder top
        graceful red-carpet asymmetry
        cutout at the waist
        pallu pinned in pleats at the shoulder
        tonal embroidery on the strap
        bell sleeve on the covered arm
        corset-seamed bodice
        draped sash from shoulder to hip
        velvet one-shoulder blouse
        elegant diagonal lines
        pearl-lined strap
        high slit skirt paired with the asymmetry
        statement earring styling on the bare side
        unique sculptural elegance
    """),
    "Pastel Organza Saree": _lines("""
        soft flowing organza
        pastel hues
        light embroidery
        cropped blouse
        dreamy fresh aesthetic
        summer event styling
        blush pink organza
        mint green organza
        powder blue organza
        lavender organza
        peach organza
        butter yellow organza
        floral thread embroidery
        scalloped border
        crisp translucent sheen
        hand-painted florals
        pearl-embellished border
        sheer organza pallu
        sleeveless pastel blouse
        puff-sleeve blouse
        sequin scatter on the body
        pastel ombre
        organza ruffles on the pallu
        delicate pleats standing crisp
        tonal embroidery
        lace trim border
        feather-light drape
        pastel blouse with a sweetheart neck
        embroidered butterflies
        silver thread motifs
        cutwork border
        organza petals appliqué
        soft gota patti accents
        light daytime wedding look
        v-neck blouse
        pallu floating in the breeze
        backless blouse with tassels
        minimal jewelry styling
        airy garden-party mood
        fresh romantic elegance
    """),
    "Pre-Draped Saree": _lines("""
        ready-to-wear draped skirt
        hassle-free styling
        stitched pleats
        attached pallu
        quick pallu adjustments
        effortless modern comfort
        hidden side zip
        elastic waistband
        pallu stitched at the shoulder
        concealed hook closures
        lycra-blend fabric
        pre-stitched fishtail hem
        belted waist
        drape in a single piece
        pallu in a cape style
        comfortable movement
        crisp permanent pleats
        pre-draped with a slit
        pallu draped over both shoulders
        stitched mermaid silhouette
        sleeveless blouse
        cocktail pre-draped style
        georgette with a soft fall
        metallic pre-draped gown saree
        pallu with a stitched ruffle
        structured hip panel
        sequined pre-draped version
        pre-pleated front fan
        one-shoulder pre-draped look
        clean polished finish
        modern travel-friendly saree
        pallu pinned with a brooch
        ruched drape at the hip
        pre-draped dhoti-style base
        embroidered border
        satin pre-draped skirt
        cropped blouse
        corset blouse pairing
        festive ready-to-wear glam
        smooth fitted silhouette
    """),
    "Quilted Fabric Saree": _lines("""
        soft padded quilting
        added texture
        volume in the skirt
        fitted blouse
        luxurious sculptural drape
        diamond quilt pattern
        channel-stitched panels
        quilted border
        quilted pallu
        puffy structured pleats
        satin quilting with sheen
        metallic thread quilting
        quilted jacket blouse
        winter-ready warmth
        quilted cape pallu
        geometric quilt stitching
        tonal quilted motifs
        quilted belt
        soft velvet quilting
        embroidered quilt squares
        quilted peplum
        voluminous hem
        contrast stitching lines
        quilted sleeves
        floral quilting pattern
        chevron quilted skirt
        quilted bodice
        sculpted silhouette
        matte quilted fabric
        pearl accents at the quilt seams
        high-neck quilted blouse
        quilted puff sleeves
        couture fashion styling
        quilted panels with sheer inserts
        textural contrast with a smooth pallu
        structured shoulders
        quilted hem border
        avant-garde runway look
        bold modern texture
        plush luxurious feel
    """),
    "Reimagined Banarasi Saree": _lines("""
        modernized Banarasi silk
        lighter shorter cuts
        contemporary silhouette
        minimal zari work
        subtle opulent statement
        kadhua weave motifs
        jangla floral jaal
        butidar small buttas
        shikargah hunting scene motifs
        tanchoi weave
        pastel Banarasi silk
        silver zari accents
        brocade crop blouse
        Banarasi belt at the waist
        lightweight katan silk
        georgette Banarasi
        meenakari colored weave
        striped Banarasi body
        kadwa paisley border
        Banarasi jacket blouse
        pallu with a woven border
        off-shoulder brocade blouse
        muted gold threads
        contrast color border
        organza Banarasi
        antique zari finish
        floral vine border
        Banarasi pleats fanning crisp
        sleeveless brocade blouse
        modern color palette
        Banarasi dupatta-style pallu
        sheer Banarasi with woven dots
        Mughal-inspired motifs
        high-neck brocade blouse
        sleek modern draping
        heritage weave refreshed
        gold-dusted pleats
        Banarasi with a subtle sheen
        wedding guest styling
        regal understated glamour
    """),
    "Sequined Glam Saree": _lines("""
        shimmering sequins
        beaded blouse
        sequined pallu
        dazzling party look
        allover sequin coverage
        ombre sequins
        metallic sequins
        tonal sequins
        sequin stripes
        sequin-studded border
        crystal beadwork
        backless sequin blouse
        halter sequin blouse
        sleeveless sequin blouse
        georgette base
        light-catching shimmer
        sequin waterfall pallu
        cocktail glam styling
        gold sequins
        silver sequins
        rose gold sequins
        black sequin drama
        sequin fringe
        sequined belt
        sequin floral motifs
        mirror sequins
        deep v blouse
        disco-ready sparkle
        sequin cape pallu
        bugle bead accents
        net saree with sequins
        sequin geometric pattern
        champagne sequins
        sequined corset blouse
        evening gala glamour
        feather trim
        sequin sleeves
        glittering hem
        high-shine finish
        red-carpet sparkle
    """),
    "Tissue Silk Saree": _lines("""
        sheer tissue silk
        delicate zari work
        fitted blouse
        flowing skirt
        lightweight luxury
        breathable elegance
        metallic tissue sheen
        gold tissue
        silver tissue
        rose gold tissue
        crushed tissue texture
        tissue border
        tissue pallu
        zari stripes
        scalloped border
        pearl embellishment
        crisp pleats
        pastel tissue
        tissue with woven buttas
        sleeveless blouse
        brocade blouse
        festive shimmer
        organza-tissue blend
        light-reflecting fabric
        zari checks
        subtle glamour
        kasavu-inspired tissue
        contrast border
        embroidered pallu
        tissue ruffles
        cutwork border
        high-neck blouse
        puff sleeves
        gota trim
        wedding styling
        airy drape
        golden glow
        minimal jewelry styling
        soft structured fall
        radiant finish
    """),
    "Ultra-Sheer Chiffon Saree": _lines("""
        lightest chiffon
        translucent drape
        minimal pallu coverage
        structured blouse
        bold sensual vibe
        barely-there fabric
        soft fluid fall
        pallu fluttering freely
        chiffon in a solid color
        chiffon with a sheer border
        corset blouse
        backless blouse
        halter blouse
        spaghetti-strap blouse
        pallu draped thin across the torso
        chiffon catching the wind
        sequin-edged chiffon
        pleats falling weightless
        ombre chiffon
        pastel chiffon
        black chiffon
        red chiffon
        floral print chiffon
        tonal embroidery
        lace border
        satin border
        rain-soaked movie styling
        bollywood glamour
        low-waist drape
        sweetheart blouse
        deep v blouse
        chiffon ruffle pallu
        crystal border
        pleats tucked low
        airy weightless drape
        chiffon with a subtle shimmer
        drape clinging lightly
        evening romance
        cocktail styling
        soft ethereal glow
    """),
    "V-Neck Deep Drape Saree": _lines("""
        deep v-neckline blouse
        plunging neckline
        intricate front drapes
        accentuated neck
        accentuated midriff
        pallu crossing into the v
        embellished v-edge
        sleeveless v-neck blouse
        long-sleeve v-neck blouse
        wrap-style blouse
        v-back blouse
        pallu draped close to the neckline
        pleated front
        chiffon drape
        georgette drape
        satin drape
        sequined v-neck blouse
        velvet v-neck blouse
        corset v-neck blouse
        crystal trim
        v-neck with tassels
        halter v-neck
        v-neck peplum
        pallu pinned at the shoulder
        front cutout
        waist chain
        belted drape
        draped cowl
        v-neck with net inserts
        zardozi v-neck
        mirror-work v-neck
        deep v with a lace edge
        pallu over both shoulders
        sheer sleeves
        bold neckline styling
        red-carpet v-neck
        evening glam
        slim silhouette
        drape layered at the front
        elegant plunge
    """),
    "Wet Look Sheer Saree": _lines("""
        wet-look finish
        sheer chiffon
        sheer georgette
        glossy sheen
        skin-like sheen
        contour-accentuating drape
        liquid satin
        clingy drape
        gloss on the pallu
        metallic wet look
        high-shine fabric
        body-skimming fall
        corset blouse
        backless blouse
        halter blouse
        sleeveless blouse
        rain-inspired styling
        droplet-like sequins
        glossy pleats
        dark jewel tones
        black wet-look
        silver wet-look
        champagne wet-look
        pallu clinging to the shoulder
        fluid folds
        glassy finish
        waist chain
        crystal trim
        editorial styling
        slick silhouette
        sheer sleeves
        pallu draped tight
        mirror-shine highlights
        runway styling
        sensual evening look
        latex-like gloss
        soft specular highlights
        drape hugging the curves
        cocktail glam
        bold fashion statement
    """),
    "X-Pleated Fusion Saree": _lines("""
        exaggerated x-shaped pleats
        fusion elements
        modern embroidery
        bold graphic silhouette
        contemporary silhouette
        crisscross pleats
        pleats meeting at the waist
        geometric structure
        structured blouse
        asymmetric blouse
        pleated pallu
        contrast pleat lining
        metallic pleat edges
        box pleats
        knife pleats
        origami folds
        corset blouse
        sleeveless blouse
        cape blouse
        belted waist
        pleats in two tones
        architectural drape
        crisp taffeta
        organza pleats
        satin pleats
        embroidered x motif
        sequin-edged pleats
        striped pleats
        monochrome pleats
        avant-garde styling
        high-neck blouse
        cutout blouse
        pleats fanning outward
        layered pleats
        pleated skirt with a slit
        runway fusion look
        sculptural shape
        graphic lines
        bold contemporary vibe
        modern art-inspired drape
    """),
    "Zari Embellished Saree": _lines("""
        intricate gold zari borders
        silver zari borders
        zari motifs on every panel
        regal traditional look
        modernly draped
        festive look
        zari buttas
        zari jaal
        zari stripes
        zari checks
        zari peacock motifs
        zari paisleys
        zari florals
        zari temple border
        heavy zari pallu
        zari blouse
        brocade blouse
        sleeveless blouse
        elbow-sleeve blouse
        high-neck blouse
        silk base
        georgette base
        organza base
        contrast border
        antique zari
        copper zari
        rose gold zari
        zari tassels
        zari belt
        pleats in crisp silk
        lustrous sheen
        wedding styling
        festive glamour
        temple jewelry styling
        zari scallops
        zari pallu with fringes
        rich jewel tones
        pastel base with gold zari
        royal opulence
        heritage craftsmanship
    """),
    "Yoke Blouse Saree": _lines("""
        yoke-style blouse
        cinched shoulders
        structured fit
        empire-like fit
        flowing skirt
        clean elegant silhouette
        embroidered yoke
        sheer yoke
        lace yoke
        beaded yoke
        mirror-work yoke
        zari yoke
        high-neck yoke
        round-neck yoke
        square yoke
        v-yoke
        sleeveless yoke blouse
        cap-sleeve yoke blouse
        long-sleeve yoke blouse
        puff-sleeve yoke blouse
        pleated skirt
        georgette skirt
        silk skirt
        chiffon skirt
        pallu over the shoulder
        pallu pinned at the yoke
        contrast yoke
        tonal yoke
        pearl yoke
        sequin yoke
        keyhole back
        button back
        dori ties
        gathered bodice below the yoke
        structured shoulders
        minimal jewelry styling
        daywear styling
        festive styling
        modest elegance
        polished finish
    """),
}

COLORS = [
    "crimson red", "maroon", "ruby red", "royal blue", "navy blue", "peacock blue",
    "teal", "emerald green", "bottle green", "mint green", "mustard yellow",
    "saffron", "marigold orange", "hot pink", "rani pink", "blush pink", "magenta",
    "royal purple", "lavender", "wine", "ivory", "pearl white", "black",
    "gold", "silver", "champagne", "peach", "coral", "turquoise", "rust",
]


class MBSareeRandomizer(io.ComfyNode):
    """One seed drives every pick: the style (when randomized), the color and
    which of the style's detail fragments land in the prompt."""

    @classmethod
    def define_schema(cls) -> io.Schema:
        styles = list(SAREES)
        return io.Schema(
            node_id="MBNodesSareeRandomizer",
            display_name="Saree Randomizer (MB)",
            category="MBNodes",
            description="Build a saree prompt from a chosen or random style with random details and an optional random color.",
            search_aliases=["saree", "sari", "random prompt", "outfit"],
            inputs=[
                io.Combo.Input("category", options=styles, default=styles[0], tooltip="Saree style used when random_category is off."),
                io.Boolean.Input("random_category", default=False, tooltip="Pick the style from the seed instead of the category widget."),
                io.Boolean.Input("color", default=False, tooltip="Put a seeded-random color before the saree name."),
                io.Int.Input("details", default=3, min=1, max=40, tooltip="How many random detail fragments to add."),
                io.Int.Input("seed", default=0, min=0, max=MAX_SEED, control_after_generate=True),
            ],
            outputs=[io.String.Output("prompt")],
        )

    @classmethod
    def execute(cls, category, random_category, color, details, seed) -> io.NodeOutput:
        rng = random.Random(seed)
        name = rng.choice(list(SAREES)) if random_category else category
        subject = f"{rng.choice(COLORS)} {name}" if color else name
        fragments = SAREES[name]
        picks = rng.sample(fragments, min(details, len(fragments)))
        return io.NodeOutput(", ".join([subject, *picks]))


NODES = [MBSareeRandomizer]

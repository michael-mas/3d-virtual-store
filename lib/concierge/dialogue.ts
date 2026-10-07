import { formatPrice, priceOf } from "@/lib/cart/pricing";
import { ARTWORKS, type Artwork, type ArtworkId } from "@/lib/gallery/artworks";
import { translate, type Locale } from "@/lib/i18n";
import { getProduct, PRODUCTS, type Product } from "@/lib/products";

/**
 * The concierge's conversation: no model, no server. A question is normalized (case, accents, punctuation), its
 * intent found from English and French keywords, the product it names recognized, and a reply written in the
 * visitor's language with suggestions (quick replies) and actions the interface carries out (walk to a piece,
 * customize or try it on, open the cart, try the whole look, start the tour, lead to the gallery or one of its works,
 * music, language).
 */

export type Action =
  | { kind: "walk"; productId: string }
  | { kind: "customize"; productId: string }
  | { kind: "tryOn"; productId: string }
  | { kind: "openCart" }
  | { kind: "tryLook" }
  | { kind: "tour" }
  | { kind: "gallery" }
  | { kind: "visit"; artworkId: ArtworkId }
  | { kind: "show" }
  | { kind: "music"; on: boolean }
  | { kind: "locale"; locale: Locale };

/** A quick reply: what the chip shows, and what it sends (in the visitor's language). */
export type Suggestion = { label: string; send: string };
export type Reply = { text: string; actions: Action[]; suggestions: Suggestion[] };
export type Context = { locale: Locale; cart: readonly { productId: string; config: Readonly<Record<string, string>> }[]; near: string | null };

type Text = { en: string; fr: string };
const L = (en: string, fr: string): Text => ({ en, fr });

/** Lowercase, accents removed, punctuation as spaces, single-spaced, padded for whole-word matching. */
export function normalize(input: string): string {
  return ` ${input
    .toLowerCase()
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .replace(/[^a-z0-9]+/g, " ")
    .trim()} `;
}

/** True when the normalized text contains one of the phrases as whole words. */
const has = (text: string, phrases: readonly string[]) => phrases.some((p) => text.includes(` ${p} `));

/** Words that name each piece, its kind or its family. */
const PRODUCT_WORDS: Record<string, readonly string[]> = {
  aviator: ["aviateur", "l aviateur", "aviator", "pilote", "pilot"],
  studio: ["atelier", "atelier 03", "studio", "carre", "carrees", "square", "acetate"],
  crystal: ["cristal", "crystal", "cat eye", "oeil de chat", "papillon"],
  "velvet-lip": ["rouge", "rouge velours", "rouge a levres", "lipstick", "levres", "lips", "velours"],
  "glow-paint": ["nuit lumiere", "face paint", "maquillage artistique", "peinture", "glow", "neon", "face art"],
  chrono: ["montre", "montres", "watch", "watches", "chrono", "chrono nuit", "horlogerie"],
  solitaire: ["bague", "bagues", "ring", "rings", "solitaire", "diamant", "diamond", "joaillerie", "jewelry", "bijou"],
  "prism-dye": ["prisme", "cheveux", "hair", "coloration", "couleur de cheveux", "hair color", "teinture", "dye"],
  topper: ["chapeau", "chapeaux", "hat", "hats", "le chapeau", "casquette", "cap", "bonnet", "beanie", "bob", "bucket"],
};
/** The gallery's works, by title (normalized). */
const ARTWORK_WORDS: Record<ArtworkId, readonly string[]> = {
  "champ-d-or": ["champ d or", "field of gold", "feuille d or", "gold leaf"],
  maree: ["maree", "tide", "la mer", "the sea", "seascape"],
  constellation: ["constellation", "etoiles", "stars"],
  fragment: ["fragment", "la toile fendue", "the cut", "slash"],
  "miroir-noir": ["miroir noir", "black mirror", "obsidienne", "obsidian"],
  ruban: ["ruban", "ribbon", "moebius", "mobius"],
  equilibre: ["equilibre", "balance", "la sphere", "the sphere", "marbre", "marble"],
  noeud: ["noeud", "knot", "trefle", "trefoil"],
  monolithe: ["monolithe", "monolith", "kintsugi", "basalte", "basalt"],
  "pluie-d-or": ["pluie d or", "golden rain", "rain of gold", "gouttes", "drops", "installation cinetique", "kinetic"],
  automates: ["automates", "trois automates", "automatons", "three automatons", "ballet mecanique", "mechanical ballet"],
};
/** Starting the performance. */
const SHOW_WORDS = ["spectacle", "performance", "the show", "le show", "ballet", "danse", "dance", "theatre", "theater", "robots qui dansent", "dancing robots"];
const GALLERY_WORDS = ["galerie", "gallery", "art", "art contemporain", "contemporary art", "oeuvre", "oeuvres", "artwork", "artworks", "exposition", "expo", "exhibition", "musee", "museum", "porte", "door", "sculpture", "sculptures", "tableau", "tableaux", "painting", "paintings"];

/** The work the text names, if any. */
export function artworkIn(text: string): Artwork | undefined {
  let best: { id: string; len: number } | null = null;
  for (const [id, words] of Object.entries(ARTWORK_WORDS)) {
    for (const w of words) if (text.includes(` ${w} `) && (!best || w.length > best.len)) best = { id, len: w.length };
  }
  return best ? ARTWORKS.find((a) => a.id === best.id) : undefined;
}

const EYEWEAR_WORDS = ["lunettes", "glasses", "eyewear", "lunetterie", "monture", "montures", "frames", "sunglasses"];

const INTENTS = {
  greeting: ["bonjour", "bonsoir", "salut", "hello", "hi", "hey", "coucou", "good morning", "good evening"],
  thanks: ["merci", "thanks", "thank you", "parfait", "super", "great"],
  who: ["qui es tu", "qui etes vous", "who are you", "ton nom", "votre nom", "your name", "what are you", "robot"],
  help: ["aide", "help", "que peux tu", "que pouvez vous", "what can you", "comment ca marche", "how does it work", "quoi faire"],
  face: ["visage", "face shape", "forme de visage", "my face", "mon visage", "rond", "ovale", "round", "oval", "long", "heart", "coeur", "morphologie"],
  price: ["prix", "combien", "coute", "coutent", "tarif", "price", "prices", "cost", "how much", "cher", "expensive"],
  privacy: ["donnees", "data", "privacy", "vie privee", "confidentialite", "envoye", "uploaded", "stocke", "stored", "securite", "safe"],
  tryOn: ["essayer", "essai", "essayage", "try", "try on", "webcam", "camera", "photo", "selfie", "porter", "wear"],
  look: ["tout essayer", "toute la tenue", "whole look", "everything", "le look", "tenue complete", "total look"],
  cart: ["panier", "cart", "selection", "ma selection", "commande", "basket", "bag"],
  tour: ["visite", "tour", "guide", "guided", "montre moi", "show me around", "faire le tour", "decouvrir", "explore"],
  musicOn: ["musique", "music", "joue", "play music", "ambiance"],
  musicOff: ["coupe la musique", "stop music", "arrete la musique", "mute", "silence"],
  english: ["english", "anglais", "in english", "en anglais"],
  french: ["francais", "french", "en francais", "in french"],
} as const;

const SHAPES = {
  round: { words: ["rond", "ronde", "round"], productId: "studio" },
  oval: { words: ["ovale", "oval"], productId: "aviator" },
  square: { words: ["carre", "carree", "square", "angular", "anguleux"], productId: "crystal" },
  long: { words: ["long", "allonge", "oblong"], productId: "aviator" },
  heart: { words: ["coeur", "heart", "triangle"], productId: "crystal" },
} as const;

const pick = (t: Text, locale: Locale) => t[locale];

/** The piece the text names, if any (the longest matching phrase wins). */
export function productIn(input: string): Product | undefined {
  // "montre-moi" (show me) is not the watch.
  const text = input.replaceAll(" montre moi ", " ");
  let best: { id: string; len: number } | null = null;
  for (const [id, words] of Object.entries(PRODUCT_WORDS)) {
    for (const w of words) if (text.includes(` ${w} `) && (!best || w.length > best.len)) best = { id, len: w.length };
  }
  return best ? getProduct(best.id) : undefined;
}

const PRODUCT_SUGGESTIONS = (p: Product, locale: Locale): Suggestion[] => [
  { label: pick(L("Take me there", "Emmenez-moi"), locale), send: pick(L(`Take me to ${p.name}`, `Emmenez-moi vers ${p.name}`), locale) },
  { label: pick(L("Try it on", "L'essayer"), locale), send: pick(L(`Try on ${p.name}`, `Essayer ${p.name}`), locale) },
  { label: pick(L("Its price", "Son prix"), locale), send: pick(L(`Price of ${p.name}`, `Prix de ${p.name}`), locale) },
];

const DEFAULT_SUGGESTIONS = (locale: Locale): Suggestion[] =>
  [
    L("Start the tour", "Commencer la visite"),
    L("Which glasses suit my face?", "Quelles lunettes pour mon visage ?"),
    L("How does the try-on work?", "Comment marche l'essayage ?"),
    L("Show me the watch", "Montrez-moi la montre"),
    L("Visit the gallery", "Visiter la galerie"),
  ].map((t) => ({ label: pick(t, locale), send: pick(t, locale) }));

const GALLERY_SUGGESTIONS = (locale: Locale): Suggestion[] =>
  (["automates", "pluie-d-or", "fragment"] as const).map((id) => {
    const a = ARTWORKS.find((w) => w.id === id)!;
    return { label: a.title, send: pick(L(`Tell me about ${a.title}`, `Parlez-moi de ${a.title}`), locale) };
  });

const reply = (text: Text, locale: Locale, actions: Action[] = [], suggestions: Suggestion[] = DEFAULT_SUGGESTIONS(locale)): Reply => ({
  text: pick(text, locale),
  actions,
  suggestions,
});

/** The concierge's answer to `input`. */
export function respond(input: string, ctx: Context): Reply {
  const text = normalize(input);
  const { locale } = ctx;
  const product = productIn(text);
  // "From": the base price plus the cheapest value of every option.
  const price = (p: Product) =>
    formatPrice(p.basePrice + p.options.reduce((sum, o) => sum + (o.kind === "choice" ? Math.min(...o.values.map((v) => v.priceDelta ?? 0)) : 0), 0), locale);
  const shape = Object.values(SHAPES).find((s) => has(text, s.words));
  const aboutFace = has(text, ["visage", "face", "morphologie", "face shape", "forme"]);

  if (has(text, INTENTS.english)) return reply(L("Of course, let us continue in English.", "Of course, let us continue in English."), "en", [{ kind: "locale", locale: "en" }], DEFAULT_SUGGESTIONS("en"));
  if (has(text, INTENTS.french)) return reply(L("Avec plaisir, continuons en français.", "Avec plaisir, continuons en français."), "fr", [{ kind: "locale", locale: "fr" }], DEFAULT_SUGGESTIONS("fr"));
  if (has(text, INTENTS.musicOff)) return reply(L("Silence, then. The salon is all yours.", "Le silence, donc. Le salon est à vous."), locale, [{ kind: "music", on: false }]);

  // Walking to a piece: "take me to…", "emmenez-moi…", "où est…".
  if (product && has(text, ["take me", "emmenez moi", "emmene moi", "ou est", "where is", "aller", "go to", "show me", "montrez moi", "montre moi"])) {
    return reply(L(`This way: ${product.name} is waiting for you.`, `Par ici : ${product.name} vous attend.`), locale, [{ kind: "walk", productId: product.id }], PRODUCT_SUGGESTIONS(product, locale));
  }
  // The gallery, and its works.
  const artwork = product ? undefined : artworkIn(text);
  const goPhrases = ["take me", "emmenez moi", "emmene moi", "ou est", "where is", "aller", "go to", "show me", "montrez moi", "montre moi", "voir", "see", "visit", "visiter"];
  if (!product && has(text, SHOW_WORDS) && !has(text, ["tell me", "parlez moi", "parle moi", "about", "c est quoi", "what is"])) {
    return reply(
      L(
        "Take a seat facing the stage: the lights are going down. « Les Trois Automates », a mechanical ballet in five acts.",
        "Installez-vous face à la scène : la lumière baisse. « Les Trois Automates », un ballet mécanique en cinq actes.",
      ),
      locale,
      [{ kind: "show" }],
      GALLERY_SUGGESTIONS(locale),
    );
  }
  if (artwork) {
    const notice = `${artwork.title}, ${artwork.artist}, ${artwork.year}. ${translate(locale, artwork.note)}`;
    const visit: Suggestion = { label: pick(L("Take me there", "Emmenez-moi"), locale), send: pick(L(`Take me to ${artwork.title}`, `Emmenez-moi vers ${artwork.title}`), locale) };
    if (has(text, goPhrases)) {
      return reply(L(`This way, to ${artwork.title}.`, `Par ici, vers ${artwork.title}.`), locale, [{ kind: "visit", artworkId: artwork.id }], GALLERY_SUGGESTIONS(locale));
    }
    return { text: notice, actions: [], suggestions: [visit, ...GALLERY_SUGGESTIONS(locale).slice(0, 2)] };
  }
  if (!product && has(text, GALLERY_WORDS)) {
    return reply(
      L(
        "Behind the entrance doors, our gallery: works you can touch, a kinetic rain of gold and a theatre where three automatons dance. The doors open as you come near. Follow me.",
        "Derrière les portes d'entrée, notre galerie : des œuvres à toucher, une pluie d'or cinétique et un théâtre où dansent trois automates. Les portes s'ouvrent à votre approche. Suivez-moi.",
      ),
      locale,
      [{ kind: "gallery" }],
      GALLERY_SUGGESTIONS(locale),
    );
  }
  if (has(text, INTENTS.look)) {
    if (ctx.cart.length < 2) return reply(L("Add at least two pieces to your selection, then I will dress you in all of them at once.", "Ajoutez au moins deux pièces à votre sélection, je vous les ferai alors porter toutes ensemble."), locale);
    return reply(L("Your whole look, one piece per zone. Face the camera.", "Toute votre tenue, une pièce par zone. Regardez la caméra."), locale, [{ kind: "tryLook" }]);
  }
  if (product && has(text, INTENTS.tryOn)) {
    return reply(L(`Let us try ${product.name}. Face the camera, or choose a photo.`, `Essayons ${product.name}. Regardez la caméra, ou choisissez une photo.`), locale, [{ kind: "tryOn", productId: product.id }]);
  }
  if (product && has(text, INTENTS.price)) {
    return reply(L(`${product.name} starts at ${price(product)}; some finishes add a little.`, `${product.name} commence à ${price(product)} ; certaines finitions ajoutent un peu.`), locale, [], PRODUCT_SUGGESTIONS(product, locale));
  }
  if ((aboutFace && (shape || !product)) || (shape && !product && has(text, INTENTS.face))) {
    if (!shape) {
      return reply(L("Tell me the shape of your face, I will find your frame.", "Dites-moi la forme de votre visage, je trouve votre monture."), locale, [], [
        ...[L("Round", "Rond"), L("Oval", "Ovale"), L("Square", "Carré"), L("Long", "Long")].map((t) => ({ label: pick(t, locale), send: pick(L(`My face is ${t.en.toLowerCase()}`, `Mon visage est ${t.fr.toLowerCase()}`), locale) })),
      ]);
    }
    const p = getProduct(shape.productId)!;
    const why: Record<string, Text> = {
      studio: L("its square line balances soft curves", "sa ligne carrée équilibre les courbes douces"),
      aviator: L("its pilot shape follows a long or oval face without hardening it", "sa forme pilote suit un visage long ou ovale sans le durcir"),
      crystal: L("its lifted cat-eye softens strong angles", "son œil-de-chat relevé adoucit les angles marqués"),
    };
    return reply(L(`I would choose ${p.name}: ${why[p.id].en}.`, `Je choisirais ${p.name} : ${why[p.id].fr}.`), locale, [], PRODUCT_SUGGESTIONS(p, locale));
  }
  if (product) {
    // The piece's advice, in the visitor's language (the catalog translates the registry's English).
    const tip = translate(locale, product.tip ?? product.tagline ?? product.name);
    return { text: tip, actions: [], suggestions: PRODUCT_SUGGESTIONS(product, locale) };
  }
  if (has(text, EYEWEAR_WORDS)) {
    const eyewear = PRODUCTS.filter((p) => p.category === "eyewear");
    return reply(
      L(`Three frames: ${eyewear.map((p) => p.name).join(", ")}. Which one tempts you?`, `Trois montures : ${eyewear.map((p) => p.name).join(", ")}. Laquelle vous tente ?`),
      locale,
      [],
      eyewear.map((p) => ({ label: p.name, send: p.name })),
    );
  }
  if (has(text, INTENTS.price)) {
    return reply(
      L(`From ${formatPrice(Math.min(...PRODUCTS.map((p) => p.basePrice)), locale)} for the beauty pieces to ${formatPrice(Math.max(...PRODUCTS.map((p) => p.basePrice)), locale)} for Chrono Nuit. Name a piece and I will be precise.`, `De ${formatPrice(Math.min(...PRODUCTS.map((p) => p.basePrice)), locale)} pour la beauté à ${formatPrice(Math.max(...PRODUCTS.map((p) => p.basePrice)), locale)} pour Chrono Nuit. Nommez une pièce, je serai précis.`),
      locale,
    );
  }
  if (has(text, INTENTS.privacy)) {
    return reply(L("Nothing leaves your device: tracking runs in your browser, and your camera or photo is never sent anywhere.", "Rien ne quitte votre appareil : le suivi tourne dans votre navigateur, votre caméra ou votre photo ne sont jamais envoyées."), locale);
  }
  if (has(text, INTENTS.tryOn)) {
    return reply(L("Choose a piece, then Try on: your camera, or a photo if you prefer. Everything stays on your device.", "Choisissez une pièce, puis Essayer : votre caméra, ou une photo si vous préférez. Tout reste sur votre appareil."), locale);
  }
  if (has(text, INTENTS.cart)) {
    if (ctx.cart.length === 0) return reply(L("Your selection is still empty. Shall I show you a piece?", "Votre sélection est encore vide. Je vous montre une pièce ?"), locale);
    const total = ctx.cart.reduce((sum, i) => sum + priceOf(i.productId, i.config), 0);
    return reply(L(`${ctx.cart.length} piece(s), ${formatPrice(total, locale)} in all. Here is your selection.`, `${ctx.cart.length} pièce(s), ${formatPrice(total, locale)} au total. Voici votre sélection.`), locale, [{ kind: "openCart" }]);
  }
  if (has(text, INTENTS.tour)) return reply(L("With pleasure. Follow me.", "Avec plaisir. Suivez-moi."), locale, [{ kind: "tour" }]);
  if (has(text, INTENTS.musicOn)) return reply(L("A little music for the salon.", "Un peu de musique pour le salon."), locale, [{ kind: "music", on: true }]);
  if (has(text, ["prisma", "aurum", "le nom", "ton nom de maison", "the name", "pourquoi ce nom", "why the name", "que veut dire", "what does it mean"])) {
    return reply(
      L(
        "Prisma Aurum: the golden prism. White light enters a prism and leaves as all its colors; here, you enter and leave wearing them. Our mark is that prism, under an arch.",
        "Prisma Aurum : le prisme d'or. La lumière blanche entre dans un prisme et en ressort en toutes ses couleurs ; ici, vous entrez et repartez en les portant. Notre emblème est ce prisme, sous une arche.",
      ),
      locale,
    );
  }
  if (has(text, INTENTS.who)) {
    return reply(L("I am the concierge of Maison Prisma Aurum. I know every piece in the salon and every work in the gallery, and I can dress you in the pieces.", "Je suis le concierge de la Maison Prisma Aurum. Je connais chaque pièce du salon et chaque œuvre de la galerie, et je peux vous faire porter les pièces."), locale);
  }
  if (has(text, INTENTS.help)) {
    return reply(L("Ask me about a piece, a price, the frame for your face, or the try-on. I can also guide you through the salon and the gallery.", "Demandez-moi une pièce, un prix, la monture pour votre visage, ou l'essayage. Je peux aussi vous guider dans le salon et la galerie."), locale);
  }
  if (has(text, INTENTS.thanks)) return reply(L("A pleasure. I remain at your service.", "Avec plaisir. Je reste à votre service."), locale);
  if (has(text, INTENTS.greeting)) return reply(L("Good day, and welcome to Maison Prisma Aurum. How may I help you?", "Bonjour, et bienvenue à la Maison Prisma Aurum. Comment puis-je vous aider ?"), locale);
  return reply(L("Forgive me, I did not quite understand. You may ask me about a piece, a price, or your face shape.", "Pardonnez-moi, je n'ai pas bien compris. Demandez-moi une pièce, un prix, ou la forme de votre visage."), locale);
}

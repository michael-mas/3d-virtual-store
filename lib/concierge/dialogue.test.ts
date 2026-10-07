import { describe, expect, it } from "vitest";
import { normalize, productIn, respond, type Context } from "./dialogue";

const en: Context = { locale: "en", cart: [], near: null };
const fr: Context = { locale: "fr", cart: [], near: null };

describe("concierge dialogue", () => {
  it("normalizes case, accents and punctuation", () => {
    expect(normalize("Où est l'Aviateur ?!")).toBe(" ou est l aviateur ");
  });

  it("recognizes pieces by name, kind or family, in both languages", () => {
    expect(productIn(normalize("j'aime la montre"))?.id).toBe("chrono");
    expect(productIn(normalize("a diamond ring"))?.id).toBe("solitaire");
    expect(productIn(normalize("Nuit Lumière"))?.id).toBe("glow-paint");
    expect(productIn(normalize("un bonnet"))?.id).toBe("topper");
    expect(productIn(normalize("hello"))).toBeUndefined();
  });

  it("walks the visitor to a piece, or tries it on", () => {
    expect(respond("Emmenez-moi vers la bague", fr).actions).toEqual([{ kind: "walk", productId: "solitaire" }]);
    expect(respond("Show me the watch", en).actions).toEqual([{ kind: "walk", productId: "chrono" }]);
    expect(respond("Essayer Cristal", fr).actions).toEqual([{ kind: "tryOn", productId: "crystal" }]);
  });

  it("leads to the gallery and tells about its works", () => {
    expect(respond("Montre-moi la galerie", fr).actions).toEqual([{ kind: "gallery" }]);
    expect(respond("Where can I see contemporary art?", en).actions).toEqual([{ kind: "gallery" }]);
    expect(respond("Parlez-moi de Pluie d'or", fr).text).toMatch(/^Pluie d'or, Studio Kaze, 2025\. /);
    expect(respond("Lance le spectacle", fr).actions).toEqual([{ kind: "show" }]);
    expect(respond("Start the performance", en).actions).toEqual([{ kind: "show" }]);
    expect(respond("Tell me about the Three Automatons", en).text).toContain("A mechanical ballet in five acts");
    expect(respond("Tell me about the knot", en).text).toContain("trefoil knot");
    expect(respond("Emmenez-moi vers Monolithe", fr).actions).toEqual([{ kind: "visit", artworkId: "monolithe" }]);
    expect(respond("Montre-moi la montre", fr).actions).toEqual([{ kind: "walk", productId: "chrono" }]);
  });

  it("explains the passport and its collections", () => {
    expect(respond("Comment débloquer la collection Or ?", fr).text).toContain("Six tampons");
  });

  it("explains the house's name", () => {
    expect(respond("Pourquoi ce nom, Prisma Aurum ?", fr).text).toContain("le prisme d'or");
  });

  it("advises a frame from the face shape, and asks for it when missing", () => {
    expect(respond("J'ai un visage rond", fr).text).toContain("Atelier 03");
    expect(respond("my face is square", en).text).toContain("Cristal");
    const ask = respond("Quelles lunettes pour mon visage ?", fr);
    expect(ask.suggestions.map((s) => s.label)).toEqual(["Rond", "Ovale", "Carré", "Long"]);
  });

  it("answers prices, privacy and the cart in the visitor's language", () => {
    expect(respond("Combien coûte le Solitaire ?", fr).text).toMatch(/Solitaire commence à 189,00\s\$/);
    expect(respond("How much is the watch?", en).text).toContain("$249.00");
    expect(respond("Mes données sont envoyées ?", fr).text).toContain("Rien ne quitte votre appareil");
    const cart = { ...en, cart: [{ productId: "aviator", config: { finish: "metal", frameColor: "#c9a44c", lens: "clear" } }] };
    expect(respond("my cart", cart).actions).toEqual([{ kind: "openCart" }]);
    expect(respond("try the whole look", cart).actions).toEqual([]);
  });

  it("gives a piece's advice translated, and switches language on request", () => {
    expect(respond("la montre", fr).text).toContain("Chrono Nuit affiche votre heure réelle");
    expect(respond("in english please", fr).actions).toEqual([{ kind: "locale", locale: "en" }]);
  });

  it("always answers, with suggestions, even when it does not understand", () => {
    const r = respond("qwerty zxcv", fr);
    expect(r.text).toContain("Pardonnez-moi");
    expect(r.suggestions.length).toBeGreaterThan(0);
  });
});

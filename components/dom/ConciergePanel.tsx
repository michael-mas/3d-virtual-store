"use client";

import { useEffect, useRef, useState, type FormEvent } from "react";
import { useT } from "@/hooks/useT";
import { respond, type Action, type Suggestion } from "@/lib/concierge/dialogue";
import { say, speech } from "@/lib/concierge/speech";
import { GALLERY, PEDESTALS } from "@/lib/explore/layout";
import { approachPoint } from "@/lib/explore/movement";
import { player, walkTo } from "@/lib/explore/player";
import { ARTWORKS, getArtwork } from "@/lib/gallery/artworks";
import { startShow } from "@/lib/gallery/stage";
import { getProduct } from "@/lib/products";
import { useAppStore } from "@/store/useAppStore";
import { chooseLocale } from "./LanguageToggle";

/** Seconds the welcome stays before giving way (it also gives way to the first piece's tip). */
const WELCOME_S = 12;
/** Messages kept on screen. */
const HISTORY = 8;

type Message = { from: "concierge" | "visitor"; text: string; id: number };

/** The clock speech is timed on (the 3D face reads the same one). */
const nowSeconds = () => performance.now() / 1000;

/** Speaks a line aloud with a local browser voice, when the visitor turned the voice on (never a network voice). */
function speak(text: string, locale: string, enabled: boolean) {
  if (!enabled || typeof speechSynthesis === "undefined") return;
  speechSynthesis.cancel();
  const voice = speechSynthesis.getVoices().find((v) => v.localService && v.lang.toLowerCase().startsWith(locale));
  if (!voice) return;
  const u = new SpeechSynthesisUtterance(text);
  u.voice = voice;
  u.lang = voice.lang;
  u.rate = 1;
  speechSynthesis.speak(u);
}

/** Carries out what the concierge decided (walk, try on, cart, look, tour, music, language). */
function run(action: Action) {
  const store = useAppStore.getState();
  const pedestal = (id: string) => PEDESTALS.find((p) => p.productId === id);
  switch (action.kind) {
    case "walk": {
      const p = pedestal(action.productId);
      if (p) walkTo(approachPoint(p, player.position, 0.9));
      break;
    }
    case "customize":
    case "tryOn":
      if (store.mode !== "EXPLORE") break;
      store.selectProduct(action.productId);
      store.transition("INTERACT");
      if (action.kind === "tryOn") store.transition("TRY_ON");
      break;
    case "openCart":
      store.setCartOpen(true);
      break;
    case "tryLook":
      store.tryOnLook();
      break;
    case "tour":
      walkTo(approachPoint(PEDESTALS[0], player.position, 0.9));
      break;
    case "gallery":
      // Just inside the doors (they open on the way), before any work.
      walkTo([0, GALLERY.zStart + 0.6]);
      break;
    case "show":
      startShow();
      break;
    case "visit": {
      const work = getArtwork(action.artworkId);
      if (work) walkTo(work.viewpoint);
      break;
    }
    case "music":
      store.setMusicOn(action.on);
      break;
    case "locale":
      chooseLocale(action.locale);
      break;
  }
}

/**
 * The concierge's voice in the interface (EXPLORE). Folded: a card with its welcome, then the advice for the piece
 * in front of the visitor and a guided tour ("Next piece"); in the gallery, the story of the work in front of the
 * visitor and a tour of the works ("Next work"). Open: a conversation in the house's style, with quick
 * replies, a question field and an optional local voice; every reply also moves the android's mouth (lib/concierge/
 * speech.ts) and may act on the boutique (lib/concierge/dialogue.ts). Announced to screen readers.
 */
export default function ConciergePanel() {
  const mode = useAppStore((s) => s.mode);
  const ready = useAppStore((s) => s.sceneReady && s.entered);
  const near = useAppStore((s) => (s.mode === "EXPLORE" ? s.nearPedestal : null));
  const nearWork = useAppStore((s) => (s.mode === "EXPLORE" ? s.nearArtwork : null));
  const inGallery = useAppStore((s) => s.mode === "EXPLORE" && s.inGallery);
  const showPlaying = useAppStore((s) => s.showPlaying);
  const locale = useAppStore((s) => s.locale);
  const t = useT();
  const [welcome, setWelcome] = useState(true);
  const [open, setOpen] = useState(false);
  const [voice, setVoice] = useState(false);
  const [draft, setDraft] = useState("");
  const [messages, setMessages] = useState<Message[]>([]);
  const [suggestions, setSuggestions] = useState<Suggestion[]>([]);
  const nextId = useRef(0);
  const list = useRef<HTMLOListElement>(null);
  const input = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (!ready) return;
    const timer = setTimeout(() => setWelcome(false), WELCOME_S * 1000);
    return () => clearTimeout(timer);
  }, [ready]);

  // The face moves with each line the concierge says, folded or open.
  const greeting = welcome && !near && !inGallery;
  const product = near ? getProduct(near) : undefined;
  const work = nearWork ? getArtwork(nearWork) : undefined;
  const line = work
    ? t(work.note)
    : inGallery
      ? t("Welcome to the gallery. Touch the works, walk beneath the rain of gold, and at the back, three automatons wait for you to take a seat.")
      : greeting
        ? t("Welcome to Maison Prisma Aurum. Walk up to any piece and I will present it.")
        : product?.tip
          ? t(product.tip)
          : null;
  useEffect(() => {
    if (line && ready && mode === "EXPLORE") say(line, nowSeconds());
  }, [line, ready, mode]);

  useEffect(() => {
    list.current?.lastElementChild?.scrollIntoView({ block: "end" });
  }, [messages]);

  if (mode !== "EXPLORE" || !ready || showPlaying) return null;

  const push = (...added: Omit<Message, "id">[]) =>
    setMessages((m) => [...m, ...added.map((a) => ({ ...a, id: nextId.current++ }))].slice(-HISTORY));

  const ask = (question: string) => {
    const q = question.trim();
    if (!q) return;
    const s = useAppStore.getState();
    const answer = respond(q, { locale: s.locale, cart: s.items, near: s.nearPedestal });
    push({ from: "visitor", text: q }, { from: "concierge", text: answer.text });
    setSuggestions(answer.suggestions);
    say(answer.text, nowSeconds());
    speak(answer.text, useAppStore.getState().locale, voice);
    answer.actions.forEach(run);
  };
  const submit = (e: FormEvent) => {
    e.preventDefault();
    ask(draft);
    setDraft("");
  };
  const openChat = () => {
    setOpen(true);
    if (messages.length === 0) {
      const hello = respond(locale === "fr" ? "bonjour" : "hello", { locale, cart: [], near: null });
      push({ from: "concierge", text: hello.text });
      setSuggestions(hello.suggestions);
      say(hello.text, nowSeconds());
    }
    requestAnimationFrame(() => input.current?.focus());
  };

  if (!open) {
    const chip = (className = "") => (
      <button
        type="button"
        onClick={openChat}
        data-testid="concierge-open"
        className={`chip fixed bottom-16 left-4 z-30 rounded-full px-4 py-2.5 sm:bottom-20 sm:left-6 ${className}`}
      >
        {t("Talk with the concierge")}
      </button>
    );
    if (!line) return chip();
    // Phones, in the gallery: no card over the works (the label carries each work's story); the chip, away from them.
    const phoneChip = inGallery && !nearWork ? chip("sm:hidden") : null;
    const index = near ? PEDESTALS.findIndex((p) => p.productId === near) : -1;
    const next = PEDESTALS[(index + 1) % PEDESTALS.length];
    const nextWork = ARTWORKS[(work ? ARTWORKS.indexOf(work) + 1 : 0) % ARTWORKS.length];
    return (
      <>
        {phoneChip}
        <aside
          aria-label={t("Your concierge")}
          data-testid="concierge"
          className={`panel fixed bottom-16 left-3 z-30 w-[min(20rem,calc(100vw-1.5rem))] rounded-sm px-3 py-2 sm:bottom-20 sm:left-6 sm:px-4 sm:py-3 ${inGallery ? "max-sm:hidden" : ""}`}
        >
          <p className="eyebrow mb-1 hidden text-[0.55rem] text-gold sm:block">{t("Your concierge")}</p>
          <p role="status" className="line-clamp-3 font-display text-[0.85rem] leading-snug text-ivory italic sm:line-clamp-none sm:text-[0.95rem]">
            {line}
          </p>
          <div className="mt-2 flex flex-wrap items-center gap-x-4 gap-y-1">
            {inGallery ? (
              <button
                type="button"
                onClick={() => walkTo(nextWork.viewpoint)}
                className="eyebrow text-[0.6rem] text-gold-light underline-offset-4 hover:underline"
              >
                {t("Next work: {title}", { title: nextWork.title })} →
              </button>
            ) : (
              <button
                type="button"
                onClick={() => walkTo(approachPoint(greeting ? PEDESTALS[0] : next, player.position, 0.9))}
                className="eyebrow text-[0.6rem] text-gold-light underline-offset-4 hover:underline"
              >
                {greeting ? t("Begin the tour") : t("Next piece: {name}", { name: getProduct(next.productId)?.name ?? "" })} →
              </button>
            )}
            <button type="button" onClick={openChat} className="eyebrow text-[0.6rem] underline-offset-4 hover:text-ivory hover:underline">
              {t("Talk")}
            </button>
          </div>
        </aside>
      </>
    );
  }

  return (
    <aside
      aria-label={t("Conversation with the concierge")}
      data-testid="concierge-chat"
      className="panel fixed bottom-16 left-4 z-30 flex max-h-[min(30rem,60dvh)] w-[min(23rem,calc(100vw-2rem))] flex-col rounded-sm sm:bottom-20 sm:left-6"
    >
      <header className="flex items-center justify-between border-b border-gold/20 px-4 py-3">
        <p className="eyebrow text-[0.6rem] text-gold">{t("Your concierge")}</p>
        <div className="flex items-center gap-3">
          <button
            type="button"
            aria-pressed={voice}
            onClick={() => {
              setVoice(!voice);
              if (voice) speechSynthesis?.cancel();
            }}
            className={`eyebrow text-[0.55rem] ${voice ? "text-gold-light" : "hover:text-ivory"}`}
          >
            {t(voice ? "Voice on" : "Voice off")}
          </button>
          <button
            type="button"
            aria-label={t("Close the conversation")}
            onClick={() => {
              setOpen(false);
              speech.current = null;
            }}
            className="eyebrow text-[0.55rem] hover:text-ivory"
          >
            {t("Close")}
          </button>
        </div>
      </header>
      <ol ref={list} role="log" aria-live="polite" className="flex-1 space-y-3 overflow-y-auto px-4 py-3">
        {messages.map((m) => (
          <li key={m.id} className={m.from === "visitor" ? "flex justify-end" : undefined}>
            {m.from === "concierge" ? (
              <p className="font-display text-[0.95rem] leading-snug text-ivory italic">{m.text}</p>
            ) : (
              <p className="max-w-[85%] rounded-sm bg-ivory/10 px-3 py-1.5 text-sm text-ivory/90">{m.text}</p>
            )}
          </li>
        ))}
      </ol>
      {suggestions.length > 0 && (
        <div className="flex flex-wrap gap-1.5 px-4 pb-2">
          {suggestions.map((s) => (
            <button
              key={s.send}
              type="button"
              onClick={() => ask(s.send)}
              className="rounded-full px-2.5 py-1 text-[0.7rem] tracking-wide text-ivory/80 ring-1 ring-gold/30 hover:text-ivory hover:ring-gold/70"
            >
              {s.label}
            </button>
          ))}
        </div>
      )}
      <form onSubmit={submit} className="flex items-center gap-2 border-t border-gold/20 px-3 py-2.5">
        <input
          ref={input}
          value={draft}
          onChange={(e) => setDraft(e.target.value)}
          placeholder={t("Ask the concierge…")}
          aria-label={t("Ask the concierge…")}
          className="min-w-0 flex-1 bg-transparent px-1 py-1 text-sm text-ivory placeholder:text-taupe focus:outline-none"
          maxLength={200}
        />
        <button type="submit" className="btn-gold rounded-sm px-3 py-1.5 text-[0.6rem]">
          {t("Send")}
        </button>
      </form>
    </aside>
  );
}

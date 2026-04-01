import { marked } from "marked";

import type { Deck, DeckSlide, ThemeDefinition } from "@presentation/domain";

function escapeHtml(value: string): string {
  return value
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#39;");
}

function renderSourceChips(sourceIds: string[]): string {
  if (sourceIds.length === 0) {
    return "";
  }

  return `<div class="sources">${sourceIds.map((sourceId) => `<span class="source-chip">${escapeHtml(sourceId)}</span>`).join("")}</div>`;
}

function renderSlideBody(slide: DeckSlide): string {
  if (slide.body?.trim()) {
    return marked.parse(slide.body) as string;
  }

  if (slide.bullets && slide.bullets.length > 0) {
    return `<ul>${slide.bullets.map((bullet) => `<li>${escapeHtml(bullet)}</li>`).join("")}</ul>`;
  }

  return "";
}

function renderSlide(slide: DeckSlide, index: number, total: number): string {
  const kicker = slide.kicker ? `<p class="slide-kicker">${escapeHtml(slide.kicker)}</p>` : "";
  const notes = slide.notes ? `<details class="speaker-notes"><summary>Speaker notes</summary><pre>${escapeHtml(slide.notes)}</pre></details>` : "";

  return `
    <section class="slide slide-${slide.layout}" data-slide-index="${index}">
      <div class="slide-shell">
        <header class="slide-header">
          ${kicker}
          <div class="slide-meta">
            <span>${String(index + 1).padStart(2, "0")} / ${String(total).padStart(2, "0")}</span>
          </div>
        </header>
        <div class="slide-body">
          <h2>${escapeHtml(slide.title)}</h2>
          <div class="slide-copy">
            ${renderSlideBody(slide)}
          </div>
        </div>
        <footer class="slide-footer">
          ${renderSourceChips(slide.sourceIds)}
          ${notes}
        </footer>
      </div>
    </section>
  `;
}

function renderStyles(theme: ThemeDefinition): string {
  return `
    :root {
      --bg: ${theme.colors.background};
      --bg-alt: ${theme.colors.backgroundAlt};
      --panel: ${theme.colors.panel};
      --panel-alt: ${theme.colors.panelAlt};
      --text: ${theme.colors.text};
      --muted: ${theme.colors.muted};
      --accent: ${theme.colors.accent};
      --accent-soft: ${theme.colors.accentSoft};
      --border: ${theme.colors.border};
      --shadow: ${theme.colors.shadow};
      --font-heading: ${theme.fonts.heading};
      --font-body: ${theme.fonts.body};
      --font-mono: ${theme.fonts.mono};
    }

    * {
      box-sizing: border-box;
    }

    html {
      scroll-behavior: smooth;
    }

    body {
      margin: 0;
      min-height: 100vh;
      font-family: var(--font-body);
      color: var(--text);
      background:
        radial-gradient(circle at top left, var(--accent-soft), transparent 28%),
        linear-gradient(135deg, var(--bg), var(--bg-alt));
    }

    .chrome {
      position: fixed;
      top: 0;
      left: 0;
      right: 0;
      z-index: 20;
      display: flex;
      justify-content: space-between;
      align-items: center;
      padding: 1rem 1.5rem;
      pointer-events: none;
    }

    .brand,
    .counter {
      display: inline-flex;
      align-items: center;
      gap: 0.5rem;
      padding: 0.5rem 0.85rem;
      border: 1px solid color-mix(in srgb, var(--border) 80%, transparent);
      border-radius: 999px;
      background: color-mix(in srgb, var(--panel) 84%, transparent);
      backdrop-filter: blur(14px);
      font-size: 0.82rem;
      color: var(--muted);
      pointer-events: auto;
    }

    .deck {
      min-height: 100vh;
      display: grid;
      gap: 2rem;
      padding: 5rem 1.5rem 3rem;
    }

    .slide {
      min-height: calc(100vh - 8rem);
      display: grid;
      place-items: center;
      scroll-snap-align: start;
    }

    .slide-shell {
      width: min(92vw, 1560px);
      min-height: min(86vh, 880px);
      display: grid;
      grid-template-rows: auto 1fr auto;
      gap: 1.4rem;
      padding: clamp(1.5rem, 2vw, 2.4rem);
      border-radius: 32px;
      border: 1px solid color-mix(in srgb, var(--border) 84%, transparent);
      background:
        linear-gradient(180deg, color-mix(in srgb, var(--panel) 92%, white 8%), color-mix(in srgb, var(--panel-alt) 96%, white 4%));
      box-shadow: 0 20px 80px var(--shadow);
      position: relative;
      overflow: hidden;
    }

    .slide-shell::before {
      content: "";
      position: absolute;
      inset: 0;
      background:
        linear-gradient(120deg, transparent 0%, transparent 62%, color-mix(in srgb, var(--accent-soft) 60%, transparent) 100%);
      opacity: 0.55;
      pointer-events: none;
    }

    .slide-header,
    .slide-footer,
    .slide-body {
      position: relative;
      z-index: 1;
    }

    .slide-header,
    .slide-footer {
      display: flex;
      align-items: flex-start;
      justify-content: space-between;
      gap: 1rem;
    }

    .slide-kicker {
      margin: 0;
      text-transform: uppercase;
      letter-spacing: 0.14em;
      font-size: 0.82rem;
      color: var(--accent);
      font-weight: 700;
    }

    .slide-meta {
      color: var(--muted);
      font-size: 0.88rem;
    }

    .slide-body {
      display: grid;
      align-content: start;
      gap: 1.5rem;
      max-width: 78ch;
    }

    .slide-title .slide-body,
    .slide-closing .slide-body {
      align-content: center;
      max-width: 60ch;
    }

    h1,
    h2,
    h3 {
      margin: 0;
      font-family: var(--font-heading);
      letter-spacing: -0.04em;
      line-height: 0.94;
      font-weight: 700;
    }

    .slide-title h2,
    .slide-closing h2 {
      font-size: clamp(3.5rem, 7vw, 7rem);
    }

    .slide-agenda h2,
    .slide-content h2,
    .slide-summary h2 {
      font-size: clamp(2.4rem, 5vw, 4.7rem);
    }

    .slide-copy {
      color: var(--text);
      font-size: clamp(1.02rem, 1.5vw, 1.24rem);
      line-height: 1.65;
    }

    .slide-copy p {
      margin: 0 0 1rem;
      max-width: 65ch;
    }

    .slide-copy ul {
      margin: 0;
      padding: 0;
      list-style: none;
      display: grid;
      gap: 0.85rem;
    }

    .slide-copy li {
      display: grid;
      grid-template-columns: 1rem 1fr;
      gap: 0.85rem;
      align-items: start;
    }

    .slide-copy li::before {
      content: "";
      width: 0.7rem;
      height: 0.7rem;
      margin-top: 0.55rem;
      border-radius: 999px;
      background: var(--accent);
      box-shadow: 0 0 0 6px color-mix(in srgb, var(--accent-soft) 76%, transparent);
    }

    .slide-copy code,
    .speaker-notes pre {
      font-family: var(--font-mono);
    }

    .sources {
      display: flex;
      flex-wrap: wrap;
      gap: 0.55rem;
    }

    .source-chip {
      display: inline-flex;
      align-items: center;
      gap: 0.35rem;
      padding: 0.45rem 0.7rem;
      border-radius: 999px;
      border: 1px solid color-mix(in srgb, var(--border) 90%, transparent);
      background: color-mix(in srgb, var(--panel-alt) 92%, transparent);
      color: var(--muted);
      font-size: 0.8rem;
    }

    .speaker-notes {
      max-width: 28rem;
      color: var(--muted);
      font-size: 0.85rem;
    }

    .speaker-notes summary {
      cursor: pointer;
      user-select: none;
    }

    .speaker-notes pre {
      margin: 0.6rem 0 0;
      white-space: pre-wrap;
      line-height: 1.5;
    }

    @media (max-width: 960px) {
      .deck {
        padding-top: 4.5rem;
      }

      .slide-shell {
        min-height: calc(100vh - 6rem);
      }

      .slide-header,
      .slide-footer {
        flex-direction: column;
      }
    }

    @media print {
      body {
        background: white;
      }

      .chrome,
      .speaker-notes {
        display: none;
      }

      .deck {
        padding: 0;
        gap: 0;
      }

      .slide {
        min-height: auto;
        page-break-after: always;
      }

      .slide-shell {
        width: 100%;
        min-height: auto;
        border-radius: 0;
        box-shadow: none;
        border: none;
      }
    }
  `;
}

function renderScript(deck: Deck): string {
  return `
    const slides = [...document.querySelectorAll('.slide')];
    const counter = document.querySelector('[data-role="counter"]');
    const title = ${JSON.stringify(deck.title)};

    function updateCounter() {
      const viewportCenter = window.scrollY + window.innerHeight / 2;
      let active = slides[0];

      for (const slide of slides) {
        const box = slide.getBoundingClientRect();
        const absoluteTop = window.scrollY + box.top;
        if (absoluteTop <= viewportCenter) {
          active = slide;
        }
      }

      const index = Number(active?.dataset.slideIndex ?? 0);
      if (counter) {
        counter.textContent = title + '  |  ' + String(index + 1).padStart(2, '0') + ' / ' + String(slides.length).padStart(2, '0');
      }
    }

    function jump(direction) {
      const viewportCenter = window.scrollY + window.innerHeight / 2;
      let currentIndex = 0;
      for (const slide of slides) {
        const box = slide.getBoundingClientRect();
        const absoluteTop = window.scrollY + box.top;
        if (absoluteTop <= viewportCenter) {
          currentIndex = Number(slide.dataset.slideIndex ?? 0);
        }
      }

      const nextIndex = Math.max(0, Math.min(slides.length - 1, currentIndex + direction));
      slides[nextIndex]?.scrollIntoView({ behavior: 'smooth', block: 'start' });
    }

    window.addEventListener('scroll', updateCounter, { passive: true });
    window.addEventListener('keydown', (event) => {
      if (event.key === 'ArrowRight' || event.key === 'PageDown' || event.key === ' ') {
        event.preventDefault();
        jump(1);
      }

      if (event.key === 'ArrowLeft' || event.key === 'PageUp') {
        event.preventDefault();
        jump(-1);
      }
    });

    updateCounter();
  `;
}

export function renderDeckHtml(deck: Deck, theme: ThemeDefinition): string {
  return `<!doctype html>
<html lang="en">
  <head>
    <meta charset="utf-8" />
    <meta name="viewport" content="width=device-width, initial-scale=1" />
    <title>${escapeHtml(deck.title)}</title>
    <style>${renderStyles(theme)}</style>
  </head>
  <body>
    <div class="chrome">
      <div class="brand">${escapeHtml(theme.name)}</div>
      <div class="counter" data-role="counter">${escapeHtml(deck.title)}</div>
    </div>
    <main class="deck">
      ${deck.slides.map((slide, index) => renderSlide(slide, index, deck.slides.length)).join("\n")}
    </main>
    <script>${renderScript(deck)}</script>
  </body>
</html>`;
}

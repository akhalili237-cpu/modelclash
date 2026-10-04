<div align="center">

# ⚔️ ModelClash

**Free AI models. Zero setup. May the best model win.**

An open, 100% client-side AI arena — a personal, no-friction alternative to LMArena.
No account. No API key. No backend. Open the URL and start battling.

[![License: MIT](https://img.shields.io/badge/License-MIT-f97316.svg)](LICENSE)
[![Deploy with GitHub Pages](https://img.shields.io/badge/Deploy-GitHub%20Pages-262637?logo=github)](#-deploy-your-own-in-60-seconds)
[![PRs Welcome](https://img.shields.io/badge/PRs-welcome-ec4899.svg)](#-contributing)
[![No login](https://img.shields.io/badge/login-none-success)](#-why-modelclash)
[![No API key](https://img.shields.io/badge/API%20key-not%20needed-success)](#-why-modelclash)

</div>

---

## 🎬 Demo

> ![ModelClash demo](docs/demo.gif)
> <!-- TODO: add a short GIF here — record with any screen recorder, ~15 s:
>      open Blind Battle → send a prompt → vote → reveal → leaderboard update -->

## 🤔 Why ModelClash?

| | LMArena | ModelClash |
|---|---|---|
| Login required | ❌ yes | ✅ none |
| API key needed | ❌ no | ❌ no (optional BYOK) |
| Cost | free (rate-limited) | free (rate-limited) |
| Your battle history | on their servers | ✅ only on your device (IndexedDB) |
| ELO from *your* prompts | community-wide | ✅ 100% yours, per category |
| Works offline | ❌ | ✅ PWA + local WebGPU models |
| Self-hostable | ❌ | ✅ one click, GitHub Pages |
| Installable app | ❌ | ✅ PWA (desktop + mobile) |

**The idea:** LMArena's leaderboard reflects everyone's votes. ModelClash builds an
ELO leaderboard from *your own* votes on *your own* prompts — so it tells you which
model is best **for you**, for coding, math, creative writing, or reasoning.

## ✨ Features

- **💬 Direct Chat** — one model, streaming markdown answers, regenerate, export `.md`,
  voice input (Web Speech), read-aloud (TTS), prompt library, chat history.
- **🎭 Blind Battle** — two anonymous models answer the same prompt side by side.
  Vote (A / B / tie / both-bad) → names revealed → ELO updated → shareable PNG battle report.
- **🏆 Tournament** — 4 or 8-model single-elimination bracket, same prompt every match,
  vote your way to a champion (final counts **double ELO**), confetti included.
- **🖼️ Image Arena** — any two image engines (free Pollinations models or BYOK Imagen 4 / Nano Banana) draw the same idea; vote and keep a gallery.
- **📈 Leaderboard** — your personal ELO table (K=32, start 1200), per-category tabs
  (General / Coding / Creative / Math / Reasoning / Images), sortable, resettable.
- **⚖️ Compare** — one prompt → up to 4 models in a grid → **continue the conversation with the winner**.
- **🔒 Local models** — WebGPU (web-llm) models run fully offline in the browser; nothing leaves your device.
- **🗣️ Voice in, voice out** — speech-to-text dictation and text-to-speech playback.
- **🌍 14 languages** — English, فارسی, العربية, 简体中文, Español, Français, Deutsch, Русский,
  Português (BR), हिन्दी, Türkçe, 日本語, 한국어, Bahasa Indonesia — with full **RTL** support.
  Optional "force AI to answer in my language" switch.
- **📱 PWA** — installable, offline-capable, app shortcuts (Chat / Battle / Leaderboard).
- **⌨️ Shortcuts** — `Ctrl+K` focus prompt · `Ctrl+B` Blind Battle · `Ctrl+T` Tournament · `Esc` close.
- **🧯 Resilience** — 429 auto-retry ("free tier busy — retrying in 5 s"), stream-break fallback to
  non-streaming, 90 s idle timeout, friendly key/5xx/network errors, one-tap "try another model".

## 🧠 How it works (the free tier)

ModelClash ships **key-less by default** through [Pollinations.AI](https://pollinations.ai) —
an open, free, no-key gateway to openai-compatible models. Zero configuration.

Three model tiers, mixed and matched freely in every mode:

| Tier | Provider | Key? | Notes |
|---|---|---|---|
| 0 | **Pollinations** (default) | ❌ none | works instantly; optional key raises limits |
| 1 | **Local WebGPU** (web-llm) | ❌ none | Llama 3.2 / Qwen2.5 / TinyLlama run **offline** in your browser |
| 2 | **OpenRouter · Groq · Gemini** | 🔑 your own | paste a key in Settings (stored only on your device) |

**Frontier catalog (October 2026)** — OpenRouter ships the full live catalog; the curated
defaults include **GPT-5.5 / GPT-5.5 Pro / GPT-5.4 Mini**, **Claude Opus 5.5 / Sonnet 5.5 /
Haiku 4.5**, **Gemini 3.1 Pro / 3.8 Flash**, **Grok 4.7**, **DeepSeek V4.1 / R1**, plus
currently-free open weights (Qwen 3.8, Nemotron 3 Ultra 550B, Gemma 4). Groq adds
GPT-OSS 120B/20B at absurd speed; Gemini API adds **Gemini 3 Pro / 2.5 Pro**.

**Images:** the Image Arena supports every Pollinations engine (live catalog: Sana, Flux,
Turbo, Nano Banana, Kontext, Seedream — availability depends on your tier/token) *and*
Google **Imagen 4 Ultra / Imagen 4 Fast / Nano Banana (gemini-2.5-flash-image)** with your
free Gemini key, with aspect-ratio control (1:1 · 4:3 · 3:4 · 16:9 · 9:16) and one-click
download.

> 🔐 **Privacy:** there is no server. Prompts go directly from your browser to the model
> provider you picked. Chats, battles, galleries and ELO ratings live in your browser's
> IndexedDB/localStorage. API keys never leave localStorage — the app ships with **no keys at all**.

## 🚀 Deploy your own in 60 seconds

1. **Create a repo** from this template (or push the folder to a new repo).
2. **Settings → Pages → Source: GitHub Actions.**
3. Push to `main` (or run the workflow manually). Done — the included
   [`.github/workflows/deploy.yml`](.github/workflows/deploy.yml) builds and publishes automatically.

Your arena is live at `https://<user>.github.io/<repo>/`.

### Run locally

```bash
npm install
npm run dev        # http://localhost:5173
npm run build      # production build → dist/
npm run preview    # preview the production build
```

> Requires Node 18+. For local WebGPU models use Chrome/Edge 113+ (or any WebGPU browser).

## 🧭 The modes

| Mode | What you do |
|---|---|
| 💬 **Direct Chat** | Talk to one model. Markdown, code blocks, regenerate, export, voice. |
| 🎭 **Blind Battle** | The classic: anonymous A vs B, you be the judge, ELO follows. |
| 🏆 **Tournament** | Crown a champion across a 4/8 bracket with one prompt per round. |
| 🖼️ **Image Arena** | Two image models, same prompt, pick the better picture — flux, sana, Imagen 4, Nano Banana… |
| 📈 **Leaderboard** | Your personal ELO rankings — filter by category, sort, reset. |
| ⚖️ **Compare** | 2–4 models at once, then continue chatting with your favorite. |

## 🛠️ Tech stack

[![Vite](https://img.shields.io/badge/Vite-5-646CFF?logo=vite&logoColor=white)](https://vitejs.dev)
[![React](https://img.shields.io/badge/React-18-61DAFB?logo=react&logoColor=black)](https://react.dev)
[![TypeScript](https://img.shields.io/badge/TypeScript-5-3178C6?logo=typescript&logoColor=white)](https://www.typescriptlang.org)
[![Tailwind](https://img.shields.io/badge/Tailwind-3-06B6D4?logo=tailwindcss&logoColor=white)](https://tailwindcss.com)
[![PWA](https://img.shields.io/badge/PWA-vite--plugin--pwa-5A0FC8)](https://vite-pwa-org.netlify.app)

- **Vite + React 18 + TypeScript + Tailwind CSS** — fast, tiny, no runtime CSS framework.
- **web-llm** (@mlc-ai) — WebGPU inference in a Web Worker for offline local models.
- **idb-keyval** — IndexedDB for chats/battles/gallery/prompt library.
- **Hand-rolled** ELO engine, SSE parser, markdown renderer and i18n runtime — no heavy deps.

### Project structure

```
src/
├── providers/        # Pollinations · web-llm · OpenRouter · Groq · Gemini + registry
├── lib/              # sse/openai streaming · resilience · elo · storage · voice · share
├── i18n/             # runtime + locales/ (14 × JSON — add a language = 1 file + 1 line)
├── modes/            # DirectChat · BlindBattle · Tournament · ImageArena · Leaderboard · Compare
├── components/       # ModelPicker · ChatInput · Markdown · Settings · PromptLibrary · ui kit
├── workers/          # webllm.worker.ts (WebGPU inference off the main thread)
├── store/            # app context: settings, keys, toasts, routing
└── types.ts
```

## 🗺️ Roadmap

- [ ] Vision models in Blind Battle (image inputs)
- [ ] Import/export full ELO state as JSON
- [ ] Share tournament brackets as PNG
- [ ] More image engines in the Image Arena
- [ ] Optional passcode-protected hosted mode (for teams)
- [ ] Voice-to-battle (speak your prompt, judge aloud)

## 🤝 Contributing

PRs welcome! The two easiest contribution paths:

1. **Translations** — copy `src/i18n/locales/en.json`, translate the values, save as
   `xx-XX.json`, then add one line in `src/i18n/index.tsx`. Run `npm run check:locales`
   to verify key parity.
2. **Providers** — implement the tiny `ChatProvider` interface in `src/providers/`,
   register it in `registry.ts`, done (it automatically appears in every mode).

```bash
npm install
npm run dev
npm run build && npm run check:locales   # must pass before PR
```

## 📜 License

[MIT](LICENSE) — do whatever you want, no warranty.

## ⭐ Star History

[![Star History Chart](https://api.star-history.com/svg?repos=YOUR_USER/modelclash&type=Date)](https://star-history.com/#YOUR_USER/modelclash&Date)

---

<div align="center">
<sub>Built for people who ask "which model is actually better?" and want their own answer.</sub>
</div>

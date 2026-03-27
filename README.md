# Clickbait Killer — Free YouTube Summary

A 100% free & open-source Chrome extension that summarizes YouTube videos using AI, so you don't have to sit through 10 minutes of clickbait to get the actual information.

![Chrome Extension](https://img.shields.io/badge/Chrome-Extension-blue?logo=googlechrome)
![License](https://img.shields.io/badge/License-MIT-green)
![Open Source](https://img.shields.io/badge/Open%20Source-100%25-brightgreen)

## Why?

YouTube summary extensions exist, but they're all freemium with only a few summaries per day. This one is **completely free and open source**. Bring your own API key (or don't — you can redirect to free LLM interfaces).

## Features

- **Side panel** injected directly into YouTube, next to the video
- **Two modes:**
  - **Direct summary (API)** — get the summary right in the page with streaming, token by token
  - **Open in LLM** — opens Claude, ChatGPT, Gemini, or Grok with the transcript auto-injected
- **4 API providers:** Anthropic (Claude), OpenAI (GPT), Google (Gemini), xAI (Grok)
- **Custom model support** — free text field, future-proof for new models
- **8 languages** supported for summaries
- **Full markdown rendering** in summaries
- **Dark & light theme** — follows YouTube's theme
- **Clickbait detection** built into the prompt
- **SPA navigation** handled (YouTube doesn't reload between videos)
- **Preferences saved** and synced across devices

## Install

1. Clone this repo (or download as ZIP)
2. Open `chrome://extensions/` in Chrome
3. Enable **Developer mode** (toggle top-right)
4. Click **Load unpacked** and select the project folder
5. Go to any YouTube video — the panel appears on the right

## Configuration

Click the extension icon to configure:

- **Provider & Model** — choose your API provider and model
- **API Key** — required only for "Direct summary" mode. Stored locally, never shared.
- **Default language** — the language for summaries
- **Default mode** — direct summary or open in an LLM

### Cost estimates (Direct summary mode)

| Provider | Cheapest model | Cost per summary |
|----------|---------------|-----------------|
| Anthropic | Claude Haiku 4.5 | ~$0.01 |
| OpenAI | GPT-4o mini | ~$0.01 |
| Google | Gemini 2.5 Flash Lite | ~$0.005 |
| xAI | Grok 4.1 Fast | ~$0.01 |

### Free mode (no API key needed)

Select "Open in Claude/ChatGPT/Gemini/Grok" mode. The extension extracts the transcript, opens the LLM in a new tab, and auto-injects the prompt. Just hit Enter.

## How it works

1. **Transcript extraction** — reads YouTube's caption tracks via the InnerTube API (handles the POT token requirement since mid-2025)
2. **Summarization** — sends the transcript to your chosen LLM with a structured prompt
3. **Rendering** — displays the markdown summary with streaming in the side panel

## Project structure

```
├── manifest.json        # Chrome Extension Manifest V3
├── background.js        # Service worker — streaming API calls
├── content.js           # Injects the summary panel into YouTube
├── page-script.js       # MAIN world script — extracts transcripts
├── injector.js          # Injects prompts into LLM chat inputs
├── styles.css           # Panel styling (dark + light theme)
├── popup.html           # Extension popup (settings)
├── options.js           # Settings logic (shared by popup)
├── lib/marked.min.js    # Markdown parser
└── icons/               # Extension icons
```

## Tech stack

- **Vanilla JS** — no build step, no framework, no dependencies (except marked.js for markdown)
- **Manifest V3** — modern Chrome extension standard
- **Streaming SSE** — real-time token-by-token display

## License

MIT — do whatever you want with it.

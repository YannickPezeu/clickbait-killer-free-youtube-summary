# Privacy Policy — Clickbait Killer

**Last updated:** March 30, 2026

## Summary

Clickbait Killer does **not** collect, store, or transmit any personal data. Everything stays on your device.

## Data handling

### What the extension stores locally

- **User preferences**: chosen language, mode, API provider, and model name (via `chrome.storage.sync`)
- **API key**: your API key for AI providers, stored locally in your browser (via `chrome.storage.sync`). It is never sent anywhere except directly to the API provider you selected.
- **Temporary transcript data**: when using "Open in LLM" mode, the video transcript is temporarily stored in `chrome.storage.local` to pass it to the target site's tab. It is deleted immediately after use.

### What the extension sends externally

- **To AI providers (only in "Direct summary" mode)**: the video transcript and your API key are sent directly to the API provider you configured (Anthropic, OpenAI, Google, or xAI). This only happens when you click "Summarize" and have configured an API key.
- **To YouTube**: the extension fetches video subtitle data from YouTube's servers to extract the transcript.
- **To LLM chat sites (only in "Open in LLM" mode)**: the transcript is injected into the chat input field on the site you selected (Claude, ChatGPT, Gemini, or Grok).

### What the extension does NOT do

- Does not collect analytics or telemetry
- Does not track browsing history
- Does not use cookies
- Does not create user accounts
- Does not share data with third parties
- Does not store any data on external servers
- Does not serve advertisements

## Open source

This extension is fully open source. You can inspect all the code at:
https://github.com/YannickPezeu/clickbait-killer-free-youtube-summary

## Contact

If you have questions about this privacy policy, please open an issue on the GitHub repository:
https://github.com/YannickPezeu/clickbait-killer-free-youtube-summary/issues

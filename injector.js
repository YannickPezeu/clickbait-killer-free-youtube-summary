// Injector — runs on Claude, ChatGPT, Gemini pages.
// Reads a pending prompt from chrome.storage and injects it into the chat input.

(async function () {
  "use strict";

  console.log("[YT-Summary][Injector] Script loaded on", window.location.hostname);

  // Check if there's a pending prompt
  const { ytsPendingPrompt } = await chrome.storage.local.get("ytsPendingPrompt");
  console.log("[YT-Summary][Injector] Pending prompt:", !!ytsPendingPrompt);
  if (!ytsPendingPrompt) return;

  const { prompt, target, timestamp } = ytsPendingPrompt;
  console.log("[YT-Summary][Injector] Target:", target, "Age:", Date.now() - timestamp, "ms");

  // Ignore if older than 60 seconds (stale)
  if (Date.now() - timestamp > 60000) {
    console.log("[YT-Summary][Injector] Prompt too old, ignoring");
    await chrome.storage.local.remove("ytsPendingPrompt");
    return;
  }

  // Verify we're on the right site
  const host = window.location.hostname;
  const siteMatch =
    (target === "claude" && host.includes("claude.ai")) ||
    (target === "chatgpt" && host.includes("chatgpt.com")) ||
    (target === "gemini" && host.includes("gemini.google.com")) ||
    (target === "grok" && host.includes("grok.com"));

  if (!siteMatch) {
    console.log("[YT-Summary][Injector] Site mismatch:", host, "vs target:", target);
    return;
  }

  // Clear the pending prompt immediately to avoid re-injection
  await chrome.storage.local.remove("ytsPendingPrompt");

  console.log("[YT-Summary][Injector] Waiting for input element...");

  // Wait for the input element to appear (SPAs take time to render)
  const input = await waitForInput(target);
  if (!input) {
    console.log("[YT-Summary][Injector] Could not find input element after timeout");
    // Log what contenteditable elements exist
    const editables = document.querySelectorAll('[contenteditable="true"]');
    console.log("[YT-Summary][Injector] Contenteditable elements found:", editables.length);
    editables.forEach((el, i) => {
      console.log(`  [${i}]`, el.tagName, el.className, el.id);
    });
    const textareas = document.querySelectorAll("textarea");
    console.log("[YT-Summary][Injector] Textareas found:", textareas.length);
    textareas.forEach((el, i) => {
      console.log(`  [${i}]`, el.id, el.className);
    });
    return;
  }

  console.log("[YT-Summary][Injector] Found input:", input.tagName, input.className, input.id);
  await injectText(input, prompt, target);
  console.log("[YT-Summary][Injector] Prompt injected successfully");
})();

/**
 * Wait for the chat input to appear in the DOM.
 * Each site has a different selector.
 */
function waitForInput(target, timeout = 15000) {
  const selectors = {
    claude: [
      'div.ProseMirror[contenteditable="true"]',
      '[contenteditable="true"].is-editor-empty',
      'fieldset [contenteditable="true"]',
    ],
    chatgpt: [
      "#prompt-textarea",
      'div[contenteditable="true"][id="prompt-textarea"]',
      'textarea[data-id="root"]',
    ],
    gemini: [
      '.ql-editor[contenteditable="true"]',
      'div[contenteditable="true"].textarea',
      'rich-textarea [contenteditable="true"]',
      '.text-input-field [contenteditable="true"]',
    ],
    grok: [
      "div.tiptap.ProseMirror",
      'div.ProseMirror[contenteditable="true"]',
      '[contenteditable="true"]',
    ],
  };

  const candidates = selectors[target] || [];

  return new Promise((resolve) => {
    // Try immediately first
    for (const sel of candidates) {
      const el = document.querySelector(sel);
      if (el) return resolve(el);
    }

    // Observe DOM changes
    const observer = new MutationObserver(() => {
      for (const sel of candidates) {
        const el = document.querySelector(sel);
        if (el) {
          observer.disconnect();
          resolve(el);
          return;
        }
      }
    });

    observer.observe(document.body, { childList: true, subtree: true });
    setTimeout(() => {
      observer.disconnect();
      resolve(null);
    }, timeout);
  });
}

/**
 * Inject text into the input element.
 * Different sites use different input types (textarea, contenteditable, ProseMirror).
 */
async function injectText(el, text, target) {
  el.focus();

  // Small delay to let the editor initialize after focus
  await sleep(300);

  if (el.tagName === "TEXTAREA" || el.tagName === "INPUT") {
    // Standard textarea (some ChatGPT versions)
    const nativeSet = Object.getOwnPropertyDescriptor(
      window.HTMLTextAreaElement.prototype, "value"
    )?.set;
    if (nativeSet) {
      nativeSet.call(el, text);
    } else {
      el.value = text;
    }
    el.dispatchEvent(new Event("input", { bubbles: true }));
    el.dispatchEvent(new Event("change", { bubbles: true }));
  } else {
    // Contenteditable div (Claude ProseMirror, ChatGPT, Gemini)
    // Use execCommand for best compatibility with rich text editors
    el.focus();

    // Clear existing content
    if (el.textContent) {
      document.execCommand("selectAll", false, null);
      document.execCommand("delete", false, null);
    }

    // Insert text via clipboard API for best editor compatibility
    const clipboardData = new DataTransfer();
    clipboardData.setData("text/plain", text);
    const pasteEvent = new ClipboardEvent("paste", {
      bubbles: true,
      cancelable: true,
      clipboardData,
    });

    const handled = !el.dispatchEvent(pasteEvent);

    if (!handled) {
      // Fallback: use execCommand insertText
      document.execCommand("insertText", false, text);
    }

    // Dispatch input event to notify frameworks
    el.dispatchEvent(new Event("input", { bubbles: true }));
  }

  // For ChatGPT: adjust textarea height
  if (target === "chatgpt") {
    await sleep(100);
    el.style.height = "auto";
    el.style.height = el.scrollHeight + "px";
  }
}

function sleep(ms) {
  return new Promise((r) => setTimeout(r, ms));
}

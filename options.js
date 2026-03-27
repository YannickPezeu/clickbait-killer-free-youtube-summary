// Options page logic

const MODEL_SUGGESTIONS = {
  anthropic: [
    { id: "claude-haiku-4-5-20251001", label: "Claude Haiku 4.5 — rapide, ~$0.01/résumé" },
    { id: "claude-sonnet-4-6-20250514", label: "Claude Sonnet 4.6 — équilibré, ~$0.05/résumé" },
    { id: "claude-opus-4-6-20250610", label: "Claude Opus 4.6 — puissant, ~$0.20/résumé" },
  ],
  openai: [
    { id: "gpt-4o-mini", label: "GPT-4o mini — rapide, ~$0.01/résumé" },
    { id: "gpt-4o", label: "GPT-4o — équilibré, ~$0.05/résumé" },
    { id: "gpt-4.1-mini", label: "GPT-4.1 mini — récent, ~$0.01/résumé" },
    { id: "gpt-4.1", label: "GPT-4.1 — récent, ~$0.05/résumé" },
    { id: "o4-mini", label: "o4-mini — raisonnement, ~$0.03/résumé" },
  ],
  google: [
    { id: "gemini-2.5-flash-lite", label: "Gemini 2.5 Flash Lite — ultra rapide, ~$0.005/résumé" },
    { id: "gemini-2.5-flash", label: "Gemini 2.5 Flash — rapide, ~$0.01/résumé" },
    { id: "gemini-2.5-pro", label: "Gemini 2.5 Pro — puissant, ~$0.10/résumé" },
  ],
  xai: [
    { id: "grok-4-1-fast-non-reasoning", label: "Grok 4.1 Fast Non-Reasoning — rapide, $0.20/$0.50 per M tokens" },
    { id: "grok-4-1-fast-reasoning", label: "Grok 4.1 Fast Reasoning — rapide, $0.20/$0.50 per M tokens" },
    { id: "grok-4.20-0309-non-reasoning", label: "Grok 4.20 Non-Reasoning — puissant, $2.00/$6.00 per M tokens" },
    { id: "grok-4.20-0309-reasoning", label: "Grok 4.20 Reasoning — puissant, $2.00/$6.00 per M tokens" },
  ],
};

const API_KEY_PLACEHOLDERS = {
  anthropic: "sk-ant-...",
  openai: "sk-...",
  google: "AIza...",
  xai: "xai-...",
};

// Load saved settings
chrome.storage.sync.get(
  ["provider", "model", "apiKey", "language", "mode"],
  (settings) => {
    if (settings.provider)
      document.getElementById("provider").value = settings.provider;
    if (settings.model)
      document.getElementById("model").value = settings.model;
    if (settings.apiKey)
      document.getElementById("apiKey").value = settings.apiKey;
    if (settings.language)
      document.getElementById("defaultLanguage").value = settings.language;
    if (settings.mode)
      document.getElementById("defaultMode").value = settings.mode;

    updateModelSuggestions();
    updateApiKeyPlaceholder();
  }
);

// Update suggestions when provider changes
document.getElementById("provider").addEventListener("change", () => {
  updateModelSuggestions();
  updateApiKeyPlaceholder();
  const provider = document.getElementById("provider").value;
  const suggestions = MODEL_SUGGESTIONS[provider] || [];
  if (suggestions.length) {
    document.getElementById("model").value = suggestions[0].id;
  }
  autoSave();
});

function updateModelSuggestions() {
  const provider = document.getElementById("provider").value;
  const datalist = document.getElementById("model-suggestions");
  const suggestions = MODEL_SUGGESTIONS[provider] || [];

  datalist.innerHTML = "";
  suggestions.forEach((s) => {
    const option = document.createElement("option");
    option.value = s.id;
    option.label = s.label;
    datalist.appendChild(option);
  });
}

function updateApiKeyPlaceholder() {
  const provider = document.getElementById("provider").value;
  document.getElementById("apiKey").placeholder =
    API_KEY_PLACEHOLDERS[provider] || "API key...";
}

// Auto-save on any change
let saveTimeout = null;

function autoSave() {
  clearTimeout(saveTimeout);
  saveTimeout = setTimeout(() => {
    const settings = {
      provider: document.getElementById("provider").value,
      model: document.getElementById("model").value.trim(),
      apiKey: document.getElementById("apiKey").value.trim(),
      language: document.getElementById("defaultLanguage").value,
      mode: document.getElementById("defaultMode").value,
    };

    chrome.storage.sync.set(settings, () => {
      const status = document.getElementById("status");
      status.classList.add("show");
      setTimeout(() => status.classList.remove("show"), 1500);
    });
  }, 300);
}

// Listen to all form changes
document.querySelectorAll("select").forEach((el) => {
  el.addEventListener("change", autoSave);
});
document.querySelectorAll("input").forEach((el) => {
  el.addEventListener("input", autoSave);
});

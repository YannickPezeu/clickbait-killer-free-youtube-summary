// Service worker — handles streaming API calls from content script

chrome.runtime.onConnect.addListener((port) => {
  if (port.name !== "yts-summarize") return;

  port.onMessage.addListener(async (request) => {
    try {
      const settings = await chrome.storage.sync.get([
        "apiKey",
        "provider",
        "model",
      ]);

      const apiKey = settings.apiKey;
      const activeProvider = request.provider || settings.provider || "anthropic";
      const model = settings.model || getDefaultModel(activeProvider);

      if (!apiKey) {
        port.postMessage({ error: "Clé API non configurée. Ouvrez les options de l'extension." });
        return;
      }

      const prompt = buildPrompt(request.transcript, request.language);

      const streamers = {
        anthropic: streamAnthropic,
        openai: streamOpenAI,
        google: streamGoogle,
        xai: streamXAI,
      };

      const streamer = streamers[activeProvider];
      if (!streamer) {
        throw new Error(`Fournisseur inconnu : ${activeProvider}`);
      }

      await streamer(apiKey, model, prompt, port);
    } catch (err) {
      port.postMessage({ error: err.message });
    }
  });
});

function getDefaultModel(provider) {
  const defaults = {
    anthropic: "claude-haiku-4-5-20251001",
    openai: "gpt-4o-mini",
    google: "gemini-2.5-flash-lite",
    xai: "grok-4-1-fast-non-reasoning",
  };
  return defaults[provider] || "claude-haiku-4-5-20251001";
}

function buildPrompt(transcript, language) {
  return `Tu es un assistant qui résume des vidéos YouTube de manière concise et structurée.

Résume la transcription suivante en ${language}.

Règles :
- Commence par un résumé en 1-2 phrases (le TL;DR)
- Puis liste les points clés avec des bullet points
- Si la vidéo est du clickbait, dis-le clairement
- Reste factuel, ne rajoute rien qui n'est pas dans la transcription

Transcription :
${transcript}`;
}

// --- SSE stream reader (shared by OpenAI-compatible APIs) ---

async function readSSEStream(res, extractContent, port) {
  const reader = res.body.getReader();
  const decoder = new TextDecoder();
  let buffer = "";

  while (true) {
    const { done, value } = await reader.read();
    if (done) break;

    buffer += decoder.decode(value, { stream: true });
    const lines = buffer.split("\n");
    buffer = lines.pop();

    for (const line of lines) {
      if (!line.startsWith("data: ")) continue;
      const data = line.slice(6).trim();
      if (data === "[DONE]") {
        port.postMessage({ done: true });
        return;
      }

      try {
        const parsed = JSON.parse(data);
        const content = extractContent(parsed);
        if (content) {
          port.postMessage({ chunk: content });
        }
      } catch {}
    }
  }

  port.postMessage({ done: true });
}

// --- Anthropic (Claude) ---

async function streamAnthropic(apiKey, model, prompt, port) {
  const res = await fetch("https://api.anthropic.com/v1/messages", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "x-api-key": apiKey,
      "anthropic-version": "2023-06-01",
      "anthropic-dangerous-direct-browser-access": "true",
    },
    body: JSON.stringify({
      model,
      max_tokens: 4096,
      stream: true,
      messages: [{ role: "user", content: prompt }],
    }),
  });

  if (!res.ok) {
    const err = await res.json().catch(() => ({}));
    throw new Error(err.error?.message || `Erreur Anthropic API (${res.status})`);
  }

  await readSSEStream(
    res,
    (parsed) => {
      if (parsed.type === "content_block_delta") return parsed.delta?.text;
      if (parsed.type === "message_stop") return null;
      return null;
    },
    port
  );
}

// --- OpenAI (GPT) ---

async function streamOpenAI(apiKey, model, prompt, port) {
  const res = await fetch("https://api.openai.com/v1/chat/completions", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${apiKey}`,
    },
    body: JSON.stringify({
      model,
      messages: [{ role: "user", content: prompt }],
      max_tokens: 4096,
      stream: true,
    }),
  });

  if (!res.ok) {
    const err = await res.json().catch(() => ({}));
    throw new Error(err.error?.message || `Erreur OpenAI API (${res.status})`);
  }

  await readSSEStream(
    res,
    (parsed) => parsed.choices?.[0]?.delta?.content,
    port
  );
}

// --- Google (Gemini) ---

async function streamGoogle(apiKey, model, prompt, port) {
  const url = `https://generativelanguage.googleapis.com/v1beta/models/${model}:streamGenerateContent?alt=sse&key=${apiKey}`;

  const res = await fetch(url, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      contents: [{ parts: [{ text: prompt }] }],
      generationConfig: { maxOutputTokens: 4096 },
    }),
  });

  if (!res.ok) {
    const err = await res.json().catch(() => ({}));
    throw new Error(
      err.error?.message || `Erreur Google API (${res.status})`
    );
  }

  await readSSEStream(
    res,
    (parsed) => parsed.candidates?.[0]?.content?.parts?.[0]?.text,
    port
  );
}

// --- xAI (Grok) ---

async function streamXAI(apiKey, model, prompt, port) {
  const res = await fetch("https://api.x.ai/v1/chat/completions", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${apiKey}`,
    },
    body: JSON.stringify({
      model,
      messages: [{ role: "user", content: prompt }],
      max_tokens: 4096,
      stream: true,
    }),
  });

  if (!res.ok) {
    const err = await res.json().catch(() => ({}));
    throw new Error(err.error?.message || `Erreur xAI API (${res.status})`);
  }

  // xAI uses OpenAI-compatible streaming format
  await readSSEStream(
    res,
    (parsed) => parsed.choices?.[0]?.delta?.content,
    port
  );
}

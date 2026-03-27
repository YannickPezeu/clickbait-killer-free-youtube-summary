// Content script — injects summary panel into YouTube pages

(function () {
  "use strict";

  const PANEL_ID = "yt-summary-panel";
  let currentVideoId = null;

  // --- i18n ---

  const i18n = {
    "français": {
      language: "Langue :",
      mode: "Mode :",
      direct: "Résumé direct (API)",
      openClaude: "Ouvrir dans Claude",
      openChatgpt: "Ouvrir dans ChatGPT",
      openGemini: "Ouvrir dans Gemini",
      openGrok: "Ouvrir dans Grok",
      summarize: "Résumer cette vidéo",
      extracting: "Extraction des sous-titres...",
      summarizing: "Résumé en cours...",
      openedIn: (name) => `Ouvert dans ${name} ↗`,
      promptCopied: "Prompt copié — collez-le dans le chat",
      popupBlocked: "Popup bloqué — autorisez les popups pour youtube.com",
      close: "Fermer",
    },
    "English": {
      language: "Language:",
      mode: "Mode:",
      direct: "Direct summary (API)",
      openClaude: "Open in Claude",
      openChatgpt: "Open in ChatGPT",
      openGemini: "Open in Gemini",
      openGrok: "Open in Grok",
      summarize: "Summarize this video",
      extracting: "Extracting subtitles...",
      summarizing: "Summarizing...",
      openedIn: (name) => `Opened in ${name} ↗`,
      promptCopied: "Prompt copied — paste it in the chat",
      popupBlocked: "Popup blocked — allow popups for youtube.com",
      close: "Close",
    },
    "español": {
      language: "Idioma:",
      mode: "Modo:",
      direct: "Resumen directo (API)",
      openClaude: "Abrir en Claude",
      openChatgpt: "Abrir en ChatGPT",
      openGemini: "Abrir en Gemini",
      openGrok: "Abrir en Grok",
      summarize: "Resumir este vídeo",
      extracting: "Extrayendo subtítulos...",
      summarizing: "Resumiendo...",
      openedIn: (name) => `Abierto en ${name} ↗`,
      promptCopied: "Prompt copiado — pégalo en el chat",
      popupBlocked: "Popup bloqueado — permite popups para youtube.com",
      close: "Cerrar",
    },
    "Deutsch": {
      language: "Sprache:",
      mode: "Modus:",
      direct: "Direktzusammenfassung (API)",
      openClaude: "In Claude öffnen",
      openChatgpt: "In ChatGPT öffnen",
      openGemini: "In Gemini öffnen",
      openGrok: "In Grok öffnen",
      summarize: "Video zusammenfassen",
      extracting: "Untertitel werden extrahiert...",
      summarizing: "Zusammenfassung läuft...",
      openedIn: (name) => `In ${name} geöffnet ↗`,
      promptCopied: "Prompt kopiert — im Chat einfügen",
      popupBlocked: "Popup blockiert — Popups für youtube.com erlauben",
      close: "Schließen",
    },
    "italiano": {
      language: "Lingua:",
      mode: "Modalità:",
      direct: "Riassunto diretto (API)",
      openClaude: "Apri in Claude",
      openChatgpt: "Apri in ChatGPT",
      openGemini: "Apri in Gemini",
      openGrok: "Apri in Grok",
      summarize: "Riassumi questo video",
      extracting: "Estrazione sottotitoli...",
      summarizing: "Riassunto in corso...",
      openedIn: (name) => `Aperto in ${name} ↗`,
      promptCopied: "Prompt copiato — incollalo nella chat",
      popupBlocked: "Popup bloccato — consenti popup per youtube.com",
      close: "Chiudi",
    },
    "português": {
      language: "Idioma:",
      mode: "Modo:",
      direct: "Resumo direto (API)",
      openClaude: "Abrir no Claude",
      openChatgpt: "Abrir no ChatGPT",
      openGemini: "Abrir no Gemini",
      openGrok: "Abrir no Grok",
      summarize: "Resumir este vídeo",
      extracting: "Extraindo legendas...",
      summarizing: "Resumindo...",
      openedIn: (name) => `Aberto no ${name} ↗`,
      promptCopied: "Prompt copiado — cole no chat",
      popupBlocked: "Popup bloqueado — permita popups para youtube.com",
      close: "Fechar",
    },
    "日本語": {
      language: "言語：",
      mode: "モード：",
      direct: "直接要約（API）",
      openClaude: "Claudeで開く",
      openChatgpt: "ChatGPTで開く",
      openGemini: "Geminiで開く",
      openGrok: "Grokで開く",
      summarize: "この動画を要約",
      extracting: "字幕を取得中...",
      summarizing: "要約中...",
      openedIn: (name) => `${name}で開きました ↗`,
      promptCopied: "プロンプトをコピーしました — チャットに貼り付けてください",
      popupBlocked: "ポップアップがブロックされました — youtube.comのポップアップを許可してください",
      close: "閉じる",
    },
    "中文": {
      language: "语言：",
      mode: "模式：",
      direct: "直接摘要（API）",
      openClaude: "在Claude中打开",
      openChatgpt: "在ChatGPT中打开",
      openGemini: "在Gemini中打开",
      openGrok: "在Grok中打开",
      summarize: "总结此视频",
      extracting: "正在提取字幕...",
      summarizing: "正在总结...",
      openedIn: (name) => `已在${name}中打开 ↗`,
      promptCopied: "提示已复制 — 粘贴到聊天中",
      popupBlocked: "弹窗被阻止 — 请允许youtube.com的弹窗",
      close: "关闭",
    },
  };

  function t(key) {
    const lang = document.getElementById("yts-language")?.value || "English";
    return i18n[lang]?.[key] || i18n["English"][key];
  }

  function updateUI() {
    const lang = document.getElementById("yts-language")?.value || "English";
    const strings = i18n[lang] || i18n["English"];

    const labelLang = document.querySelector(`#${PANEL_ID} label[for="yts-language"]`);
    const labelMode = document.querySelector(`#${PANEL_ID} label[for="yts-mode"]`);
    const modeSelect = document.getElementById("yts-mode");
    const btn = document.getElementById("yts-summarize");
    const closeBtn = document.querySelector(`#${PANEL_ID} .yts-close`);

    if (labelLang) labelLang.textContent = strings.language;
    if (labelMode) labelMode.textContent = strings.mode;
    if (closeBtn) closeBtn.title = strings.close;
    if (btn && !btn.disabled) btn.textContent = strings.summarize;
    if (modeSelect) {
      modeSelect.querySelector('[value="direct"]').textContent = strings.direct;
      modeSelect.querySelector('[value="claude"]').textContent = strings.openClaude;
      modeSelect.querySelector('[value="chatgpt"]').textContent = strings.openChatgpt;
      modeSelect.querySelector('[value="gemini"]').textContent = strings.openGemini;
      modeSelect.querySelector('[value="grok"]').textContent = strings.openGrok;
    }
  }

  // --- Transcript extraction ---

  function getVideoId() {
    const params = new URLSearchParams(window.location.search);
    return params.get("v");
  }

  /**
   * Extract transcript via page-script.js (MAIN world).
   * The page script has access to YouTube cookies so the fetch works.
   */
  function extractTranscript() {
    return new Promise((resolve, reject) => {
      const timeout = setTimeout(() => {
        window.removeEventListener("yts-transcript-result", handler);
        reject(new Error("Timeout: impossible d'extraire les sous-titres."));
      }, 15000);

      const handler = (e) => {
        clearTimeout(timeout);
        window.removeEventListener("yts-transcript-result", handler);
        const data = JSON.parse(e.detail);
        if (data.error) {
          reject(new Error(data.error));
        } else {
          console.log("[YT-Summary] Transcript received, length:", data.transcript.length);
          resolve(data.transcript);
        }
      };

      window.addEventListener("yts-transcript-result", handler);
      window.dispatchEvent(new CustomEvent("yts-get-transcript"));
    });
  }

  // --- LLM tab openers ---

  function buildLLMPrompt(transcript, language) {
    return `Résume cette transcription de vidéo YouTube en ${language}. Commence par un TL;DR en 1-2 phrases, puis les points clés en bullet points. Si c'est du clickbait, dis-le.\n\nTranscription :\n${transcript}`;
  }

  const LLM_URLS = {
    claude: "https://claude.ai/new",
    chatgpt: "https://chatgpt.com/",
    gemini: "https://gemini.google.com/app",
    grok: "https://grok.com/",
  };

  /**
   * Store prompt in local storage and navigate the pre-opened window to the LLM.
   * The injector.js content script on the target site will pick it up and inject it.
   */
  async function openAndInject(win, mode, transcript, language) {
    const prompt = buildLLMPrompt(transcript, language);

    // Store prompt for the injector script
    await chrome.storage.local.set({
      ytsPendingPrompt: { prompt, target: mode, timestamp: Date.now() },
    });

    win.location.href = LLM_URLS[mode];
  }

  // --- UI ---

  function loadPreferences() {
    chrome.storage.sync.get(["language", "mode"], (settings) => {
      if (settings.language) {
        const el = document.getElementById("yts-language");
        if (el) el.value = settings.language;
      }
      if (settings.mode) {
        const el = document.getElementById("yts-mode");
        if (el) el.value = settings.mode;
      }
      updateUI();
    });
  }

  function createPanel() {
    if (document.getElementById(PANEL_ID)) return;

    const panel = document.createElement("div");
    panel.id = PANEL_ID;
    panel.innerHTML = `
      <div class="yts-header">
        <span class="yts-title">Clickbait Killer</span>
        <button class="yts-close" title="Fermer">✕</button>
      </div>
      <div class="yts-controls">
        <div class="yts-row">
          <label for="yts-language">Langue :</label>
          <select id="yts-language">
            <option value="English">English</option>
            <option value="français">Français</option>
            <option value="español">Español</option>
            <option value="Deutsch">Deutsch</option>
            <option value="italiano">Italiano</option>
            <option value="português">Português</option>
            <option value="日本語">日本語</option>
            <option value="中文">中文</option>
          </select>
        </div>
        <div class="yts-row">
          <label for="yts-mode">Mode :</label>
          <select id="yts-mode">
            <option value="direct">Résumé direct (API)</option>
            <option value="claude">Ouvrir dans Claude</option>
            <option value="chatgpt">Ouvrir dans ChatGPT</option>
            <option value="gemini">Ouvrir dans Gemini</option>
            <option value="grok">Ouvrir dans Grok</option>
          </select>
        </div>
        <button id="yts-summarize" class="yts-btn">Résumer cette vidéo</button>
      </div>
      <div id="yts-result" class="yts-result"></div>
    `;

    // Insert next to the video player
    const onInserted = () => {
      loadPreferences();
      // Event listeners
      panel.querySelector(".yts-close").addEventListener("click", () => {
        panel.style.display = "none";
      });
      panel.querySelector("#yts-summarize").addEventListener("click", handleSummarize);
      panel.querySelector("#yts-language").addEventListener("change", (e) => {
        chrome.storage.sync.set({ language: e.target.value });
        updateUI();
      });
      panel.querySelector("#yts-mode").addEventListener("change", (e) => {
        chrome.storage.sync.set({ mode: e.target.value });
      });
    };

    const insertPanel = () => {
      const secondary = document.querySelector("#secondary.style-scope.ytd-watch-flexy");
      if (secondary) {
        secondary.insertBefore(panel, secondary.firstChild);
        onInserted();
        return true;
      }
      return false;
    };

    if (!insertPanel()) {
      const observer = new MutationObserver(() => {
        if (insertPanel()) observer.disconnect();
      });
      observer.observe(document.body, { childList: true, subtree: true });
      setTimeout(() => observer.disconnect(), 10000);
    }

    // Event listeners are set in onInserted() above
  }

  async function handleSummarize() {
    const resultDiv = document.getElementById("yts-result");
    const btn = document.getElementById("yts-summarize");
    const language = document.getElementById("yts-language").value;
    const mode = document.getElementById("yts-mode").value;

    btn.disabled = true;
    btn.textContent = t("extracting");
    resultDiv.innerHTML = "";
    resultDiv.className = "yts-result";

    // For LLM tab modes, open the window NOW (synchronous with user click)
    // to avoid popup blocker. We'll navigate it after transcript extraction.
    const llmModes = { claude: "Claude", chatgpt: "ChatGPT", gemini: "Gemini", grok: "Grok" };
    let llmWindow = null;
    if (llmModes[mode]) {
      llmWindow = window.open("about:blank", "_blank");
    }

    try {
      const transcript = await extractTranscript();

      if (llmModes[mode]) {
        if (llmWindow && !llmWindow.closed) {
          await openAndInject(llmWindow, mode, transcript, language);
          resultDiv.innerHTML = `<p class="yts-info">${t("openedIn")(llmModes[mode])}</p>`;
        } else {
          resultDiv.innerHTML = `<p class="yts-error">${t("popupBlocked")}</p>`;
        }
        btn.disabled = false;
        btn.textContent = t("summarize");
        return;
      }

      // Direct mode — stream API via background script port
      btn.textContent = t("summarizing");

      await new Promise((resolve, reject) => {
        const port = chrome.runtime.connect({ name: "yts-summarize" });
        let fullText = "";

        port.onMessage.addListener((msg) => {
          if (msg.error) {
            reject(new Error(msg.error));
            return;
          }
          if (msg.chunk) {
            fullText += msg.chunk;
            resultDiv.innerHTML = formatSummary(fullText);
            resultDiv.scrollTop = resultDiv.scrollHeight;
          }
          if (msg.done) {
            resolve();
          }
        });

        port.onDisconnect.addListener(() => {
          if (chrome.runtime.lastError) {
            reject(new Error(chrome.runtime.lastError.message));
          }
        });

        port.postMessage({ transcript, language });
      });
    } catch (err) {
      // Close the LLM window if extraction failed
      if (llmWindow && !llmWindow.closed) llmWindow.close();
      resultDiv.innerHTML = `<p class="yts-error">${err.message}</p>`;
    } finally {
      btn.disabled = false;
      btn.textContent = t("summarize");
    }
  }

  // Configure marked for safe, clean rendering
  marked.setOptions({
    breaks: true,
    gfm: true,
  });

  function formatSummary(text) {
    return marked.parse(text);
  }

  // --- Navigation handling (YouTube is a SPA) ---

  function onNavigate() {
    const videoId = getVideoId();
    if (!videoId) return;

    if (videoId !== currentVideoId) {
      currentVideoId = videoId;
      const existing = document.getElementById(PANEL_ID);
      if (existing) {
        existing.style.display = "";
        document.getElementById("yts-result").innerHTML = "";
      } else {
        createPanel();
      }
      // Always reload preferences (user may have changed them in popup)
      loadPreferences();
    }
  }

  document.addEventListener("yt-navigate-finish", onNavigate);
  onNavigate();
})();

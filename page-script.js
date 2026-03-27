// Runs in MAIN world — has access to YouTube's JS variables and cookies

/**
 * Fetch transcript lines from a baseUrl.
 * Tries json3 format first, then falls back to XML.
 * Returns an array of text lines, or [] if the body is empty / parsing fails.
 */
async function fetchTranscriptFromUrl(baseUrl) {
  let lines = [];

  // Try json3 format
  try {
    const url = baseUrl.includes("fmt=")
      ? baseUrl
      : baseUrl + "&fmt=json3";
    const res = await fetch(url, { credentials: "include" });
    console.log("[YT-Summary][MAIN] json3 status:", res.status);
    if (res.ok) {
      const text = await res.text();
      console.log("[YT-Summary][MAIN] json3 body length:", text.length);
      if (text.length > 0) {
        const data = JSON.parse(text);
        lines = (data.events || [])
          .filter((e) => e.segs)
          .map((e) => e.segs.map((s) => s.utf8).join(""))
          .filter((l) => l.trim());
      }
    }
  } catch (e) {
    console.log("[YT-Summary][MAIN] json3 error:", e.message);
  }

  if (lines.length) return lines;

  // Fallback: raw XML (classic <text> format)
  try {
    const res = await fetch(baseUrl, { credentials: "include" });
    console.log("[YT-Summary][MAIN] XML status:", res.status);
    const xml = await res.text();
    console.log("[YT-Summary][MAIN] XML body length:", xml.length);
    if (xml.length > 0) {
      // Handle both classic <text> and srv3 <p><s> formats
      const classicRegex = /<text[^>]*>([\s\S]*?)<\/text>/g;
      let match;
      while ((match = classicRegex.exec(xml)) !== null) {
        const decoded = decodeXmlEntities(match[1]).replace(/\n/g, " ").trim();
        if (decoded) lines.push(decoded);
      }

      // srv3 format: <p t="..." d="..."><s>text</s></p>
      if (!lines.length) {
        const srv3Regex = /<s[^>]*>([\s\S]*?)<\/s>/g;
        while ((match = srv3Regex.exec(xml)) !== null) {
          const decoded = decodeXmlEntities(match[1]).trim();
          if (decoded) lines.push(decoded);
        }
      }
    }
  } catch (e) {
    console.log("[YT-Summary][MAIN] XML error:", e.message);
  }

  return lines;
}

function decodeXmlEntities(str) {
  return str
    .replace(/&amp;/g, "&")
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">")
    .replace(/&quot;/g, '"')
    .replace(/&#39;/g, "'")
    .replace(/&#(\d+);/g, (_, n) => String.fromCharCode(Number(n)));
}

/**
 * Get the video ID from the current page URL.
 */
function getVideoId() {
  const params = new URLSearchParams(window.location.search);
  return params.get("v");
}

/**
 * Pick the best track: prefer manual captions over auto-generated (ASR).
 */
function pickTrack(tracks) {
  const manual = tracks.find((t) => t.kind !== "asr");
  return manual || tracks[0];
}

/**
 * Strategy 1: Use caption tracks already available in the page's player response.
 * This is the fastest path and works when baseUrls haven't expired / don't need POT.
 */
function getTracksFromPageState() {
  let pr = window.ytInitialPlayerResponse;

  if (!pr?.captions) {
    const el = document.querySelector("ytd-watch-flexy");
    if (el) {
      pr = el?.playerData || el?.__data?.playerResponse;
    }
  }

  return pr?.captions?.playerCaptionsTracklistRenderer?.captionTracks || null;
}

/**
 * Strategy 2: Call YouTube's InnerTube player API with an ANDROID client context.
 *
 * This is how the popular `youtube-transcript` npm package and the Python
 * `youtube-transcript-api` library work. The ANDROID client returns baseUrls
 * that do NOT require a Proof-of-Origin (POT) token, which is the root cause
 * of 200-OK-but-empty-body responses from the timedtext endpoint since mid-2025.
 *
 * Reference:
 *   https://github.com/Kakulukian/youtube-transcript  (npm)
 *   https://github.com/jdepoix/youtube-transcript-api  (Python)
 */
async function getTracksFromInnertubeAPI(videoId) {
  console.log("[YT-Summary][MAIN] Falling back to InnerTube player API...");

  // Try to grab the page's API key; if unavailable, omit it (endpoint works without it too)
  let apiKey = "";
  try {
    const cfg = window.ytcfg;
    apiKey = cfg?.get?.("INNERTUBE_API_KEY") || cfg?.data_?.INNERTUBE_API_KEY || "";
  } catch (_) {}

  const url = apiKey
    ? `https://www.youtube.com/youtubei/v1/player?key=${apiKey}&prettyPrint=false`
    : "https://www.youtube.com/youtubei/v1/player?prettyPrint=false";

  const res = await fetch(url, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      // ANDROID client User-Agent — this is what makes the returned baseUrls
      // work without a POT token.
      "User-Agent":
        "com.google.android.youtube/20.10.38 (Linux; U; Android 14)",
    },
    body: JSON.stringify({
      context: {
        client: {
          clientName: "ANDROID",
          clientVersion: "20.10.38",
        },
      },
      videoId,
    }),
  });

  if (!res.ok) {
    throw new Error(`InnerTube API returned ${res.status}`);
  }

  const data = await res.json();
  return (
    data?.captions?.playerCaptionsTracklistRenderer?.captionTracks || null
  );
}

// ---------------------------------------------------------------------------
// Main handler
// ---------------------------------------------------------------------------

window.addEventListener("yts-get-transcript", async () => {
  try {
    const videoId = getVideoId();
    if (!videoId) {
      throw new Error("Impossible de trouver l'ID de la vidéo.");
    }

    let lines = [];

    // -----------------------------------------------------------------------
    // Strategy 1: Try the page-state baseUrl first (fastest, no extra request)
    // -----------------------------------------------------------------------
    const pageTracks = getTracksFromPageState();

    if (pageTracks?.length) {
      console.log("[YT-Summary][MAIN] Page tracks:", pageTracks.length);
      const track = pickTrack(pageTracks);
      console.log(
        "[YT-Summary][MAIN] Trying page-state track:",
        track.languageCode
      );
      lines = await fetchTranscriptFromUrl(track.baseUrl);
    }

    // -----------------------------------------------------------------------
    // Strategy 2: InnerTube ANDROID API (gets fresh URLs without POT requirement)
    // This is the method used by youtube-transcript (npm) and youtube-transcript-api (Python).
    // -----------------------------------------------------------------------
    if (!lines.length) {
      console.log(
        "[YT-Summary][MAIN] Page-state baseUrl returned empty — trying InnerTube API..."
      );
      try {
        const innerTracks = await getTracksFromInnertubeAPI(videoId);
        if (innerTracks?.length) {
          const track = pickTrack(innerTracks);
          console.log(
            "[YT-Summary][MAIN] InnerTube track:",
            track.languageCode
          );
          lines = await fetchTranscriptFromUrl(track.baseUrl);
        } else {
          console.log("[YT-Summary][MAIN] InnerTube API returned no tracks.");
        }
      } catch (e) {
        console.log("[YT-Summary][MAIN] InnerTube API error:", e.message);
      }
    }

    // -----------------------------------------------------------------------
    // Strategy 3: Direct timedtext URL with video ID (last resort)
    // Some older videos respond to this without POT.
    // -----------------------------------------------------------------------
    if (!lines.length) {
      console.log("[YT-Summary][MAIN] Trying direct timedtext fallback...");
      try {
        lines = await fetchTranscriptFromUrl(
          `https://www.youtube.com/api/timedtext?v=${videoId}&lang=en&fmt=json3`
        );
      } catch (_) {}
    }

    // -----------------------------------------------------------------------
    // Dispatch result
    // -----------------------------------------------------------------------
    console.log("[YT-Summary][MAIN] Total lines:", lines.length);

    if (lines.length > 0) {
      window.dispatchEvent(
        new CustomEvent("yts-transcript-result", {
          detail: JSON.stringify({ transcript: lines.join(" ") }),
        })
      );
    } else {
      window.dispatchEvent(
        new CustomEvent("yts-transcript-result", {
          detail: JSON.stringify({
            error:
              "Sous-titres vides — YouTube a peut-être bloqué la requête (POT token). " +
              "Essayez de recharger la page ou vérifiez que la vidéo a des sous-titres.",
          }),
        })
      );
    }
  } catch (e) {
    window.dispatchEvent(
      new CustomEvent("yts-transcript-result", {
        detail: JSON.stringify({ error: "Erreur: " + e.message }),
      })
    );
  }
});

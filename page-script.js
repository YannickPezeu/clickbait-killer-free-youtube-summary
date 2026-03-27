// Runs in MAIN world — has access to YouTube's JS variables and cookies

/**
 * Fetch transcript lines from a baseUrl.
 * Tries json3 format first, then falls back to XML.
 * Returns an array of text lines, or [] if the body is empty / parsing fails.
 */
async function fetchTranscriptFromUrl(baseUrl) {
  let lines = [];

  // Fetch the URL and parse whatever format comes back (JSON or XML)
  try {
    // Try with json3 format hint
    const url = baseUrl.includes("fmt=")
      ? baseUrl
      : baseUrl + "&fmt=json3";
    const res = await fetch(url, { credentials: "include" });
    console.log("[YT-Summary][MAIN] fetch status:", res.status);
    if (res.ok) {
      const text = await res.text();
      console.log("[YT-Summary][MAIN] fetch body length:", text.length);
      if (text.length > 0) {
        lines = parseTranscriptResponse(text);
      }
    }
  } catch (e) {
    console.log("[YT-Summary][MAIN] fetch error:", e.message);
  }

  // If json3 param changed the URL and returned empty, try original URL
  if (!lines.length && !baseUrl.includes("fmt=")) {
    try {
      const res = await fetch(baseUrl, { credentials: "include" });
      if (res.ok) {
        const text = await res.text();
        console.log("[YT-Summary][MAIN] fallback body length:", text.length);
        if (text.length > 0) {
          lines = parseTranscriptResponse(text);
        }
      }
    } catch (e) {
      console.log("[YT-Summary][MAIN] fallback error:", e.message);
    }
  }

  return lines;
}

/**
 * Parse a transcript response that could be JSON (json3) or XML.
 */
function parseTranscriptResponse(text) {
  const trimmed = text.trim();

  // Try JSON first
  if (trimmed.startsWith("{")) {
    try {
      const data = JSON.parse(trimmed);
      const lines = (data.events || [])
        .filter((e) => e.segs)
        .map((e) => e.segs.map((s) => s.utf8).join(""))
        .filter((l) => l.trim());
      if (lines.length) return lines;
    } catch {}
  }

  // Parse as XML
  let lines = [];
  let match;

  // Classic <text> format
  const classicRegex = /<text[^>]*>([\s\S]*?)<\/text>/g;
  while ((match = classicRegex.exec(trimmed)) !== null) {
    const decoded = decodeXmlEntities(match[1]).replace(/\n/g, " ").trim();
    if (decoded) lines.push(decoded);
  }

  // srv3 <body><p><s> format
  if (!lines.length) {
    const srv3Regex = /<s[^>]*>([\s\S]*?)<\/s>/g;
    while ((match = srv3Regex.exec(trimmed)) !== null) {
      const decoded = decodeXmlEntities(match[1]).trim();
      if (decoded) lines.push(decoded);
    }
  }

  // srv3 <body><p> format (no <s> wrapper)
  if (!lines.length) {
    const pRegex = /<p[^>]+>([\s\S]*?)<\/p>/g;
    while ((match = pRegex.exec(trimmed)) !== null) {
      // Strip inner tags
      const decoded = decodeXmlEntities(match[1].replace(/<[^>]+>/g, "")).trim();
      if (decoded) lines.push(decoded);
    }
  }

  console.log("[YT-Summary][MAIN] Parsed lines:", lines.length, trimmed.startsWith("{") ? "(json)" : "(xml)");
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
 */
async function getTracksFromInnertubeAPI(videoId) {
  console.log("[YT-Summary][MAIN] Trying InnerTube ANDROID API...");

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

  if (!res.ok) throw new Error(`InnerTube ANDROID returned ${res.status}`);

  const data = await res.json();
  return data?.captions?.playerCaptionsTracklistRenderer?.captionTracks || null;
}

/**
 * Encode video ID into the protobuf params format expected by get_transcript.
 * Wire format: field 1 (string) containing a nested message with field 1 (string) = videoId
 */
function encodeTranscriptParams(videoId) {
  // Inner message: field 1, wire type 2 (length-delimited), value = videoId
  const innerField = new Uint8Array(2 + videoId.length);
  innerField[0] = 0x0a; // field 1, wire type 2
  innerField[1] = videoId.length;
  for (let i = 0; i < videoId.length; i++) {
    innerField[2 + i] = videoId.charCodeAt(i);
  }

  // Outer message: field 1, wire type 2, value = inner message
  const outer = new Uint8Array(2 + innerField.length);
  outer[0] = 0x0a; // field 1, wire type 2
  outer[1] = innerField.length;
  outer.set(innerField, 2);

  // Base64 encode
  let binary = "";
  for (let i = 0; i < outer.length; i++) {
    binary += String.fromCharCode(outer[i]);
  }
  return btoa(binary);
}

/**
 * Strategy 3: Use YouTube's InnerTube get_transcript endpoint.
 * This is what YouTube's own "Show transcript" UI uses internally.
 * It works with the WEB client and page cookies, bypassing POT issues.
 */
async function getTranscriptFromInnertubeWeb(videoId) {
  console.log("[YT-Summary][MAIN] Trying InnerTube get_transcript (WEB)...");

  let apiKey = "";
  try {
    const cfg = window.ytcfg;
    apiKey = cfg?.get?.("INNERTUBE_API_KEY") || cfg?.data_?.INNERTUBE_API_KEY || "";
  } catch (_) {}

  if (!apiKey) {
    throw new Error("No InnerTube API key available");
  }

  const url = `https://www.youtube.com/youtubei/v1/get_transcript?key=${apiKey}&prettyPrint=false`;

  const res = await fetch(url, {
    method: "POST",
    credentials: "include",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      context: {
        client: {
          clientName: "WEB",
          clientVersion: "2.20250326.00.00",
        },
      },
      params: encodeTranscriptParams(videoId),
    }),
  });

  if (!res.ok) throw new Error(`get_transcript returned ${res.status}`);

  const data = await res.json();

  // Extract transcript segments from the response
  const body =
    data?.actions?.[0]?.updateEngagementPanelAction?.content
      ?.transcriptRenderer?.body?.transcriptBodyRenderer?.cueGroups ||
    data?.actions?.[0]?.updateEngagementPanelAction?.content
      ?.transcriptRenderer?.content?.transcriptSearchPanelRenderer
      ?.body?.transcriptSegmentListRenderer?.initialSegments;

  if (!body?.length) {
    throw new Error("No transcript segments in response");
  }

  const lines = body
    .map((group) => {
      const cue =
        group?.transcriptCueGroupRenderer?.cues?.[0]
          ?.transcriptCueRenderer?.cue?.simpleText ||
        group?.transcriptSegmentRenderer?.snippet?.runs
          ?.map((r) => r.text)
          .join("");
      return cue?.trim();
    })
    .filter(Boolean);

  return lines;
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

    // Strategy 1: Page-state baseUrl (fastest)
    const pageTracks = getTracksFromPageState();
    if (pageTracks?.length) {
      console.log("[YT-Summary][MAIN] Page tracks:", pageTracks.length);
      const track = pickTrack(pageTracks);
      console.log("[YT-Summary][MAIN] Trying page-state track:", track.languageCode);
      lines = await fetchTranscriptFromUrl(track.baseUrl);
    }

    // Strategy 2: InnerTube ANDROID API
    if (!lines.length) {
      console.log("[YT-Summary][MAIN] Page-state empty — trying InnerTube ANDROID...");
      try {
        const innerTracks = await getTracksFromInnertubeAPI(videoId);
        if (innerTracks?.length) {
          const track = pickTrack(innerTracks);
          console.log("[YT-Summary][MAIN] InnerTube ANDROID track:", track.languageCode);
          lines = await fetchTranscriptFromUrl(track.baseUrl);
        } else {
          console.log("[YT-Summary][MAIN] InnerTube ANDROID returned no tracks.");
        }
      } catch (e) {
        console.log("[YT-Summary][MAIN] InnerTube ANDROID error:", e.message);
      }
    }

    // Strategy 3: InnerTube get_transcript (WEB client with cookies)
    if (!lines.length) {
      console.log("[YT-Summary][MAIN] ANDROID empty — trying get_transcript WEB...");
      try {
        lines = await getTranscriptFromInnertubeWeb(videoId);
        console.log("[YT-Summary][MAIN] get_transcript lines:", lines?.length);
      } catch (e) {
        console.log("[YT-Summary][MAIN] get_transcript error:", e.message);
      }
    }

    // Strategy 4: Direct timedtext URL (last resort)
    if (!lines.length) {
      console.log("[YT-Summary][MAIN] Trying direct timedtext fallback...");
      try {
        lines = await fetchTranscriptFromUrl(
          `https://www.youtube.com/api/timedtext?v=${videoId}&lang=en&fmt=json3`
        );
      } catch (_) {}
    }

    // Dispatch result
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
              "No subtitles found — YouTube may have blocked the request. " +
              "Try reloading the page or check that the video has subtitles.",
          }),
        })
      );
    }
  } catch (e) {
    window.dispatchEvent(
      new CustomEvent("yts-transcript-result", {
        detail: JSON.stringify({ error: "Error: " + e.message }),
      })
    );
  }
});

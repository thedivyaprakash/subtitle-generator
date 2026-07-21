const fs = require("fs");
const path = require("path");
const { romanizeText,} = require("./romanizationService");
const { resolveFont } = require("./fontService");
const { layoutWordRows } = require("./textMeasureService");

// ─── existing ──────────────────────────────────────────

const formatTime = (seconds) => {
  const date = new Date(seconds * 1000);
  const hh = String(date.getUTCHours()).padStart(2, "0");
  const mm = String(date.getUTCMinutes()).padStart(2, "0");
  const ss = String(date.getUTCSeconds()).padStart(2, "0");
  const ms = String(date.getUTCMilliseconds()).padStart(3, "0");
  return `${hh}:${mm}:${ss},${ms}`;
};

const generateSRT = (transcriptData, subtitleMode = "original") => {
  const words =
    transcriptData.results.channels[0].alternatives[0].words;
  let srtContent = "";
  let index = 1;
  for (let i = 0; i < words.length; i += 8) {
    const chunk = words.slice(i, i + 8);
    const start = chunk[0].start;
    const end = chunk[chunk.length - 1].end;
    //const text = chunk.map((w) => w.word).join(" ");
    let text = chunk.map((w) => w.word).join(" ");

if (subtitleMode === "romanized") {
  text = romanizeText(text);
}
    srtContent += `${index}\n`;
    srtContent += `${formatTime(start)} --> ${formatTime(end)}\n`;
    srtContent += `${text}\n\n`;
    index++;
  }
  const fileName = `subtitle_${Date.now()}.srt`;
  const filePath = path.join("src/subtitles", fileName);
  fs.writeFileSync(filePath, srtContent, { encoding: "utf8" });
  return filePath;
};

const SRT_TIMESTAMP_PATTERN =
  /^\d{2}:\d{2}:\d{2},\d{3} --> \d{2}:\d{2}:\d{2},\d{3}$/;

const normalizeSrtLineEndings = (content = "") =>
  content.replace(/\r/g, "");

const buildSrtFromCues = (cues) =>
  `${cues
    .map(({ index, timestamp, textLines }) =>
      [index, timestamp, ...textLines].join("\n")
    )
    .join("\n\n")}\n\n`;

const parseStrictSrt = (content) => {
  const normalized =
    normalizeSrtLineEndings(content).trim();

  if (!normalized) {
    return {
      isValid: false,
      cues: [],
    };
  }

  const blocks =
    normalized.split(/\n\n+/);
  const cues = [];

  for (const block of blocks) {
    const lines =
      block.split("\n");

    if (lines.length < 3) {
      return {
        isValid: false,
        cues: [],
      };
    }

    const [indexLine, timestampLine, ...textLines] = lines;

    if (!/^\d+$/.test(indexLine.trim())) {
      return {
        isValid: false,
        cues: [],
      };
    }

    if (!SRT_TIMESTAMP_PATTERN.test(timestampLine.trim())) {
      return {
        isValid: false,
        cues: [],
      };
    }

    const cleanedTextLines =
      textLines.map((line) => line.trimEnd());

    if (cleanedTextLines.length === 0) {
      return {
        isValid: false,
        cues: [],
      };
    }

    for (let i = 0; i < cleanedTextLines.length - 1; i++) {
      if (
        /^\d+$/.test(cleanedTextLines[i].trim()) &&
        SRT_TIMESTAMP_PATTERN.test(
          cleanedTextLines[i + 1].trim()
        )
      ) {
        return {
          isValid: false,
          cues: [],
        };
      }
    }

    cues.push({
      index: indexLine.trim(),
      timestamp: timestampLine.trim(),
      textLines: cleanedTextLines,
    });
  }

  return {
    isValid: true,
    cues,
    normalizedContent: buildSrtFromCues(cues),
  };
};

const repairMissingCueBlankLines = (
  originalContent,
  candidateContent
) => {
  const originalParse =
    parseStrictSrt(originalContent);

  if (!originalParse.isValid) {
    return null;
  }

  const nonEmptyLines =
    normalizeSrtLineEndings(candidateContent)
      .split("\n")
      .map((line) => line.trimEnd())
      .filter((line) => line.trim() !== "");

  if (nonEmptyLines.length === 0) {
    return null;
  }

  const repairedCues = [];
  let pointer = 0;

  for (let i = 0; i < originalParse.cues.length; i++) {
    const cue = originalParse.cues[i];
    const nextCue =
      originalParse.cues[i + 1];

    if (nonEmptyLines[pointer]?.trim() !== cue.index) {
      return null;
    }
    pointer++;

    if (nonEmptyLines[pointer]?.trim() !== cue.timestamp) {
      return null;
    }
    pointer++;

    const textLines = [];

    while (pointer < nonEmptyLines.length) {
      const currentLine =
        nonEmptyLines[pointer].trim();
      const followingLine =
        nonEmptyLines[pointer + 1]?.trim();

      const startsNextCue =
        nextCue &&
        currentLine === nextCue.index &&
        followingLine === nextCue.timestamp;

      if (startsNextCue) {
        break;
      }

      textLines.push(nonEmptyLines[pointer]);
      pointer++;
    }

    if (textLines.length === 0) {
      return null;
    }

    repairedCues.push({
      index: cue.index,
      timestamp: cue.timestamp,
      textLines,
    });
  }

  if (pointer !== nonEmptyLines.length) {
    return null;
  }

  return buildSrtFromCues(repairedCues);
};

const validateEnhancedSrt = (
  originalContent,
  candidateContent
) => {
  const originalParse =
    parseStrictSrt(originalContent);

  if (!originalParse.isValid) {
    return normalizeSrtLineEndings(originalContent);
  }

  const candidateParse =
    parseStrictSrt(candidateContent);

  if (candidateParse.isValid) {
    return candidateParse.normalizedContent;
  }

  const repairedCandidate =
    repairMissingCueBlankLines(
      originalParse.normalizedContent,
      candidateContent
    );

  if (!repairedCandidate) {
    return originalParse.normalizedContent;
  }

  const repairedParse =
    parseStrictSrt(repairedCandidate);

  return repairedParse.isValid
    ? repairedParse.normalizedContent
    : originalParse.normalizedContent;
};

// ─── new: ASS generation ───────────────────────────────

// "00:00:02,738" → "0:00:02.73"
const srtTimeToAss = (srtTime) => {

  if (!srtTime)
    return "0:00:00.00";

  const parts =
    srtTime.trim().split(":");

  if (parts.length !== 3)
    return "0:00:00.00";

  const [h, m, rest] = parts;

  const [s, ms = "00"] =
    rest.split(",");

  return `${parseInt(h)}:${m}:${s}.${ms.substring(0,2)}`;
};

// Parse raw SRT string → array of { start, end, text }
const parseSrt = (content) => {

  const blocks =
    content
      .replace(/\r/g, "")
      .trim()
      .split(/\n\s*\n/);

  return blocks
    .map((block) => {

      const lines =
        block
          .split("\n")
          .map(line => line.trim())
          .filter(Boolean);

      const timeLine =
        lines.find(line =>
          line.includes("-->")
        );

      if (!timeLine)
        return null;

      const [start, end] =
        timeLine.split("-->");

      const textLines =
        lines.filter(line =>
          !line.includes("-->") &&
          isNaN(line)
        );

      return {
        start: start.trim(),
        end: end.trim(),
        text: textLines.join("\\N")
      };

    })
    .filter(Boolean);
};

const parseSrtCues = (content) => {
  const normalized = normalizeSrtLineEndings(content).trim();

  if (!normalized) {
    return [];
  }

  return normalized
    .split(/\n\n+/)
    .map((block) => {
      const lines = block.split("\n").map((line) => line.trim()).filter(Boolean);
      if (lines.length < 3) {
        return null;
      }

      const [index, timestamp, ...textLines] = lines;
      const [start, end] = timestamp.split("-->").map((part) => part.trim());

      return {
        index,
        start,
        end,
        text: textLines.join(" ").trim(),
      };
    })
    .filter(Boolean);
};

const assTimeToSeconds = (assTime) => {
  if (!assTime) return 0;
  const [hoursPart, minutesPart, secondsPart] = assTime.trim().split(":");
  const [seconds, fraction = "0"] = (secondsPart || "0").split(".");
  return (
    Number(hoursPart || 0) * 3600 +
    Number(minutesPart || 0) * 60 +
    Number(seconds || 0) +
    Number(`0.${fraction}`)
  );
};

const srtTimeToSeconds = (srtTime) => {
  if (!srtTime) return 0;

  const normalized = String(srtTime).trim().replace(",", ".");
  const parts = normalized.split(":");

  if (parts.length !== 3) return 0;

  const [hoursPart, minutesPart, secondsPart] = parts;
  const [seconds, fraction = "0"] = (secondsPart || "0").split(".");

  return (
    Number(hoursPart || 0) * 3600 +
    Number(minutesPart || 0) * 60 +
    Number(seconds || 0) +
    Number(`0.${fraction}`)
  );
};

// Mirrors frontend/src/utils/emphasisUtils.js's parseEmphasis — manual
// keyword emphasis is authored inline as "**word**" (or "**word:#hex**"
// for a word-specific color) markup in the cue text itself, so both sides
// must tokenize it identically.
const parseEmphasisMarkup = (text = "") =>
  String(text)
    .split(/\s+/)
    .filter(Boolean)
    .map((token) => {
      const match = token.match(/^\*\*(.+?)(?::(#[0-9a-fA-F]{6}))?\*\*$/);
      return match
        ? { word: match[1], emphasized: true, color: match[2] || null }
        : { word: token, emphasized: false, color: null };
    });

const escapeAssText = (text) =>
  String(text)
    .replace(/\\/g, "\\\\")
    .replace(/{/g, "\\{")
    .replace(/}/g, "\\}");

// Per-word colors arrive as raw "#rrggbb" straight out of "**word:#hex**"
// markup in the cue text — everywhere else colors reach this file already
// converted to ASS's "&H00bbggrr&" by the caller (worker.js), but this one
// is parsed directly out of user content, so it needs its own conversion.
const hexToAssColorLocal = (hex) => {
  const clean = String(hex || "").replace("#", "");
  const r = clean.substring(0, 2);
  const g = clean.substring(2, 4);
  const b = clean.substring(4, 6);
  return `&H00${b}${g}${r}&`;
};

// Seconds (float) → ASS time "H:MM:SS.CC"
const secondsToAssTime = (seconds) => {
  const totalCentiseconds = Math.max(0, Math.round(Number(seconds || 0) * 100));
  const hours = Math.floor(totalCentiseconds / 360000);
  const minutes = Math.floor((totalCentiseconds % 360000) / 6000);
  const secs = Math.floor((totalCentiseconds % 6000) / 100);
  const centiseconds = totalCentiseconds % 100;

  return `${String(hours).padStart(1, "0")}:${String(minutes).padStart(2, "0")}:${String(secs).padStart(2, "0")}.${String(centiseconds).padStart(2, "0")}`;
};

// Per-word or per-line "intro" animation: transforms FROM a start state TO
// the resting state over a short window beginning at startMs (ms relative
// to the Dialogue line's own start). Returns an ASS override block, or ""
// for "none" — safe to prepend directly before a {\kf} block or text run.
const buildAnimationTag = (mode, startMs, durationMs, options = {}) => {
  const { glowColor } = options;
  const introMs = Math.max(20, Math.min(Math.round(durationMs), 180));
  const safeStart = Math.max(0, Math.round(startMs));

  switch ((mode || "none").toLowerCase()) {
    case "pop":
      return `{\\t(${safeStart},${safeStart + 1},\\fscx120\\fscy120)\\t(${safeStart + 1},${safeStart + introMs},\\fscx100\\fscy100)}`;
    case "bounce": {
      const mid = safeStart + Math.round(introMs * 0.55);
      return `{\\t(${safeStart},${safeStart + 1},\\fscx55\\fscy55)\\t(${safeStart + 1},${mid},\\fscx118\\fscy118)\\t(${mid},${safeStart + introMs},\\fscx100\\fscy100)}`;
    }
    case "fade":
      return `{\\t(${safeStart},${safeStart + 1},\\alpha&HFF&)\\t(${safeStart + 1},${safeStart + introMs},\\alpha&H00&)}`;
    case "zoom":
      return `{\\t(${safeStart},${safeStart + 1},\\fscx70\\fscy70)\\t(${safeStart + 1},${safeStart + introMs},\\fscx100\\fscy100)}`;
    case "neon":
      return `{\\bord4\\blur6\\3c${glowColor || "&H00FFFFFF&"}}`;
    default:
      return "";
  }
};

// "slide" (and any future move-based effect) is always applied once per
// Dialogue line, not per word — computed from the caption's alignment so
// it actually slides toward wherever it rests, not a fixed screen spot.
const buildSlideTag = (alignment, marginV, customPosition = null) => {
  const centerX = customPosition ? customPosition.x : 960;
  const restY = customPosition
    ? customPosition.y
    : Number(alignment) === 8
      ? 60 + Number(marginV || 80)
      : Number(alignment) === 5
        ? 540
        : 1080 - Number(marginV || 80);
  const startY = customPosition
    ? restY - 110
    : Number(alignment) === 8
      ? restY - 110
      : restY + 110;
  return `{\\move(${centerX},${startY},${centerX},${restY})}`;
};

const isLineLevelAnimation = (mode) =>
  ["slide", "neon"].includes(String(mode || "").toLowerCase());

const buildAssDocument = ({
  resolvedFont,
  fontSize,
  primaryColor,
  secondaryColor = "&H000000FF&",
  outlineColor,
  backColor,
  assBold,
  borderStyle,
  outline,
  shadow,
  alignment,
  marginV,
  dialogueLines,
  includeWordBoxStyle = false,
}) => {
  // Word-box captions (one Dialogue per word, positioned with \pos) use a
  // dedicated style — BorderStyle=3 turns "Outline" into box padding around
  // each word, scaled to the font size so bigger captions get bigger boxes.
  const wordBoxStyleLine = includeWordBoxStyle
    ? `\nStyle: WordBox,${resolvedFont.fontFamily},${fontSize},${primaryColor},${secondaryColor},${outlineColor},${backColor},${assBold},0,0,0,100,100,0,0,3,${Math.round(fontSize * 0.28)},0,4,10,10,${marginV},1`
    : "";

  const header = `[Script Info]
ScriptType: v4.00+
WrapStyle: 0
ScaledBorderAndShadow: yes
PlayResX: 1920
PlayResY: 1080

[V4+ Styles]
Format: Name, Fontname, Fontsize, PrimaryColour, SecondaryColour, OutlineColour, BackColour, Bold, Italic, Underline, StrikeOut, ScaleX, ScaleY, Spacing, Angle, BorderStyle, Outline, Shadow, Alignment, MarginL, MarginR, MarginV, Encoding
Style: Default,${resolvedFont.fontFamily},${fontSize},${primaryColor},${secondaryColor},${outlineColor},${backColor},${assBold},0,0,0,100,100,0,0,${borderStyle},${outline},${shadow},${alignment},10,10,${marginV},1${wordBoxStyleLine}

[Events]
Format: Layer, Start, End, Style, Name, MarginL, MarginR, MarginV, Effect, Text`;

  return `${header}\n${dialogueLines}\n`;
};

const validateGeneratedAss = (assContent, expectedSegments = []) => {
  const requiredSections = ["[Script Info]", "[V4+ Styles]", "[Events]"];

  for (const section of requiredSections) {
    if (!assContent.includes(section)) {
      throw new Error(`Generated ASS is missing ${section}`);
    }
  }

  if (!assContent.includes("Dialogue:")) {
    throw new Error("Generated ASS must include at least one Dialogue line");
  }

  for (const segment of expectedSegments) {
    if (segment && !assContent.includes(segment)) {
      throw new Error(`Generated ASS is missing required content: ${segment}`);
    }
  }

  return assContent;
};

// Vertical anchor a caption (or word-box block) centers on, in the same
// 1920x1080 coordinate space buildSlideTag already uses.
const resolveVerticalAnchor = (alignment, marginV) =>
  Number(alignment) === 8
    ? 60 + Number(marginV || 80)
    : Number(alignment) === 5
      ? 540
      : 1080 - Number(marginV || 80);

// Emits one Dialogue per word, positioned via \pos using real measured
// widths (textMeasureService) so each word gets its own solid-colored box
// (the WordBox style added in buildAssDocument) — the Hormozi/Reels look
// that a single-Style, single-Dialogue-per-line ASS document can't express,
// since BorderStyle (the box mode) is a Style-level property, not something
// an override tag can toggle mid-line.
const buildWordBoxDialogues = (entries, {
  fontFile,
  fontSize,
  alignment,
  marginV,
  primaryColor,
  highlightColor,
  backColor,
  uppercase,
  animationMode = "none",
  customPosition = null,
  maxWidth = 1600,
}) => {
  const restY = customPosition ? customPosition.y : resolveVerticalAnchor(alignment, marginV);
  const centerX = customPosition ? customPosition.x : 1920 / 2;
  const padding = Math.round(fontSize * 0.28);
  const rowGap = Math.round(fontSize * 0.25);
  const rowHeight = fontSize + padding * 2 + rowGap;
  const wordGap = Math.round(fontSize * 0.35);
  // "neon" needs \3c for its glow color, but \3c is already spoken for here
  // (it's the per-word box fill) — the two genuinely can't coexist, so
  // neon is skipped in word-box mode rather than silently corrupting box
  // colors. Every other preset is a scale/fade/move, which composes fine.
  const mode = String(animationMode || "none").toLowerCase();
  const effectiveMode = mode === "neon" ? "none" : mode;

  return entries
    .map((e) => {
      const lineText = e.text.split("\\N").join(" ");
      const tokens = parseEmphasisMarkup(lineText).map((token) => ({
        ...token,
        word: uppercase ? token.word.toUpperCase() : token.word,
      }));
      if (!tokens.length) return "";

      const lineDurationMs = Math.max(
        1,
        (srtTimeToSeconds(e.end) - srtTimeToSeconds(e.start)) * 1000
      );
      const rows = layoutWordRows(tokens, { fontFile, fontSize, maxWidth, wordGap });
      const blockHeight = rows.length * rowHeight;
      const firstRowY = restY - blockHeight / 2 + rowHeight / 2;

      return rows
        .map((row, rowIndex) => {
          const rowY = Math.round(firstRowY + rowIndex * rowHeight);
          let x = Math.round(centerX - row.rowWidth / 2);

          return row.words
            .map((word) => {
              const boxColor = word.emphasized
                ? word.color
                  ? hexToAssColorLocal(word.color)
                  : highlightColor
                : backColor;
              const wordX = Math.round(x);
              x += word.width + wordGap;

              // Every word pops in together (synced from the cue's own
              // start) rather than each word timing its own — word-box mode
              // has no per-word speech timing to key off, it's a static
              // caption block, so a synchronized group entrance is the
              // closest match to how the other presets read.
              const positionTag =
                effectiveMode === "slide"
                  ? `\\move(${wordX},${rowY - 110},${wordX},${rowY})`
                  : `\\pos(${wordX},${rowY})`;
              const introTag =
                effectiveMode !== "none" && effectiveMode !== "slide"
                  ? buildAnimationTag(effectiveMode, 0, lineDurationMs)
                  : "";

              // BorderStyle=3's opaque box fill comes from OutlineColour
              // (\3c), not BackColour (\4c) — confirmed empirically against
              // libass, contrary to the ASS spec's naming.
              return `Dialogue: 0,${srtTimeToAss(e.start)},${srtTimeToAss(e.end)},WordBox,,0,0,0,,${introTag}{${positionTag}\\an4\\1c${primaryColor}\\3c${boxColor}}${escapeAssText(word.word)}`;
            })
            .join("\n");
        })
        .join("\n");
    })
    .filter(Boolean)
    .join("\n");
};

// Build ASS file string from SRT string + style options
const generateAss = (srtContent, options = {}) => {
  const {
    fontName     = "Poppins",
    fontSize     = 48,
    fontWeight   = "Regular",
    primaryColor = "&H00FFFFFF&", // white text
    outlineColor = "&H00000000&", // black outline
    backColor    = "&H80000000&", // semi-transparent bg
    outline      = 2,
    shadow       = 1,
    alignment    = 2,             // 2 = bottom center
    backgroundEnabled = false,
    // "none" | "line" (today's whole-line box) | "word" (per-word boxes).
    // Falls back to backgroundEnabled for callers that haven't been
    // updated to pass backgroundStyle explicitly.
    backgroundStyle = backgroundEnabled ? "line" : "none",
    uppercase = false,
    marginV      = 80,
    animationMode = "none",
    highlightColor = "&H0000FFFF&",
    // { x, y } in the 1920x1080 canvas, from dragging the caption in the
    // live preview — overrides the alignment/marginV-driven default spot.
    customPosition = null,
  } = options;

  const resolvedFont = resolveFont({
    family: fontName,
    weight: fontWeight,
  });
  const assBold =
    ["SemiBold", "Bold", "ExtraBold"].includes(resolvedFont.weight)
      ? -1
      : 0;
  const borderStyle = backgroundStyle === "line" ? 3 : 1;
  const applyCase = (word) => (uppercase ? word.toUpperCase() : word);

  // Renders manual "**word**" keyword emphasis (bigger + highlight color)
  // per word, reverting explicitly afterward rather than via \r so it
  // doesn't clobber a line-level animation tag (e.g. neon) already active
  // on the same Dialogue line.
  const buildEmphasisAwareText = (text) =>
    String(text)
      .split("\\N")
      .map((line) =>
        parseEmphasisMarkup(line)
          .map(({ word, emphasized, color }) => {
            if (!emphasized) return escapeAssText(applyCase(word));
            const wordColor = color ? hexToAssColorLocal(color) : highlightColor;
            return `{\\fscx130\\fscy130\\1c${wordColor}}${escapeAssText(applyCase(word))}{\\fscx100\\fscy100\\1c${primaryColor}}`;
          })
          .join(" ")
      )
      .join("\\N");

  const entries = parseSrt(srtContent);
  const dialogues =
    backgroundStyle === "word"
      ? buildWordBoxDialogues(entries, {
          fontFile: resolvedFont.fontFile,
          fontSize,
          alignment,
          marginV,
          primaryColor,
          highlightColor,
          backColor,
          uppercase,
          animationMode,
          customPosition,
        })
      : entries
          .map((e) => {
            const lineDurationMs = Math.max(
              1,
              (srtTimeToSeconds(e.end) - srtTimeToSeconds(e.start)) * 1000
            );
            const isSlide = animationMode.toLowerCase?.() === "slide";
            const animationTag = isLineLevelAnimation(animationMode)
              ? isSlide
                ? buildSlideTag(alignment, marginV, customPosition)
                : buildAnimationTag("neon", 0, lineDurationMs, { glowColor: primaryColor })
              : buildAnimationTag(animationMode, 0, lineDurationMs);
            // Slide already positions via \move above; everything else
            // needs an explicit \pos to land at the dragged spot instead of
            // the Style's Alignment/MarginV default.
            const positionTag = customPosition && !isSlide
              ? `{\\an5\\pos(${customPosition.x},${customPosition.y})}`
              : "";

            return `Dialogue: 0,${srtTimeToAss(e.start)},${srtTimeToAss(e.end)},Default,,0,0,0,,${positionTag}${animationTag}${buildEmphasisAwareText(e.text)}`;
          })
          .join("\n");
  const assContent = buildAssDocument({
    resolvedFont,
    fontSize,
    primaryColor,
    outlineColor,
    backColor,
    assBold,
    borderStyle,
    outline,
    shadow,
    alignment,
    marginV,
    dialogueLines: dialogues,
    includeWordBoxStyle: backgroundStyle === "word",
  });

  return validateGeneratedAss(assContent, ["Dialogue:"]);

};

// Read SRT from disk → write ASS next to it → return ASS path
const convertSrtToAss = (srtPath, options = {}) => {
  const srtContent = fs.readFileSync(srtPath, "utf8");
  const assContent = generateAss(srtContent, options);
  const assPath = srtPath.replace(/\.srt$/i, ".ass");
  fs.writeFileSync(assPath, assContent, { encoding: "utf8" });
  return assPath;
};

const generateKaraokeAss = (words = [], options = {}) => {
  const {
    fontName = "Poppins",
    fontSize = 60,
    fontWeight = "Regular",
    highlightMode = "current",
    highlightColor = "&H0000FFFF&",
    animationMode = "none",
    primaryColor = "&H00FFFFFF&",
    outlineColor = "&H00000000&",
    backColor = "&H80000000&",
    outline = 2,
    shadow = 1,
    alignment = 2,
    backgroundEnabled = false,
    marginV = 80,
    subtitlePath,
    customPosition = null,
  } = options;

  const resolvedFont = resolveFont({
    family: fontName,
    weight: fontWeight,
  });
  const assBold =
    ["SemiBold", "Bold", "ExtraBold"].includes(resolvedFont.weight)
      ? -1
      : 0;
  const borderStyle = backgroundEnabled ? 3 : 1;

  const validWords = Array.isArray(words)
    ? words.filter((word) => word && word.word)
    : [];

  const cueList = (() => {
    if (!subtitlePath) {
      return [];
    }

    try {
      const srtContent = fs.readFileSync(subtitlePath, "utf8");
      return parseSrtCues(srtContent);
    } catch (error) {
      return [];
    }
  })();

  const buildCueDialogues = (cue, cueWords) => {
    const cueTextWords = (cue.text || "").split(/\s+/).filter(Boolean);

    const fallbackWords = cueTextWords.map((word, index) => ({
      word,
      start: index === 0 ? srtTimeToSeconds(cue.start) : srtTimeToSeconds(cue.start),
      end:
        index === cueTextWords.length - 1
          ? srtTimeToSeconds(cue.end)
          : srtTimeToSeconds(cue.start),
    }));

    const normalizedWords = cueWords.length
      ? cueWords.map((word, index) => ({
          word: word.word,
          start: Number.isFinite(Number(word.start))
            ? Number(word.start)
            : srtTimeToSeconds(cue.start),
          end: Number.isFinite(Number(word.end))
            ? Number(word.end)
            : index === cueWords.length - 1
              ? srtTimeToSeconds(cue.end)
              : srtTimeToSeconds(cue.start),
        }))
      : fallbackWords;

    if (!normalizedWords.length) {
      return [];
    }

    const lineLevel = isLineLevelAnimation(animationMode);
    const isSlide = lineLevel && animationMode.toLowerCase() === "slide";
    const lineDurationMs = Math.max(
      1,
      (srtTimeToSeconds(cue.end) - srtTimeToSeconds(cue.start)) * 1000
    );
    const lineAnimationTag = lineLevel
      ? isSlide
        ? buildSlideTag(alignment, marginV, customPosition)
        : buildAnimationTag("neon", 0, lineDurationMs, { glowColor: primaryColor })
      : "";
    // Slide already positions via \move; everything else needs an explicit
    // \pos to land at the dragged spot instead of the Style's default.
    const positionTag = customPosition && !isSlide
      ? `{\\an5\\pos(${customPosition.x},${customPosition.y})}`
      : "";

    let cumulativeMs = 0;
    const dialogueText = normalizedWords
      .map((word, index) => {
        const duration = Math.max(
          1,
          Math.round((Number(word.end) - Number(word.start)) * 100)
        );
        const wordStartMs = cumulativeMs;
        const wordDurationMs = duration * 10;
        const wordEndMs = wordStartMs + wordDurationMs;
        cumulativeMs = wordEndMs;

        const perWordTag = lineLevel
          ? ""
          : buildAnimationTag(animationMode, wordStartMs, wordDurationMs);
        const prefix = index === 0 ? positionTag + lineAnimationTag + perWordTag : perWordTag;

        // "progressive" uses ASS's native \kf sweep, which naturally keeps
        // already-spoken words highlighted. "current" instead only highlights
        // a word during its own window, then reverts — \kf can't express
        // that (it never un-highlights), so it's done via explicit \1c color
        // transforms timed off the same wordStartMs/wordEndMs used above.
        const karaokeTag =
          highlightMode === "progressive"
            ? `{\\kf${duration}}`
            : `{\\t(${wordStartMs},${wordStartMs + 1},\\1c${highlightColor})\\t(${wordEndMs},${wordEndMs + 1},\\1c${primaryColor})}`;

        return `${prefix}${karaokeTag}${escapeAssText(word.word)}`;
      })
      .join(" ");

    return [
      `Dialogue: 0,${secondsToAssTime(srtTimeToSeconds(cue.start))},${secondsToAssTime(srtTimeToSeconds(cue.end))},Default,,0,0,0,,${dialogueText}`,
    ];
  };

  const dialogues = cueList.length
    ? cueList
        .map((cue) => {
          const cueStart = srtTimeToSeconds(cue.start);
          const cueEnd = srtTimeToSeconds(cue.end);
          const cueWords = validWords.filter((word) => {
            const wordStart = Number(word.start) || 0;
            const wordEnd = Number(word.end) || 0;
            return wordStart >= cueStart && wordEnd <= cueEnd;
          });

          return buildCueDialogues(cue, cueWords);
        })
        .flat()
        .join("\n")
    : "";

  const fallbackDialogue =
    "Dialogue: 0,0:00:00.00,0:00:01.00,Default,,0,0,0,,";
  const eventLines = dialogues ? dialogues : fallbackDialogue;
  const assContent = buildAssDocument({
    resolvedFont,
    fontSize,
    primaryColor,
    secondaryColor: highlightColor,
    outlineColor,
    backColor,
    assBold,
    borderStyle,
    outline,
    shadow,
    alignment,
    marginV,
    dialogueLines: eventLines,
  });

  fs.mkdirSync(path.join("src", "subtitles"), { recursive: true });

  const assFileName = `karaoke_${Date.now()}.ass`;
  const assPath = path.resolve(path.join("src", "subtitles", assFileName));
  validateGeneratedAss(assContent, ["Dialogue:"]);
  //console.log("===== GENERATED ASS =====");
  //console.log(assContent);
  fs.writeFileSync(assPath, assContent, { encoding: "utf8" });

  return assPath;
};

const generateAssFromPreview = (previewModel = {}) => {
  const previewWords = Array.isArray(previewModel.words)
    ? previewModel.words
        .filter((word) => word && word.word)
        .map((word) => ({
          word: word.word,
          start: Number(word.start) || 0,
          end: Number(word.end) || 0,
        }))
    : [];
  const previewCues = Array.isArray(previewModel.cues)
    ? previewModel.cues.filter((cue) => cue && cue.text)
    : [];
  const style = previewModel.style || {};

  if (!previewWords.length) {
    return null;
  }

  const resolvedFont = resolveFont({
    family: style.fontName || "Poppins",
    weight: style.fontWeight || "Regular",
  });
  const assBold =
    ["SemiBold", "Bold", "ExtraBold"].includes(resolvedFont.weight)
      ? -1
      : 0;
  const borderStyle = style.backgroundEnabled ? 3 : 1;
  const primaryColor = style.fontColor || "&H00FFFFFF&";
  const outlineColor = style.outlineEnabled
    ? style.outlineColor || "&H00000000&"
    : "&H00000000&";
  const backColor = style.backgroundEnabled
    ? style.backColor || "&H80000000&"
    : "&H80000000&";
  const alignment =
    style.position === "top" ? 8 : style.position === "center" ? 5 : 2;
  const marginV = 80;
  const customPosition =
    style.position === "custom" &&
    Number.isFinite(Number(style.positionX)) &&
    Number.isFinite(Number(style.positionY))
      ? { x: (Number(style.positionX) / 100) * 1920, y: (Number(style.positionY) / 100) * 1080 }
      : null;

  const animationMode = style.animation || "none";

  const buildCueDialogue = (cue, cueWords) => {
    const normalizedWords = cueWords.length ? cueWords : previewWords;

    const lineLevel = isLineLevelAnimation(animationMode);
    const isSlide = lineLevel && animationMode.toLowerCase() === "slide";
    const lineDurationMs = Math.max(1, (Number(cue.end) - Number(cue.start)) * 1000);
    const lineAnimationTag = lineLevel
      ? isSlide
        ? buildSlideTag(alignment, marginV, customPosition)
        : buildAnimationTag("neon", 0, lineDurationMs, { glowColor: primaryColor })
      : "";
    const positionTag = customPosition && !isSlide
      ? `{\\an5\\pos(${customPosition.x},${customPosition.y})}`
      : "";

    let cumulativeMs = 0;
    const dialogueText = normalizedWords
      .map((word, index) => {
        const duration = Math.max(
          1,
          Math.round((Number(word.end) - Number(word.start)) * 100)
        );
        const wordStartMs = cumulativeMs;
        cumulativeMs += duration * 10;

        const perWordTag = lineLevel ? "" : buildAnimationTag(animationMode, wordStartMs, duration * 10);
        const prefix = index === 0 ? positionTag + lineAnimationTag + perWordTag : perWordTag;

        return `${prefix}{\\kf${duration}}${escapeAssText(word.word)}`;
      })
      .join(" ");

    return `Dialogue: 0,${secondsToAssTime(cue.start)},${secondsToAssTime(cue.end)},Default,,0,0,0,,${dialogueText}`;
  };

  const dialogues = previewCues.length
    ? previewCues
        .map((cue) => {
          const cueStart = srtTimeToSeconds(cue.start);
          const cueEnd = srtTimeToSeconds(cue.end);
          const cueWords = previewWords.filter((word) => {
            const wordStart = Number(word.start) || 0;
            const wordEnd = Number(word.end) || 0;
            return wordStart >= cueStart && wordEnd <= cueEnd;
          });

          return buildCueDialogue(
            {
              start: cueStart,
              end: cueEnd,
            },
            cueWords
          );
        })
        .join("\n")
    : [
        `Dialogue: 0,0:00:00.00,0:00:01.00,Default,,0,0,0,,${previewWords
          .map((word) => `{\\kf${Math.max(1, Math.round((word.end - word.start) * 100))}}${escapeAssText(word.word)}`)
          .join(" ")}`,
      ].join("\n");

  const assContent = buildAssDocument({
    resolvedFont,
    fontSize: Number(style.fontSize) || 60,
    primaryColor,
    secondaryColor: style.highlightColor || "&H0000FFFF&",
    outlineColor,
    backColor,
    assBold,
    borderStyle,
    outline: style.outlineEnabled ? Number(style.outline) || 0 : 0,
    shadow: style.shadowEnabled ? Number(style.shadow) || 0 : 0,
    alignment,
    marginV,
    dialogueLines: dialogues,
  });

  validateGeneratedAss(assContent, ["Dialogue:"]);

  fs.mkdirSync(path.join("src", "subtitles"), { recursive: true });

  const assFileName = `preview_${Date.now()}.ass`;
  const assPath = path.resolve(path.join("src", "subtitles", assFileName));
  fs.writeFileSync(assPath, assContent, { encoding: "utf8" });

  return assPath;
};

// ─── exports ───────────────────────────────────────────

module.exports = {
  generateSRT,
  generateAss,
  convertSrtToAss,
  validateEnhancedSrt,
  resolveFont,
  generateKaraokeAss,
  generateAssFromPreview,
};

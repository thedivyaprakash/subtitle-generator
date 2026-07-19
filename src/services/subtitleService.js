const fs = require("fs");
const path = require("path");
const { romanizeText,} = require("./romanizationService");
const { resolveFont } = require("./fontService");

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
// keyword emphasis is authored inline as "**word**" markup in the cue
// text itself, so both sides must tokenize it identically.
const parseEmphasisMarkup = (text = "") =>
  String(text)
    .split(/\s+/)
    .filter(Boolean)
    .map((token) => {
      const match = token.match(/^\*\*(.+)\*\*$/);
      return match
        ? { word: match[1], emphasized: true }
        : { word: token, emphasized: false };
    });

const escapeAssText = (text) =>
  String(text)
    .replace(/\\/g, "\\\\")
    .replace(/{/g, "\\{")
    .replace(/}/g, "\\}");

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
const buildSlideTag = (alignment, marginV) => {
  const centerX = 960;
  const restY =
    Number(alignment) === 8
      ? 60 + Number(marginV || 80)
      : Number(alignment) === 5
        ? 540
        : 1080 - Number(marginV || 80);
  const startY = Number(alignment) === 8 ? restY - 110 : restY + 110;
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
}) => {
  const header = `[Script Info]
ScriptType: v4.00+
WrapStyle: 0
ScaledBorderAndShadow: yes
PlayResX: 1920
PlayResY: 1080

[V4+ Styles]
Format: Name, Fontname, Fontsize, PrimaryColour, SecondaryColour, OutlineColour, BackColour, Bold, Italic, Underline, StrikeOut, ScaleX, ScaleY, Spacing, Angle, BorderStyle, Outline, Shadow, Alignment, MarginL, MarginR, MarginV, Encoding
Style: Default,${resolvedFont.fontFamily},${fontSize},${primaryColor},${secondaryColor},${outlineColor},${backColor},${assBold},0,0,0,100,100,0,0,${borderStyle},${outline},${shadow},${alignment},10,10,${marginV},1

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
    marginV      = 80,
    animationMode = "none",
    highlightColor = "&H0000FFFF&",
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

  // Renders manual "**word**" keyword emphasis (bigger + highlight color)
  // per word, reverting explicitly afterward rather than via \r so it
  // doesn't clobber a line-level animation tag (e.g. neon) already active
  // on the same Dialogue line.
  const buildEmphasisAwareText = (text) =>
    String(text)
      .split("\\N")
      .map((line) =>
        parseEmphasisMarkup(line)
          .map(({ word, emphasized }) =>
            emphasized
              ? `{\\fscx130\\fscy130\\1c${highlightColor}}${escapeAssText(word)}{\\fscx100\\fscy100\\1c${primaryColor}}`
              : escapeAssText(word)
          )
          .join(" ")
      )
      .join("\\N");

  const entries = parseSrt(srtContent);
  const dialogues = entries
    .map((e) => {
      const lineDurationMs = Math.max(
        1,
        (srtTimeToSeconds(e.end) - srtTimeToSeconds(e.start)) * 1000
      );
      const animationTag = isLineLevelAnimation(animationMode)
        ? animationMode.toLowerCase() === "slide"
          ? buildSlideTag(alignment, marginV)
          : buildAnimationTag("neon", 0, lineDurationMs, { glowColor: primaryColor })
        : buildAnimationTag(animationMode, 0, lineDurationMs);

      return `Dialogue: 0,${srtTimeToAss(e.start)},${srtTimeToAss(e.end)},Default,,0,0,0,,${animationTag}${buildEmphasisAwareText(e.text)}`;
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
    const lineDurationMs = Math.max(
      1,
      (srtTimeToSeconds(cue.end) - srtTimeToSeconds(cue.start)) * 1000
    );
    const lineAnimationTag = lineLevel
      ? animationMode.toLowerCase() === "slide"
        ? buildSlideTag(alignment, marginV)
        : buildAnimationTag("neon", 0, lineDurationMs, { glowColor: primaryColor })
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
        const prefix = index === 0 ? lineAnimationTag + perWordTag : perWordTag;

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

  const animationMode = style.animation || "none";

  const buildCueDialogue = (cue, cueWords) => {
    const normalizedWords = cueWords.length ? cueWords : previewWords;

    const lineLevel = isLineLevelAnimation(animationMode);
    const lineDurationMs = Math.max(1, (Number(cue.end) - Number(cue.start)) * 1000);
    const lineAnimationTag = lineLevel
      ? animationMode.toLowerCase() === "slide"
        ? buildSlideTag(alignment, marginV)
        : buildAnimationTag("neon", 0, lineDurationMs, { glowColor: primaryColor })
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
        const prefix = index === 0 ? lineAnimationTag + perWordTag : perWordTag;

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

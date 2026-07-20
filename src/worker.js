require("dotenv").config();

const fs = require("fs");
const { Worker } = require("bullmq");
const connection = require("./queue/connection");
const { updateVideo, getVideo } = require("./db/database");

const { extractAudio } = require("./services/ffmpegService");
const { transcribeAudio } = require("./services/transcriptionService");
const { denoiseAudio } = require("./services/audioEnhancementService");
const {
  generateSRT,
  validateEnhancedSrt,
  convertSrtToAss,
  generateKaraokeAss,
  generateAssFromPreview,
} = require("./services/subtitleService");
const { enhanceText } = require("./services/geminiService");
const { resolveFont } = require("./services/fontService");
const { getKaraokePresetDefaults } = require("./services/karaokePresetService");
const { burnSubtitles } = require("./services/videoSubtitleService");

const hexToAssColor = (hex) => {
  const clean = hex.replace("#", "");
  const r = clean.substring(0, 2);
  const g = clean.substring(2, 4);
  const b = clean.substring(4, 6);
  return `&H00${b}${g}${r}&`;
};

const hexToAssBackColor = (hex) => {
  const clean = hex.replace("#", "");
  const r = clean.substring(0, 2);
  const g = clean.substring(2, 4);
  const b = clean.substring(4, 6);
  return `&H80${b}${g}${r}&`;
};

const transcriptionWorker = new Worker(
  "transcription",
  async (job) => {
    const { videoId, videoPath, language, skipExtraction } = job.data;

    try {
      updateVideo(videoId, { status: "transcribing" });

      const audioPath = skipExtraction ? videoPath : await extractAudio(videoPath);
      const [transcript, denoisedAudioPath] = await Promise.all([
        transcribeAudio(audioPath, language),
        denoiseAudio(audioPath).catch(() => null),
      ]);
      const words = transcript.results.channels[0].alternatives[0].words;

      const subtitlePath = generateSRT(transcript);
      const wordsPath = subtitlePath.replace(/\.srt$/i, ".words.json");

      fs.writeFileSync(wordsPath, JSON.stringify(words, null, 2), "utf8");

      const originalSrtContent = fs.readFileSync(subtitlePath, "utf8");
      const enhancedSrtContent = await enhanceText(originalSrtContent, language);
      const subtitleContent = validateEnhancedSrt(originalSrtContent, enhancedSrtContent);

      fs.writeFileSync(subtitlePath, subtitleContent, "utf8");

      updateVideo(videoId, {
        status: "ready",
        subtitle_path: subtitlePath,
        words_path: wordsPath,
        denoised_audio_path: denoisedAudioPath,
      });
    } catch (error) {
      updateVideo(videoId, { status: "failed", error_message: error.toString() });
      throw error;
    }
  },
  { connection }
);

const renderWorker = new Worker(
  "render",
  async (job) => {
    const {
      videoId,
      videoPath,
      subtitlePath,
      subtitleContent,
      subtitleMode,
      subtitlePreset,
      highlightMode,
      highlightColor,
      animation,
      fontName,
      fontWeight,
      fontSize,
      fontColor,
      position,
      outline,
      outlineEnabled,
      shadow,
      shadowEnabled,
      backColor,
      outlineColor,
      backgroundEnabled,
      backgroundStyle,
      uppercase,
      previewModel,
      useEnhancedAudio,
    } = job.data;

    try {
      updateVideo(videoId, { status: "rendering" });

      const video = getVideo(videoId);
      const enhancedAudioPath =
        useEnhancedAudio && video?.denoised_audio_path && fs.existsSync(video.denoised_audio_path)
          ? video.denoised_audio_path
          : null;

      fs.writeFileSync(subtitlePath, subtitleContent, "utf8");

      const resolvedFont = resolveFont({ family: fontName, weight: fontWeight });

      const karaokePresetDefaults = getKaraokePresetDefaults();
      const preset =
        karaokePresetDefaults[String(subtitlePreset || "").toLowerCase()] || {};
      const selectedKaraokeHighlightMode =
        highlightMode || preset.karaokeHighlightMode || "current";
      const selectedKaraokeAnimationMode =
        animation || preset.karaokeAnimationMode || "none";
      const selectedKaraokeHighlightColor =
        highlightColor || preset.karaokeHighlightColor || "#FFFF00";
      const selectedPosition = position || preset.position || "bottom";
      const selectedFontSize = Number(fontSize || preset.fontSize || 48);
      const selectedOutlineEnabled = outlineEnabled === true || outlineEnabled === "true";
      const selectedShadowEnabled = shadowEnabled === true || shadowEnabled === "true";
      const selectedBackgroundEnabled =
        backgroundEnabled === true || backgroundEnabled === "true";
      // "none" | "line" | "word" — falls back to the legacy boolean for
      // any caller that hasn't been updated to send backgroundStyle yet.
      const selectedBackgroundStyle =
        backgroundStyle || (selectedBackgroundEnabled ? "line" : "none");
      const selectedUppercase = uppercase === true || uppercase === "true";
      const selectedOutline = Number(outline) || 0;
      const selectedShadow = Number(shadow) || 0;
      const selectedOutlineColor =
        selectedOutlineEnabled && outlineColor ? outlineColor : "#000000";
      const selectedBackColor =
        selectedBackgroundStyle !== "none" && backColor ? backColor : "#000000";

      const alignment =
        selectedPosition === "top" ? 8 : selectedPosition === "center" ? 5 : 2;

      let assPath;
      let words = [];

      if (previewModel && Array.isArray(previewModel.words) && previewModel.words.length) {
        assPath = generateAssFromPreview(previewModel);
      } else if (subtitleMode === "karaoke") {
        const wordsPath = subtitlePath.replace(/\.srt$/i, ".words.json");

        if (fs.existsSync(wordsPath)) {
          try {
            words = JSON.parse(fs.readFileSync(wordsPath, "utf8"));
          } catch (error) {
            throw new Error(`Failed to read karaoke words file: ${error.message}`);
          }
        }

        assPath = generateKaraokeAss(words, {
          subtitlePath,
          fontName: resolvedFont.fontFamily,
          fontWeight: resolvedFont.weight,
          fontSize: selectedFontSize,
          highlightMode: selectedKaraokeHighlightMode,
          animationMode: selectedKaraokeAnimationMode,
          highlightColor: hexToAssColor(selectedKaraokeHighlightColor),
          primaryColor: hexToAssColor(fontColor),
          alignment,
        });
      } else {
        assPath = convertSrtToAss(subtitlePath, {
          fontName: resolvedFont.fontFamily,
          fontWeight: resolvedFont.weight,
          fontSize,
          primaryColor: hexToAssColor(fontColor),
          highlightColor: hexToAssColor(selectedKaraokeHighlightColor),
          outline: selectedOutline,
          shadow: selectedShadow,
          // Word boxes are meant to read as solid Hormozi-style pills, so
          // they use the opaque encoding; the whole-line backdrop keeps its
          // existing semi-transparent look.
          backColor:
            selectedBackgroundStyle === "word"
              ? hexToAssColor(selectedBackColor)
              : selectedBackgroundStyle === "line"
                ? hexToAssBackColor(selectedBackColor)
                : "&H80000000&",
          outlineColor: selectedOutlineEnabled
            ? hexToAssColor(selectedOutlineColor)
            : "&H00000000&",
          backgroundStyle: selectedBackgroundStyle,
          uppercase: selectedUppercase,
          alignment,
          animationMode: selectedKaraokeAnimationMode,
        });
      }

      const finalVideoPath = await burnSubtitles(videoPath, assPath, {
        fontFile: resolvedFont.fontFile,
        audioPath: enhancedAudioPath,
      });

      updateVideo(videoId, { status: "done", final_video_path: finalVideoPath });
    } catch (error) {
      updateVideo(videoId, { status: "failed", error_message: error.toString() });
      throw error;
    }
  },
  { connection }
);

transcriptionWorker.on("failed", (job, err) => {
  console.error("Transcription job failed:", job?.id, err?.message || err);
});

renderWorker.on("failed", (job, err) => {
  console.error("Render job failed:", job?.id, err?.message || err);
});

console.log("Workers started: transcription, render");

const express = require("express");
const multer = require("multer");
const fs = require("fs");
const path = require("path");

const router = express.Router();
const uploadDir = path.join(process.cwd(), "src", "uploads");
const { extractAudio } = require("../services/ffmpegService");

const { transcribeAudio } =
require("../services/transcriptionService");

const { generateSRT, validateEnhancedSrt } =
require("../services/subtitleService");
const { resolveFont } =
require("../services/fontService");
const {
  getKaraokePresetDefaults,
} = require("../services/karaokePresetService");


const storage = multer.diskStorage({
  destination: function (req, file, cb) {
    fs.mkdirSync(uploadDir, { recursive: true });
    cb(null, uploadDir);
  },

  filename: function (req, file, cb) {
    const uniqueName =
      Date.now() + path.extname(file.originalname);

    cb(null, uniqueName);
  },
});

const upload = multer({ storage });

router.get("/video", (req, res) => {
  res.status(200).json({
    success: true,
    message: "Use POST /api/upload/video with form-data key 'video' to upload a file.",
  });
});

router.post(
  "/video",
  upload.single("video"),
  async (req, res) => {

    try {

      const videoPath = req.file.path;
      const {
      subtitleMode,
      fontSize,
      fontColor,
      backgroundColor,
      position
    } = req.body;

      const audioPath =
        await extractAudio(videoPath);

      const transcript =
      await transcribeAudio(
        audioPath
      );

      const words =
        transcript.results.channels[0].alternatives[0].words;

      const { enhanceText } =
        require("../services/geminiService");

 
      const subtitlePath =
      generateSRT(transcript);

      const wordsPath =
        subtitlePath.replace(/\.srt$/i, ".words.json");

      fs.writeFileSync(
        wordsPath,
        JSON.stringify(words, null, 2),
        "utf8"
      );

    const originalSrtContent =
      fs.readFileSync(
        subtitlePath,
        "utf8"
      );

    const enhancedSrtContent =
      await enhanceText(
        originalSrtContent
      );

    //console.log("ORIGINAL SRT =>\n",originalSrtContent );

    //console.log("GEMINI SRT LENGTH =>",enhancedSrtContent.length);

    //console.log("ENHANCED SRT =>\n", enhancedSrtContent );

    const subtitleContent =
      validateEnhancedSrt(
        originalSrtContent,
        enhancedSrtContent
      );
      
     //console.log( "RETURNING TO FRONTEND =>\n", subtitleContent );

      res.json({
      success: true,
      videoPath,
      subtitlePath,
      wordsPath,
      subtitleContent,
      words
    });

    } catch (error) {

   //console.log("FFMPEG ERROR => ", error);
   //console.error("VIDEO ROUTE ERROR =>");
   // console.error(error);

  res.status(500).json({
    success: false,
    error: error.toString()
  });

}

  }
);

router.post("/save-srt", (req, res) => {
  try {
    const { subtitlePath, subtitleContent } = req.body;

    fs.writeFileSync(
      subtitlePath,
      subtitleContent,
      "utf8"
    );

    res.json({
      success: true
    });

  } catch (error) {
    res.status(500).json({
      success: false,
      error: error.toString()
    });

  }
});

router.post("/generate-video", async (req, res) => {
  //console.log("===== GENERATE VIDEO API CALLED =====");
  //console.log(req.body);

  try {
    const {
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
      backgroundEnabled
    } = req.body;

    //console.log("===== GENERATE VIDEO =====");
    //console.log("subtitleMode:", subtitleMode);

    fs.writeFileSync(
      subtitlePath,
      subtitleContent,
      "utf8"
    );

    //console.log("SRT UPDATED");
    //console.log("STEP 1");
    
    const {
    convertSrtToAss,
    generateKaraokeAss,
    generateAssFromPreview
    } = require("../services/subtitleService");

    //console.log("STEP 2");

        const hexToAssColor = (hex) => {
      const clean = hex.replace("#", "");
      const r = clean.substring(0, 2);
      const g = clean.substring(2, 4);
      const b = clean.substring(4, 6);
      return `&H00${b}${g}${r}&`;
    };

    const resolvedFont =
      resolveFont({ family: fontName, weight: fontWeight });
    
    const hexToAssBackColor = (hex) => {
    const clean = hex.replace("#", "");
    const r = clean.substring(0, 2);
    const g = clean.substring(2, 4);
    const b = clean.substring(4, 6);
    //80 = semi-transparent background
    return `&H80${b}${g}${r}&`;
  };

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
    const selectedBackgroundEnabled = backgroundEnabled === true || backgroundEnabled === "true";
    const selectedOutline = Number(outline) || 0;
    const selectedShadow = Number(shadow) || 0;
    const selectedOutlineColor =
      selectedOutlineEnabled && outlineColor ? outlineColor : "#000000";
    const selectedBackColor =
      selectedBackgroundEnabled && backColor ? backColor : "#000000";

    const previewModel = req.body.previewModel || null;

    const alignment =
      selectedPosition === "top"
        ? 8
        : selectedPosition === "center"
        ? 5
        : 2;

let assPath;
let words = [];

//console.log("Branch Check:", subtitleMode);
if (previewModel && Array.isArray(previewModel.words) && previewModel.words.length) {
  assPath = generateAssFromPreview(previewModel);
} else if (subtitleMode === "karaoke") {
  //console.log(">>> ENTERED KARAOKE BRANCH");
  const wordsPath =
    subtitlePath.replace(/\.srt$/i, ".words.json");

  if (fs.existsSync(wordsPath)) {
    try {
      words = JSON.parse(fs.readFileSync(wordsPath, "utf8"));
    } catch (error) {
      throw new Error(`Failed to read karaoke words file: ${error.message}`);
    }
  }

  assPath = generateKaraokeAss(
    words,
    {
      subtitlePath,
      fontName: resolvedFont.fontFamily,
      fontWeight: resolvedFont.weight,
      fontSize: selectedFontSize,
      highlightMode: selectedKaraokeHighlightMode,
      animationMode: selectedKaraokeAnimationMode,
      highlightColor: hexToAssColor(selectedKaraokeHighlightColor),
      primaryColor: hexToAssColor(fontColor),
      alignment,
      
    }
    
  );
  
  /*
  console.log("Generated Karaoke ASS:", assPath);
  console.log("ASS Exists:", fs.existsSync(assPath));
  console.log("===== KARAOKE MODE =====");
  console.log("Total Words:", words.length);
  console.log("Generated Karaoke ASS:", assPath);
  console.log("Exists:", fs.existsSync(assPath));
  */

if (fs.existsSync(assPath)) {
    //console.log("Real Path:", require("path").resolve(assPath));
}

  } else {
    assPath = 
          convertSrtToAss(
          subtitlePath,
          {
            fontName: resolvedFont.fontFamily,
            fontWeight: resolvedFont.weight,
            fontSize,
            primaryColor:
            hexToAssColor(fontColor),
            outline: selectedOutline,
            shadow: selectedShadow,
            backColor: selectedBackgroundEnabled
                      ? hexToAssBackColor(selectedBackColor)
                      : "&H80000000&",
            outlineColor:
            selectedOutlineEnabled
              ? hexToAssColor(selectedOutlineColor)
              : "&H00000000&",
              backgroundEnabled: selectedBackgroundEnabled,
              alignment
                  }
                );
  }

      const { burnSubtitles } =
      require("../services/videoSubtitleService");

      //console.log("STEP 3");
      //console.log("Burning ASS:", assPath);

      const finalVideoPath =
      await burnSubtitles(
        videoPath,
        assPath,
        {
          fontFile: resolvedFont.fontFile,
        }
      );

    return res.json({
    success: true,
    assPath,
    finalVideoPath,
    subtitlePath,
    message: "Video Generated"
  });

  } catch (error) {

  console.error("===== GENERATE VIDEO ERROR =====");
  console.error(error);
  console.error("==============================");

  res.status(500).json({
    success: false,
    error: error.toString()
  });

}

});

router.get("/download-srt", (req, res) => {

  const filePath = req.query.path;

  if (!fs.existsSync(filePath)) {

    return res.status(404).json({
      success: false,
      message: "SRT file not found"
    });

  }

  res.download(filePath);

});

router.get("/download-video", (req, res) => {

  const filePath = req.query.path;

  if (!fs.existsSync(filePath)) {

    return res.status(404).json({
      success: false,
      message: "Video not found"
    });

  }

  res.download(filePath);

});

module.exports = router;

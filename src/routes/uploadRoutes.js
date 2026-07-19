const express = require("express");
const multer = require("multer");
const fs = require("fs");
const path = require("path");

const router = express.Router();
const uploadDir = path.join(process.cwd(), "src", "uploads");

const { createVideo, updateVideo, getVideo } = require("../db/database");
const transcriptionQueue = require("../queue/transcriptionQueue");
const renderQueue = require("../queue/renderQueue");
const { validateEnhancedSrt } = require("../services/subtitleService");
const { translateText } = require("../services/geminiService");

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
      const language = req.body.language || "hi";

      const videoId = createVideo({
        originalFilename: req.file.originalname,
        videoPath,
      });

      await transcriptionQueue.add("transcribe", { videoId, videoPath, language });

      res.json({
        success: true,
        videoId,
        videoPath,
      });

    } catch (error) {

  res.status(500).json({
    success: false,
    error: error.toString()
  });

}

  }
);

router.post(
  "/audio",
  upload.single("audio"),
  async (req, res) => {

    try {

      const audioPath = req.file.path;
      const language = req.body.language || "hi";

      const videoId = createVideo({
        originalFilename: req.file.originalname,
        videoPath: audioPath,
      });

      await transcriptionQueue.add("transcribe", {
        videoId,
        videoPath: audioPath,
        language,
        skipExtraction: true,
      });

      res.json({
        success: true,
        videoId,
      });

    } catch (error) {

      res.status(500).json({
        success: false,
        error: error.toString(),
      });

    }

  }
);

router.get("/video/:id/status", (req, res) => {
  const video = getVideo(req.params.id);

  if (!video) {
    return res.status(404).json({
      success: false,
      message: "Video not found",
    });
  }

  const response = {
    success: true,
    id: video.id,
    status: video.status,
    videoPath: video.video_path,
    subtitlePath: video.subtitle_path,
    wordsPath: video.words_path,
    finalVideoPath: video.final_video_path,
    denoisedAudioPath: video.denoised_audio_path,
    errorMessage: video.error_message,
  };

  if (video.subtitle_path && fs.existsSync(video.subtitle_path)) {
    response.subtitleContent = fs.readFileSync(video.subtitle_path, "utf8");
  }

  if (video.words_path && fs.existsSync(video.words_path)) {
    try {
      response.words = JSON.parse(fs.readFileSync(video.words_path, "utf8"));
    } catch {
      response.words = [];
    }
  }

  res.json(response);
});

router.post("/translate", async (req, res) => {
  try {
    const { subtitleContent, sourceLanguage } = req.body;

    if (!subtitleContent) {
      return res.status(400).json({
        success: false,
        error: "subtitleContent is required",
      });
    }

    if (sourceLanguage === "en") {
      return res.json({ success: true, translatedContent: subtitleContent });
    }

    const translated = await translateText(subtitleContent, sourceLanguage);
    const translatedContent = validateEnhancedSrt(subtitleContent, translated);

    res.json({ success: true, translatedContent });
  } catch (error) {
    res.status(500).json({
      success: false,
      error: error.toString(),
    });
  }
});

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
  try {
    const { videoId } = req.body;

    if (!videoId || !getVideo(videoId)) {
      return res.status(404).json({
        success: false,
        error: "Unknown videoId. Upload a video first.",
      });
    }

    updateVideo(videoId, { status: "rendering" });

    await renderQueue.add("render", req.body);

    res.json({
      success: true,
      videoId,
    });
  } catch (error) {
    console.error("===== GENERATE VIDEO ERROR =====");
    console.error(error);
    console.error("==============================");

    res.status(500).json({
      success: false,
      error: error.toString(),
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

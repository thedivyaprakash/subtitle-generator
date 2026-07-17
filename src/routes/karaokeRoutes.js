const express = require("express");
const { getKaraokePresets } = require("../services/karaokePresetService");

const router = express.Router();

router.get("/presets", (req, res) => {
  res.json(getKaraokePresets());
});

module.exports = router;

const express = require("express");
const { getFontFamilies } = require("../services/fontService");

const router = express.Router();

router.get("/", (req, res) => {
    res.json(getFontFamilies());

});

module.exports = router;

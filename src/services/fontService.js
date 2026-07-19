const fs = require("fs");
const path = require("path");

const FONTS_DIR = path.join(process.cwd(), "fonts");
const FONT_WEIGHT_SEGMENTS = {
  thin: "Thin",
  extralight: "ExtraLight",
  light: "Light",
  regular: "Regular",
  medium: "Medium",
  semibold: "SemiBold",
  bold: "Bold",
  extrabold: "ExtraBold",
  black: "Black",
};

const normalizeFontFamily = (family) => String(family || "").trim();

const normalizeFontWeight = (weight = "Regular") => {
  const normalized = String(weight).replace(/\s+/g, "").toLowerCase();

  if (normalized in FONT_WEIGHT_SEGMENTS) {
    return FONT_WEIGHT_SEGMENTS[normalized];
  }

  return "Regular";
};

// Derives each family's ACTUAL available weights from whatever .ttf files
// exist on disk (e.g. "Teko-Light.ttf" -> "Light"), rather than assuming a
// fixed weight set — so a new font folder with any subset of weights (or a
// weight name not seen before) works without touching this code.
const getFontFamilies = () => {
  if (!fs.existsSync(FONTS_DIR)) {
    return [];
  }

  return fs
    .readdirSync(FONTS_DIR, { withFileTypes: true })
    .filter((entry) => entry.isDirectory())
    .map((entry) => {
      const family = entry.name;
      const familyDir = path.join(FONTS_DIR, family);
      const weights = fs
        .readdirSync(familyDir)
        .filter((file) => file.toLowerCase().endsWith(".ttf"))
        .map((file) => {
          const base = path.basename(file, ".ttf");
          const prefix = `${family}-`;
          return base.startsWith(prefix) ? base.slice(prefix.length) : base;
        })
        .filter(Boolean);

      return { family, weights };
    })
    .filter((entry) => entry.weights.length > 0);
};

const resolveFont = ({ family, weight } = {}) => {
  const fontFamily = normalizeFontFamily(family) || "Poppins";
  const resolvedWeight = normalizeFontWeight(weight);
  const familyDir = path.join(FONTS_DIR, fontFamily);
  const requestedFile = path.join(
    familyDir,
    `${fontFamily}-${resolvedWeight}.ttf`
  );

  const regularFile = path.join(
    familyDir,
    `${fontFamily}-Regular.ttf`
  );

  let fontFile = null;

  if (fs.existsSync(requestedFile)) {
    fontFile = requestedFile;
  } else if (fs.existsSync(regularFile)) {
    fontFile = regularFile;
  } else if (fs.existsSync(familyDir)) {
    const fallback = fs
      .readdirSync(familyDir)
      .find((file) => file.toLowerCase().endsWith(".ttf"));

    if (fallback) {
      fontFile = path.join(familyDir, fallback);
    }
  }

  /*
    console.trace("===== FONT RESOLVER =====");
    console.log({
      family,
      weight,
      resolvedWeight,
      resolvedFile: fontFile
    });
*/
  return {
    fontFamily,
    fontFace: fontFile ? path.basename(fontFile, ".ttf") : fontFamily,
    fontFile,
    weight: resolvedWeight,
  };
};



module.exports = {
  FONTS_DIR,
  getFontFamilies,
  resolveFont,
};

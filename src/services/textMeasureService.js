const fontkit = require("fontkit");

// Word-box captions need each word's real pixel width (at the exact font
// file + size libass will render) to place \pos coordinates accurately —
// fontkit reads the same .ttf resolveFont() already picked, so measurements
// match the burned output instead of guessing from character counts.
const fontCache = new Map();

const getFont = (fontFile) => {
  if (!fontCache.has(fontFile)) {
    fontCache.set(fontFile, fontkit.openSync(fontFile));
  }
  return fontCache.get(fontFile);
};

const measureWordWidth = (fontFile, fontSize, text) => {
  // No resolved font file (shouldn't normally happen, resolveFont() always
  // falls back to whatever .ttf exists in the family folder) — fall back to
  // a rough per-character estimate instead of throwing, so a missing font
  // degrades word-box spacing rather than breaking rendering entirely.
  if (!fontFile) {
    return fontSize * 0.55 * String(text).length;
  }

  const font = getFont(fontFile);
  const run = font.layout(String(text));
  return (run.advanceWidth / font.unitsPerEm) * fontSize;
};

// Greedy line-wrap: packs words into rows up to maxWidth, same approach a
// text renderer uses for word-wrap, just done ahead of time since ASS has
// no native reflow.
const layoutWordRows = (words, { fontFile, fontSize, maxWidth, wordGap }) => {
  const gap = wordGap ?? Math.round(fontSize * 0.35);
  const measured = words.map((word) => ({
    ...word,
    width: measureWordWidth(fontFile, fontSize, word.word),
  }));

  const rows = [];
  let currentRow = [];
  let currentWidth = 0;

  measured.forEach((word) => {
    const additionalWidth = currentRow.length ? gap + word.width : word.width;
    if (currentRow.length && currentWidth + additionalWidth > maxWidth) {
      rows.push({ words: currentRow, rowWidth: currentWidth });
      currentRow = [];
      currentWidth = 0;
    }
    currentRow.push(word);
    currentWidth += currentRow.length > 1 ? gap + word.width : word.width;
  });

  if (currentRow.length) {
    rows.push({ words: currentRow, rowWidth: currentWidth });
  }

  return rows;
};

module.exports = {
  measureWordWidth,
  layoutWordRows,
};

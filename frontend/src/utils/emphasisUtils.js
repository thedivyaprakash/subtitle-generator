// Manual keyword emphasis uses inline "**word**" markup directly inside
// cue text, the same string that already flows through editing, undo/redo,
// project save/load, and SRT parsing — no parallel data structure to keep
// in sync with edits. An optional trailing ":#rrggbb" gives that word its
// own color instead of the shared highlight color — "**word**" alone still
// means "use whatever highlightColor is set," so every existing template
// and any text already saved by users keeps working unchanged.
const EMPHASIS_TOKEN = /^\*\*(.+?)(?::(#[0-9a-fA-F]{6}))?\*\*$/;

export const parseEmphasis = (text = "") =>
  String(text)
    .split(/\s+/)
    .filter(Boolean)
    .map((token) => {
      const match = token.match(EMPHASIS_TOKEN);
      return match
        ? { word: match[1], emphasized: true, color: match[2] || null }
        : { word: token, emphasized: false, color: null };
    });

export const toggleWordEmphasis = (text = "", wordIndex) => {
  const tokens = String(text).split(/\s+/).filter(Boolean);
  if (wordIndex < 0 || wordIndex >= tokens.length) return text;

  const token = tokens[wordIndex];
  const match = token.match(EMPHASIS_TOKEN);
  tokens[wordIndex] = match ? match[1] : `**${token}**`;

  return tokens.join(" ");
};

// Sets (or clears, when colorHex is falsy) a specific word's own color,
// marking it emphasized if it wasn't already — same "**word:#hex**" markup
// parseEmphasis reads back.
export const setWordColor = (text = "", wordIndex, colorHex) => {
  const tokens = String(text).split(/\s+/).filter(Boolean);
  if (wordIndex < 0 || wordIndex >= tokens.length) return text;

  const token = tokens[wordIndex];
  const match = token.match(EMPHASIS_TOKEN);
  const word = match ? match[1] : token;
  tokens[wordIndex] = colorHex ? `**${word}:${colorHex}**` : `**${word}**`;

  return tokens.join(" ");
};

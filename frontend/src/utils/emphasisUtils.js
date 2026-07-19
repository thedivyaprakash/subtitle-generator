// Manual keyword emphasis uses inline "**word**" markup directly inside
// cue text, the same string that already flows through editing, undo/redo,
// project save/load, and SRT parsing — no parallel data structure to keep
// in sync with edits.
const EMPHASIS_TOKEN = /^\*\*(.+)\*\*$/;

export const parseEmphasis = (text = "") =>
  String(text)
    .split(/\s+/)
    .filter(Boolean)
    .map((token) => {
      const match = token.match(EMPHASIS_TOKEN);
      return match
        ? { word: match[1], emphasized: true }
        : { word: token, emphasized: false };
    });

export const toggleWordEmphasis = (text = "", wordIndex) => {
  const tokens = String(text).split(/\s+/).filter(Boolean);
  if (wordIndex < 0 || wordIndex >= tokens.length) return text;

  const token = tokens[wordIndex];
  const match = token.match(EMPHASIS_TOKEN);
  tokens[wordIndex] = match ? match[1] : `**${token}**`;

  return tokens.join(" ");
};

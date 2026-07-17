export const clamp = (value, min, max) => Math.min(Math.max(value, min), max);

export const ensurePositiveDuration = (start, end, minimum = 0.01) =>
  Math.max(Number(end) || Number(start) + minimum, Number(start) + minimum);

export const preventOverlap = (cues = [], changedIndex = -1) => {
  let previousEnd = 0;
  return cues.map((cue, index) => {
    const start = Math.max(index === changedIndex ? 0 : previousEnd, Number(cue.start) || 0);
    const end = ensurePositiveDuration(start, cue.end);
    previousEnd = end;
    return { ...cue, start, end };
  });
};

export const getCueLabel = (text = "", wordCount = 4) =>
  String(text)
    .split(/\s+/)
    .filter(Boolean)
    .slice(0, wordCount)
    .join(" ");

export const parseSrtTimeToSeconds = (srtTime) => {
  if (!srtTime) return 0;
  const normalized = String(srtTime).trim().replace(",", ".");
  const [hours = "0", minutes = "0", secondsWithFraction = "0"] = normalized.split(":");
  const [seconds = "0", fraction = "0"] = secondsWithFraction.split(".");

  return (
    Number(hours || 0) * 3600 +
    Number(minutes || 0) * 60 +
    Number(seconds || 0) +
    Number(`0.${fraction}`)
  );
};

export const formatSecondsToSrtTime = (seconds) => {
  const totalMilliseconds = Math.max(0, Math.round(Number(seconds || 0) * 1000));
  const hours = Math.floor(totalMilliseconds / 3600000);
  const minutes = Math.floor((totalMilliseconds % 3600000) / 60000);
  const secs = Math.floor((totalMilliseconds % 60000) / 1000);
  const milliseconds = totalMilliseconds % 1000;
  return `${String(hours).padStart(2, "0")}:${String(minutes).padStart(2, "0")}:${String(secs).padStart(2, "0")},${String(milliseconds).padStart(3, "0")}`;
};

export const buildSubtitleCueList = (content = "") => {
  const lines = String(content).split("\n").map((line) => line.trimEnd());
  const cues = [];

  for (let index = 0; index < lines.length; index += 1) {
    const line = lines[index].trim();
    if (!line || /^\d+$/.test(line) || !line.includes("-->")) continue;

    const [startRaw, endRaw] = line.split("-->").map((part) => part.trim());
    const textLines = [];
    let nextIndex = index + 1;

    while (nextIndex < lines.length) {
      const nextLine = lines[nextIndex].trim();
      if (!nextLine) break;
      if (/^\d+$/.test(nextLine) && lines[nextIndex + 1]?.includes("-->")) break;
      if (nextLine.includes("-->")) break;
      textLines.push(nextLine);
      nextIndex += 1;
    }

    cues.push({
      start: parseSrtTimeToSeconds(startRaw),
      end: parseSrtTimeToSeconds(endRaw),
      text: textLines.join(" ").trim(),
    });
  }

  return cues;
};

export const normalizeCues = (nextCues = []) => {
  let previousEnd = 0;
  return nextCues.map((cue) => {
    const start = Math.max(previousEnd, Number(cue.start) || 0);
    const end = Math.max(start + 0.01, Number(cue.end) || start + 0.01);
    previousEnd = end;
    return {
      start,
      end,
      text: String(cue.text || "").trim(),
    };
  });
};

export const writeCuesToSubtitleContent = (nextCues = []) =>
  nextCues
    .map(
      (cue, index) =>
        `${index + 1}\n${formatSecondsToSrtTime(cue.start)} --> ${formatSecondsToSrtTime(cue.end)}\n${cue.text}\n`
    )
    .join("\n")
    .trim();

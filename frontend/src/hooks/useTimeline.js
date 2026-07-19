import { useCallback, useMemo } from "react";
import { buildSubtitleCueList, normalizeCues, writeCuesToSubtitleContent } from "../utils/subtitleUtils";
import { preventOverlap } from "../utils/timelineUtils";

export default function useTimeline({
  subtitleContent,
  subtitleWords,
  subtitleMode,
  videoSeek,
  selectedSubtitleIndex,
  setSubtitleContent,
  setSelectedSubtitleIndex,
}) {
  const subtitleCues = useMemo(() => buildSubtitleCueList(subtitleContent), [subtitleContent]);

  const activeCue = useMemo(
    () => subtitleCues.find((cue) => videoSeek >= cue.start && videoSeek <= cue.end),
    [subtitleCues, videoSeek]
  );

  const activeCueWords = useMemo(() => {
    if (subtitleMode !== "karaoke" || !activeCue) return [];
    const cueStart = activeCue.start;
    const cueEnd = activeCue.end;

    const timedWords = subtitleWords.length
      ? subtitleWords
          .filter((word) => {
            const wordStart = Number(word.start) || 0;
            const wordEnd = Number(word.end) || 0;
            // Overlap check, not strict containment — cue times come from
            // SRT-formatted (millisecond-rounded) text while word times come
            // from raw Deepgram floats, so boundary words can fail a strict
            // containment check by a fraction of a millisecond.
            return wordEnd > cueStart && wordStart < cueEnd;
          })
          .map((word) => ({
            word: word.word,
            start: Number(word.start) || 0,
            end: Number(word.end) || 0,
          }))
      : [];

    if (timedWords.length) return timedWords;

    // No timed words overlap this cue (retimed/edited cue, or the words
    // list doesn't line up with this cue for some other reason) — evenly
    // spread the cue's own text across its time range. This mirrors the
    // exact fallback the backend ASS generator uses (subtitleService.js
    // buildCueDialogues), so the live preview matches what actually gets
    // burned instead of silently dropping to plain, unhighlighted text.
    const cueTextWords = (activeCue.text || "").split(/\s+/).filter(Boolean);
    if (!cueTextWords.length) return [];

    const duration = Math.max(0.01, cueEnd - cueStart);
    const step = duration / cueTextWords.length;

    return cueTextWords.map((word, index) => ({
      word,
      start: cueStart + step * index,
      end: cueStart + step * (index + 1),
    }));
  }, [activeCue, subtitleMode, subtitleWords]);

  const updateSubtitleCues = useCallback(
    (nextCues, nextSelectedIndex = selectedSubtitleIndex) => {
      const normalizedCues = preventOverlap(normalizeCues(nextCues), nextSelectedIndex);
      setSubtitleContent(writeCuesToSubtitleContent(normalizedCues));
      setSelectedSubtitleIndex(Math.max(0, Math.min(nextSelectedIndex, Math.max(0, normalizedCues.length - 1))));
    },
    [selectedSubtitleIndex, setSelectedSubtitleIndex, setSubtitleContent]
  );

  return {
    subtitleCues,
    activeCue,
    activeCueWords,
    updateSubtitleCues,
  };
}

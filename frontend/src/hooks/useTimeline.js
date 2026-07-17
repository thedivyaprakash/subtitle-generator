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
    if (subtitleMode !== "karaoke" || !subtitleWords.length) return [];
    const cueStart = activeCue?.start ?? videoSeek;
    const cueEnd = activeCue?.end ?? videoSeek + 0.8;
    return subtitleWords
      .filter((word) => {
        const wordStart = Number(word.start) || 0;
        const wordEnd = Number(word.end) || 0;
        return wordStart >= cueStart && wordEnd <= cueEnd;
      })
      .map((word) => ({
        word: word.word,
        start: Number(word.start) || 0,
        end: Number(word.end) || 0,
      }));
  }, [activeCue?.end, activeCue?.start, subtitleMode, subtitleWords, videoSeek]);

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

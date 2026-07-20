import { useMemo } from "react";
import { parseEmphasis } from "../utils/emphasisUtils";

function SubtitleOverlay({
  text = "",
  words = [],
  currentTime = 0,
  subtitleMode = "original",
  fontColor = "#ffffff",
  highlightColor = "#ffff00",
  highlightMode = "current",
  animation = "none",
  backgroundStyle = "none",
  backColor = "#000000",
})
{
  const fallbackWords = useMemo(() => parseEmphasis(text), [text]);

  if (!words.length && !fallbackWords.length) {
    return null;
  }

  const activeWordIndex = words.length
    ? words.findIndex(
        (word) =>
          currentTime >= Number(word.start) &&
          currentTime < Number(word.end)
      )
    : -1;

  const karaokeMode = subtitleMode === "karaoke" && words.length;
  const renderWords = karaokeMode ? words : fallbackWords;

  return (
    <>
      {renderWords.map((word, index) => {
        const displayWord =
          typeof word === "string"
            ? word
            : word.word || word.text || "";
        const isActive = karaokeMode
          ? activeWordIndex >= 0
            ? highlightMode === "progressive"
              ? index <= activeWordIndex
              : index === activeWordIndex
            : false
          : Boolean(word.emphasized);
        const isAnimated = karaokeMode && isActive && animation !== "none";
        const isBoxed = !karaokeMode && backgroundStyle === "word";

        return (
          <span
            key={`${displayWord}-${index}`}
            className={[
              "preview-word",
              isActive ? "preview-word--active" : "",
              !karaokeMode && isActive ? "preview-word--emphasized" : "",
              isAnimated ? `preview-word--animation-${animation}` : "",
              isBoxed ? "preview-word--boxed" : "",
            ]
              .filter(Boolean)
              .join(" ")}
            style={{
              color: isBoxed ? fontColor : isActive ? highlightColor : fontColor,
              backgroundColor: isBoxed ? (isActive ? highlightColor : backColor) : undefined,
            }}
          >
            {displayWord}
          </span>
        );
      })}
    </>
  );
}

export default SubtitleOverlay;

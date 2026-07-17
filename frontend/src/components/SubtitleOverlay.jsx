import { useMemo } from "react";

function SubtitleOverlay({
  text = "",
  words = [],
  currentTime = 0,
  subtitleMode = "original",
  fontColor = "#ffffff",
  highlightColor = "#ffff00",
  highlightMode = "current",
  animation = "none",
})
{
  const fallbackWords = useMemo(
    () => String(text).split(/\s+/).filter(Boolean),
    [text]
  );

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

  const renderWords = words.length ? words : fallbackWords;

  return (
    <>
      {renderWords.map((word, index) => {
        const displayWord =
          typeof word === "string"
            ? word
            : word.word || word.text || "";
        const karaokeMode = subtitleMode === "karaoke" && words.length;
        const isActive = karaokeMode
          ? activeWordIndex >= 0
            ? highlightMode === "progressive"
              ? index <= activeWordIndex
              : index === activeWordIndex
            : false
          : false;
        const isAnimated = karaokeMode && isActive && animation !== "none";

        return (
          <span
            key={`${displayWord}-${index}`}
            className={[
              "preview-word",
              isActive ? "preview-word--active" : "",
              isAnimated ? `preview-word--animation-${animation}` : "",
            ]
              .filter(Boolean)
              .join(" ")}
            style={{ color: isActive ? highlightColor : fontColor }}
          >
            {displayWord}
          </span>
        );
      })}
    </>
  );
}

export default SubtitleOverlay;

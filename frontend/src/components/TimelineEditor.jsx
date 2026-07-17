import { useEffect, useMemo, useRef, useState } from "react";
import Waveform from "./Waveform";

function TimelineEditor({
  cues = [],
  currentTime = 0,
  duration = 0,
  selectedIndex = -1,
  waveformPeaks = [],
  onSeek,
  onSelectCue,
  onTogglePlay,
  onUpdateCue,
}) {
  const safeDuration = Number(duration) || 0;
  const trackScrollRef = useRef(null);
  const playheadRef = useRef(null);
  const interactionRef = useRef(null);
  const [zoom, setZoom] = useState(100);

  const rulerMarks = useMemo(() => {
    if (!safeDuration) return [0];
    const marks = [];
    for (let time = 0; time <= safeDuration; time += 5) {
      marks.push(time);
    }
    if (marks[marks.length - 1] !== safeDuration) {
      marks.push(safeDuration);
    }
    return marks;
  }, [safeDuration]);

  const formatTime = (seconds) => {
    const totalSeconds = Math.max(0, Math.floor(seconds));
    const minutes = Math.floor(totalSeconds / 60);
    const remainingSeconds = totalSeconds % 60;
    return `${String(minutes).padStart(2, "0")}:${String(remainingSeconds).padStart(2, "0")}`;
  };

  const clamp = (value, min, max) => Math.min(Math.max(value, min), max);
  const pixelsPerSecond = zoom / 10;
  const minCueDuration = 0.08;

  const activeIndex =
    selectedIndex >= 0
      ? selectedIndex
      : cues.findIndex((cue) => currentTime >= cue.start && currentTime <= cue.end);

  useEffect(() => {
    const handleKeyDown = (event) => {
      const targetTag = event.target?.tagName?.toLowerCase();
      if (["input", "textarea", "select"].includes(targetTag)) return;

      if (event.key === " ") {
        event.preventDefault();
        onTogglePlay?.();
        return;
      }

      if (event.key === "ArrowLeft") {
        event.preventDefault();
        const nextIndex = Math.max(0, selectedIndex > 0 ? selectedIndex - 1 : activeIndex - 1);
        const cue = cues[nextIndex];
        if (cue) {
          onSelectCue?.(nextIndex);
          onSeek?.(cue.start, nextIndex);
        }
        return;
      }

      if (event.key === "ArrowRight") {
        event.preventDefault();
        const nextIndex = Math.min(cues.length - 1, selectedIndex >= 0 ? selectedIndex + 1 : activeIndex + 1);
        const cue = cues[nextIndex];
        if (cue) {
          onSelectCue?.(nextIndex);
          onSeek?.(cue.start, nextIndex);
        }
      }
    };

    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [activeIndex, cues, onSeek, onSelectCue, onTogglePlay, selectedIndex]);

  useEffect(() => {
    const track = trackScrollRef.current;
    const playhead = playheadRef.current;
    if (!track || !playhead) return;

    const visibleLeft = track.scrollLeft;
    const visibleRight = visibleLeft + track.clientWidth;
    const playheadLeft = playhead.offsetLeft;
    const playheadRight = playheadLeft + playhead.offsetWidth;

    if (playheadRight > visibleRight - 32) {
      track.scrollLeft = playheadRight - track.clientWidth + 32;
    } else if (playheadLeft < visibleLeft + 32) {
      track.scrollLeft = Math.max(0, playheadLeft - 32);
    }
  }, [currentTime, zoom, safeDuration]);

  useEffect(() => {
    const handlePointerMove = (event) => {
      const interaction = interactionRef.current;
      if (!interaction) return;

      const track = trackScrollRef.current;
      if (!track) return;

      const rect = track.getBoundingClientRect();
      const nextTime = clamp((event.clientX - rect.left + track.scrollLeft) / pixelsPerSecond, 0, safeDuration);
      const cue = cues[interaction.index];
      if (!cue) return;

      if (interaction.mode === "move") {
        const durationSeconds = Math.max((cue.end || 0) - (cue.start || 0), minCueDuration);
        let nextStart = nextTime - interaction.offsetSeconds;
        nextStart = clamp(nextStart, 0, Math.max(safeDuration - durationSeconds, 0));
        const nextEnd = nextStart + durationSeconds;
        onUpdateCue?.(interaction.index, { start: nextStart, end: nextEnd });
      }

      if (interaction.mode === "start") {
        const nextStart = clamp(Math.min(nextTime, cue.end - minCueDuration), 0, cue.end - minCueDuration);
        onUpdateCue?.(interaction.index, { start: nextStart });
      }

      if (interaction.mode === "end") {
        const nextEnd = clamp(Math.max(nextTime, cue.start + minCueDuration), cue.start + minCueDuration, safeDuration);
        onUpdateCue?.(interaction.index, { end: nextEnd });
      }
    };

    const handlePointerUp = () => {
      interactionRef.current = null;
    };

    window.addEventListener("pointermove", handlePointerMove);
    window.addEventListener("pointerup", handlePointerUp);
    window.addEventListener("pointercancel", handlePointerUp);
    return () => {
      window.removeEventListener("pointermove", handlePointerMove);
      window.removeEventListener("pointerup", handlePointerUp);
      window.removeEventListener("pointercancel", handlePointerUp);
    };
  }, [cues, onUpdateCue, pixelsPerSecond, safeDuration]);

  return (
    <div className="timeline-editor">
      <div className="timeline-editor__controls">
        {[25, 50, 100, 200, 400].map((value) => (
          <button
            key={value}
            type="button"
            className={`tab-button ${zoom === value ? "tab-button--active" : ""}`}
            onClick={() => setZoom(value)}
          >
            {value}%
          </button>
        ))}
      </div>

      <div className="timeline-editor__ruler">
        {rulerMarks.map((time) => (
          <span
            key={time}
            className="timeline-editor__tick"
            style={{ left: `${time * pixelsPerSecond}px` }}
          >
            {formatTime(time)}
          </span>
        ))}
      </div>

      <div className="timeline-editor__track-wrap" ref={trackScrollRef}>
        <div
          className="timeline-editor__track"
          style={{ width: `${Math.max(safeDuration * pixelsPerSecond, 100)}px` }}
        >
          <div
            ref={playheadRef}
            className="timeline-editor__playhead"
            style={{ left: `${safeDuration ? clamp(currentTime * pixelsPerSecond, 0, safeDuration * pixelsPerSecond) : 0}px` }}
          />
          {cues.map((cue, index) => {
            const cueStart = Number(cue.start) || 0;
            const cueEnd = Number(cue.end) || 0;
            const left = cueStart * pixelsPerSecond;
            const width = Math.max((cueEnd - cueStart) * pixelsPerSecond, 48);
            const label = (cue.text || "")
              .split(/\s+/)
              .filter(Boolean)
              .slice(0, 4)
              .join(" ");
            const isActive = index === activeIndex;
            const isSelected = index === selectedIndex;
            const cueDuration = Math.max(cueEnd - cueStart, 0);

            return (
              <button
                key={`${cue.start}-${cue.end}-${index}`}
                type="button"
                className={[
                  "timeline-editor__block",
                  isActive ? "timeline-editor__block--active" : "",
                  isSelected ? "timeline-editor__block--selected" : "",
                ]
                  .filter(Boolean)
                  .join(" ")}
                style={{ left: `${left}px`, width: `${width}px` }}
                onPointerDown={(event) => {
                  event.preventDefault();
                  interactionRef.current = {
                    mode: "move",
                    index,
                    offsetSeconds:
                      ((event.clientX - (trackScrollRef.current?.getBoundingClientRect().left || 0) +
                        (trackScrollRef.current?.scrollLeft || 0)) /
                        pixelsPerSecond) -
                      cueStart,
                  };
                }}
                onClick={() => {
                  onSelectCue?.(index);
                  onSeek?.(cueStart, index);
                }}
                title={`Start Time: ${formatTime(cueStart)}\nEnd Time: ${formatTime(cueEnd)}\nDuration: ${formatTime(cueDuration)}\nSubtitle Text: ${cue.text || ""}`}
              >
                <span
                  className="timeline-editor__handle timeline-editor__handle--start"
                  onPointerDown={(event) => {
                    event.stopPropagation();
                    interactionRef.current = { mode: "start", index };
                  }}
                />
                <span className="timeline-editor__block-label">
                  {label || "Subtitle"}
                </span>
                <span
                  className="timeline-editor__handle timeline-editor__handle--end"
                  onPointerDown={(event) => {
                    event.stopPropagation();
                    interactionRef.current = { mode: "end", index };
                  }}
                />
              </button>
            );
          })}
          <Waveform peaks={waveformPeaks} duration={safeDuration} zoom={zoom} currentTime={currentTime} />
        </div>
      </div>
    </div>
  );
}

export default TimelineEditor;

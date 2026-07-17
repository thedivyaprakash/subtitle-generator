import { useMemo, useRef, useState } from "react";

function WordTimeline({
  words = [],
  currentTime = 0,
  duration = 0,
  onSeek,
  onWordsChange,
  onWordsCommit,
  zoom = 1,
}) {
  const timelineRef = useRef(null);
  const dragStateRef = useRef(null);
  const playheadDragRef = useRef(false);
  const [menuState, setMenuState] = useState(null);

  const safeWords = useMemo(
    () =>
      words
        .map((word) => ({
          ...word,
          start: Number(word.start) || 0,
          end: Number(word.end) || 0,
        }))
        .sort((left, right) => left.start - right.start),
    [words]
  );

  const rulerMarks = useMemo(() => {
    if (!duration) return [];

    const marks = [];
    for (let seconds = 0; seconds <= duration; seconds += 5) {
      marks.push(seconds);
    }
    if (marks[marks.length - 1] !== duration) {
      marks.push(duration);
    }
    return marks;
  }, [duration]);

  const formatTime = (seconds) => {
    const totalSeconds = Math.max(0, Math.floor(seconds));
    const minutes = Math.floor(totalSeconds / 60);
    const remainingSeconds = totalSeconds % 60;
    return `${String(minutes).padStart(2, "0")}:${String(remainingSeconds).padStart(2, "0")}`;
  };

  if (!words.length || !duration) {
    return null;
  }

  const clamp = (value, min, max) => Math.min(Math.max(value, min), max);

  const getTimelineSecondsFromClientX = (clientX) => {
    const element = timelineRef.current;
    if (!element) return 0;
    const rect = element.getBoundingClientRect();
    const ratio = rect.width ? (clientX - rect.left) / rect.width : 0;
    return clamp(ratio * duration, 0, duration);
  };

  const snapToTimeline = (seconds) => {
    const snapSize = 0.1;
    return clamp(Math.round(seconds / snapSize) * snapSize, 0, duration);
  };

  const buildShiftedWords = (draggedIndex, nextStart) => {
    const nextWords = safeWords.map((word) => ({ ...word }));
    const draggedWord = nextWords[draggedIndex];
    if (!draggedWord) return nextWords;

    const wordDuration = Math.max(0, draggedWord.end - draggedWord.start);
    const previousWord = nextWords[draggedIndex - 1];
    const nextWord = nextWords[draggedIndex + 1];
    const minStart = previousWord ? previousWord.end : 0;
    const maxStart = nextWord ? nextWord.start - wordDuration : duration - wordDuration;
    const clampedStart = clamp(nextStart, minStart, Math.max(minStart, maxStart));
    const clampedEnd = clamp(clampedStart + wordDuration, clampedStart, duration);

    nextWords[draggedIndex] = {
      ...draggedWord,
      start: clampedStart,
      end: clampedEnd,
    };

    return nextWords;
  };

  const updateDuringDrag = (clientX) => {
    const dragState = dragStateRef.current;
    if (!dragState) return;

    const nextStart = snapToTimeline(getTimelineSecondsFromClientX(clientX) - dragState.offsetSeconds);
    const nextWords = buildShiftedWords(dragState.index, nextStart);
    onWordsChange?.(nextWords);
  };

  const stopDragging = () => {
    const dragState = dragStateRef.current;
    if (!dragState) return;
    dragStateRef.current = null;
    onWordsCommit?.();
  };

  const handlePointerMove = (event) => {
    if (!dragStateRef.current) return;
    event.preventDefault();
    updateDuringDrag(event.clientX);
  };

  const handlePointerUp = () => {
    stopDragging();
  };

  const handlePointerLeave = () => {
    if (dragStateRef.current) {
      stopDragging();
    }
  };

  const handleTimelinePointerDown = (event) => {
    if (event.button !== 0) return;
    playheadDragRef.current = true;
    const nextTime = snapToTimeline(getTimelineSecondsFromClientX(event.clientX));
    onSeek?.(nextTime);
  };

  const handleTimelinePointerMove = (event) => {
    if (!playheadDragRef.current) return;
    event.preventDefault();
    const nextTime = snapToTimeline(getTimelineSecondsFromClientX(event.clientX));
    onSeek?.(nextTime);
  };

  const handleTimelinePointerUp = () => {
    playheadDragRef.current = false;
  };

  return (
    <div className="word-timeline-wrap">
      <div className="word-timeline-ruler">
        {rulerMarks.map((seconds) => (
          <div
            key={seconds}
            className="word-timeline-ruler__tick"
            style={{ left: `${(seconds / duration) * 100}%` }}
          >
            <span className="word-timeline-ruler__label">{formatTime(seconds)}</span>
          </div>
        ))}
      </div>
      <div
        className="word-timeline"
        ref={timelineRef}
        style={{ transform: `scaleX(${zoom})`, transformOrigin: "left center" }}
        onPointerDown={handleTimelinePointerDown}
        onPointerMove={handlePointerMove}
        onPointerMoveCapture={handleTimelinePointerMove}
        onPointerUp={handlePointerUp}
        onPointerUpCapture={handleTimelinePointerUp}
        onPointerLeave={handlePointerLeave}
        onContextMenu={(event) => {
          event.preventDefault();
          setMenuState({ x: event.clientX, y: event.clientY });
        }}
      >
        <div
          className="word-timeline__playhead"
          style={{ left: `${(currentTime / duration) * 100}%` }}
        />
        {safeWords.map((word, index) => {
          const start = Number(word.start) || 0;
          const end = Number(word.end) || 0;
          const left = (start / duration) * 100;
          const width = ((end - start) / duration) * 100;
          const isActive = currentTime >= start && currentTime < end;
          const label = word.word || word.text || "";

          return (
            <button
              key={`${label}-${index}`}
              type="button"
              className={`word-timeline__block ${isActive ? "word-timeline__block--active" : ""}`}
              style={{ left: `${left}%`, width: `${width}%` }}
              onPointerDown={(event) => {
                event.preventDefault();
                dragStateRef.current = {
                  index,
                  offsetSeconds: getTimelineSecondsFromClientX(event.clientX) - start,
                };
                event.currentTarget.setPointerCapture?.(event.pointerId);
              }}
              onClick={() => onSeek?.(start)}
            >
              <span className="word-timeline__label">{label}</span>
            </button>
          );
        })}
        {menuState && (
          <div className="word-timeline-menu" style={{ left: menuState.x, top: menuState.y }} onMouseLeave={() => setMenuState(null)}>
            <button type="button" onClick={() => { onSeek?.(0); setMenuState(null); }}>Go to start</button>
            <button type="button" onClick={() => { onSeek?.(duration); setMenuState(null); }}>Go to end</button>
            <button type="button" onClick={() => { setMenuState(null); }}>Close</button>
          </div>
        )}
      </div>
    </div>
  );
}

export default WordTimeline;

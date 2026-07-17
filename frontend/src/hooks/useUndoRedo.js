import { useCallback, useEffect, useRef, useState } from "react";

export default function useUndoRedo(buildSnapshot, applySnapshot, areSnapshotsEqual = (left, right) => JSON.stringify(left) === JSON.stringify(right), maxHistory = 100) {
  const [history, setHistory] = useState({ past: [], future: [] });
  const skipRef = useRef(false);
  const lastSnapshotRef = useRef(null);

  const commit = useCallback(() => {
    const nextSnapshot = buildSnapshot();
    if (!lastSnapshotRef.current) {
      lastSnapshotRef.current = nextSnapshot;
      return;
    }
    if (areSnapshotsEqual(lastSnapshotRef.current, nextSnapshot)) return;
    const previousSnapshot = lastSnapshotRef.current;
    lastSnapshotRef.current = nextSnapshot;
    setHistory((current) => ({
      past: [...current.past.slice(-(maxHistory - 1)), previousSnapshot],
      future: [],
    }));
  }, [areSnapshotsEqual, buildSnapshot, maxHistory]);

  const undo = useCallback(() => {
    let previousSnapshot = null;
    let currentSnapshot = null;
    setHistory((current) => {
      if (!current.past.length) return current;
      previousSnapshot = current.past[current.past.length - 1];
      currentSnapshot = buildSnapshot();
      return {
        past: current.past.slice(0, -1),
        future: [currentSnapshot, ...current.future].slice(0, maxHistory),
      };
    });
    if (!previousSnapshot) return;
    skipRef.current = true;
    lastSnapshotRef.current = previousSnapshot;
    applySnapshot(previousSnapshot);
  }, [applySnapshot, buildSnapshot, maxHistory]);

  const redo = useCallback(() => {
    let nextSnapshot = null;
    let currentSnapshot = null;
    setHistory((current) => {
      if (!current.future.length) return current;
      nextSnapshot = current.future[0];
      currentSnapshot = buildSnapshot();
      return {
        past: [...current.past.slice(-(maxHistory - 1)), currentSnapshot],
        future: current.future.slice(1),
      };
    });
    if (!nextSnapshot) return;
    skipRef.current = true;
    lastSnapshotRef.current = nextSnapshot;
    applySnapshot(nextSnapshot);
  }, [applySnapshot, buildSnapshot, maxHistory]);

  const sync = useCallback((snapshot) => {
    if (skipRef.current) {
      skipRef.current = false;
      lastSnapshotRef.current = snapshot;
      return;
    }
    if (!lastSnapshotRef.current) {
      lastSnapshotRef.current = snapshot;
      return;
    }
    if (!areSnapshotsEqual(lastSnapshotRef.current, snapshot)) {
      const previousSnapshot = lastSnapshotRef.current;
      lastSnapshotRef.current = snapshot;
      setHistory((current) => ({
        past: [...current.past.slice(-(maxHistory - 1)), previousSnapshot],
        future: [],
      }));
    }
  }, [areSnapshotsEqual, maxHistory]);

  useEffect(() => {
    const handleKeyDown = (event) => {
      const key = event.key.toLowerCase();
      const isUndo = event.ctrlKey && key === "z" && !event.shiftKey;
      const isRedo = (event.ctrlKey && event.shiftKey && key === "z") || (event.ctrlKey && key === "y");
      if (!isUndo && !isRedo) return;
      event.preventDefault();
      if (isUndo) undo();
      if (isRedo) redo();
    };

    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [redo, undo]);

  return { history, commit, undo, redo, sync, skipRef, lastSnapshotRef };
}

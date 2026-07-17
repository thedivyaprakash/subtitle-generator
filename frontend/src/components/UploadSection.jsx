import { useEffect, useMemo, useRef, useState } from "react";
import api from "../services/api";
import { Form, Button } from "react-bootstrap";
import "../App.css";
import Loader from "./Loader";
import SubtitleOverlay from "./SubtitleOverlay";
import TimelineEditor from "./TimelineEditor";

function UploadSection() {
  const [file, setFile] = useState(null);
  const [subtitleContent, setSubtitleContent] = useState("");
  const [subtitlePath, setSubtitlePath] = useState("");
  const [subtitleWords, setSubtitleWords] = useState([]);
  const [isGenerating, setIsGenerating] = useState(false);
  const [videoPath, setVideoPath] = useState("");
  const [isUploading, setIsUploading] = useState(false);
  const [subtitleMode, setSubtitleMode] = useState("original");
  const [subtitlePreset, setSubtitlePreset] = useState("");
  const [highlightMode, setHighlightMode] = useState("current");
  const [highlightColor, setHighlightColor] = useState("#ffff00");
  const [animation, setAnimation] = useState("none");
  const [fontName, setFontName] = useState("Poppins");
  const [fonts, setFonts] = useState([]);
  const [fontWeight, setFontWeight] = useState("Regular");
  const [fontColor, setFontColor] = useState("#ffffff");
  const [fontSize, setFontSize] = useState(48);
  const [outline, setOutline] = useState(2);
  const [outlineEnabled, setOutlineEnabled] = useState(false);
  const [shadow, setShadow] = useState(1);
  const [shadowEnabled, setShadowEnabled] = useState(false);
  const [backColor, setBackColor] = useState("#000000");
  const [backgroundEnabled, setBackgroundEnabled] = useState(false);
  const [outlineColor, setOutlineColor] = useState("#000000");
  const [position, setPosition] = useState("bottom");
  const [showDownload, setShowDownload] = useState(false);
  const [successMessage, setSuccessMessage] = useState("");
  const [finalVideoPath, setFinalVideoPath] = useState("");
  const [generatedSrtPath, setGeneratedSrtPath] = useState("");
  const [activeTab, setActiveTab] = useState("text");
  const [searchTerm, setSearchTerm] = useState("");
  const [selectedSubtitleIndex, setSelectedSubtitleIndex] = useState(0);
  const [isVideoPlaying, setIsVideoPlaying] = useState(true);
  const [videoSeek, setVideoSeek] = useState(0);
  const [videoDuration, setVideoDuration] = useState(0);
  const [timelineZoom, setTimelineZoom] = useState(100);
  const [waveformPeaks, setWaveformPeaks] = useState([]);
  const [history, setHistory] = useState({ past: [], future: [] });
  const videoRef = useRef(null);
  const projectFileInputRef = useRef(null);
  const historySkipRef = useRef(false);
  const lastHistorySnapshotRef = useRef(null);

  useEffect(() => {
    const loadFonts = async () => {
      const response = await api.get("/api/fonts");
      setFonts(response.data);
    };
    loadFonts();
  }, []);

  useEffect(() => {
    if (!fontName) return;

    const styleId = "preview-font-face";
    const previousStyle = document.getElementById(styleId);
    if (previousStyle) previousStyle.remove();

    const style = document.createElement("style");
    style.id = styleId;
    style.textContent = `
      @font-face { font-family: "${fontName}"; src: url("http://localhost:5000/fonts/${fontName}/${fontName}-Regular.ttf") format("truetype"); font-weight: 400; font-style: normal; }
      @font-face { font-family: "${fontName}"; src: url("http://localhost:5000/fonts/${fontName}/${fontName}-Medium.ttf") format("truetype"); font-weight: 500; font-style: normal; }
      @font-face { font-family: "${fontName}"; src: url("http://localhost:5000/fonts/${fontName}/${fontName}-SemiBold.ttf") format("truetype"); font-weight: 600; font-style: normal; }
      @font-face { font-family: "${fontName}"; src: url("http://localhost:5000/fonts/${fontName}/${fontName}-Bold.ttf") format("truetype"); font-weight: 700; font-style: normal; }
      @font-face { font-family: "${fontName}"; src: url("http://localhost:5000/fonts/${fontName}/${fontName}-ExtraBold.ttf") format("truetype"); font-weight: 800; font-style: normal; }
    `;
    document.head.appendChild(style);
    return () => style.remove();
  }, [fontName]);

  const parseSrtTimeToSeconds = (srtTime) => {
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

  const formatSecondsToSrtTime = (seconds) => {
    const totalMilliseconds = Math.max(0, Math.round(Number(seconds || 0) * 1000));
    const hours = Math.floor(totalMilliseconds / 3600000);
    const minutes = Math.floor((totalMilliseconds % 3600000) / 60000);
    const secs = Math.floor((totalMilliseconds % 60000) / 1000);
    const milliseconds = totalMilliseconds % 1000;
    return `${String(hours).padStart(2, "0")}:${String(minutes).padStart(2, "0")}:${String(secs).padStart(2, "0")},${String(milliseconds).padStart(3, "0")}`;
  };

  const buildEditorSnapshot = () => ({
    subtitleContent,
    selectedSubtitleIndex,
    subtitleMode,
    subtitlePreset,
    highlightMode,
    highlightColor,
    animation,
    fontName,
    fontWeight,
    fontColor,
    fontSize,
    outline,
    outlineEnabled,
    shadow,
    shadowEnabled,
    backColor,
    backgroundEnabled,
    outlineColor,
    position,
  });

  const areSnapshotsEqual = (left, right) =>
    JSON.stringify(left) === JSON.stringify(right);

  const applyEditorSnapshot = (snapshot) => {
    if (!snapshot) return;
    historySkipRef.current = true;
    setSubtitleContent(snapshot.subtitleContent ?? "");
    setSelectedSubtitleIndex(snapshot.selectedSubtitleIndex ?? 0);
    setSubtitleMode(snapshot.subtitleMode ?? "original");
    setSubtitlePreset(snapshot.subtitlePreset ?? "");
    setHighlightMode(snapshot.highlightMode ?? "current");
    setHighlightColor(snapshot.highlightColor ?? "#ffff00");
    setAnimation(snapshot.animation ?? "none");
    setFontName(snapshot.fontName ?? "Poppins");
    setFontWeight(snapshot.fontWeight ?? "Regular");
    setFontColor(snapshot.fontColor ?? "#ffffff");
    setFontSize(snapshot.fontSize ?? 48);
    setOutline(snapshot.outline ?? 2);
    setOutlineEnabled(Boolean(snapshot.outlineEnabled));
    setShadow(snapshot.shadow ?? 1);
    setShadowEnabled(Boolean(snapshot.shadowEnabled));
    setBackColor(snapshot.backColor ?? "#000000");
    setBackgroundEnabled(Boolean(snapshot.backgroundEnabled));
    setOutlineColor(snapshot.outlineColor ?? "#000000");
    setPosition(snapshot.position ?? "bottom");
  };

  const undoEditorChange = () => {
    let previousSnapshot = null;
    let currentSnapshot = null;
    setHistory((currentHistory) => {
      if (!currentHistory.past.length) return currentHistory;
      previousSnapshot = currentHistory.past[currentHistory.past.length - 1];
      currentSnapshot = buildEditorSnapshot();
      return {
        past: currentHistory.past.slice(0, -1),
        future: [currentSnapshot, ...currentHistory.future].slice(0, 100),
      };
    });
    if (!previousSnapshot) return;
    historySkipRef.current = true;
    lastHistorySnapshotRef.current = previousSnapshot;
    applyEditorSnapshot(previousSnapshot);
  };

  const redoEditorChange = () => {
    let nextSnapshot = null;
    let currentSnapshot = null;
    setHistory((currentHistory) => {
      if (!currentHistory.future.length) return currentHistory;
      nextSnapshot = currentHistory.future[0];
      currentSnapshot = buildEditorSnapshot();
      return {
        past: [...currentHistory.past.slice(-99), currentSnapshot],
        future: currentHistory.future.slice(1),
      };
    });
    if (!nextSnapshot) return;
    historySkipRef.current = true;
    lastHistorySnapshotRef.current = nextSnapshot;
    applyEditorSnapshot(nextSnapshot);
  };

  const buildSubtitleCueList = (content = subtitleContent) => {
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

  const updateSubtitleCues = (nextCues, nextSelectedIndex = selectedSubtitleIndex) => {
    const normalizedCues = normalizeCues(nextCues);
    writeCuesToSubtitleContent(normalizedCues);
    setSelectedSubtitleIndex(
      Math.max(0, Math.min(nextSelectedIndex, Math.max(0, normalizedCues.length - 1)))
    );
  };

  const splitSelectedCue = () => {
    const cues = buildSubtitleCueList();
    const cue = cues[selectedSubtitleIndex];
    if (!cue) return;
    const cueStart = Number(cue.start) || 0;
    const cueEnd = Number(cue.end) || 0;
    const splitTime = Math.min(Math.max(videoSeek, cueStart + 0.01), cueEnd - 0.01);
    if (!(splitTime > cueStart && splitTime < cueEnd)) return;

    const words = cue.text.split(/\s+/).filter(Boolean);
    const elapsedRatio = (splitTime - cueStart) / Math.max(cueEnd - cueStart, 0.0001);
    const splitIndex = Math.min(
      Math.max(1, Math.round(words.length * elapsedRatio)),
      Math.max(1, words.length - 1)
    );
    if (words.length < 2) return;

    const leftWords = words.slice(0, splitIndex);
    const rightWords = words.slice(splitIndex);
    const nextCues = [
      ...cues.slice(0, selectedSubtitleIndex),
      {
        start: cueStart,
        end: splitTime,
        text: leftWords.join(" "),
      },
      {
        start: splitTime,
        end: cueEnd,
        text: rightWords.join(" "),
      },
      ...cues.slice(selectedSubtitleIndex + 1),
    ];

    updateSubtitleCues(nextCues, selectedSubtitleIndex);
  };

  const mergeSelectedCue = () => {
    const cues = buildSubtitleCueList();
    const cue = cues[selectedSubtitleIndex];
    const nextCue = cues[selectedSubtitleIndex + 1];
    if (!cue || !nextCue) return;

    const mergedCue = {
      start: cue.start,
      end: nextCue.end,
      text: `${cue.text} ${nextCue.text}`.trim(),
    };

    const nextCues = [
      ...cues.slice(0, selectedSubtitleIndex),
      mergedCue,
      ...cues.slice(selectedSubtitleIndex + 2),
    ];

    updateSubtitleCues(nextCues, selectedSubtitleIndex);
  };

  const deleteSelectedCue = () => {
    const cues = buildSubtitleCueList();
    if (!cues[selectedSubtitleIndex]) return;

    const nextCues = cues.filter((_, index) => index !== selectedSubtitleIndex);
    const nextSelectedIndex = Math.min(selectedSubtitleIndex, Math.max(0, nextCues.length - 1));
    updateSubtitleCues(nextCues, nextSelectedIndex);
  };

  const duplicateSelectedCue = () => {
    const cues = buildSubtitleCueList();
    const cue = cues[selectedSubtitleIndex];
    if (!cue) return;

    const copyCue = {
      start: cue.start,
      end: cue.end,
      text: cue.text,
    };

    const nextCues = [
      ...cues.slice(0, selectedSubtitleIndex + 1),
      copyCue,
      ...cues.slice(selectedSubtitleIndex + 1),
    ];

    updateSubtitleCues(nextCues, selectedSubtitleIndex + 1);
  };

  const subtitleLines = useMemo(
    () =>
      subtitleContent
        .split("\n")
        .map((line) => line.trim())
        .filter((line) => line && !line.includes("-->") && !/^\d+$/.test(line)),
    [subtitleContent]
  );

  const subtitleCues = useMemo(() => {
    const lines = subtitleContent.split("\n").map((line) => line.trimEnd());
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
  }, [subtitleContent]);

  const writeCuesToSubtitleContent = (nextCues) => {
    const nextSubtitleContent = nextCues
      .map((cue, index) => `${index + 1}\n${formatSecondsToSrtTime(cue.start)} --> ${formatSecondsToSrtTime(cue.end)}\n${cue.text}\n`)
      .join("\n")
      .trim();
    setSubtitleContent(nextSubtitleContent);
  };

  const normalizeCues = (nextCues = []) => {
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

  const buildProjectPayload = () => ({
    version: 1,
    savedAt: new Date().toISOString(),
    subtitles: subtitleContent,
    subtitleWords,
    waveformPeaks,
    editorStyles: {
      fontName,
      fontWeight,
      fontColor,
      fontSize,
      outline,
      outlineEnabled,
      outlineColor,
      shadow,
      shadowEnabled,
      backColor,
      backgroundEnabled,
      position,
      highlightColor,
      highlightMode,
      animation,
    },
    subtitleMode,
    timelineZoom,
    selectedCue: selectedSubtitleIndex,
    template: subtitlePreset,
    videoPath,
    subtitlePath,
  });

  const applyProjectPayload = (payload = {}) => {
    if (!payload || typeof payload !== "object") {
      throw new Error("Invalid project format.");
    }
    if (payload.version !== 1) {
      throw new Error("Unsupported project version.");
    }
    const editorStyles = payload.editorStyles || {};
    setSubtitleContent(String(payload.subtitles || ""));
    setSubtitleWords(Array.isArray(payload.subtitleWords) ? payload.subtitleWords : []);
    setWaveformPeaks(Array.isArray(payload.waveformPeaks) ? payload.waveformPeaks : []);
    setSubtitleMode(payload.subtitleMode || "original");
    setTimelineZoom(Number(payload.timelineZoom) || 100);
    setSelectedSubtitleIndex(Number(payload.selectedCue) || 0);
    setSubtitlePreset(payload.template || "");
    setVideoPath(payload.videoPath || "");
    setSubtitlePath(payload.subtitlePath || "");
    setFontName(editorStyles.fontName || "Poppins");
    setFontWeight(editorStyles.fontWeight || "Regular");
    setFontColor(editorStyles.fontColor || "#ffffff");
    setFontSize(Number(editorStyles.fontSize) || 48);
    setOutline(Number(editorStyles.outline) || 2);
    setOutlineEnabled(Boolean(editorStyles.outlineEnabled));
    setOutlineColor(editorStyles.outlineColor || "#000000");
    setShadow(Number(editorStyles.shadow) || 1);
    setShadowEnabled(Boolean(editorStyles.shadowEnabled));
    setBackColor(editorStyles.backColor || "#000000");
    setBackgroundEnabled(Boolean(editorStyles.backgroundEnabled));
    setPosition(editorStyles.position || "bottom");
    setHighlightColor(editorStyles.highlightColor || "#ffff00");
    setHighlightMode(editorStyles.highlightMode || "current");
    setAnimation(editorStyles.animation || "none");
    setVideoSeek(0);
    setIsVideoPlaying(false);
    setShowDownload(false);
    setSuccessMessage("");
    setFinalVideoPath("");
    setGeneratedSrtPath("");
    historySkipRef.current = true;
  };

  const saveProject = () => {
    const projectJson = JSON.stringify(buildProjectPayload(), null, 2);
    const blob = new Blob([projectJson], { type: "application/json" });
    const url = URL.createObjectURL(blob);
    const anchor = document.createElement("a");
    anchor.href = url;
    anchor.download = `subtitle-project-${Date.now()}.subtitle`;
    anchor.click();
    URL.revokeObjectURL(url);
  };

  const openProject = () => {
    projectFileInputRef.current?.click();
  };

  const handleProjectFileChange = async (event) => {
    const projectFile = event.target.files?.[0];
    if (!projectFile) return;
    try {
      const text = await projectFile.text();
      const payload = JSON.parse(text);
      applyProjectPayload(payload);
    } catch (error) {
      alert(error instanceof Error ? error.message : "Unable to open project file.");
    } finally {
      event.target.value = "";
    }
  };

  useEffect(() => {
    if (selectedSubtitleIndex >= subtitleLines.length) {
      setSelectedSubtitleIndex(Math.max(0, subtitleLines.length - 1));
    }
  }, [selectedSubtitleIndex, subtitleLines.length]);

  const filteredSubtitleLines = subtitleLines.filter((line) =>
    line.toLowerCase().includes(searchTerm.toLowerCase())
  );
  const currentSubtitle =
    filteredSubtitleLines[selectedSubtitleIndex] ||
    subtitleLines[0] ||
    "Your subtitle preview will appear here.";
  const isVideoUploaded = Boolean(videoPath);
  const previewCue =
    subtitleContent
      .split("\n")
      .map((line) => line.trim())
      .find((line) => line && !line.includes("-->") && !/^\d+$/.test(line)) ||
    "Your subtitle preview will appear here.";
  const activeCue = subtitleCues.find(
    (cue) => videoSeek >= cue.start && videoSeek <= cue.end
  );
  const activeCueText = activeCue?.text || previewCue;
  const activeCueWords = useMemo(() => {
    if (subtitleMode !== "karaoke" || !subtitleWords.length) {
      return [];
    }
    const cueStart = activeCue?.start ?? videoSeek;
    const cueEnd = activeCue?.end ?? videoSeek + 0.8;

    const filteredWords = subtitleWords
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
    return filteredWords;
  }, [activeCue?.start, activeCue?.end, subtitleMode, subtitleWords, videoSeek]);
  const editorSnapshot = useMemo(
    () => ({
      subtitleContent,
      selectedSubtitleIndex,
      subtitleMode,
      subtitlePreset,
      highlightMode,
      highlightColor,
      animation,
      fontName,
      fontWeight,
      fontColor,
      fontSize,
      outline,
      outlineEnabled,
      shadow,
      shadowEnabled,
      backColor,
      backgroundEnabled,
      outlineColor,
      position,
    }),
    [
      subtitleContent,
      selectedSubtitleIndex,
      subtitleMode,
      subtitlePreset,
      highlightMode,
      highlightColor,
      animation,
      fontName,
      fontWeight,
      fontColor,
      fontSize,
      outline,
      outlineEnabled,
      shadow,
      shadowEnabled,
      backColor,
      backgroundEnabled,
      outlineColor,
      position,
    ]
  );

  useEffect(() => {
    if (historySkipRef.current) {
      historySkipRef.current = false;
      lastHistorySnapshotRef.current = editorSnapshot;
      return;
    }

    if (!lastHistorySnapshotRef.current) {
      lastHistorySnapshotRef.current = editorSnapshot;
      return;
    }

    if (!areSnapshotsEqual(lastHistorySnapshotRef.current, editorSnapshot)) {
      const previousSnapshot = lastHistorySnapshotRef.current;
      lastHistorySnapshotRef.current = editorSnapshot;
      setHistory((currentHistory) => ({
        past: [...currentHistory.past.slice(-99), previousSnapshot],
        future: [],
      }));
    }
  }, [editorSnapshot]);
  const previewVideoSrc = videoPath
    ? videoPath.startsWith("http")
      ? videoPath
      : videoPath.includes("/uploads/")
        ? `http://localhost:5000${videoPath.slice(videoPath.indexOf("/uploads/"))}`
        : `http://localhost:5000/uploads/${videoPath.split(/[\\/]/).pop()}`
    : "";

  const uploadVideo = async () => {
    if (!file) return;
    setIsUploading(true);
    try {
      const formData = new FormData();
      formData.append("video", file);
      const response = await api.post("/api/upload/video", formData);
      setSubtitleContent(response.data.subtitleContent);
      setSubtitlePath(response.data.subtitlePath);
      setSubtitleWords(response.data.words || []);
      setVideoPath(response.data.videoPath);
      setSelectedSubtitleIndex(0);
      setVideoSeek(0);
      setIsVideoPlaying(true);
    } finally {
      setIsUploading(false);
    }
  };

  useEffect(() => {
    let cancelled = false;

    const generateWaveform = async () => {
      if (!previewVideoSrc) {
        setWaveformPeaks([]);
        return;
      }

      try {
        const response = await fetch(previewVideoSrc);
        const arrayBuffer = await response.arrayBuffer();
        const AudioContextClass = window.AudioContext || window.webkitAudioContext;
        if (!AudioContextClass) return;
        const audioContext = new AudioContextClass();
        const audioBuffer = await audioContext.decodeAudioData(arrayBuffer.slice(0));
        const channelData = audioBuffer.getChannelData(0);
        const bucketCount = 320;
        const samplesPerBucket = Math.max(1, Math.floor(channelData.length / bucketCount));
        const peaks = Array.from({ length: bucketCount }, (_, bucketIndex) => {
          const start = bucketIndex * samplesPerBucket;
          const end = Math.min(channelData.length, start + samplesPerBucket);
          let peak = 0;
          for (let sampleIndex = start; sampleIndex < end; sampleIndex += 1) {
            peak = Math.max(peak, Math.abs(channelData[sampleIndex] || 0));
          }
          return peak;
        });

        if (!cancelled) {
          setWaveformPeaks(peaks);
        }
        audioContext.close?.();
      } catch (error) {
        if (!cancelled) {
          setWaveformPeaks([]);
        }
      }
    };

    generateWaveform();

    return () => {
      cancelled = true;
    };
  }, [previewVideoSrc]);

  const generateVideo = async () => {
    setIsGenerating(true);
    try {
      const response = await api.post("/api/upload/generate-video", {
        subtitleMode,
        subtitlePreset,
        highlightMode,
        highlightColor,
        animation,
        fontName,
        fontColor,
        fontSize,
        position,
        fontWeight,
        outlineEnabled,
        outline: outlineEnabled ? outline : 0,
        shadowEnabled,
        shadow: shadowEnabled ? shadow : 0,
        backgroundEnabled,
        backColor: backgroundEnabled ? backColor : "#000000",
        outlineColor: outlineEnabled ? outlineColor : "#000000",
        subtitleContent,
        subtitlePath,
        videoPath,
      });
      setGeneratedSrtPath(response.data.subtitlePath);
      setFinalVideoPath(response.data.finalVideoPath);
      setShowDownload(true);
      alert("Video generated successfully.");
    } catch (error) {
      alert("Video generation failed");
    } finally {
      setIsGenerating(false);
    }
  };

  useEffect(() => {
    const videoElement = videoRef.current;
    if (!videoElement) return;
    if (isVideoPlaying) {
      void videoElement.play().catch(() => {});
    } else {
      videoElement.pause();
    }
  }, [isVideoPlaying, videoPath]);

  useEffect(() => {
    const handleUndoRedo = (event) => {
      const key = event.key.toLowerCase();
      const isUndo = event.ctrlKey && key === "z" && !event.shiftKey;
      const isRedo = (event.ctrlKey && event.shiftKey && key === "z") || (event.ctrlKey && key === "y");

      if (!isUndo && !isRedo) return;

      event.preventDefault();
      if (isUndo) {
        undoEditorChange();
      } else {
        redoEditorChange();
      }
    };

    window.addEventListener("keydown", handleUndoRedo);
    return () => window.removeEventListener("keydown", handleUndoRedo);
  }, []);

  useEffect(() => {
    const handleEditorActions = (event) => {
      const target = event.target;
      const isTypingTarget =
        target &&
        (target.tagName === "INPUT" ||
          target.tagName === "TEXTAREA" ||
          target.tagName === "SELECT" ||
          target.isContentEditable);
      if (isTypingTarget) return;

      const key = event.key.toLowerCase();
      if (key === "escape") {
        event.preventDefault();
        setSelectedSubtitleIndex(-1);
        return;
      }
      if (key === "delete") {
        event.preventDefault();
        deleteSelectedCue();
        return;
      }
      if (event.ctrlKey && key === "d") {
        event.preventDefault();
        duplicateSelectedCue();
      }
    };

    window.addEventListener("keydown", handleEditorActions);
    return () => window.removeEventListener("keydown", handleEditorActions);
  }, [selectedSubtitleIndex, subtitleContent, videoSeek]);

  const subtitlePreviewStyle = {
    color: fontColor,
    fontFamily: fontName,
    fontWeight:
      fontWeight === "Regular"
        ? 400
        : fontWeight === "Medium"
          ? 500
          : fontWeight === "SemiBold"
            ? 600
            : fontWeight === "Bold"
              ? 700
              : 800,
    fontSize: `${Math.min(Math.max(fontSize / 2.5, 16), 30)}px`,
    WebkitTextStroke: outlineEnabled ? `${Math.max(outline, 1)}px ${outlineColor}` : "0px transparent",
    WebkitTextFillColor: fontColor,
    textShadow: shadowEnabled ? `${shadow}px ${shadow}px 0 rgba(0, 0, 0, 0.95)` : "0 2px 8px rgba(0, 0, 0, 0.9)",
    backgroundColor: backgroundEnabled ? `${backColor}F2` : "transparent",
    padding: "0.35rem 0.6rem",
    borderRadius: "0.5rem",
    display: "inline-block",
    boxDecorationBreak: "clone",
    border: outlineEnabled ? `2px solid ${outlineColor}` : "1px solid transparent",
    boxShadow: "none",
  };

  const previewCaptionClassName = [
    "preview-caption",
    `preview-caption--${position}`,
    `preview-caption--animation-${animation}`,
    highlightMode === "progressive"
      ? "preview-caption--progressive"
      : "preview-caption--current",
  ].join(" ");

  return (
    <main className="subtitle-page subtitle-page--desktop">
      <input
        ref={projectFileInputRef}
        type="file"
        accept=".json,.subtitle,application/json"
        style={{ display: "none" }}
        onChange={handleProjectFileChange}
      />
      <header className="subtitle-hero subtitle-hero--sticky">
        <div>
          <p className="eyebrowH">Subtitle Studio</p>
          <p className="hero-copy" style={{ marginLeft: "10px" }}>
            Upload a video, tune subtitle styling, and export a polished final cut.
          </p>
        </div>
      </header>

      <section className="editor-layout">
        <aside className="editor-panel editor-panel--left">
          <section className="panel-card">
            <div className="upload-card__header">
              <div>
                <p className="section-kicker">Step 1</p>
                <h2>Upload video</h2>
              </div>
              <span className="status-pill">{file ? file.name : "No file selected"}</span>
            </div>
            <div className="upload-row upload-row--stack">
              <Form.Control
                className="file-input"
                type="file"
                accept="video/*"
                onChange={(e) => setFile(e.target.files[0])}
              />
              {isUploading ? (
                <div className="inline-loader">
                  <Loader />
                  <p>Uploading and generating subtitles...</p>
                </div>
              ) : (
                <Button className="primary-action" onClick={uploadVideo} disabled={!file}>
                  Upload
                </Button>
              )}
            </div>
          </section>

          <section className="panel-card panel-card--subtle">
            <div className="upload-card__header">
              <div>
                <p className="section-kicker">Library</p>
                <h2>History</h2>
              </div>
            </div>
            <div className="panel-placeholder">History placeholder</div>
          </section>

          <section className="panel-card panel-card--subtle">
            <div className="upload-card__header">
              <div>
                <p className="section-kicker">Library</p>
                <h2>Assets</h2>
              </div>
            </div>
            <div className="panel-placeholder">Assets placeholder</div>
          </section>
        </aside>

        <section className="editor-panel editor-panel--center">
          <section className="panel-card panel-card--preview">
            <div className="upload-card__header">
              <div>
                <p className="section-kicker">Live Preview</p>
                <h2>Video Preview</h2>
              </div>
              <div className="preview-toolbar">
                <button type="button" className="ghost-button" onClick={() => setIsVideoPlaying(true)}>
                  Play
                </button>
                <button type="button" className="ghost-button" onClick={() => setIsVideoPlaying(false)}>
                  Pause
                </button>
                <button type="button" className="ghost-button" onClick={openProject}>
                  Open Project
                </button>
                <button type="button" className="ghost-button" onClick={saveProject}>
                  Save Project
                </button>
              </div>
            </div>
            <div className="preview-frame preview-frame--large preview-frame--editor">
              {videoPath ? (
                <video
                  ref={videoRef}
                  className="preview-video"
                  src={previewVideoSrc}
                  muted
                  loop
                  playsInline
                  controls
                  onPlay={() => setIsVideoPlaying(true)}
                  onPause={() => setIsVideoPlaying(false)}
                  onTimeUpdate={(event) => setVideoSeek(event.currentTarget.currentTime)}
                  onLoadedMetadata={(event) => setVideoDuration(event.currentTarget.duration || 0)}
                />
              ) : null}
              <div className="preview-overlay" />
              <div className="preview-badge">
                {fontName} · {fontWeight}
              </div>
              <div className={previewCaptionClassName} style={subtitlePreviewStyle}>
                <SubtitleOverlay
                  text={activeCueText}
                  words={activeCueWords}
                  currentTime={videoSeek}
                  subtitleMode={subtitleMode}
                  fontColor={fontColor}
                  highlightColor={highlightColor}
                  highlightMode={highlightMode}
                  animation={animation}
                />
              </div>
            </div>
            <div className="preview-seek">
              <input
                type="range"
                min="0"
                max={videoDuration || 0}
                step="0.01"
                value={videoSeek}
                onChange={(event) => {
                  const nextTime = Number(event.target.value);
                  setVideoSeek(nextTime);
                  if (videoRef.current) videoRef.current.currentTime = nextTime;
                }}
              />
            </div>
            <TimelineEditor
              cues={subtitleCues}
              currentTime={videoSeek}
              duration={videoDuration}
              selectedIndex={selectedSubtitleIndex}
              waveformPeaks={waveformPeaks}
              zoom={timelineZoom}
              onZoomChange={setTimelineZoom}
              onUpdateCue={(index, nextCue) => {
                const nextCues = subtitleCues.map((cue, cueIndex) =>
                  cueIndex === index ? { ...cue, ...nextCue } : cue
                );
                updateSubtitleCues(nextCues, index);
              }}
              onSeek={(time, index) => {
                setVideoSeek(time);
                if (videoRef.current) videoRef.current.currentTime = time;
                if (typeof index === "number") {
                  setSelectedSubtitleIndex(index);
                }
              }}
              onSelectCue={(index) => setSelectedSubtitleIndex(index)}
              onTogglePlay={() => setIsVideoPlaying((current) => !current)}
            />
          </section>
        </section>

        <aside className="editor-panel editor-panel--right">
          <div className="settings-card settings-card--sticky">
            <div className="upload-card__header">
              <div>
                <p className="section-kicker">Step 2</p>
                <h2>Subtitle List</h2>
              </div>
            </div>
            <div className="list-toolbar">
              <input
                className="subtitle-search"
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                placeholder="Search subtitles"
              />
              <div className="list-actions">
                <button
                  className="ghost-button"
                  type="button"
                  onClick={() =>
                    setSubtitleContent(
                      (value) => `${value}\n${subtitleLines.length + 1}\n00:00:00,000 --> 00:00:01,000\nNew subtitle\n`
                    )
                  }
                >
                  Add Subtitle
                </button>
                <button
                  className="ghost-button ghost-button--danger"
                  type="button"
                  onClick={() =>
                    setSubtitleContent((value) => value.split("\n\n").slice(0, -1).join("\n\n"))
                  }
                >
                  Delete Subtitle
                </button>
                <button className="ghost-button" type="button" onClick={splitSelectedCue}>
                  Split Cue
                </button>
                <button className="ghost-button" type="button" onClick={mergeSelectedCue}>
                  Merge Cue
                </button>
                <button className="ghost-button" type="button" onClick={duplicateSelectedCue}>
                  Duplicate Cue
                </button>
              </div>
            </div>
            <div className="subtitle-list">
              {filteredSubtitleLines.map((line, index) => (
                <button
                  key={`${line}-${index}`}
                  type="button"
                  className={`subtitle-list-item ${index === selectedSubtitleIndex ? "subtitle-list-item--active" : ""}`}
                  onClick={() => setSelectedSubtitleIndex(index)}
                >
                  <span className="subtitle-list-item__index">
                    {String(index + 1).padStart(2, "0")}
                  </span>
                  <span className="subtitle-list-item__text">{line}</span>
                </button>
              ))}
            </div>
            <textarea
              className="subtitle-textarea subtitle-textarea--compact"
              rows="14"
              value={subtitleContent}
              onChange={(e) => setSubtitleContent(e.target.value)}
            />

            <div className="settings-block settings-block--caption-mode">
              <p className="settings-block__title">Caption Mode</p>
              <div className="caption-mode-group">
                <button
                  type="button"
                  className={`tab-button ${subtitleMode === "original" ? "tab-button--active" : ""}`}
                  onClick={() => setSubtitleMode("original")}
                >
                  Original
                </button>
                <button
                  type="button"
                  className={`tab-button ${subtitleMode === "romanized" ? "tab-button--active" : ""}`}
                  onClick={() => setSubtitleMode("romanized")}
                >
                  Hinglish
                </button>
                <button
                  type="button"
                  className={`tab-button ${subtitleMode === "karaoke" ? "tab-button--active" : ""}`}
                  onClick={() => setSubtitleMode("karaoke")}
                >
                  Word Highlight
                </button>
              </div>
            </div>

            <div className="tab-bar">
              {[
                "text",
                "karaoke",
                "style",
                "animation",
                "templates",
              ].map((tab) => (
                <button
                  key={tab}
                  type="button"
                  className={`tab-button ${activeTab === tab ? "tab-button--active" : ""}`}
                  onClick={() => setActiveTab(tab)}
                >
                  {tab.charAt(0).toUpperCase() + tab.slice(1)}
                </button>
              ))}
            </div>

            <div className="tab-panel">
              {activeTab === "text" && (
                <div className="settings-grid settings-grid--single">
                  <div className="control-field">
                    <label>Font Name:</label>
                    <select className="control-select" value={fontName} onChange={(e) => setFontName(e.target.value)}>
                      {fonts.map((font) => (
                        <option key={font} value={font}>
                          {font}
                        </option>
                      ))}
                    </select>
                  </div>
                  <div className="control-field">
                    <label>Font Weight:</label>
                    <select className="control-select" value={fontWeight} onChange={(e) => setFontWeight(e.target.value)}>
                      <option value="Regular">Regular</option>
                      <option value="Medium">Medium</option>
                      <option value="SemiBold">Semi Bold</option>
                      <option value="Bold">Bold</option>
                      <option value="ExtraBold">Extra Bold</option>
                    </select>
                  </div>
                  <div className="control-field">
                    <label>Font Color:</label>
                    <input className="color-input" type="color" value={fontColor} onChange={(e) => setFontColor(e.target.value)} />
                  </div>
                  <div className="control-field">
                    <label>Font Size:</label>
                    <input className="number-input" type="number" value={fontSize} onChange={(e) => setFontSize(Number(e.target.value))} />
                  </div>
                  <div className="control-field">
                    <label>Position:</label>
                    <select className="control-select" value={position} onChange={(e) => setPosition(e.target.value)}>
                      <option value="bottom">Bottom</option>
                      <option value="center">Center</option>
                      <option value="top">Top</option>
                    </select>
                  </div>
                </div>
              )}
              {activeTab === "karaoke" && (
                <div className="settings-grid settings-grid--single">
                  <div className="control-field">
                    <label>Karaoke Preset:</label>
                    <select className="control-select" value={subtitlePreset} onChange={(e) => setSubtitlePreset(e.target.value)}>
                      <option value="">Custom</option>
                      <option value="instagram-reel">Instagram Reel</option>
                      <option value="youtube-shorts">YouTube Shorts</option>
                      <option value="netflix">Netflix</option>
                      <option value="news">News</option>
                      <option value="gaming">Gaming</option>
                      <option value="podcast">Podcast</option>
                    </select>
                  </div>
                  <div className="control-field">
                    <label>Highlight Mode:</label>
                    <select className="control-select" value={highlightMode} onChange={(e) => setHighlightMode(e.target.value)}>
                      <option value="current">Current Word</option>
                      <option value="progressive">Progressive</option>
                    </select>
                  </div>
                  <div className="control-field">
                    <label>Highlight Color:</label>
                    <input className="color-input" type="color" value={highlightColor} onChange={(e) => setHighlightColor(e.target.value)} />
                  </div>
                </div>
              )}
              {activeTab === "style" && (
                <div className="settings-grid settings-grid--single">
                  <div className="control-field">
                    <label className="toggle-label">
                      <input type="checkbox" checked={outlineEnabled} onChange={(e) => setOutlineEnabled(e.target.checked)} />
                      Outline
                    </label>
                    <input className="number-input" type="number" min="0" max="10" value={outline} disabled={!outlineEnabled} onChange={(e) => setOutline(Number(e.target.value))} />
                  </div>
                  <div className="control-field">
                    <label>Outline Color:</label>
                    <input className="color-input" type="color" value={outlineColor} onChange={(e) => setOutlineColor(e.target.value)} />
                  </div>
                  <div className="control-field">
                    <label className="toggle-label">
                      <input type="checkbox" checked={shadowEnabled} onChange={(e) => setShadowEnabled(e.target.checked)} />
                      Shadow
                    </label>
                    <input className="number-input" type="number" min="0" max="10" value={shadow} disabled={!shadowEnabled} onChange={(e) => setShadow(Number(e.target.value))} />
                  </div>
                  <div className="control-field">
                    <label className="toggle-label">
                      <input type="checkbox" checked={backgroundEnabled} onChange={(e) => setBackgroundEnabled(e.target.checked)} />
                      Background Box
                    </label>
                    <input className="color-input" type="color" value={backColor} disabled={!backgroundEnabled} onChange={(e) => setBackColor(e.target.value)} />
                  </div>
                </div>
              )}
              {activeTab === "animation" && (
                <div className="templates-grid">
                  {["none", "pop", "fade", "zoom", "slide"].map((item) => (
                    <button
                      key={item}
                      type="button"
                      className={`template-card ${animation === item ? "template-card--active" : ""}`}
                      onClick={() => setAnimation(item)}
                    >
                      <strong>{item.charAt(0).toUpperCase() + item.slice(1)}</strong>
                      <span>Animation preset</span>
                    </button>
                  ))}
                </div>
              )}
              {activeTab === "templates" && (
                <div className="templates-grid">
                  {[
                    ["instagram-reel", "Instagram Reel"],
                    ["youtube-shorts", "YouTube Shorts"],
                    ["netflix", "Netflix"],
                    ["news", "News"],
                    ["gaming", "Gaming"],
                    ["podcast", "Podcast"],
                    ["", "Custom"],
                  ].map(([id, name]) => (
                    <button
                      key={id || name}
                      type="button"
                      className={`template-card ${subtitlePreset === id ? "template-card--active" : ""}`}
                      onClick={() => setSubtitlePreset(id)}
                    >
                      <strong>{name}</strong>
                      <span>{id || "Manual control"}</span>
                    </button>
                  ))}
                </div>
              )}
            </div>

            <div className="action-bar">
              {isGenerating ? (
                <div className="inline-loader">
                  <Loader />
                  <p>Generating Final Video...</p>
                </div>
              ) : (
                <button className="generate-action" onClick={generateVideo}>
                  Generate Video
                </button>
              )}
            </div>
          </div>
        </aside>
      </section>

      {successMessage && <div className="success-message">{successMessage}</div>}
      {showDownload && (
        <div className="download-bar">
          <div className="download-copy">
            <p className="section-kicker">Ready</p>
            <h2>Export files</h2>
          </div>
          <Button
            className="download-action download-action--srt"
            onClick={() =>
              window.open(
                `http://localhost:5000/api/upload/download-srt?path=${encodeURIComponent(generatedSrtPath)}`
              )
            }
          >
            Download SRT
          </Button>
          {finalVideoPath && (
            <Button
              className="download-action download-action--video"
              onClick={() =>
                window.open(
                  `http://localhost:5000/api/upload/download-video?path=${encodeURIComponent(finalVideoPath)}`
                )
              }
            >
              Download Video
            </Button>
          )}
        </div>
      )}
    </main>
  );
}

export default UploadSection;

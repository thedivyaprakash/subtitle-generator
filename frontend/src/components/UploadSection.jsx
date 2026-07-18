import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import api from "../services/api";
import { Form, Button } from "react-bootstrap";
import "../App.css";
import Loader from "./Loader";
import SubtitleOverlay from "./SubtitleOverlay";
import TimelineEditor from "./TimelineEditor";
import useTimeline from "../hooks/useTimeline";
import useUndoRedo from "../hooks/useUndoRedo";
import useWaveform from "../hooks/useWaveform";
import useProject from "../hooks/useProject";
import {
  buildSubtitleCueList,
} from "../utils/subtitleUtils";

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
  const videoRef = useRef(null);

  const previewVideoSrc = videoPath
    ? videoPath.startsWith("http")
      ? videoPath
      : videoPath.includes("/uploads/")
        ? `http://localhost:5000${videoPath.slice(videoPath.indexOf("/uploads/"))}`
        : `http://localhost:5000/uploads/${videoPath.split(/[\\/]/).pop()}`
    : "";

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

  const subtitleLines = useMemo(
    () =>
      subtitleContent
        .split("\n")
        .map((line) => line.trim())
        .filter((line) => line && !line.includes("-->") && !/^\d+$/.test(line)),
    [subtitleContent]
  );

  const {
    subtitleCues,
    activeCue,
    activeCueWords,
    updateSubtitleCues,
  } = useTimeline({
    subtitleContent,
    subtitleWords,
    subtitleMode,
    videoSeek,
    selectedSubtitleIndex,
    setSubtitleContent,
    setSelectedSubtitleIndex,
  });

  const filteredSubtitleLines = useMemo(
    () =>
      subtitleLines.filter((line) =>
        line.toLowerCase().includes(searchTerm.toLowerCase())
      ),
    [searchTerm, subtitleLines]
  );

  const activeCueText = activeCue?.text || subtitleLines[0] || "";

  const splitSelectedCue = useCallback(() => {
    const cues = buildSubtitleCueList(subtitleContent);
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

    const nextCues = [
      ...cues.slice(0, selectedSubtitleIndex),
      { start: cueStart, end: splitTime, text: words.slice(0, splitIndex).join(" ") },
      { start: splitTime, end: cueEnd, text: words.slice(splitIndex).join(" ") },
      ...cues.slice(selectedSubtitleIndex + 1),
    ];

    updateSubtitleCues(nextCues, selectedSubtitleIndex);
  }, [selectedSubtitleIndex, subtitleContent, updateSubtitleCues, videoSeek]);

  const mergeSelectedCue = useCallback(() => {
    const cues = buildSubtitleCueList(subtitleContent);
    const cue = cues[selectedSubtitleIndex];
    const nextCue = cues[selectedSubtitleIndex + 1];
    if (!cue || !nextCue) return;

    updateSubtitleCues(
      [
        ...cues.slice(0, selectedSubtitleIndex),
        { start: cue.start, end: nextCue.end, text: `${cue.text} ${nextCue.text}`.trim() },
        ...cues.slice(selectedSubtitleIndex + 2),
      ],
      selectedSubtitleIndex
    );
  }, [selectedSubtitleIndex, subtitleContent, updateSubtitleCues]);

  const deleteSelectedCue = useCallback(() => {
    const cues = buildSubtitleCueList(subtitleContent);
    if (!cues[selectedSubtitleIndex]) return;
    const nextCues = cues.filter((_, index) => index !== selectedSubtitleIndex);
    updateSubtitleCues(nextCues, Math.min(selectedSubtitleIndex, Math.max(0, nextCues.length - 1)));
  }, [selectedSubtitleIndex, subtitleContent, updateSubtitleCues]);

  const duplicateSelectedCue = useCallback(() => {
    const cues = buildSubtitleCueList(subtitleContent);
    const cue = cues[selectedSubtitleIndex];
    if (!cue) return;

    const nextCues = [
      ...cues.slice(0, selectedSubtitleIndex + 1),
      { start: cue.start, end: cue.end, text: cue.text },
      ...cues.slice(selectedSubtitleIndex + 1),
    ];

    updateSubtitleCues(nextCues, selectedSubtitleIndex + 1);
  }, [selectedSubtitleIndex, subtitleContent, updateSubtitleCues]);

  const [waveformPeaks, setWaveformPeaks] = useWaveform(previewVideoSrc);

  const projectState = {
    subtitleContent,
    subtitleWords,
    waveformPeaks,
    subtitleMode,
    timelineZoom,
    selectedSubtitleIndex,
    subtitlePreset,
    videoPath,
    subtitlePath,
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
  };

  const { fileInputRef, saveProject, openProject, handleProjectFileChange } = useProject(projectState, {
    setSubtitleContent,
    setSubtitleWords,
    setWaveformPeaks,
    setSubtitleMode,
    setTimelineZoom,
    setSelectedSubtitleIndex,
    setSubtitlePreset,
    setVideoPath,
    setSubtitlePath,
    setFontName,
    setFontWeight,
    setFontColor,
    setFontSize,
    setOutline,
    setOutlineEnabled,
    setOutlineColor,
    setShadow,
    setShadowEnabled,
    setBackColor,
    setBackgroundEnabled,
    setPosition,
    setHighlightColor,
    setHighlightMode,
    setAnimation,
    setVideoSeek,
    setIsVideoPlaying,
    setShowDownload,
    setSuccessMessage,
    setFinalVideoPath,
    setGeneratedSrtPath,
  });

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

  const applyEditorSnapshot = (snapshot) => {
    if (!snapshot) return;
    setSubtitleContent(snapshot.subtitleContent ?? '');
    setSelectedSubtitleIndex(snapshot.selectedSubtitleIndex ?? 0);
    setSubtitleMode(snapshot.subtitleMode ?? 'original');
    setSubtitlePreset(snapshot.subtitlePreset ?? '');
    setHighlightMode(snapshot.highlightMode ?? 'current');
    setHighlightColor(snapshot.highlightColor ?? '#ffff00');
    setAnimation(snapshot.animation ?? 'none');
    setFontName(snapshot.fontName ?? 'Poppins');
    setFontWeight(snapshot.fontWeight ?? 'Regular');
    setFontColor(snapshot.fontColor ?? '#ffffff');
    setFontSize(snapshot.fontSize ?? 48);
    setOutline(snapshot.outline ?? 2);
    setOutlineEnabled(Boolean(snapshot.outlineEnabled));
    setShadow(snapshot.shadow ?? 1);
    setShadowEnabled(Boolean(snapshot.shadowEnabled));
    setBackColor(snapshot.backColor ?? '#000000');
    setBackgroundEnabled(Boolean(snapshot.backgroundEnabled));
    setOutlineColor(snapshot.outlineColor ?? '#000000');
    setPosition(snapshot.position ?? 'bottom');
  };

  const { undo, redo, sync } = useUndoRedo(buildEditorSnapshot, applyEditorSnapshot);

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
    sync(editorSnapshot);
  }, [editorSnapshot, sync]);

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
    } catch {
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
        undo();
      } else {
        redo();
      }
    };

    window.addEventListener("keydown", handleUndoRedo);
    return () => window.removeEventListener("keydown", handleUndoRedo);
  }, [redo, undo, selectedSubtitleIndex, subtitleContent]);

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
  }, [deleteSelectedCue, duplicateSelectedCue]);

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
        ref={fileInputRef}
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
            <div className="upload-stack">
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

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { transliterate } from "transliteration";
import api, { pollVideoStatus } from "../services/api";
import { Form, Button } from "react-bootstrap";
import {
  Upload as UploadIcon,
  Play,
  Pause,
  FolderOpen,
  Save,
  Plus,
  Trash2,
  Scissors,
  Combine,
  Copy,
  Wand2,
  FileText,
  Download,
  CheckCircle2,
  AlertCircle,
  User,
  ChevronDown,
  Ban,
  Sparkles,
  Blend,
  ZoomIn,
  MoveHorizontal,
  Waves,
  Flame,
} from "lucide-react";
import "../App.css";
import Loader from "./Loader";
import SubtitleOverlay from "./SubtitleOverlay";
import TimelineEditor from "./TimelineEditor";
import TemplateGallery from "./TemplateGallery";
import ColorSwatchRow from "./ColorSwatchRow";
import subtitleTemplates from "../data/subtitleTemplates";
import useTimeline from "../hooks/useTimeline";
import useUndoRedo from "../hooks/useUndoRedo";
import useWaveform from "../hooks/useWaveform";
import useProject from "../hooks/useProject";
import {
  buildSubtitleCueList,
} from "../utils/subtitleUtils";
import { getRtlTextStyle, getRtlCaptionStyle } from "../utils/textDirection";
import { parseEmphasis, toggleWordEmphasis } from "../utils/emphasisUtils";

const FONT_WEIGHT_NUMBERS = {
  Thin: 100,
  ExtraLight: 200,
  Light: 300,
  Regular: 400,
  Medium: 500,
  SemiBold: 600,
  Bold: 700,
  ExtraBold: 800,
  Black: 900,
};

const ANIMATION_PRESETS = [
  { id: "none", label: "None", Icon: Ban },
  { id: "pop", label: "Pop", Icon: Sparkles },
  { id: "fade", label: "Fade", Icon: Blend },
  { id: "zoom", label: "Zoom", Icon: ZoomIn },
  { id: "slide", label: "Slide", Icon: MoveHorizontal },
  { id: "bounce", label: "Bounce", Icon: Waves },
  { id: "neon", label: "Neon", Icon: Flame },
];

function AccordionSection({ title, defaultOpen, children }) {
  return (
    <details className="inspector-accordion__item" open={defaultOpen}>
      <summary className="inspector-accordion__summary">
        <span className="inspector-accordion__icon">
          <ChevronDown size={14} />
        </span>
        {title}
      </summary>
      <div className="inspector-accordion__body">
        <div className="settings-grid settings-grid--single">{children}</div>
      </div>
    </details>
  );
}

function UploadSection() {
  const [file, setFile] = useState(null);
  const [language, setLanguage] = useState("hi");
  const [subtitleContent, setSubtitleContent] = useState("");
  const [subtitlePath, setSubtitlePath] = useState("");
  const [subtitleWords, setSubtitleWords] = useState([]);
  const [isGenerating, setIsGenerating] = useState(false);
  const [videoId, setVideoId] = useState(null);
  const [videoPath, setVideoPath] = useState("");
  const [denoisedAudioPath, setDenoisedAudioPath] = useState("");
  const [useEnhancedAudio, setUseEnhancedAudio] = useState(false);
  const [isUploading, setIsUploading] = useState(false);
  const [subtitleMode, setSubtitleMode] = useState("original");
  const [translatedSubtitleContent, setTranslatedSubtitleContent] = useState("");
  const [translatedSourceContent, setTranslatedSourceContent] = useState("");
  const [isTranslating, setIsTranslating] = useState(false);
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
  // "none" | "line" (box behind the whole caption line) | "word" (a
  // separate colored box behind each word, Hormozi/Reels style).
  const [backgroundStyle, setBackgroundStyle] = useState("none");
  const [uppercase, setUppercase] = useState(false);
  const [outlineColor, setOutlineColor] = useState("#000000");
  const [position, setPosition] = useState("bottom");
  const [showDownload, setShowDownload] = useState(false);
  const [successMessage, setSuccessMessage] = useState("");
  const [finalVideoPath, setFinalVideoPath] = useState("");
  const [generatedSrtPath, setGeneratedSrtPath] = useState("");
  const [activeTab, setActiveTab] = useState("templates");
  const [toast, setToast] = useState(null);
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

  const denoisedAudioUrl = denoisedAudioPath
    ? `http://localhost:5000/audio/${denoisedAudioPath.split(/[\\/]/).pop()}`
    : "";

  useEffect(() => {
    const loadFonts = async () => {
      const response = await api.get("/api/fonts");
      setFonts(response.data);
    };
    loadFonts();
  }, []);

  const availableWeights = useMemo(() => {
    const weights = fonts.find((font) => font.family === fontName)?.weights;
    return weights && weights.length ? weights : ["Regular"];
  }, [fonts, fontName]);

  useEffect(() => {
    if (!availableWeights.includes(fontWeight)) {
      setFontWeight(availableWeights.includes("Regular") ? "Regular" : availableWeights[0]);
    }
  }, [availableWeights, fontWeight]);

  useEffect(() => {
    if (!fontName || !availableWeights.length) return;

    const styleId = "preview-font-face";
    const previousStyle = document.getElementById(styleId);
    if (previousStyle) previousStyle.remove();

    const style = document.createElement("style");
    style.id = styleId;
    style.textContent = availableWeights
      .map(
        (weight) =>
          `@font-face { font-family: "${fontName}"; src: url("http://localhost:5000/fonts/${fontName}/${fontName}-${weight}.ttf") format("truetype"); font-weight: ${FONT_WEIGHT_NUMBERS[weight] || 400}; font-style: normal; }`
      )
      .join("\n");
    document.head.appendChild(style);
    return () => style.remove();
  }, [fontName, availableWeights]);

  useEffect(() => {
    if (!toast) return;
    const timer = setTimeout(() => setToast(null), 5000);
    return () => clearTimeout(timer);
  }, [toast]);

  const showToast = useCallback((message, tone = "success") => {
    setToast({ message, tone });
  }, []);

  const displaySubtitleContent = useMemo(() => {
    if (subtitleMode === "romanized") return transliterate(subtitleContent);
    if (subtitleMode === "translated") return translatedSubtitleContent || subtitleContent;
    return subtitleContent;
  }, [subtitleMode, subtitleContent, translatedSubtitleContent]);

  const translatedCues = useMemo(
    () => buildSubtitleCueList(translatedSubtitleContent),
    [translatedSubtitleContent]
  );

  const subtitleLines = useMemo(
    () =>
      displaySubtitleContent
        .split("\n")
        .map((line) => line.trim())
        .filter((line) => line && !line.includes("-->") && !/^\d+$/.test(line)),
    [displaySubtitleContent]
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

  const activeCueText = useMemo(() => {
    const rawText = activeCue?.text || "";
    if (!rawText) return "";
    if (subtitleMode === "romanized") return transliterate(rawText);
    if (subtitleMode === "translated") {
      const cueIndex = subtitleCues.indexOf(activeCue);
      return translatedCues[cueIndex]?.text || rawText;
    }
    return rawText;
  }, [activeCue, subtitleCues, subtitleMode, translatedCues]);

  const selectedCueEmphasisTokens = useMemo(
    () => parseEmphasis(subtitleCues[selectedSubtitleIndex]?.text || ""),
    [subtitleCues, selectedSubtitleIndex]
  );

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

  const toggleEmphasisOnWord = useCallback(
    (wordIndex) => {
      const cues = buildSubtitleCueList(subtitleContent);
      const cue = cues[selectedSubtitleIndex];
      if (!cue) return;

      const nextCues = cues.map((item, index) =>
        index === selectedSubtitleIndex
          ? { ...item, text: toggleWordEmphasis(item.text, wordIndex) }
          : item
      );

      updateSubtitleCues(nextCues, selectedSubtitleIndex);
    },
    [selectedSubtitleIndex, subtitleContent, updateSubtitleCues]
  );

  const handleSubtitleModeChange = useCallback(
    async (mode) => {
      if (mode === "translated" && translatedSourceContent !== subtitleContent) {
        setIsTranslating(true);
        try {
          const response = await api.post("/api/upload/translate", {
            subtitleContent,
            sourceLanguage: language,
          });
          setTranslatedSubtitleContent(response.data.translatedContent);
          setTranslatedSourceContent(subtitleContent);
        } catch {
          showToast("Translation failed", "error");
          setIsTranslating(false);
          return;
        }
        setIsTranslating(false);
      }
      setSubtitleMode(mode);
    },
    [language, subtitleContent, translatedSourceContent, showToast]
  );

  const applyTemplate = useCallback((id) => {
    if (id === "none") {
      setSubtitlePreset("");
      setFontName("Poppins");
      setFontWeight("Regular");
      setFontColor("#ffffff");
      setFontSize(48);
      setHighlightColor("#ffff00");
      setOutline(2);
      setOutlineEnabled(false);
      setOutlineColor("#000000");
      setShadow(1);
      setShadowEnabled(false);
      setBackgroundStyle("none");
      setUppercase(false);
      setPosition("bottom");
      setAnimation("none");
      return;
    }

    setSubtitlePreset(id);
    const template = subtitleTemplates[id];
    if (!template) return;

    setFontName(template.fontName);
    setFontWeight(template.fontWeight);
    setFontColor(template.fontColor);
    setFontSize(template.fontSize);
    setHighlightColor(template.highlightColor);
    setOutline(template.outline);
    setOutlineEnabled(Boolean(template.outline));
    setOutlineColor(template.outlineColor);
    setShadow(template.shadow);
    setShadowEnabled(Boolean(template.shadow));
    setBackgroundStyle(template.backgroundStyle || "none");
    setBackColor(template.backColor || "#000000");
    setUppercase(Boolean(template.uppercase));
    setPosition(template.position);
    setAnimation(template.animation);
  }, []);

  const [waveformPeaks, setWaveformPeaks] = useWaveform(previewVideoSrc);

  const projectState = {
    subtitleContent,
    subtitleWords,
    waveformPeaks,
    subtitleMode,
    timelineZoom,
    selectedSubtitleIndex,
    subtitlePreset,
    videoId,
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
      backgroundStyle,
      uppercase,
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
    setVideoId,
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
    setBackgroundStyle,
    setUppercase,
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
    backgroundStyle,
    uppercase,
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
    setBackgroundStyle(snapshot.backgroundStyle ?? 'none');
    setUppercase(Boolean(snapshot.uppercase));
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
      backgroundStyle,
      uppercase,
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
      backgroundStyle,
      uppercase,
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
      formData.append("language", language);
      const response = await api.post("/api/upload/video", formData);
      setVideoId(response.data.videoId);
      setVideoPath(response.data.videoPath);

      const result = await pollVideoStatus(response.data.videoId, {
        isDone: (data) => data.status === "ready" || data.status === "failed",
      });

      if (result.status === "failed") {
        showToast(`Transcription failed: ${result.errorMessage || "unknown error"}`, "error");
        return;
      }

      setSubtitleContent(result.subtitleContent || "");
      setSubtitlePath(result.subtitlePath);
      setSubtitleWords(result.words || []);
      setDenoisedAudioPath(result.denoisedAudioPath || "");
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
      const contentForRender =
        subtitleMode === "romanized"
          ? transliterate(subtitleContent)
          : subtitleMode === "translated"
            ? translatedSubtitleContent || subtitleContent
            : subtitleContent;

      const response = await api.post("/api/upload/generate-video", {
        videoId,
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
        backgroundStyle,
        uppercase,
        backColor: backgroundStyle !== "none" ? backColor : "#000000",
        outlineColor: outlineEnabled ? outlineColor : "#000000",
        subtitleContent: contentForRender,
        subtitlePath,
        videoPath,
        useEnhancedAudio,
      });

      const result = await pollVideoStatus(response.data.videoId, {
        isDone: (data) => data.status === "done" || data.status === "failed",
      });

      if (result.status === "failed") {
        showToast(`Video generation failed: ${result.errorMessage || "unknown error"}`, "error");
        return;
      }

      setGeneratedSrtPath(result.subtitlePath);
      setFinalVideoPath(result.finalVideoPath);
      setShowDownload(true);
      showToast("Video generated successfully — ready to download below.", "success");
    } catch {
      showToast("Video generation failed", "error");
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
    fontWeight: FONT_WEIGHT_NUMBERS[fontWeight] || 400,
    fontSize: `${Math.min(Math.max(fontSize / 2.5, 16), 30)}px`,
    WebkitTextStroke: outlineEnabled ? `${Math.max(outline, 1)}px ${outlineColor}` : "0px transparent",
    WebkitTextFillColor: fontColor,
    textShadow: shadowEnabled ? `${shadow}px ${shadow}px 0 rgba(0, 0, 0, 0.95)` : "0 2px 8px rgba(0, 0, 0, 0.9)",
    backgroundColor: backgroundStyle === "line" ? `${backColor}F2` : "transparent",
    textTransform: uppercase ? "uppercase" : "none",
    padding: "0.35rem 0.6rem",
    borderRadius: "0.5rem",
    display: "inline-flex",
    flexWrap: "wrap",
    justifyContent: "center",
    alignItems: "baseline",
    // Real layout gap (not a text-node space) so a scaled-up active/emphasized
    // word — transform doesn't reflow siblings — has room to grow into
    // without visually bleeding into its neighbors.
    gap: "0.15em 0.55em",
    border: outlineEnabled ? `2px solid ${outlineColor}` : "1px solid transparent",
    boxShadow: "none",
  };

  // Matches the backend: whole-line animation only applies to the plain
  // caption path (generateAss). Karaoke mode animates per active word
  // instead (handled inside SubtitleOverlay), so applying it here too
  // would double it up.
  const previewCaptionClassName = [
    "preview-caption",
    `preview-caption--${position}`,
    subtitleMode !== "karaoke" ? `preview-caption--animation-${animation}` : "",
    highlightMode === "progressive"
      ? "preview-caption--progressive"
      : "preview-caption--current",
  ]
    .filter(Boolean)
    .join(" ");

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
            </div>
            <div className="upload-stack">
              <label className="dropzone">
                <Form.Control
                  className="dropzone__input"
                  type="file"
                  accept="video/*"
                  onChange={(e) => setFile(e.target.files[0])}
                />
                <span className="dropzone__glyph">
                  <UploadIcon size={17} />
                </span>
                <strong>{file ? file.name : "Drop a video, or click to browse"}</strong>
                <span className="dropzone__hint">MP4, MOV — any length</span>
              </label>
              <div className="control-field">
                <label>Spoken Language:</label>
                <select
                  className="control-select"
                  value={language}
                  onChange={(e) => setLanguage(e.target.value)}
                >
                  <option value="hi">Hindi</option>
                  <option value="en">English</option>
                </select>
              </div>
              {isUploading ? (
                <div className="inline-loader">
                  <Loader />
                  <p>Uploading and generating subtitles...</p>
                </div>
              ) : (
                <Button className="primary-action" onClick={uploadVideo} disabled={!file}>
                  <UploadIcon size={16} /> Upload
                </Button>
              )}
            </div>
          </section>

          {denoisedAudioUrl && (
            <section className="panel-card">
              <div className="upload-card__header">
                <div>
                  <p className="section-kicker">Step 1.5</p>
                  <h2>Audio Enhancement</h2>
                </div>
              </div>
              <div className="upload-stack">
                <div className="control-field">
                  <label>Before:</label>
                  <audio controls src={previewVideoSrc} style={{ width: "100%" }} />
                </div>
                <div className="control-field">
                  <label>After (denoised):</label>
                  <audio controls src={denoisedAudioUrl} style={{ width: "100%" }} />
                </div>
                <label className="toggle-label">
                  <input
                    type="checkbox"
                    checked={useEnhancedAudio}
                    onChange={(e) => setUseEnhancedAudio(e.target.checked)}
                  />
                  Use enhanced audio in final video
                </label>
              </div>
            </section>
          )}

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
                  <Play size={14} /> Play
                </button>
                <button type="button" className="ghost-button" onClick={() => setIsVideoPlaying(false)}>
                  <Pause size={14} /> Pause
                </button>
                <button type="button" className="ghost-button" onClick={openProject}>
                  <FolderOpen size={14} /> Open Project
                </button>
                <button type="button" className="ghost-button" onClick={saveProject}>
                  <Save size={14} /> Save Project
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
              ) : (
                <div className="preview-placeholder-icon">
                  <User size={72} strokeWidth={1.2} />
                </div>
              )}
              <div className="preview-overlay" />
              <div className="preview-badge">
                <span className="preview-badge__dot" />
                Preview
              </div>
              {waveformPeaks.length > 0 && (
                <div className="preview-mini-wave">
                  {waveformPeaks
                    .filter((_, index) => index % Math.ceil(waveformPeaks.length / 46) === 0)
                    .slice(0, 46)
                    .map((peak, index) => (
                      <i key={index} style={{ height: `${Math.max(12, Math.min(100, peak * 100))}%` }} />
                    ))}
                </div>
              )}
              <div
                key={subtitleMode !== "karaoke" ? activeCue?.start ?? "empty" : "karaoke"}
                className={previewCaptionClassName}
                style={{ ...subtitlePreviewStyle, ...getRtlCaptionStyle(activeCueText) }}
              >
                <SubtitleOverlay
                  text={activeCueText}
                  words={activeCueWords}
                  currentTime={videoSeek}
                  subtitleMode={subtitleMode}
                  fontColor={fontColor}
                  highlightColor={highlightColor}
                  highlightMode={highlightMode}
                  animation={animation}
                  backgroundStyle={backgroundStyle}
                  backColor={backColor}
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
                  <Plus size={14} /> Add Subtitle
                </button>
                <button
                  className="ghost-button ghost-button--danger"
                  type="button"
                  onClick={() =>
                    setSubtitleContent((value) => value.split("\n\n").slice(0, -1).join("\n\n"))
                  }
                >
                  <Trash2 size={14} /> Delete Subtitle
                </button>
                <button className="ghost-button" type="button" onClick={splitSelectedCue}>
                  <Scissors size={14} /> Split Cue
                </button>
                <button className="ghost-button" type="button" onClick={mergeSelectedCue}>
                  <Combine size={14} /> Merge Cue
                </button>
                <button className="ghost-button" type="button" onClick={duplicateSelectedCue}>
                  <Copy size={14} /> Duplicate Cue
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
                  <span className="subtitle-list-item__text" style={getRtlTextStyle(line)}>
                    {line}
                  </span>
                </button>
              ))}
            </div>
            <textarea
              className="subtitle-textarea subtitle-textarea--compact"
              rows="14"
              dir="auto"
              value={displaySubtitleContent}
              readOnly={subtitleMode === "romanized" || subtitleMode === "translated"}
              onChange={(e) => {
                if (subtitleMode === "romanized" || subtitleMode === "translated") return;
                setSubtitleContent(e.target.value);
              }}
            />
            {(subtitleMode === "romanized" || subtitleMode === "translated") && (
              <p className="hero-copy" style={{ marginTop: "0.35rem", fontSize: "0.8rem" }}>
                {subtitleMode === "translated" && isTranslating
                  ? "Translating..."
                  : "This preview is read-only. Switch to Original to edit text."}
              </p>
            )}

            {subtitleMode === "original" && selectedCueEmphasisTokens.length > 0 && (
              <div className="emphasis-row">
                <span className="emphasis-row__label">
                  Emphasize words in this cue (bigger + highlight color):
                </span>
                {selectedCueEmphasisTokens.map((token, index) => (
                  <button
                    key={`${token.word}-${index}`}
                    type="button"
                    className={`emphasis-token ${token.emphasized ? "emphasis-token--active" : ""}`}
                    onClick={() => toggleEmphasisOnWord(index)}
                  >
                    {token.word}
                  </button>
                ))}
              </div>
            )}

            <div className="settings-block settings-block--caption-mode">
              <p className="settings-block__title">Caption Mode</p>
              <div className="caption-mode-group">
                <button
                  type="button"
                  className={`tab-button ${subtitleMode === "original" ? "tab-button--active" : ""}`}
                  onClick={() => handleSubtitleModeChange("original")}
                >
                  Original
                </button>
                <button
                  type="button"
                  className={`tab-button ${subtitleMode === "romanized" ? "tab-button--active" : ""}`}
                  onClick={() => handleSubtitleModeChange("romanized")}
                >
                  Hinglish
                </button>
                <button
                  type="button"
                  className={`tab-button ${subtitleMode === "translated" ? "tab-button--active" : ""}`}
                  onClick={() => handleSubtitleModeChange("translated")}
                  disabled={isTranslating}
                >
                  {isTranslating ? "Translating..." : "Translate to English"}
                </button>
                <button
                  type="button"
                  className={`tab-button ${subtitleMode === "karaoke" ? "tab-button--active" : ""}`}
                  onClick={() => handleSubtitleModeChange("karaoke")}
                >
                  Word Highlight
                </button>
              </div>
            </div>

            <div className="tab-bar">
              {[
                ["text", "Text"],
                ["animation", "Transitions"],
                ["templates", "Templates"],
              ].map(([tab, label]) => (
                <button
                  key={tab}
                  type="button"
                  className={`tab-button ${activeTab === tab ? "tab-button--active" : ""}`}
                  onClick={() => setActiveTab(tab)}
                >
                  {label}
                </button>
              ))}
            </div>

            <div className="tab-panel">
              {activeTab === "text" && (
                <div className="inspector-accordion">
                  <AccordionSection title="Fonts" defaultOpen>
                    <div className="control-field">
                      <label>Font Name:</label>
                      <select className="control-select" value={fontName} onChange={(e) => setFontName(e.target.value)}>
                        {fonts.map((font) => (
                          <option key={font.family} value={font.family}>
                            {font.family}
                          </option>
                        ))}
                      </select>
                    </div>
                    <div className="control-field">
                      <label>Font Weight:</label>
                      <select className="control-select" value={fontWeight} onChange={(e) => setFontWeight(e.target.value)}>
                        {availableWeights.map((weight) => (
                          <option key={weight} value={weight}>
                            {weight.replace(/([a-z])([A-Z])/g, "$1 $2")}
                          </option>
                        ))}
                      </select>
                    </div>
                    <div className="control-field">
                      <label>Font Size:</label>
                      <input className="number-input" type="number" value={fontSize} onChange={(e) => setFontSize(Number(e.target.value))} />
                    </div>
                    <div className="control-field">
                      <label className="toggle-label">
                        <input type="checkbox" checked={uppercase} onChange={(e) => setUppercase(e.target.checked)} />
                        Uppercase
                      </label>
                    </div>
                  </AccordionSection>

                  <AccordionSection title="Position">
                    <div className="control-field">
                      <label>Position:</label>
                      <select className="control-select" value={position} onChange={(e) => setPosition(e.target.value)}>
                        <option value="bottom">Bottom</option>
                        <option value="center">Center</option>
                        <option value="top">Top</option>
                      </select>
                    </div>
                  </AccordionSection>

                  <AccordionSection title="Color">
                    <div className="control-field">
                      <label>Font Color:</label>
                      <input className="color-input" type="color" value={fontColor} onChange={(e) => setFontColor(e.target.value)} />
                      <ColorSwatchRow value={fontColor} onChange={setFontColor} />
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
                      <ColorSwatchRow value={highlightColor} onChange={setHighlightColor} />
                    </div>
                  </AccordionSection>

                  <AccordionSection title="Effects">
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
                      <ColorSwatchRow value={outlineColor} onChange={setOutlineColor} disabled={!outlineEnabled} />
                    </div>
                    <div className="control-field">
                      <label className="toggle-label">
                        <input type="checkbox" checked={shadowEnabled} onChange={(e) => setShadowEnabled(e.target.checked)} />
                        Shadow
                      </label>
                      <input className="number-input" type="number" min="0" max="10" value={shadow} disabled={!shadowEnabled} onChange={(e) => setShadow(Number(e.target.value))} />
                    </div>
                    <div className="control-field">
                      <label>Background Style:</label>
                      <select
                        className="control-select"
                        value={backgroundStyle}
                        onChange={(e) => setBackgroundStyle(e.target.value)}
                      >
                        <option value="none">None</option>
                        <option value="line">Line Box</option>
                        <option value="word">Word Boxes (trending)</option>
                      </select>
                      <input
                        className="color-input"
                        type="color"
                        value={backColor}
                        disabled={backgroundStyle === "none"}
                        onChange={(e) => setBackColor(e.target.value)}
                      />
                      <ColorSwatchRow value={backColor} onChange={setBackColor} disabled={backgroundStyle === "none"} />
                    </div>
                  </AccordionSection>
                </div>
              )}
              {activeTab === "animation" && (
                <div className="templates-grid">
                  {ANIMATION_PRESETS.map(({ id, label, Icon }) => (
                    <button
                      key={id}
                      type="button"
                      className={`template-card template-card--icon ${animation === id ? "template-card--active" : ""}`}
                      onClick={() => setAnimation(id)}
                    >
                      <Icon size={22} />
                      <strong>{label}</strong>
                    </button>
                  ))}
                </div>
              )}
              {activeTab === "templates" && (
                <TemplateGallery
                  selectedTemplateId={subtitlePreset || "none"}
                  onSelectTemplate={applyTemplate}
                />
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
                  <Wand2 size={16} /> Generate Video
                </button>
              )}
            </div>
          </div>
        </aside>
      </section>

      {successMessage && <div className="success-message">{successMessage}</div>}
      {toast && (
        <div className={`toast-notification ${toast.tone === "error" ? "toast-notification--error" : ""}`}>
          {toast.tone === "error" ? <AlertCircle size={16} /> : <CheckCircle2 size={16} />}
          <span>{toast.message}</span>
        </div>
      )}
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
            <FileText size={16} /> Download SRT
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
              <Download size={16} /> Download Video
            </Button>
          )}
        </div>
      )}
    </main>
  );
}

export default UploadSection;

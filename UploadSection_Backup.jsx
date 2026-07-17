older ==============

import { useEffect, useMemo, useRef, useState } from "react";
import api from "../services/api";
import { Form, Button } from "react-bootstrap";
import "../App.css";
import Loader from "./Loader";
import SubtitleOverlay from "./SubtitleOverlay";

function UploadSection() {
  const [file, setFile] = useState(null);
  const [subtitleContent, setSubtitleContent] = useState("");
  const [subtitlePath, setSubtitlePath] = useState("");
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
  const videoRef = useRef(null);

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

  useEffect(() => {
    if (selectedSubtitleIndex >= subtitleLines.length) {
      setSelectedSubtitleIndex(Math.max(0, subtitleLines.length - 1));
    }
  }, [selectedSubtitleIndex, subtitleLines.length]);

  const filteredSubtitleLines = subtitleLines.filter((line) => line.toLowerCase().includes(searchTerm.toLowerCase()));
  const currentSubtitle = filteredSubtitleLines[selectedSubtitleIndex] || subtitleLines[0] || "Your subtitle preview will appear here.";
  const isVideoUploaded = Boolean(videoPath);
  const previewCue = subtitleContent.split("\n").map((line) => line.trim()).find((line) => line && !line.includes("-->") && !/^\d+$/.test(line)) || "Your subtitle preview will appear here.";
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
      //console.log("React subtitleMode state:", subtitleMode);
      //console.log("POST subtitleMode:", subtitleMode);
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

  const subtitlePreviewStyle = {
    color: fontColor,
    fontFamily: fontName,
    fontWeight: fontWeight === "Regular" ? 400 : fontWeight === "Medium" ? 500 : fontWeight === "SemiBold" ? 600 : fontWeight === "Bold" ? 700 : 800,
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
    highlightMode === "progressive" ? "preview-caption--progressive" : "preview-caption--current",
  ].join(" ");

  return (
    <main className="subtitle-page subtitle-page--desktop">
      <header className="subtitle-hero subtitle-hero--sticky">
        <div>
          <p className="eyebrowH">Subtitle Studio</p>
          {/*<h1>Subtitle Generator</h1>*/}
          <p className="hero-copy" style={{ marginLeft: "10px" }}>Upload a video, tune subtitle styling, and export a polished final cut.</p>
        </div>
      </header>

      <section className="upload-landing">
        <section className="upload-card upload-card--stacked upload-card--landing">
          <div className="upload-card__header">
            <div>
              <p className="section-kicker">Step 1</p>
              <h2>Upload video</h2>
            </div>
            <span className="status-pill">{file ? file.name : "No file selected"}</span>
          </div>
          <div className="upload-row">
            <Form.Control className="file-input" type="file" accept="video/*" onChange={(e) => setFile(e.target.files[0])} />
            {isUploading ? (
              <div className="inline-loader"><Loader /><p>Uploading and generating subtitles...</p></div>
            ) : (
              <Button className="primary-action" onClick={uploadVideo} disabled={!file}>Upload</Button>
            )}
          </div>
        </section>
      </section>

      {isVideoUploaded && (
        <div className="workspace-shell workspace-shell--revealed workspace-shell--refined">
          <aside className="panel panel--left">
            <section className="preview-card">
              <div className="upload-card__header">
                <div>
                  <p className="section-kicker">Live Preview</p>
                  <h2>Video Preview</h2>
                </div>
                <div className="preview-toolbar">
                  <button type="button" className="ghost-button" onClick={() => setIsVideoPlaying(true)}>Play</button>
                  <button type="button" className="ghost-button" onClick={() => setIsVideoPlaying(false)}>Pause</button>
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
                <div className="preview-badge">{fontName} · {fontWeight}</div>
                <div className={previewCaptionClassName} style={subtitlePreviewStyle}>
                  <SubtitleOverlay
                    text={previewCue}
                    fontColor={fontColor}
                    highlightColor={highlightColor}
                    highlightMode={highlightMode}
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
              <div className="timeline-shell">
                <div className="timeline-shell__row">
                  <span>Current subtitle</span>
                  <strong>{currentSubtitle}</strong>
                </div>
                <div className="timeline-placeholder">
                  <div className="timeline-placeholder__bar" />
                  <div className="timeline-placeholder__bar timeline-placeholder__bar--active" />
                  <div className="timeline-placeholder__bar" />
                </div>
                <div className="timeline-footer"><span>Timeline</span><span>Waveform</span><span>Word timeline</span></div>
              </div>
            </section>
          </aside>

          <section className="panel panel--center">
            <section className="editor-card editor-card--list">
              <div className="upload-card__header">
                <div>
                  <p className="section-kicker">Step 2</p>
                  <h2>Subtitle List</h2>
                </div>
              </div>
              <div className="list-toolbar">
                <input className="subtitle-search" value={searchTerm} onChange={(e) => setSearchTerm(e.target.value)} placeholder="Search subtitles" />
                <div className="list-actions">
                  <button className="ghost-button" type="button" onClick={() => setSubtitleContent((value) => `${value}\n${subtitleLines.length + 1}\n00:00:00,000 --> 00:00:01,000\nNew subtitle\n`)}>Add Subtitle</button>
                  <button className="ghost-button ghost-button--danger" type="button" onClick={() => setSubtitleContent((value) => value.split("\n\n").slice(0, -1).join("\n\n"))}>Delete Subtitle</button>
                </div>
              </div>
              <div className="subtitle-list">
                {filteredSubtitleLines.map((line, index) => (
                  <button key={`${line}-${index}`} type="button" className={`subtitle-list-item ${index === selectedSubtitleIndex ? "subtitle-list-item--active" : ""}`} onClick={() => setSelectedSubtitleIndex(index)}>
                    <span className="subtitle-list-item__index">{String(index + 1).padStart(2, "0")}</span>
                    <span className="subtitle-list-item__text">{line}</span>
                  </button>
                ))}
              </div>
              <textarea className="subtitle-textarea subtitle-textarea--compact" rows="14" value={subtitleContent} onChange={(e) => setSubtitleContent(e.target.value)} />
            </section>
          </section>

          <aside className="panel panel--right">
            <div className="settings-card settings-card--sticky">
              <div className="upload-card__header">
                <div>
                  <p className="section-kicker">Step 3</p>
                  <h2>Settings</h2>
                </div>
              </div>
              <div className="settings-block settings-block--caption-mode">
                <p className="settings-block__title">Caption Mode</p>
                <div className="caption-mode-group">
                  <label className={`caption-mode-option ${subtitleMode === "original" ? "caption-mode-option--active" : ""}`}>
                    <input type="radio" name="captionMode" value="original" checked={subtitleMode === "original"} onChange={(e) => setSubtitleMode(e.target.value)} />
                    <span>Original</span>
                  </label>
                  <label className={`caption-mode-option ${subtitleMode === "romanized" ? "caption-mode-option--active" : ""}`}>
                    <input type="radio" name="captionMode" value="romanized" checked={subtitleMode === "romanized"} onChange={(e) => setSubtitleMode(e.target.value)} />
                    <span>Hinglish</span>
                  </label>
                  <label className={`caption-mode-option ${subtitleMode === "karaoke" ? "caption-mode-option--active" : ""}`}>
                    <input type="radio" name="captionMode" value="karaoke" checked={subtitleMode === "karaoke"} onChange={(e) => setSubtitleMode(e.target.value)} />
                    <span>Word Highlight</span>
                  </label>
                </div>
              </div>
              <div className="tab-bar">{["text", "karaoke", "style", "animation", "templates"].map((tab) => (<button key={tab} type="button" className={`tab-button ${activeTab === tab ? "tab-button--active" : ""}`} onClick={() => setActiveTab(tab)}>{tab.charAt(0).toUpperCase() + tab.slice(1)}</button>))}</div>
              <div className="tab-panel">
                {activeTab === "text" && (
                  <div className="settings-grid settings-grid--single">
                    <div className="control-field"><label>Font Name:</label><select className="control-select" value={fontName} onChange={(e) => setFontName(e.target.value)}>{fonts.map((font) => (<option key={font} value={font}>{font}</option>))}</select></div>
                    <div className="control-field"><label>Font Weight:</label><select className="control-select" value={fontWeight} onChange={(e) => setFontWeight(e.target.value)}><option value="Regular">Regular</option><option value="Medium">Medium</option><option value="SemiBold">Semi Bold</option><option value="Bold">Bold</option><option value="ExtraBold">Extra Bold</option></select></div>
                    <div className="control-field"><label>Font Color:</label><input className="color-input" type="color" value={fontColor} onChange={(e) => setFontColor(e.target.value)} /></div>
                    <div className="control-field"><label>Font Size:</label><input className="number-input" type="number" value={fontSize} onChange={(e) => setFontSize(Number(e.target.value))} /></div>
                    <div className="control-field"><label>Position:</label><select className="control-select" value={position} onChange={(e) => setPosition(e.target.value)}><option value="bottom">Bottom</option><option value="center">Center</option><option value="top">Top</option></select></div>
                  </div>
                )}
                {activeTab === "karaoke" && (
                  <div className="settings-grid settings-grid--single">
                    <div className="control-field"><label>Karaoke Preset:</label><select className="control-select" value={subtitlePreset} onChange={(e) => setSubtitlePreset(e.target.value)}><option value="">Custom</option><option value="instagram-reel">Instagram Reel</option><option value="youtube-shorts">YouTube Shorts</option><option value="netflix">Netflix</option><option value="news">News</option><option value="gaming">Gaming</option><option value="podcast">Podcast</option></select></div>
                    <div className="control-field"><label>Highlight Mode:</label><select className="control-select" value={highlightMode} onChange={(e) => setHighlightMode(e.target.value)}><option value="current">Current Word</option><option value="progressive">Progressive</option></select></div>
                    <div className="control-field"><label>Highlight Color:</label><input className="color-input" type="color" value={highlightColor} onChange={(e) => setHighlightColor(e.target.value)} /></div>
                  </div>
                )}
                {activeTab === "style" && (
                  <div className="settings-grid settings-grid--single">
                    <div className="control-field"><label className="toggle-label"><input type="checkbox" checked={outlineEnabled} onChange={(e) => setOutlineEnabled(e.target.checked)} />Outline</label><input className="number-input" type="number" min="0" max="10" value={outline} disabled={!outlineEnabled} onChange={(e) => setOutline(Number(e.target.value))} /></div>
                    <div className="control-field"><label>Outline Color:</label><input className="color-input" type="color" value={outlineColor} onChange={(e) => setOutlineColor(e.target.value)} /></div>
                    <div className="control-field"><label className="toggle-label"><input type="checkbox" checked={shadowEnabled} onChange={(e) => setShadowEnabled(e.target.checked)} />Shadow</label><input className="number-input" type="number" min="0" max="10" value={shadow} disabled={!shadowEnabled} onChange={(e) => setShadow(Number(e.target.value))} /></div>
                    <div className="control-field"><label className="toggle-label"><input type="checkbox" checked={backgroundEnabled} onChange={(e) => setBackgroundEnabled(e.target.checked)} />Background Box</label><input className="color-input" type="color" value={backColor} disabled={!backgroundEnabled} onChange={(e) => setBackColor(e.target.value)} /></div>
                  </div>
                )}
                {activeTab === "animation" && (<div className="templates-grid">{["none", "pop", "fade", "zoom", "slide"].map((item) => (<button key={item} type="button" className={`template-card ${animation === item ? "template-card--active" : ""}`} onClick={() => setAnimation(item)}><strong>{item.charAt(0).toUpperCase() + item.slice(1)}</strong><span>Animation preset</span></button>))}</div>)}
                {activeTab === "templates" && (<div className="templates-grid">{[["instagram-reel", "Instagram Reel"], ["youtube-shorts", "YouTube Shorts"], ["netflix", "Netflix"], ["news", "News"], ["gaming", "Gaming"], ["podcast", "Podcast"], ["", "Custom"]].map(([id, name]) => (<button key={id || name} type="button" className={`template-card ${subtitlePreset === id ? "template-card--active" : ""}`} onClick={() => setSubtitlePreset(id)}><strong>{name}</strong><span>{id || "Manual control"}</span></button>))}</div>)}
              </div>
              <div className="action-bar">{isGenerating ? <div className="inline-loader"><Loader /><p>Generating Final Video...</p></div> : <button className="generate-action" onClick={generateVideo}>Generate Video</button>}</div>
            </div>
          </aside>
        </div>
      )}

      {successMessage && <div className="success-message">{successMessage}</div>}
      {showDownload && (<div className="download-bar"><div className="download-copy"><p className="section-kicker">Ready</p><h2>Export files</h2></div><Button className="download-action download-action--srt" onClick={() => window.open(`http://localhost:5000/api/upload/download-srt?path=${encodeURIComponent(generatedSrtPath)}`)}>Download SRT</Button>{finalVideoPath && (<Button className="download-action download-action--video" onClick={() => window.open(`http://localhost:5000/api/upload/download-video?path=${encodeURIComponent(finalVideoPath)}`)}>Download Video</Button>)}</div>)}
    </main>
  );
}

export default UploadSection;

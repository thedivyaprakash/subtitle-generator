import { useCallback, useRef } from "react";
import { createProjectPayload, validateProjectPayload } from "../utils/projectSerializer";

export default function useProject(state, setters) {
  const fileInputRef = useRef(null);

  const saveProject = useCallback(() => {
    const projectJson = JSON.stringify(
      createProjectPayload({
        subtitles: state.subtitleContent,
        subtitleWords: state.subtitleWords,
        waveformPeaks: state.waveformPeaks,
        editorStyles: state.editorStyles,
        subtitleMode: state.subtitleMode,
        timelineZoom: state.timelineZoom,
        selectedCue: state.selectedSubtitleIndex,
        template: state.subtitlePreset,
        videoId: state.videoId,
        videoPath: state.videoPath,
        subtitlePath: state.subtitlePath,
      }),
      null,
      2
    );
    const blob = new Blob([projectJson], { type: "application/json" });
    const url = URL.createObjectURL(blob);
    const anchor = document.createElement("a");
    anchor.href = url;
    anchor.download = `subtitle-project-${Date.now()}.subtitle`;
    anchor.click();
    URL.revokeObjectURL(url);
  }, [state]);

  const applyProjectPayload = useCallback((payload = {}) => {
    validateProjectPayload(payload);
    const editorStyles = payload.editorStyles || {};
    setters.setSubtitleContent(String(payload.subtitles || ""));
    setters.setSubtitleWords(Array.isArray(payload.subtitleWords) ? payload.subtitleWords : []);
    setters.setWaveformPeaks(Array.isArray(payload.waveformPeaks) ? payload.waveformPeaks : []);
    setters.setSubtitleMode(payload.subtitleMode || "original");
    setters.setTimelineZoom(Number(payload.timelineZoom) || 100);
    setters.setSelectedSubtitleIndex(Number(payload.selectedCue) || 0);
    setters.setSubtitlePreset(payload.template || "");
    setters.setVideoId(payload.videoId ?? null);
    setters.setVideoPath(payload.videoPath || "");
    setters.setSubtitlePath(payload.subtitlePath || "");
    setters.setFontName(editorStyles.fontName || "Poppins");
    setters.setFontWeight(editorStyles.fontWeight || "Regular");
    setters.setFontColor(editorStyles.fontColor || "#ffffff");
    setters.setFontSize(Number(editorStyles.fontSize) || 48);
    setters.setOutline(Number(editorStyles.outline) || 2);
    setters.setOutlineEnabled(Boolean(editorStyles.outlineEnabled));
    setters.setOutlineColor(editorStyles.outlineColor || "#000000");
    setters.setShadow(Number(editorStyles.shadow) || 1);
    setters.setShadowEnabled(Boolean(editorStyles.shadowEnabled));
    setters.setBackColor(editorStyles.backColor || "#000000");
    setters.setBackgroundEnabled(Boolean(editorStyles.backgroundEnabled));
    setters.setPosition(editorStyles.position || "bottom");
    setters.setHighlightColor(editorStyles.highlightColor || "#ffff00");
    setters.setHighlightMode(editorStyles.highlightMode || "current");
    setters.setAnimation(editorStyles.animation || "none");
    setters.setVideoSeek(0);
    setters.setIsVideoPlaying(false);
    setters.setShowDownload(false);
    setters.setSuccessMessage("");
    setters.setFinalVideoPath("");
    setters.setGeneratedSrtPath("");
  }, [setters]);

  const openProject = useCallback(() => {
    fileInputRef.current?.click();
  }, []);

  const handleProjectFileChange = useCallback(async (event) => {
    const projectFile = event.target.files?.[0];
    if (!projectFile) return;
    try {
      const text = await projectFile.text();
      applyProjectPayload(JSON.parse(text));
    } finally {
      event.target.value = "";
    }
  }, [applyProjectPayload]);

  return { fileInputRef, saveProject, openProject, handleProjectFileChange, applyProjectPayload };
}

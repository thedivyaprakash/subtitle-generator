export const PROJECT_VERSION = 1;

export const createProjectPayload = ({
  subtitles = "",
  subtitleWords = [],
  waveformPeaks = [],
  editorStyles = {},
  subtitleMode = "original",
  timelineZoom = 100,
  selectedCue = 0,
  template = "",
  videoPath = "",
  subtitlePath = "",
} = {}) => ({
  version: PROJECT_VERSION,
  savedAt: new Date().toISOString(),
  subtitles,
  subtitleWords,
  waveformPeaks,
  editorStyles,
  subtitleMode,
  timelineZoom,
  selectedCue,
  template,
  videoPath,
  subtitlePath,
});

export const validateProjectPayload = (payload) => {
  if (!payload || typeof payload !== "object") {
    throw new Error("Invalid project format.");
  }
  if (payload.version !== PROJECT_VERSION) {
    throw new Error("Unsupported project version.");
  }
  return true;
};

export const safeProjectField = (value, fallback) =>
  value === undefined || value === null ? fallback : value;

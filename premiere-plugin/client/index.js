/* global CSInterface, require */

const fs = require("fs");
const os = require("os");
const path = require("path");
const { uploadAudio, waitForTranscription } = require("./backendClient");

const csInterface = new CSInterface();
const statusEl = document.getElementById("status");
const generateButton = document.getElementById("generate");
const languageSelect = document.getElementById("language");

const setStatus = (message) => {
  statusEl.textContent = message;
};

const evalHostScript = (script) =>
  new Promise((resolve, reject) => {
    csInterface.evalScript(script, (result) => {
      if (typeof result === "string" && result.indexOf("EvalScript error") === 0) {
        reject(new Error(result));
        return;
      }
      resolve(result);
    });
  });

const escapeForExtendScript = (value) => value.replace(/\\/g, "\\\\").replace(/"/g, '\\"');

const run = async () => {
  generateButton.disabled = true;
  try {
    setStatus("Exporting sequence audio in Premiere...");
    const audioPath = await evalHostScript("exportActiveSequenceAudio()");

    if (!audioPath || audioPath.indexOf("ERROR:") === 0) {
      setStatus(audioPath || "ERROR: no active sequence/audio export failed.");
      return;
    }

    setStatus(`Audio exported: ${audioPath}\nUploading...`);
    const language = languageSelect.value;
    const videoId = await uploadAudio(audioPath, language);

    setStatus(`Uploaded (videoId=${videoId}). Waiting for transcription...`);
    const subtitleContent = await waitForTranscription(videoId);

    if (!subtitleContent.trim()) {
      setStatus("ERROR: transcription returned no text.");
      return;
    }

    const srtPath = path.join(os.tmpdir(), `subtitle_${Date.now()}.srt`);
    fs.writeFileSync(srtPath, subtitleContent, "utf8");

    setStatus(`Captions saved: ${srtPath}\nImporting into project...`);
    const importResult = await evalHostScript(
      `importCaptionsIntoProject("${escapeForExtendScript(srtPath)}")`
    );

    setStatus(
      `${importResult}\n\nIf captions didn't land on the timeline automatically, ` +
        `drag the imported item from the Project panel onto your sequence.`
    );
  } catch (error) {
    setStatus(`ERROR: ${error.message}`);
  } finally {
    generateButton.disabled = false;
  }
};

generateButton.addEventListener("click", run);

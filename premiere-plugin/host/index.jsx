// ExtendScript host for the Subtitle Generator panel.
// Runs inside Premiere Pro's scripting engine — has access to `app`.
//
// Two uncertain points here (see premiere-plugin/README.md):
//  - exportAsMediaDirect's workAreaType constant (using 1 below)
//  - whether importFiles() puts captions directly on the timeline, or
//    only into the Project panel bin (most likely just the bin)

// One-time setup: export an "audio only" preset from Premiere's Export
// dialog (Format: Waveform Audio, uncheck video) and save its full path
// here.
var AUDIO_PRESET_PATH = "";

function exportActiveSequenceAudio() {
  try {
    var sequence = app.project.activeSequence;
    if (!sequence) {
      return "ERROR: no active sequence. Open a sequence and try again.";
    }

    if (!AUDIO_PRESET_PATH) {
      return "ERROR: AUDIO_PRESET_PATH is not set in host/index.jsx. " +
        "See README.md step 2.";
    }

    var presetFile = new File(AUDIO_PRESET_PATH);
    if (!presetFile.exists) {
      return "ERROR: preset file not found at " + AUDIO_PRESET_PATH;
    }

    var outputFolder = Folder.temp.fsName;
    var outputPath = outputFolder + "/subtitle_export_" + new Date().getTime() + ".wav";

    // workAreaType: 1 = entire sequence (unconfirmed against a live
    // Premiere install — try 0 here if the exported audio is empty/short).
    sequence.exportAsMediaDirect(outputPath, AUDIO_PRESET_PATH, 1);

    var outputFile = new File(outputPath);
    var waited = 0;
    while (!outputFile.exists && waited < 120) {
      $.sleep(1000);
      waited++;
      outputFile = new File(outputPath);
    }

    if (!outputFile.exists) {
      return "ERROR: export timed out, no file produced at " + outputPath;
    }

    return outputPath;
  } catch (error) {
    return "ERROR: " + error.toString();
  }
}

function importCaptionsIntoProject(srtPath) {
  try {
    var srtFile = new File(srtPath);
    if (!srtFile.exists) {
      return "ERROR: srt file not found at " + srtPath;
    }

    var imported = app.project.importFiles(
      [srtPath],
      true,
      app.project.rootItem,
      false
    );

    if (!imported) {
      return "ERROR: importFiles() returned false. Import the .srt manually: " +
        "File > Import, then drag it onto your sequence.";
    }

    return "Captions imported into the Project panel from " + srtPath + ".";
  } catch (error) {
    return "ERROR: " + error.toString();
  }
}

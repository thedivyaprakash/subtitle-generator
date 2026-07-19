# Premiere Pro Subtitle Generator Panel

A CEP panel that sends the active sequence's audio to the same backend
the web app uses (Deepgram transcription + Gemini correction), and
imports the result back into your Premiere project as captions.

This has NOT been run against a real Premiere Pro install yet (not
available in the dev environment) — built from documented CEP/ExtendScript
APIs. The `backendClient.js` HTTP layer is verified working standalone;
the Premiere-specific parts (export, import) need your first real test.
See "If something breaks" below — it's organized around the exact points
most likely to need a tweak.

## One-time setup

1. **Enable CEP debug mode** (lets Premiere load an unsigned/local
   extension). Open Registry Editor and create/set, under
   `HKEY_CURRENT_USER\Software\Adobe\CSXS.9`:
   - Name: `PlayerDebugMode`, Type: `String`, Value: `1`

   (If your Premiere Pro version uses a different CSXS version, the key
   is `CSXS.<version>` — check `premiere-plugin/CSXS/manifest.xml`'s
   `RequiredRuntime Version` and match it, or try `CSXS.9` through
   `CSXS.12` if unsure.)

2. **Install the extension**: copy the whole `premiere-plugin` folder to:
   ```
   C:\Users\DP\AppData\Roaming\Adobe\CEP\extensions\subtitle-generator\
   ```
   (rename the copied folder to `subtitle-generator` — folder name
   doesn't have to match, but keep it simple.)

3. **Download `CSInterface.js`** from Adobe's official CEP-Resources repo
   (`Adobe-CEP/CEP-Resources` on GitHub, under `CEP_11.x/CEP JS Libraries`
   or similar path depending on version) and save it as
   `premiere-plugin/client/CSInterface.js`. This file is Adobe's own
   bridging library — deliberately not hand-written here to avoid
   transcription errors in a large file.

4. **Create the audio export preset** (one-time, in Premiere):
   - Select your sequence → File → Export → Media
   - Format: `Waveform Audio`, uncheck "Export Video"
   - Save Preset, give it a name, and note the exported `.epr` file's
     full path (Premiere stores presets under
     `%APPDATA%\Adobe\Adobe Premiere Pro\<version>\Profile-<user>\`
     or wherever you explicitly saved it)
   - Open `premiere-plugin/host/index.jsx` and set `AUDIO_PRESET_PATH` to
     that full path.

5. **Backend must be running**: `npm run backend` and `npm run worker`
   from the project root.

6. Restart Premiere Pro. The panel should appear under
   **Window → Extensions → Subtitle Generator**.

## Using it

1. Open a project and a sequence with the audio you want captioned.
2. Open the panel (Window → Extensions → Subtitle Generator).
3. Pick a language, click **Generate Captions**.
4. Watch the status text: exporting → uploading → transcribing →
   importing.
5. Check the Project panel for the imported `.srt` item. If it isn't
   already on your timeline, drag it there manually (see uncertain point
   #3 below — this is the most likely manual step needed).

## If something breaks

Four points in this plugin are built from documented APIs but unverified
against a real Premiere install — check these first, in order:

1. **Panel doesn't appear in Window → Extensions at all** — CSXS version
   mismatch. Check what CSXS version your Premiere expects (varies by
   version, roughly 9-12) and update both the registry key (step 1) and
   `RequiredRuntime Version` in `CSXS/manifest.xml`.

2. **"Generate Captions" fails immediately with an export error** —
   `exportAsMediaDirect`'s third argument (`workAreaType`, currently `1`
   in `host/index.jsx`) may need to be `0`. Open the ExtendScript Toolkit
   or Premiere's own console (Window → Extensions gives access to a
   debug console in some versions) to see the exact error.

3. **Export succeeds but caption import doesn't land on the timeline** —
   expected; `app.project.importFiles()` is confirmed to bring the `.srt`
   into the Project panel, but Premiere's ExtendScript API for
   programmatically placing it on the active sequence's caption track
   isn't something I could verify. Manual drag from Project panel to
   timeline is the documented fallback — Premiere auto-detects `.srt`
   files as caption tracks once dropped on a sequence.

4. **Panel loads but errors on `require(...)` calls** — Node.js isn't
   enabled for this panel. Double-check the `<CEFCommandLine>` parameters
   in `CSXS/manifest.xml` match what your CEP version expects (the
   `--enable-nodejs`/`--mixed-context` flags here are the commonly
   documented ones, but this has shifted across CEP versions).

Report back whatever error text/console output you see at any of these
points and we'll fix the specific line.

## Config

- `premiere-plugin/client/backendClient.js` — `BACKEND_HOST`/`BACKEND_PORT`
  constants at the top (default `localhost:5000`).
- `premiere-plugin/host/index.jsx` — `AUDIO_PRESET_PATH` (required, see
  setup step 4).

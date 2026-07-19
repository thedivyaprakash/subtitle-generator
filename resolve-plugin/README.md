# DaVinci Resolve Subtitle Generator Plugin

Generates captions for the current Resolve timeline using the same
backend as the web app (Deepgram transcription + Gemini correction), and
inserts them as a subtitle track — no burning, fully editable in Resolve.

## One-time setup

1. **Enable external scripting**
   Resolve → Preferences → General → "External scripting using" → **Local**.

2. **Create the audio export preset**
   Open a project → Deliver page → set:
   - Format: `Wave`
   - Codec: `Linear PCM`
   - Uncheck "Export Video"

   Save it as a render preset named exactly **`SubtitleAudioExport`**.
   (The script loads this preset by name — it doesn't guess render
   settings, so the name must match exactly.)

3. **Set environment variables** (System Properties → Environment
   Variables → New, under your user account):

   | Variable | Value |
   |---|---|
   | `RESOLVE_SCRIPT_API` | `C:\ProgramData\Blackmagic Design\DaVinci Resolve\Support\Developer\Scripting` |
   | `RESOLVE_SCRIPT_LIB` | `C:\Program Files\Blackmagic Design\DaVinci Resolve\fusionscript.dll` |
   | `PYTHONPATH` | `%RESOLVE_SCRIPT_API%\Modules\` |

   Restart Resolve (and any open terminal) after setting these.

4. **No pip installs needed** — the script uses only the Python standard
   library (`urllib`), so it runs unmodified under whatever Python
   interpreter Resolve is configured to use, on any machine.

5. **Backend must be running**: `npm run backend` and `npm run worker`
   from the project root (or `npm run dev` for everything at once).

## Installing the script into Resolve's menu (optional)

Copy `generate_subtitles.py` into:
```
C:\Users\DP\AppData\Roaming\Blackmagic Design\DaVinci Resolve\Support\Fusion\Scripts\Utility\
```
It'll then appear under **Workspace → Scripts → Utility → generate_subtitles**
in Resolve.

## Running it

1. Open a project and a timeline in Resolve with the audio you want captioned.
2. Run the script (Workspace → Scripts menu, or paste its contents into
   Resolve's built-in Console for first-run debugging — the Console
   shows print() output directly, which is the easiest way to see what's
   failing if something goes wrong the first time).
3. Watch the Console for progress: exporting audio → uploading →
   transcribing → captions inserted.

## Config

Edit the top of `generate_subtitles.py`:
- `BACKEND_URL` — defaults to `http://localhost:5000`
- `LANGUAGE` — `"hi"` or `"en"`

## If something breaks

This script is written against Resolve's documented scripting API but
hasn't been run against a live Resolve install yet. Two spots most likely
to need adjustment on first real run:

- **`ImportIntoTimeline` fails or does nothing visible** — the `.srt` file
  is still saved to a temp folder (path printed in the Console). You can
  import it manually: right-click the timeline → Import → Subtitle, and
  point it at that file. Report back what the Console printed and we'll
  fix the script.
- **`LoadRenderPreset` returns false** — double check the preset name is
  exactly `SubtitleAudioExport` (case-sensitive) and that it was saved
  (not just configured) on the Deliver page.

"""
Generate captions for the current DaVinci Resolve timeline and insert them
as a subtitle track, using the subtitle-generator-backend API.

Uses only the Python standard library — no pip install required, so this
runs unmodified under whichever Python interpreter Resolve is configured
to use on any machine.

Setup required before running — see resolve-plugin/README.md.
"""

import json
import mimetypes
import os
import sys
import tempfile
import time
import urllib.error
import urllib.request
import uuid

BACKEND_URL = "http://localhost:5000"
LANGUAGE = "hi"  # "hi" or "en"
RENDER_PRESET_NAME = "SubtitleAudioExport"
POLL_INTERVAL_SECONDS = 2
POLL_TIMEOUT_SECONDS = 600


def http_get_json(url):
    try:
        with urllib.request.urlopen(url, timeout=30) as response:
            return json.loads(response.read().decode("utf-8"))
    except urllib.error.URLError as error:
        print(f"ERROR: request to {url} failed: {error}")
        sys.exit(1)


def http_post_multipart(url, file_path, file_field_name, extra_fields=None):
    boundary = uuid.uuid4().hex
    content_type = mimetypes.guess_type(file_path)[0] or "application/octet-stream"
    file_name = os.path.basename(file_path)

    with open(file_path, "rb") as file_obj:
        file_bytes = file_obj.read()

    parts = []
    for key, value in (extra_fields or {}).items():
        parts.append(
            f"--{boundary}\r\n"
            f'Content-Disposition: form-data; name="{key}"\r\n\r\n'
            f"{value}\r\n".encode("utf-8")
        )

    parts.append(
        (
            f"--{boundary}\r\n"
            f'Content-Disposition: form-data; name="{file_field_name}"; filename="{file_name}"\r\n'
            f"Content-Type: {content_type}\r\n\r\n"
        ).encode("utf-8")
    )
    parts.append(file_bytes)
    parts.append(f"\r\n--{boundary}--\r\n".encode("utf-8"))

    body = b"".join(
        part if isinstance(part, bytes) else part.encode("utf-8") for part in parts
    )

    request = urllib.request.Request(
        url,
        data=body,
        method="POST",
        headers={
            "Content-Type": f"multipart/form-data; boundary={boundary}",
            "Content-Length": str(len(body)),
        },
    )

    try:
        with urllib.request.urlopen(request, timeout=120) as response:
            return json.loads(response.read().decode("utf-8"))
    except urllib.error.URLError as error:
        print(f"ERROR: upload to {url} failed: {error}")
        sys.exit(1)


def get_resolve():
    try:
        import DaVinciResolveScript as dvr_script
    except ImportError:
        print(
            "ERROR: could not import DaVinciResolveScript. "
            "Confirm RESOLVE_SCRIPT_API / RESOLVE_SCRIPT_LIB / PYTHONPATH "
            "are set as described in README.md."
        )
        sys.exit(1)

    resolve = dvr_script.scriptapp("Resolve")
    if not resolve:
        print("ERROR: could not connect to Resolve. Is Resolve running with "
              "'External scripting using' set to Local in Preferences?")
        sys.exit(1)
    return resolve


def export_timeline_audio(project, out_dir):
    if not project.LoadRenderPreset(RENDER_PRESET_NAME):
        print(
            f"ERROR: render preset '{RENDER_PRESET_NAME}' not found. "
            "Create it on the Deliver page first — see README.md."
        )
        sys.exit(1)

    project.SetRenderSettings({"TargetDir": out_dir, "CustomName": "subtitle_export"})

    job_id = project.AddRenderJob()
    if not job_id:
        print("ERROR: failed to add render job.")
        sys.exit(1)

    project.StartRendering(job_id)

    print("Exporting timeline audio...")
    while project.IsRenderingInProgress():
        time.sleep(1)

    for file_name in os.listdir(out_dir):
        if file_name.startswith("subtitle_export") and file_name.lower().endswith(".wav"):
            return os.path.join(out_dir, file_name)

    print(f"ERROR: rendered audio file not found in {out_dir}.")
    sys.exit(1)


def upload_audio(audio_path):
    data = http_post_multipart(
        f"{BACKEND_URL}/api/upload/audio",
        audio_path,
        "audio",
        extra_fields={"language": LANGUAGE},
    )
    if not data.get("success"):
        print(f"ERROR: upload failed: {data}")
        sys.exit(1)
    return data["videoId"]


def wait_for_transcription(video_id):
    print("Waiting for transcription...")
    elapsed = 0
    while elapsed < POLL_TIMEOUT_SECONDS:
        data = http_get_json(f"{BACKEND_URL}/api/upload/video/{video_id}/status")
        status = data.get("status")

        if status == "ready":
            return data.get("subtitleContent", "")
        if status == "failed":
            print(f"ERROR: transcription failed: {data.get('errorMessage')}")
            sys.exit(1)

        time.sleep(POLL_INTERVAL_SECONDS)
        elapsed += POLL_INTERVAL_SECONDS

    print("ERROR: timed out waiting for transcription.")
    sys.exit(1)


def main():
    resolve = get_resolve()
    project_manager = resolve.GetProjectManager()
    project = project_manager.GetCurrentProject()
    if not project:
        print("ERROR: no project open in Resolve.")
        sys.exit(1)

    timeline = project.GetCurrentTimeline()
    if not timeline:
        print("ERROR: no timeline open. Open a timeline and try again.")
        sys.exit(1)

    work_dir = tempfile.mkdtemp(prefix="subtitle_export_")

    audio_path = export_timeline_audio(project, work_dir)
    print(f"Audio exported: {audio_path}")

    video_id = upload_audio(audio_path)
    print(f"Uploaded. videoId={video_id}")

    subtitle_content = wait_for_transcription(video_id)
    if not subtitle_content.strip():
        print("ERROR: transcription returned no text.")
        sys.exit(1)

    srt_path = os.path.join(work_dir, "captions.srt")
    with open(srt_path, "w", encoding="utf-8") as srt_file:
        srt_file.write(subtitle_content)
    print(f"Captions saved: {srt_path}")

    imported = timeline.ImportIntoTimeline(
        srt_path, {"autoImportSourceClipsIntoMediaPool": False}
    )
    if imported:
        print("Subtitle track inserted into timeline.")
    else:
        print(
            f"ERROR: ImportIntoTimeline failed. The .srt file is saved at "
            f"{srt_path} — you can import it manually via right-click on the "
            "timeline > Import > Subtitle."
        )


if __name__ == "__main__":
    main()

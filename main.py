"""
Ultimate Playlist Merger — FastAPI backend.

Playlist metadata and media are obtained entirely via yt-dlp scraping/extraction.
No YouTube Data API, OAuth, or API keys are required; yt-dlp talks to YouTube
like a normal client and parses the returned pages/player responses.
"""

from __future__ import annotations

import json
import re
import shutil
import subprocess
import uuid
from pathlib import Path
from threading import Lock

from fastapi import BackgroundTasks, FastAPI, HTTPException, Request
from fastapi.responses import FileResponse, HTMLResponse, JSONResponse
from fastapi.staticfiles import StaticFiles
from fastapi.templating import Jinja2Templates
from pydantic import BaseModel, Field

BASE_DIR = Path(__file__).resolve().parent
TEMP_ROOT = BASE_DIR / "temp"
TEMP_ROOT.mkdir(parents=True, exist_ok=True)

app = FastAPI(title="Ultimate Playlist Merger")
app.mount("/static", StaticFiles(directory=str(BASE_DIR / "static")), name="static")
templates = Jinja2Templates(directory=str(BASE_DIR / "templates"))

jobs_lock = Lock()
jobs: dict[str, dict] = {}


def _validate_job_id(job_id: str) -> str:
    try:
        uuid.UUID(job_id)
    except ValueError as exc:
        raise HTTPException(status_code=400, detail="Invalid job id") from exc
    return job_id


def _job_dir(job_id: str) -> Path:
    return TEMP_ROOT / job_id


def _escape_concat_path(path: Path) -> str:
    """Single-quoted path for ffmpeg concat demuxer (POSIX-style slashes)."""
    p = path.resolve().as_posix()
    return p.replace("'", r"'\''")


def _has_playable_content(data: dict) -> bool:
    if not isinstance(data, dict):
        return False
    entries = data.get("entries")
    if entries is not None:
        return any(e for e in entries if e)
    return bool(data.get("id") or data.get("url"))


def process_job(job_id: str, url: str) -> None:
    job_dir = _job_dir(job_id)
    url = url.strip()

    def set_state(
        *,
        stage: str,
        message: str | None = None,
        output_path: str | None = None,
        error: str | None = None,
    ) -> None:
        with jobs_lock:
            j = jobs.get(job_id)
            if j is None:
                return
            j["stage"] = stage
            if message is not None:
                j["message"] = message
            if output_path is not None:
                j["output_path"] = output_path
            if error is not None:
                j["error"] = error

    try:
        job_dir.mkdir(parents=True, exist_ok=True)

        set_state(
            stage="fetching",
            message="Fetching playlist information...",
        )

        # Phase 1: resolve playlist / video (flat, no full video downloads).
        info_proc = subprocess.run(
            [
                "yt-dlp",
                "--flat-playlist",
                "-J",
                "--no-download",
                url,
            ],
            capture_output=True,
            text=True,
            encoding="utf-8",
            errors="replace",
            cwd=str(job_dir),
            timeout=120,
        )
        if info_proc.returncode != 0:
            err = (info_proc.stderr or info_proc.stdout or "").strip()
            raise RuntimeError(err or "Could not read playlist or video information.")

        try:
            meta = json.loads(info_proc.stdout)
        except json.JSONDecodeError as exc:
            raise RuntimeError("Invalid response from yt-dlp while fetching metadata.") from exc

        if not _has_playable_content(meta):
            raise RuntimeError("No videos found for this URL.")

        set_state(
            stage="downloading",
            message="Downloading all MP3 files...",
        )

        # Phase 2: extract 320 kbps MP3 in strict playlist order (autonumber).
        dl_proc = subprocess.run(
            [
                "yt-dlp",
                "-x",
                "--audio-format",
                "mp3",
                "--postprocessor-args",
                "ffmpeg:-c:a libmp3lame -b:a 320k",
                "-o",
                "%(autonumber)03d.%(ext)s",
                "--no-playlist-reverse",
                url,
            ],
            capture_output=True,
            text=True,
            encoding="utf-8",
            errors="replace",
            cwd=str(job_dir),
            timeout=None,
        )
        if dl_proc.returncode != 0:
            err = (dl_proc.stderr or dl_proc.stdout or "").strip()
            raise RuntimeError(err or "Download or audio extraction failed.")

        mp3_files = sorted(job_dir.glob("*.mp3"))
        # Ignore accidental output file from a previous partial run.
        mp3_files = [p for p in mp3_files if p.name != "ULTIMATE_PLAYLIST.mp3"]
        if not mp3_files:
            raise RuntimeError("No MP3 files were produced. Check the URL and try again.")

        set_state(
            stage="merging",
            message="Merging into one ultimate MP3...",
        )

        concat_list = job_dir / "concat_list.txt"
        lines = [f"file '{_escape_concat_path(p)}'" for p in mp3_files]
        concat_list.write_text("\n".join(lines) + "\n", encoding="utf-8")

        out_file = job_dir / "ULTIMATE_PLAYLIST.mp3"
        ff_proc = subprocess.run(
            [
                "ffmpeg",
                "-hide_banner",
                "-loglevel",
                "error",
                "-y",
                "-f",
                "concat",
                "-safe",
                "0",
                "-i",
                str(concat_list.resolve()),
                "-c",
                "copy",
                str(out_file.resolve()),
            ],
            capture_output=True,
            text=True,
            encoding="utf-8",
            errors="replace",
            timeout=3600,
        )
        if ff_proc.returncode != 0:
            err = (ff_proc.stderr or ff_proc.stdout or "").strip()
            raise RuntimeError(err or "FFmpeg merge failed. Is FFmpeg installed and on PATH?")

        if not out_file.is_file() or out_file.stat().st_size == 0:
            raise RuntimeError("Merged file was not created or is empty.")

        set_state(
            stage="completed",
            message="Your ultimate merged MP3 is ready!",
            output_path=str(out_file.resolve()),
        )
    except subprocess.TimeoutExpired:
        set_state(
            stage="error",
            message=None,
            error="Operation timed out. Try a smaller playlist or check your connection.",
        )
    except Exception as exc:  # noqa: BLE001 — surface any failure to the client
        msg = str(exc).strip() or "Something went wrong."
        # Shorten huge yt-dlp stderr dumps for the UI
        if len(msg) > 2000:
            msg = msg[:2000] + "…"
        set_state(stage="error", message=None, error=msg)
    finally:
        # Remove concat sidecar; keep per-track MP3s until user cleanup (or re-merge).
        cl = job_dir / "concat_list.txt"
        if cl.is_file():
            try:
                cl.unlink()
            except OSError:
                pass


class CreateJobBody(BaseModel):
    url: str = Field(..., min_length=4, max_length=2048)


@app.get("/", response_class=HTMLResponse)
async def home(request: Request):
    return templates.TemplateResponse(
        request=request,
        name="index.html",
        context={"request": request}
    )


@app.post("/create-job")
async def create_job(body: CreateJobBody, background_tasks: BackgroundTasks):
    raw = body.url.strip()
    if not raw or not re.search(r"https?://", raw, re.I):
        raise HTTPException(status_code=400, detail="Please provide a valid http(s) URL.")

    job_id = str(uuid.uuid4())
    with jobs_lock:
        jobs[job_id] = {
            "stage": "fetching",
            "message": "Fetching playlist information...",
            "output_path": None,
            "error": None,
        }

    background_tasks.add_task(process_job, job_id, raw)
    return {"job_id": job_id}


@app.get("/status/{job_id}")
async def status(job_id: str):
    jid = _validate_job_id(job_id)
    with jobs_lock:
        job = jobs.get(jid)
    if not job:
        raise HTTPException(status_code=404, detail="Job not found.")
    return JSONResponse(
        {
            "stage": job["stage"],
            "message": job.get("message"),
            "error": job.get("error"),
        }
    )


@app.get("/download/{job_id}")
async def download(job_id: str):
    jid = _validate_job_id(job_id)
    with jobs_lock:
        job = jobs.get(jid)
    if not job:
        raise HTTPException(status_code=404, detail="Job not found.")
    if job["stage"] != "completed" or not job.get("output_path"):
        raise HTTPException(status_code=400, detail="Merged file is not ready yet.")

    path = Path(job["output_path"])
    if not path.is_file():
        raise HTTPException(status_code=404, detail="Merged file no longer exists.")

    return FileResponse(
        path,
        media_type="audio/mpeg",
        filename="ULTIMATE_PLAYLIST.mp3",
    )


@app.post("/cleanup/{job_id}")
async def cleanup(job_id: str):
    jid = _validate_job_id(job_id)
    target = _job_dir(jid)
    if target.is_dir():
        try:
            shutil.rmtree(target, ignore_errors=False)
        except OSError as exc:
            raise HTTPException(status_code=500, detail=f"Could not remove job folder: {exc}") from exc

    with jobs_lock:
        jobs.pop(jid, None)

    return {"ok": True}

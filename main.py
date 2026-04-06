"""
Ultimate Playlist Merger — FastAPI backend.

Playlist metadata and media are obtained entirely via yt-dlp scraping/extraction.
No YouTube Data API, OAuth, or API keys are required; yt-dlp talks to YouTube
like a normal client and parses the returned pages/player responses.
"""

from __future__ import annotations

import logging
import os
import re
import shutil
import subprocess
import uuid
from pathlib import Path
from threading import Lock
import asyncio
from datetime import datetime, timedelta

import yt_dlp
from fastapi import BackgroundTasks, FastAPI, HTTPException, Request
from fastapi.responses import FileResponse, HTMLResponse, JSONResponse
from fastapi.staticfiles import StaticFiles
from fastapi.templating import Jinja2Templates
from pydantic import BaseModel, Field
from yt_dlp.utils import DownloadError

BASE_DIR = Path(__file__).resolve().parent
TEMP_ROOT = BASE_DIR / "temp"
TEMP_ROOT.mkdir(parents=True, exist_ok=True)

app = FastAPI(title="Ultimate Playlist Merger")
app.mount("/static", StaticFiles(directory=str(BASE_DIR / "static")), name="static")
templates = Jinja2Templates(directory=str(BASE_DIR / "templates"))

jobs_lock = Lock()
jobs: dict[str, dict] = {}

log = logging.getLogger("ultimate_playlist_merger")


async def schedule_job_cleanup(job_id: str, delay_hours: int = 1):
    """Schedule automatic cleanup of job files after specified hours."""
    await asyncio.sleep(delay_hours * 3600)  # Convert hours to seconds
    
    log.info(f"Auto-cleanup triggered for job_id={job_id}")
    target = _job_dir(job_id)
    if target.is_dir():
        try:
            shutil.rmtree(target, ignore_errors=False)
            log.info(f"Auto-deleted job folder: {target}")
        except OSError as exc:
            log.error(f"Auto-cleanup failed for job_id={job_id}: {exc}")
    
    with jobs_lock:
        jobs.pop(job_id, None)


@app.on_event("startup")
async def startup_diagnostics():
    """Log runtime paths and yt-dlp-ejs availability on startup."""
    import os
    deno = shutil.which("deno")
    node = shutil.which("node")
    ffmpeg = shutil.which("ffmpeg")
    
    log.info("=== Startup Diagnostics ===")
    log.info(f"deno (PATH): {deno or 'NOT FOUND'}")
    log.info(f"node (PATH): {node or 'NOT FOUND'}")
    log.info(f"ffmpeg (PATH): {ffmpeg or 'NOT FOUND'}")
    
    # Search Nix store if not on PATH
    try:
        nix_store = Path("/nix/store")
        if not deno and nix_store.exists():
            nix_deno = list(nix_store.glob("*-deno-*/bin/deno"))
            if nix_deno:
                log.info(f"deno (Nix store): {nix_deno[0]}")
        
        if not node and nix_store.exists():
            nix_node = list(nix_store.glob("*-nodejs-*/bin/node"))
            if nix_node:
                log.info(f"node (Nix store): {nix_node[0]}")
    except (OSError, PermissionError) as e:
        log.warning(f"Could not search Nix store: {e}")
    
    log.info(f"PATH: {os.environ.get('PATH', 'NOT SET')[:200]}...")  # Truncate long PATH
    
    try:
        from yt_dlp.dependencies import yt_dlp_ejs
        log.info(f"yt-dlp-ejs: {'installed' if yt_dlp_ejs else 'NOT installed'}")
    except ImportError:
        log.warning("yt-dlp-ejs: import failed")
    
    # Check bgutil-ytdlp-pot-provider plugin
    try:
        import bgutil_ytdlp_pot_provider
        log.info(f"bgutil-ytdlp-pot-provider: {bgutil_ytdlp_pot_provider.__version__}")
    except ImportError:
        # Plugin is installed but can't be imported directly - this is normal for yt-dlp plugins
        # Check if it's in pip list instead
        try:
            import subprocess
            result = subprocess.run(
                ["pip", "list"], 
                capture_output=True, 
                text=True, 
                timeout=5
            )
            if "bgutil-ytdlp-pot-provider" in result.stdout:
                log.info("bgutil-ytdlp-pot-provider: installed (yt-dlp plugin)")
            else:
                log.warning("bgutil-ytdlp-pot-provider: NOT found in pip list")
        except Exception:
            log.info("bgutil-ytdlp-pot-provider: unable to verify (check manually)")
    
    # Test bgutil provider connectivity (optional feature)
    bgutil_url = os.environ.get("BGUTIL_PROVIDER_URL", "http://bgutil-provider.railway.internal:4416")
    try:
        import urllib.request
        with urllib.request.urlopen(f"{bgutil_url}/health", timeout=5) as response:
            if response.status == 200:
                log.info(f"✓ bgutil provider: CONNECTED at {bgutil_url}")
            else:
                log.info(f"bgutil provider responded with status {response.status}")
    except Exception:
        log.info(f"bgutil provider: not available (optional - app will use cookies only)")
    
    log.info("===========================")


def _strip_ansi(text: str) -> str:
    return re.sub(r"\x1b\[[0-9;:]*m", "", text)


class _YtdlpErrCapture:
    """Collect yt-dlp errors/warnings (to_stderr → logger.error); ignore noisy progress (debug)."""

    __slots__ = ("lines",)

    def __init__(self) -> None:
        self.lines: list[str] = []

    def debug(self, msg: object) -> None:
        pass

    def info(self, msg: object) -> None:
        pass

    def warning(self, msg: object) -> None:
        self.lines.append(_strip_ansi(str(msg).strip()))

    def error(self, msg: object) -> None:
        self.lines.append(_strip_ansi(str(msg).strip()))


def _ytdlp_recent_messages(capture: _YtdlpErrCapture, *, max_lines: int = 25) -> str:
    if not capture.lines:
        return ""
    chunk = capture.lines[-max_lines:]
    return "\n".join(chunk)


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


def process_playlist(job_id: str, url: str, filename: str = "ULTIMATE_PLAYLIST") -> None:
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

    # js_runtimes + yt-dlp-ejs (requirements.txt) are required for YouTube n/sig challenges.
    # With cookies, only clients with SUPPORTS_COOKIES are used — ios/android are skipped by yt-dlp.
    # Do not use "mweb" here: it often requires a GVS PO Token for HTTPS formats (see PO-Token-Guide).
    
    # Find deno/node executables - try PATH first, then common Nix store locations
    deno_path = shutil.which("deno")
    node_path = shutil.which("node")
    
    # Fallback: search common Nix store paths (Runway/Nixpacks)
    if not deno_path:
        try:
            nix_store = Path("/nix/store")
            if nix_store.exists():
                for candidate in nix_store.glob("*-deno-*/bin/deno"):
                    if candidate.is_file():
                        deno_path = str(candidate)
                        log.info(f"Found deno in Nix store: {deno_path}")
                        break
        except (OSError, PermissionError) as e:
            log.warning(f"Could not search Nix store for deno: {e}")
    
    if not node_path:
        try:
            nix_store = Path("/nix/store")
            if nix_store.exists():
                for candidate in nix_store.glob("*-nodejs-*/bin/node"):
                    if candidate.is_file():
                        node_path = str(candidate)
                        log.info(f"Found node in Nix store: {node_path}")
                        break
        except (OSError, PermissionError) as e:
            log.warning(f"Could not search Nix store for node: {e}")
    
    js_runtimes = {}
    if deno_path:
        js_runtimes["deno"] = {"executable": deno_path}
        log.info(f"Using deno runtime at: {deno_path}")
    if node_path:
        js_runtimes["node"] = {"executable": node_path}
        log.info(f"Using node runtime at: {node_path}")
    
    # Fallback: if no JS runtime found, log warning but continue (will fail on protected videos)
    if not js_runtimes:
        log.warning("No JavaScript runtime (deno/node) found on PATH. YouTube signature challenges will fail.")
        # Try without js_runtimes - yt-dlp might auto-detect
        js_runtimes = None
    
    # Check if cookies file exists and is readable
    cookies_path = BASE_DIR / "cookies.txt"
    cookies_exist = cookies_path.is_file()
    
    if not cookies_exist:
        log.warning(f"cookies.txt not found at {cookies_path}. YouTube may block requests as bot.")
    else:
        # Check if cookies are recent (modified within last 30 days)
        import time
        mtime = cookies_path.stat().st_mtime
        age_days = (time.time() - mtime) / 86400
        if age_days > 30:
            log.warning(f"cookies.txt is {age_days:.0f} days old. Consider refreshing for better reliability.")
    
    # bgutil PO Token provider (optional - enhances bot detection bypass)
    # If not available, app will work with cookies.txt alone
    bgutil_url = os.environ.get("BGUTIL_PROVIDER_URL", "http://bgutil-provider.railway.internal:4416")
    
    # Only add bgutil config if it's actually reachable
    bgutil_available = False
    try:
        import urllib.request
        with urllib.request.urlopen(f"{bgutil_url}/health", timeout=2) as response:
            if response.status == 200:
                bgutil_available = True
                log.info(f"✓ bgutil provider connected at {bgutil_url}")
    except Exception as e:
        log.info(f"bgutil provider not available (will use cookies only): {e}")
    
    ydl_opts = {
        "format": "bestaudio/best",
        "outtmpl": f"{job_dir.as_posix()}/%(playlist_index)02d - %(title)s.%(ext)s",
        "postprocessors": [
            {
                "key": "FFmpegExtractAudio",
                "preferredcodec": "mp3",
                "preferredquality": "320",
            },
        ],
        "quiet": False,
        "extractaudio": True,
        "ignoreerrors": True,
        "yes_playlist": True,
        "no_warnings": False,
        "sleep_interval": 5,  # Avoid YouTube rate limiting
        "extractor_args": {
            "youtube": {
                "player_client": ["web", "web_embedded", "tv"],
            },
        },
    }
    
    # Only add bgutil config if service is reachable
    if bgutil_available:
        ydl_opts["extractor_args"]["youtubepot-bgutil:http"] = {
            "base_url": bgutil_url,
        }
    
    # Add optional configs only if available
    if cookies_exist:
        ydl_opts["cookiefile"] = str(cookies_path)
    
    if js_runtimes:
        ydl_opts["js_runtimes"] = js_runtimes
        ydl_opts["remote_components"] = {"ejs:github"}
    else:
        log.warning("Proceeding without JS runtime - may fail on signature-protected videos")

    try:
        job_dir.mkdir(parents=True, exist_ok=True)

        set_state(
            stage="fetching",
            message="Fetching playlist information...",
        )

        # Phase 1: resolve playlist / video (flat, no full video downloads).
        phase1_opts = {
            **ydl_opts,
            "extract_flat": True,
            "skip_download": True,
            "quiet": True,
            "no_warnings": True,
        }
        phase1_opts.pop("postprocessors", None)
        phase1_opts.pop("postprocessor_args", None)
        phase1_opts.pop("format", None)

        try:
            with yt_dlp.YoutubeDL(phase1_opts) as ydl:
                meta = ydl.extract_info(url, download=False)
        except DownloadError as exc:
            raise RuntimeError(str(exc)) from exc

        if not _has_playable_content(meta):
            raise RuntimeError("No videos found for this URL.")

        set_state(
            stage="downloading",
            message="Downloading all MP3 files...",
        )

        # Phase 2: extract 320 kbps MP3 in strict playlist order (playlist_index).
        ytdlp_capture = _YtdlpErrCapture()
        dl_opts = {**ydl_opts, "quiet": True, "no_warnings": True, "logger": ytdlp_capture}
        try:
            with yt_dlp.YoutubeDL(dl_opts) as ydl:
                rc = ydl.download([url])
            recent = _ytdlp_recent_messages(ytdlp_capture)
            if rc != 0:
                error_msg = "yt-dlp reported a problem while downloading or extracting audio " f"(exit code {rc}).\n\n"
                
                # Check if it's a bot detection error
                if recent and ("Sign in to confirm you're not a bot" in recent or "bot" in recent.lower()):
                    error_msg += "🤖 YouTube detected bot activity and blocked the request.\n\n"
                    error_msg += "SOLUTION: Update your cookies.txt file with fresh YouTube cookies.\n"
                    error_msg += "1. Install browser extension: 'Get cookies.txt LOCALLY'\n"
                    error_msg += "2. Go to youtube.com (logged in)\n"
                    error_msg += "3. Export cookies and replace cookies.txt\n"
                    error_msg += "4. Redeploy your app\n\n"
                    error_msg += f"Details:\n{recent}"
                else:
                    error_msg += recent if recent else "No detailed message was captured. See server logs."
                
                raise RuntimeError(error_msg)
        except DownloadError as exc:
            recent = _ytdlp_recent_messages(ytdlp_capture)
            body = str(exc).strip()
            
            # Check if it's a bot detection error
            if recent and ("Sign in to confirm you're not a bot" in recent or "bot" in recent.lower()):
                body = "🤖 YouTube detected bot activity and blocked the request.\n\n"
                body += "SOLUTION: Update your cookies.txt file with fresh YouTube cookies.\n"
                body += "1. Install browser extension: 'Get cookies.txt LOCALLY'\n"
                body += "2. Go to youtube.com (logged in)\n"
                body += "3. Export cookies and replace cookies.txt\n"
                body += "4. Redeploy your app\n\n"
                body += f"Details:\n{recent}"
            elif recent:
                body = f"{body}\n\nLast yt-dlp output:\n{recent}"
            
            raise RuntimeError(body) from exc

        mp3_files = sorted(job_dir.glob("*.mp3"))
        # Ignore accidental output file from a previous partial run.
        safe_filename = re.sub(r'[<>:"/\\|?*]', '_', filename)  # Sanitize filename
        output_filename = f"{safe_filename}.mp3"
        mp3_files = [p for p in mp3_files if p.name != output_filename]
        if not mp3_files:
            recent = _ytdlp_recent_messages(ytdlp_capture)
            raise RuntimeError(
                "No MP3 files were produced after the download step.\n\n"
                + (recent if recent else "Check cookies.txt, URL, and that FFmpeg is available on the server.")
            )

        set_state(
            stage="merging",
            message="Merging into one ultimate MP3...",
        )

        concat_list = job_dir / "concat_list.txt"
        lines = [f"file '{_escape_concat_path(p)}'" for p in mp3_files]
        concat_list.write_text("\n".join(lines) + "\n", encoding="utf-8")

        out_file = job_dir / output_filename
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
        full_msg = str(exc).strip() or "Something went wrong."
        log.error("Job failed job_id=%s: %s", job_id, full_msg, exc_info=True)
        # Allow longer yt-dlp traces in the UI; full text is also in server logs above
        msg = full_msg if len(full_msg) <= 8000 else full_msg[:8000] + "…"
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
    filename: str = Field(default="ULTIMATE_PLAYLIST", min_length=1, max_length=100)


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
    
    # Sanitize filename
    safe_filename = re.sub(r'[<>:"/\\|?*]', '_', body.filename.strip())
    if not safe_filename:
        safe_filename = "ULTIMATE_PLAYLIST"

    job_id = str(uuid.uuid4())
    created_at = datetime.utcnow()
    
    with jobs_lock:
        jobs[job_id] = {
            "stage": "fetching",
            "message": "Fetching playlist information...",
            "output_path": None,
            "error": None,
            "filename": safe_filename,
            "created_at": created_at.isoformat(),
        }

    background_tasks.add_task(process_playlist, job_id, raw, safe_filename)
    background_tasks.add_task(schedule_job_cleanup, job_id, 1)  # Auto-delete after 1 hour
    
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
            "filename": job.get("filename", "ULTIMATE_PLAYLIST"),
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
    
    download_filename = f"{job.get('filename', 'ULTIMATE_PLAYLIST')}.mp3"

    return FileResponse(
        path,
        media_type="audio/mpeg",
        filename=download_filename,
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

# Ultimate Playlist Merger

Single-repo web app: paste a YouTube playlist or single video URL → the server downloads each item as **320 kbps MP3** (via **yt-dlp**), concatenates them in playlist order with **FFmpeg** (`-c copy`), and serves **one** file: `ULTIMATE_PLAYLIST.mp3`.

**No API keys required** — metadata and media are handled entirely by **yt-dlp** (no YouTube Data API).

## Requirements

- **Python 3.11+**
- **FFmpeg** on `PATH` (for merge step)
- **yt-dlp** (installed from `requirements.txt`)

## One-command setup

```bash
cd youtube-playlist-merger
python -m venv .venv
```

Activate the virtual environment:

- **Windows (PowerShell):** `.venv\Scripts\Activate.ps1`
- **macOS / Linux:** `source .venv/bin/activate`

Then:

```bash
pip install -r requirements.txt
```

## FFmpeg install

- **Windows:** Install [FFmpeg](https://ffmpeg.org/download.html) (e.g. via [gyan.dev](https://www.gyan.dev/ffmpeg/builds/) builds) and add `ffmpeg.exe` to your **PATH**, or use **Chocolatey**: `choco install ffmpeg`
- **macOS:** `brew install ffmpeg`
- **Linux (Debian/Ubuntu):** `sudo apt update && sudo apt install ffmpeg`

Verify: `ffmpeg -version`

## Run locally

```bash
uvicorn main:app --reload
```

Open **http://127.0.0.1:8000**

## API (for reference)

| Method | Path | Purpose |
|--------|------|---------|
| POST | `/create-job` | JSON body `{"url":"..."}` → `{ "job_id": "..." }`, starts background work |
| GET | `/status/{job_id}` | `{ "stage", "message", "error" }` — stages: `fetching`, `downloading`, `merging`, `completed`, `error` |
| GET | `/download/{job_id}` | One-click download of `ULTIMATE_PLAYLIST.mp3` when `completed` |
| POST | `/cleanup/{job_id}` | Deletes the job’s folder under `temp/` and clears server-side job state |

Temporary files live under `temp/<job_id>/` (created automatically).

## Deploy notes

- Run with a production ASGI server, e.g. `uvicorn main:app --host 0.0.0.0 --port 8000` (add **HTTPS** in front with **nginx**, **Caddy**, or your host’s reverse proxy).
- Ensure **FFmpeg** and **yt-dlp** are available in the same environment as the app (container image or VM).
- Merges and downloads can be **large** and **long-running**; size `temp/` disk appropriately and consider **timeouts** on your reverse proxy for big playlists.
- This app is intended for **personal / rights-respecting** use; you are responsible for complying with YouTube’s terms and applicable copyright law.

## Project layout

```
youtube-playlist-merger/
├── main.py
├── templates/
│   └── index.html
├── static/
│   └── style.css
├── temp/          # auto-created per job
├── requirements.txt
└── README.md
```

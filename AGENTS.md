# Repository Guidelines

## Project Structure & Module Organization
- **Backend:** `main.py` is the core FastAPI application. It handles background tasks, uses `yt-dlp` for downloading media, and `ffmpeg` to concatenate audio into a single `.mp3` file.
- **Frontend & Mini-Game:** `static/` and `templates/` house the frontend files. This includes a zero-dependency vanilla JavaScript and CSS mini-game called "Neela Tap" (`static/neela-tap.js`, `static/neela-tap.css`) shown during loading states.
- **Temporary Storage:** The `temp/` directory is automatically generated and handles intermediate job processing, downloaded segments, and playlist files before final output generation.
- **Deployment:** Configured for Docker (`Dockerfile`) and Nixpacks (`nixpacks.toml` + `start.sh`). Integrates with a `bgutil-ytdlp-pot-provider` private service via `main.py` to bypass bot detection.

## Build, Test, and Development Commands
- **Environment Setup:**
  ```bash
  python -m venv .venv
  pip install -r requirements.txt
  ```
- **Run Local Development Server:**
  ```bash
  uvicorn main:app --reload
  ```
- **Testing:** No formal testing framework (e.g., `pytest`) or automated test scripts are configured. Tests are run manually.

## Coding Style & Naming Conventions
- **Python Backend:** Follows general Python PEP-8 structure with type hints for parameters and return types (e.g., `def schedule_job_cleanup(job_id: str, delay_hours: int = 1):`).
- **Frontend:** Written in pure Vanilla JavaScript (ES6+) and CSS without any build pipelines or bundlers. The mini-game runs entirely on DOM + CSS with `requestAnimationFrame`.
- **Linting & Formatting:** No automated linters (flake8, ruff) or formatters (black, prettier) are enforced.

## Commit & Pull Request Guidelines
- **Commits:** The project history uses casual, unstructured commit messages. No strict formatting (e.g., Conventional Commits) is required.
- **Pull Requests:** No PR templates or automated CI hooks are defined.
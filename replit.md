# Reel Saver — Instagram Reels Downloader

A small Flask website that takes a public Instagram Reel/Post link and lets the
user download the video as MP4.

## Stack

- Python 3.11 + Flask (server)
- yt-dlp (video extraction & download)
- Vanilla HTML/CSS/JS frontend (no build step)

## Project layout

- `app.py` — Flask app with two endpoints:
  - `POST /api/fetch` — validates the URL, extracts metadata + a direct video URL
  - `GET  /api/download?url=...` — downloads the MP4 server-side and streams it back
- `templates/index.html` — single-page UI
- `static/style.css` — styling (dark theme, gradient accents)
- `static/app.js` — frontend logic (fetch, preview, download)

## Workflow

- `Start application`: `python app.py`, port 5000 (webview).

## Notes / known limitations

- Instagram heavily restricts anonymous downloads from datacenter IPs. Many
  Reels will fail with a "login required" message — this is surfaced to the
  user as a friendly error in `_friendly_error()`.
- Only public Reels / Posts / IGTV links are supported. URL shape is validated
  by `INSTAGRAM_URL_RE` in `app.py`.
- Downloaded files are written to a temp directory and removed immediately
  after the response is sent (`@after_this_request` cleanup).

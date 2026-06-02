import os
import re
import tempfile
import uuid
from pathlib import Path

from flask import Flask, render_template, request, jsonify, send_file, after_this_request
import yt_dlp

app = Flask(__name__)

DOWNLOAD_DIR = Path(tempfile.gettempdir()) / "ig_reels"
DOWNLOAD_DIR.mkdir(parents=True, exist_ok=True)

INSTAGRAM_URL_RE = re.compile(
    r"^https?://(?:www\.)?instagram\.com/(?:reel|reels|p|tv)/[A-Za-z0-9_\-]+/?",
    re.IGNORECASE,
)


def is_valid_instagram_url(url: str) -> bool:
    return bool(INSTAGRAM_URL_RE.match(url.strip()))


@app.route("/")
def index():
    return render_template("index.html")


@app.route("/api/fetch", methods=["POST"])
def fetch():
    data = request.get_json(silent=True) or {}
    url = (data.get("url") or "").strip()

    if not url:
        return jsonify({"error": "Please provide an Instagram URL."}), 400
    if not is_valid_instagram_url(url):
        return jsonify({
            "error": "That doesn't look like an Instagram Reel/Post link. "
                     "Use a link like https://www.instagram.com/reel/XXXXX/"
        }), 400

    try:
        ydl_opts = {
            "quiet": True,
            "no_warnings": True,
            "skip_download": True,
            "noplaylist": True,
        }
        with yt_dlp.YoutubeDL(ydl_opts) as ydl:
            info = ydl.extract_info(url, download=False)

        formats = info.get("formats") or []
        video_url = None
        for f in reversed(formats):
            if f.get("vcodec") and f.get("vcodec") != "none" and f.get("url"):
                video_url = f.get("url")
                break
        if not video_url:
            video_url = info.get("url")

        if not video_url:
            return jsonify({"error": "Could not extract a downloadable video from that link."}), 422

        return jsonify({
            "title": info.get("title") or "Instagram Reel",
            "uploader": info.get("uploader") or info.get("channel") or "",
            "thumbnail": info.get("thumbnail"),
            "duration": info.get("duration"),
            "video_url": video_url,
            "download_endpoint": f"/api/download?url={request_quote(url)}",
        })
    except yt_dlp.utils.DownloadError as e:
        msg = str(e)
        return jsonify({"error": _friendly_error(msg)}), 422
    except Exception as e:
        return jsonify({"error": f"Unexpected error: {e}"}), 500


@app.route("/api/download", methods=["GET"])
def download():
    url = (request.args.get("url") or "").strip()
    if not url or not is_valid_instagram_url(url):
        return jsonify({"error": "Invalid Instagram URL."}), 400

    file_id = uuid.uuid4().hex
    out_template = str(DOWNLOAD_DIR / f"{file_id}.%(ext)s")

    ydl_opts = {
        "quiet": True,
        "no_warnings": True,
        "outtmpl": out_template,
        "format": "mp4/best",
        "noplaylist": True,
        "merge_output_format": "mp4",
    }

    try:
        with yt_dlp.YoutubeDL(ydl_opts) as ydl:
            info = ydl.extract_info(url, download=True)
            filepath = ydl.prepare_filename(info)
            if not os.path.exists(filepath):
                base = filepath.rsplit(".", 1)[0]
                for ext in ("mp4", "mkv", "webm", "mov"):
                    candidate = f"{base}.{ext}"
                    if os.path.exists(candidate):
                        filepath = candidate
                        break
    except yt_dlp.utils.DownloadError as e:
        return jsonify({"error": _friendly_error(str(e))}), 422
    except Exception as e:
        return jsonify({"error": f"Unexpected error: {e}"}), 500

    if not os.path.exists(filepath):
        return jsonify({"error": "Download failed."}), 500

    title = (info.get("title") or "instagram_reel").strip()
    safe_title = re.sub(r"[^A-Za-z0-9._\- ]+", "_", title)[:80].strip() or "instagram_reel"
    download_name = f"{safe_title}.mp4"

    @after_this_request
    def cleanup(response):
        try:
            os.remove(filepath)
        except Exception:
            pass
        return response

    return send_file(
        filepath,
        as_attachment=True,
        download_name=download_name,
        mimetype="video/mp4",
    )


def _friendly_error(msg: str) -> str:
    low = msg.lower()
    if ("login" in low or "rate-limit" in low or "rate limit" in low
            or "checkpoint" in low or "empty media response" in low or "cookies" in low):
        return ("Instagram blocked this request and is asking for a login. "
                "This usually happens because Instagram limits anonymous downloads from servers. "
                "Try a different public Reel, wait a few minutes, or try again later.")
    if "private" in low:
        return "This post appears to be private. Only public Reels can be downloaded."
    if "unavailable" in low or "removed" in low or "404" in low:
        return "This Reel is unavailable, removed, or the link is incorrect."
    return f"Could not fetch the Reel: {msg}"


def request_quote(s: str) -> str:
    from urllib.parse import quote
    return quote(s, safe="")


if __name__ == "__main__":
    app.run(host="0.0.0.0", port=5000, debug=False)

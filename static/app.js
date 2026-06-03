const form = document.getElementById("reel-form");
const urlInput = document.getElementById("url");
const submitBtn = document.getElementById("submit-btn");
const messageEl = document.getElementById("message");
const resultEl = document.getElementById("result");
const thumbEl = document.getElementById("thumb");
const titleEl = document.getElementById("title");
const metaEl = document.getElementById("meta");
const downloadLink = document.getElementById("download-link");
const previewBtn = document.getElementById("preview-btn");
const previewWrap = document.getElementById("preview-wrap");
const previewVideo = document.getElementById("preview-video");
const historySection = document.getElementById("history-section");
const historyList = document.getElementById("history-list");
const clearHistoryBtn = document.getElementById("clear-history");

const HISTORY_KEY = "reelsaver:history:v1";
const MAX_HISTORY = 8;

function showMessage(text, type = "info") {
  messageEl.textContent = text;
  messageEl.className = `message ${type}`;
  messageEl.hidden = false;
}
function hideMessage() {
  messageEl.hidden = true;
  messageEl.textContent = "";
}
function hideResult() {
  resultEl.hidden = true;
  previewWrap.hidden = true;
  previewVideo.removeAttribute("src");
  previewVideo.load?.();
}
function setLoading(isLoading) {
  submitBtn.disabled = isLoading;
  submitBtn.classList.toggle("loading", isLoading);
  submitBtn.querySelector(".btn-label").textContent = isLoading ? "Fetching…" : "Fetch";
}

function formatDuration(seconds) {
  if (!seconds || !Number.isFinite(seconds)) return "";
  const s = Math.round(seconds);
  const m = Math.floor(s / 60);
  const r = String(s % 60).padStart(2, "0");
  return `${m}:${r}`;
}

form.addEventListener("submit", async (e) => {
  e.preventDefault();
  hideMessage();
  hideResult();

  const url = urlInput.value.trim();
  if (!url) {
    showMessage("Please paste an Instagram Reel link.", "error");
    return;
  }

  setLoading(true);
  try {
    const res = await fetch("/api/fetch", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ url }),
    });
    const data = await res.json();

    if (!res.ok) {
      showMessage(data.error || "Something went wrong.", "error");
      return;
    }

    titleEl.textContent = data.title || "Instagram Reel";
    const parts = [];
    if (data.uploader) parts.push(`@${data.uploader.replace(/^@/, "")}`);
    const dur = formatDuration(data.duration);
    if (dur) parts.push(dur);
    metaEl.textContent = parts.join(" · ");

    if (data.thumbnail) {
      thumbEl.src = data.thumbnail;
      thumbEl.referrerPolicy = "no-referrer";
    } else {
      thumbEl.removeAttribute("src");
    }

    downloadLink.href = data.download_endpoint;
    downloadLink.setAttribute("download", "");

    previewVideo.dataset.src = data.video_url || "";
    previewWrap.hidden = true;

    resultEl.hidden = false;

    addToHistory({
      url,
      title: data.title,
      uploader: data.uploader,
      thumbnail: data.thumbnail,
      duration: data.duration,
      download_endpoint: data.download_endpoint,
    });
  } catch (err) {
    showMessage("Network error. Please try again.", "error");
  } finally {
    setLoading(false);
  }
});

function loadHistory() {
  try {
    const raw = localStorage.getItem(HISTORY_KEY);
    if (!raw) return [];
    const parsed = JSON.parse(raw);
    return Array.isArray(parsed) ? parsed : [];
  } catch {
    return [];
  }
}

function saveHistory(items) {
  try {
    localStorage.setItem(HISTORY_KEY, JSON.stringify(items));
  } catch {}
}

function addToHistory(entry) {
  if (!entry || !entry.url) return;
  const items = loadHistory().filter((it) => it.url !== entry.url);
  items.unshift({
    url: entry.url,
    title: entry.title || "Instagram Reel",
    uploader: entry.uploader || "",
    thumbnail: entry.thumbnail || "",
    duration: entry.duration || null,
    download_endpoint: entry.download_endpoint || "",
    savedAt: Date.now(),
  });
  saveHistory(items.slice(0, MAX_HISTORY));
  renderHistory();
}

function removeFromHistory(url) {
  const items = loadHistory().filter((it) => it.url !== url);
  saveHistory(items);
  renderHistory();
}

function clearHistory() {
  saveHistory([]);
  renderHistory();
}

function timeAgo(ts) {
  if (!ts) return "";
  const diff = Math.max(0, Date.now() - ts);
  const sec = Math.floor(diff / 1000);
  if (sec < 60) return "just now";
  const min = Math.floor(sec / 60);
  if (min < 60) return `${min}m ago`;
  const hr = Math.floor(min / 60);
  if (hr < 24) return `${hr}h ago`;
  const day = Math.floor(hr / 24);
  if (day < 7) return `${day}d ago`;
  return new Date(ts).toLocaleDateString();
}

function renderHistory() {
  const items = loadHistory();
  if (items.length === 0) {
    historySection.hidden = true;
    historyList.innerHTML = "";
    return;
  }
  historySection.hidden = false;
  historyList.innerHTML = "";

  for (const it of items) {
    const li = document.createElement("li");
    li.className = "history-item";

    const img = document.createElement("img");
    img.className = "history-thumb";
    img.alt = "";
    img.referrerPolicy = "no-referrer";
    if (it.thumbnail) img.src = it.thumbnail;

    const meta = document.createElement("div");
    meta.className = "history-meta";
    const title = document.createElement("div");
    title.className = "history-title";
    title.textContent = it.title || "Instagram Reel";
    const sub = document.createElement("div");
    sub.className = "history-sub";
    const subParts = [];
    if (it.uploader) subParts.push(`@${String(it.uploader).replace(/^@/, "")}`);
    const dur = formatDuration(it.duration);
    if (dur) subParts.push(dur);
    subParts.push(timeAgo(it.savedAt));
    sub.textContent = subParts.join(" · ");
    meta.appendChild(title);
    meta.appendChild(sub);

    const actions = document.createElement("div");
    actions.className = "history-actions";

    const dl = document.createElement("a");
    dl.className = "icon-btn";
    dl.title = "Download again";
    dl.textContent = "⬇";
    dl.href = it.download_endpoint || `/api/download?url=${encodeURIComponent(it.url)}`;
    dl.setAttribute("download", "");

    const reload = document.createElement("button");
    reload.type = "button";
    reload.className = "icon-btn";
    reload.title = "Load this link";
    reload.textContent = "↺";
    reload.addEventListener("click", () => {
      urlInput.value = it.url;
      urlInput.focus();
      window.scrollTo({ top: 0, behavior: "smooth" });
    });

    const del = document.createElement("button");
    del.type = "button";
    del.className = "icon-btn danger";
    del.title = "Remove";
    del.textContent = "✕";
    del.addEventListener("click", () => removeFromHistory(it.url));

    actions.append(dl, reload, del);
    li.append(img, meta, actions);
    historyList.appendChild(li);
  }
}

clearHistoryBtn.addEventListener("click", () => {
  if (loadHistory().length === 0) return;
  clearHistory();
});

renderHistory();

previewBtn.addEventListener("click", () => {
  const src = previewVideo.dataset.src;
  if (!src) {
    showMessage("No preview available for this Reel.", "info");
    return;
  }
  if (previewWrap.hidden) {
    previewVideo.src = src;
    previewWrap.hidden = false;
    previewVideo.play?.().catch(() => {});
    previewBtn.textContent = "Hide preview";
  } else {
    previewVideo.pause?.();
    previewWrap.hidden = true;
    previewBtn.textContent = "Preview";
  }
});

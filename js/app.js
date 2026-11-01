"use strict";

(() => {
  const {
    SURAHS,
    RECITERS,
    MINIMAL_FALLBACK_CATALOG,
    STYLE_PRESETS,
    KNOWN_EXCERPTS,
    AMBIENT_SOUNDS,
    ARABIC_COLOR_SWATCHES,
    MEAL_COLOR_SWATCHES,
    EN_COLOR_SWATCHES,
    HIGHLIGHT_COLOR_SWATCHES,
    MEAL_TEXT_STYLES,
    COVER_TEMPLATES
  } = window.TW_DATA;

  const {
    PERSISTED_KEYS,
    loadSettings,
    saveSettings,
    resetSettingsToDefault,
    initDB,
    getAllGalleryItems,
    saveGalleryItem,
    deleteGalleryItem,
    clearAllGallery,
    cacheVersesToDB,
    getCachedVersesRange,
    getStorageStats
  } = window.TW_STORAGE;

  const {
    drawProceduralScene,
    drawVisualEffectOverlay,
    drawBackgroundMediaWithFilters,
    drawFilterWarmthAndCinemaBars,
    drawCinematicVignette
  } = window.TW_SCENES;

  const {
    ensureAudioGraph,
    connectBgVideoToGraph,
    updateVolumes,
    triggerSmoothFadeOut,
    resetMasterGain,
    startAmbientSound,
    stopAmbientSound,
    loadSingleAyahAudio,
    playAyahItem,
    stopActiveAyahPlayback
  } = window.TW_AUDIO;

  const {
    detectRecorderCapabilities,
    patchWebmDuration,
    formatExportFileName
  } = window.TW_RECORDER;

  function syncAppViewportHeight() {
    const vh = window.visualViewport ? window.visualViewport.height : window.innerHeight;
    document.documentElement.style.setProperty("--app-height", `${vh}px`);
  }
  window.addEventListener("resize", syncAppViewportHeight);
  if (window.visualViewport) window.visualViewport.addEventListener("resize", syncAppViewportHeight);
  syncAppViewportHeight();

  const savedSettings = loadSettings();
  let extraBlockOffsets = {};
  try {
    extraBlockOffsets = JSON.parse(localStorage.getItem("tilawah_block_offsets_v1") || "{}") || {};
  } catch (_) {}

  const state = {
    arOffsetX: 0,
    arOffsetY: 0,
    trOffsetX: 0,
    trOffsetY: 0,
    enOffsetX: 0,
    enOffsetY: 0,
    activeMoveTarget: "auto", // "auto" | "ar" | "tr" | "en" | "all"
    ...savedSettings,
    ...extraBlockOffsets,
    activeTab: "stil",
    drawerCollapsed: false,
    reciterSearch: "",
    surahSearch: "",
    verses: [],
    versesLoaded: false,
    versesOfflineError: "",
    audioStatuses: [],
    audioElements: [],
    audioDurations: [],
    audioObjectUrls: [],
    audioReady: false,
    textOnlyMode: false,
    isPlaying: false,
    isRecording: false,
    isFadingOut: false,
    fadeOutProgress: 0,
    activeVerseIdx: 0,
    verseStartTime: 0,
    activeVerseElapsed: 0,
    elapsedTime: 0,
    totalDuration: 0,
    lastExportBlob: null,
    lastExportObjectUrl: null,
    lastExportExt: "mp4",
    lastExportMime: "video/mp4",
    lastExportCleanMime: "video/mp4",
    fontsReady: false
  };

  // Undo / Redo History Stack
  const historyStack = [];
  let historyPointer = -1;
  let isRestoringHistory = false;

  function captureStateSnapshot() {
    const snap = {};
    for (const k of PERSISTED_KEYS) {
      snap[k] = JSON.parse(JSON.stringify(state[k]));
    }
    return snap;
  }

  function pushHistorySnapshot() {
    if (isRestoringHistory) return;
    const snap = captureStateSnapshot();
    const serialized = JSON.stringify(snap);
    if (historyPointer >= 0 && JSON.stringify(historyStack[historyPointer]) === serialized) {
      return;
    }
    historyStack.splice(historyPointer + 1);
    historyStack.push(snap);
    if (historyStack.length > 35) historyStack.shift();
    historyPointer = historyStack.length - 1;
    updateUndoRedoButtons();
  }

  function updateUndoRedoButtons() {
    const btnUndo = document.getElementById("btnUndo");
    const btnRedo = document.getElementById("btnRedo");
    if (btnUndo) btnUndo.disabled = historyPointer <= 0;
    if (btnRedo) btnRedo.disabled = historyPointer >= historyStack.length - 1;
  }

  async function applyHistorySnapshot(snap) {
    if (!snap) return;
    isRestoringHistory = true;
    const prevSurah = state.surahNo;
    const prevStart = state.ayahStart;
    const prevEnd = state.ayahEnd;
    const prevReciter = state.reciterId;
    const prevBismillah = state.bismillahMode;
    const prevZemin = state.zeminId;

    for (const k of PERSISTED_KEYS) {
      if (typeof snap[k] !== "undefined") {
        state[k] = JSON.parse(JSON.stringify(snap[k]));
      }
    }
    saveSettings(state);
    syncAllControlsFromState();

    if (prevZemin !== state.zeminId) {
      await selectZemin(state.zeminId, true);
    }
    if (
      prevSurah !== state.surahNo ||
      prevStart !== state.ayahStart ||
      prevEnd !== state.ayahEnd ||
      prevReciter !== state.reciterId ||
      prevBismillah !== state.bismillahMode
    ) {
      await loadVersesAndPreloadAudio();
    }
    updateVolumes(state, activeBgVideo);
    if (state.isPlaying || state.isRecording) {
      startAmbientSound(state);
    }
    isRestoringHistory = false;
    updateUndoRedoButtons();
  }

  let persistDebounceTimer = null;
  function persistState(recordHistory = true) {
    saveSettings(state);
    try {
      localStorage.setItem("tilawah_block_offsets_v1", JSON.stringify({
        arOffsetX: state.arOffsetX || 0,
        arOffsetY: state.arOffsetY || 0,
        trOffsetX: state.trOffsetX || 0,
        trOffsetY: state.trOffsetY || 0,
        enOffsetX: state.enOffsetX || 0,
        enOffsetY: state.enOffsetY || 0,
        subtitleMode: state.subtitleMode
      }));
    } catch (_) {}
    updateHeaderAndBottomSummary();
    updateSocialCaptionText();
    if (recordHistory && !isRestoringHistory) {
      clearTimeout(persistDebounceTimer);
      persistDebounceTimer = setTimeout(() => {
        pushHistorySnapshot();
      }, 280);
    }
  }

  let toastTimer = null;
  function showToast(msg, duration = 2600) {
    const el = document.getElementById("toastNotification");
    if (!el) return;
    el.textContent = msg;
    el.classList.add("show");
    clearTimeout(toastTimer);
    toastTimer = setTimeout(() => el.classList.remove("show"), duration);
  }

  function hapticTap(ms = 10) {
    try {
      if (navigator.vibrate) navigator.vibrate(ms);
    } catch (_) {}
  }

  function formatPreciseTime(sec) {
    const s = Math.max(0, Number(sec) || 0);
    const m = Math.floor(s / 60);
    const rem = s - m * 60;
    const whole = Math.floor(rem);
    const tenths = Math.floor((rem - whole) * 10);
    return `${String(m).padStart(2, "0")}:${String(whole).padStart(2, "0")}.${tenths}`;
  }

  function formatShortTime(sec) {
    const s = Math.max(0, Math.round(sec || 0));
    const m = Math.floor(s / 60);
    const r = s % 60;
    return `${m}:${String(r).padStart(2, "0")}`;
  }

  // Formats seconds into MM:SS (e.g. 30 -> "00:30", 105 -> "01:45")
  function formatMMSS(sec) {
    const s = Math.max(0, Math.round(Number(sec) || 0));
    const m = Math.floor(s / 60);
    const r = s % 60;
    return `${String(m).padStart(2, "0")}:${String(r).padStart(2, "0")}`;
  }

  // Parses "00:30", "1:45", or "90" into seconds
  function parseMMSS(str) {
    if (typeof str === "number") return Math.max(0, str);
    const raw = String(str || "").trim();
    if (!raw) return 0;
    if (raw.includes(":")) {
      const parts = raw.split(":").map((p) => Number(p.trim()) || 0);
      if (parts.length === 2) return Math.max(0, parts[0] * 60 + parts[1]);
      if (parts.length === 3) return Math.max(0, parts[0] * 3600 + parts[1] * 60 + parts[2]);
    }
    const num = Number(raw.replace(",", "."));
    return Number.isFinite(num) ? Math.max(0, num) : 0;
  }

  function toArabicIndicDigits(num) {
    const map = ["٠", "١", "٢", "٣", "٤", "٥", "٦", "٧", "٨", "٩"];
    return String(num).replace(/\d/g, (d) => map[Number(d)]);
  }

  function normalizeHashtagWord(str) {
    if (!str) return "";
    return String(str)
      .replace(/[âÂ]/g, (m) => (m === "Â" ? "A" : "a"))
      .replace(/[îÎ]/g, (m) => (m === "Î" ? "İ" : "i"))
      .replace(/[ûÛ]/g, (m) => (m === "Û" ? "U" : "u"))
      .replace(/[êÊ]/g, (m) => (m === "Ê" ? "E" : "e"))
      .replace(/[ôÔ]/g, (m) => (m === "Ô" ? "O" : "o"))
      .replace(/[^a-zA-Z0-9ğüşıöçĞÜŞİÖÇ]/g, "");
  }

  function formatVerseTextWithNumber(rawText, ayahNum, fmt) {
    if (!rawText) return "";
    const clean = String(rawText).replace(/^\s*\d+\s*[-.)\]]\s*/, "").trim();
    const mode = fmt || state.mealNumberFormat || "hyphen";
    if (mode === "none") return clean;
    if (mode === "dot") return `${ayahNum}. ${clean}`;
    if (mode === "bracket") return `[${ayahNum}] ${clean}`;
    return `${ayahNum}- ${clean}`;
  }

  function updateHeaderAndBottomSummary() {
    const surahMeta = SURAHS.find((s) => s[0] === state.surahNo) || SURAHS[0];
    const recMeta = RECITERS.find((r) => r.id === state.reciterId) || RECITERS[0];
    const rangeStr = state.ayahStart === state.ayahEnd ? `${state.ayahStart}` : `${state.ayahStart}-${state.ayahEnd}`;

    const hdr = document.getElementById("headerProjectSummary");
    if (hdr) hdr.textContent = `${surahMeta[1]} ${rangeStr} · ${recMeta.name}`;

    // Dynamic placeholders for Cover Arabic & Turkish Surah Name inputs
    const inpCoverAr = document.getElementById("inpCoverSurahNameAr");
    if (inpCoverAr) inpCoverAr.placeholder = surahMeta[2];
    const inpCoverTr = document.getElementById("inpCoverSurahName");
    if (inpCoverTr) inpCoverTr.placeholder = `${surahMeta[1]} Sûresi`;

    const durSec = Math.max(5, Math.round(state.totalDuration || 18));
    const estRenderSec = Math.max(3, Math.round(durSec * 0.25));
    const estMB = Math.max(2, Math.round((durSec * (state.bitrateMbps || 8)) / 8));

    const mainSpec = document.getElementById("lblExportSpecsMain");
    if (mainSpec) mainSpec.textContent = `${state.platformRatio} · ${state.resolution}p · ≈ ${formatShortTime(durSec)}`;

    const estTime = document.getElementById("lblExportEstTime");
    if (estTime) estTime.textContent = `⏱ ≈ ${formatShortTime(estRenderSec)}`;

    const estSize = document.getElementById("lblExportEstSize");
    if (estSize) estSize.textContent = `💾 ${estMB} MB`;

    for (let i = 0; i <= 4; i++) {
      const el = document.getElementById(`tlRuler${i}`);
      if (el) {
        const tVal = (durSec * i) / 4;
        el.textContent = formatShortTime(tVal);
      }
    }
  }

  let wakeLockSentinel = null;
  async function requestScreenWakeLock() {
    if ("wakeLock" in navigator && navigator.wakeLock) {
      try {
        wakeLockSentinel = await navigator.wakeLock.request("screen");
      } catch (_) {}
    }
  }
  function releaseScreenWakeLock() {
    if (wakeLockSentinel) {
      try { wakeLockSentinel.release(); } catch (_) {}
      wakeLockSentinel = null;
    }
  }

  async function ensureFontsLoaded() {
    if (document.fonts && document.fonts.load) {
      try {
        await Promise.all([
          document.fonts.load(`700 ${state.arabicSize}px '${state.arabicFont}'`),
          document.fonts.load(`${state.mealWeight} ${state.mealItalic ? "italic " : ""}${state.mealSize}px '${state.mealFont}'`),
          document.fonts.load("700 44px 'Amiri'"),
          document.fonts.load("700 44px 'Scheherazade New'"),
          document.fonts.load("700 44px 'Noto Naskh Arabic'"),
          document.fonts.load("600 italic 22px 'Cormorant Garamond'"),
          document.fonts.load("500 22px 'DM Sans'"),
          document.fonts.load("500 22px 'Source Sans 3'")
        ]);
        await document.fonts.ready;
      } catch (_) {}
    }
    state.fontsReady = true;
  }

  // Crisp 512x512 High-DPI Studio Logo
  const appLogoImg = new Image();
  let appLogoLoaded = false;
  const fallbackLogoCanvas = document.createElement("canvas");
  fallbackLogoCanvas.width = 512;
  fallbackLogoCanvas.height = 512;

  function buildFallbackLogo() {
    const lctx = fallbackLogoCanvas.getContext("2d");
    lctx.clearRect(0, 0, 512, 512);
    const grad = lctx.createRadialGradient(256, 256, 30, 256, 256, 240);
    grad.addColorStop(0, "#1A1E26");
    grad.addColorStop(1, "#07080A");
    lctx.fillStyle = grad;
    lctx.beginPath();
    lctx.arc(256, 256, 240, 0, Math.PI * 2);
    lctx.fill();

    lctx.lineWidth = 10;
    lctx.strokeStyle = "#E0B84C";
    lctx.stroke();

    lctx.lineWidth = 3;
    lctx.strokeStyle = "rgba(248, 229, 166, 0.45)";
    lctx.beginPath();
    lctx.arc(256, 256, 218, 0, Math.PI * 2);
    lctx.stroke();

    lctx.fillStyle = "rgba(224, 184, 76, 0.22)";
    lctx.beginPath();
    lctx.arc(256, 256, 155, 0, Math.PI * 2);
    lctx.fill();

    lctx.fillStyle = "#F8E5A6";
    lctx.font = "bold 116px 'Amiri', serif";
    lctx.textAlign = "center";
    lctx.textBaseline = "middle";
    lctx.fillText("تلاوة", 256, 244);

    lctx.fillStyle = "#E0B84C";
    lctx.font = "700 30px 'DM Sans', sans-serif";
    lctx.fillText("TILAWAH", 256, 355);
  }
  buildFallbackLogo();

  appLogoImg.onload = () => {
    appLogoLoaded = (appLogoImg.naturalWidth >= 128);
  };
  appLogoImg.onerror = () => {
    appLogoLoaded = false;
    const hdr = document.getElementById("headerLogoImg");
    if (hdr) hdr.src = fallbackLogoCanvas.toDataURL("image/png");
    const spl = document.getElementById("splashLogoImg");
    if (spl) spl.src = fallbackLogoCanvas.toDataURL("image/png");
  };
  appLogoImg.src = window.__TW_INLINE_LOGO_DATA__ || "icons/logo.png";

  let galleryItems = [];
  let activeObjectUrls = [];
  const styleThumbCache = new Map();
  let activeBgImage = null;
  let activeBgVideo = null;
  let activeBgVideoDuration = 0;

  function revokeActiveMediaUrls() {
    while (activeObjectUrls.length > 0) {
      const u = activeObjectUrls.pop();
      try { URL.revokeObjectURL(u); } catch (_) {}
    }
  }

  // Generates a typography preview card thumbnail for each of the 8 clean Styles
  function generateStyleCardPreview(st) {
    const key = st.id;
    if (styleThumbCache.has(key)) return styleThumbCache.get(key);

    const c = document.createElement("canvas");
    c.width = 220;
    c.height = 300;
    const tctx = c.getContext("2d");

    const p = st.palette || ["#07080A", "#12151C", "#E0B84C"];
    const g = tctx.createLinearGradient(0, 0, 0, 300);
    g.addColorStop(0, p[0]);
    g.addColorStop(0.5, p[1]);
    g.addColorStop(1, p[0]);
    tctx.fillStyle = g;
    tctx.fillRect(0, 0, 220, 300);

    if (st.textBoxStyle === "frosted") {
      tctx.fillStyle = "rgba(255, 255, 255, 0.08)";
      tctx.strokeStyle = "rgba(240, 215, 138, 0.35)";
      tctx.lineWidth = 1.5;
      tctx.fillRect(18, 78, 184, 128);
      tctx.strokeRect(18, 78, 184, 128);
    } else if (st.textBoxStyle === "dark_pill") {
      tctx.fillStyle = "rgba(4, 5, 7, 0.85)";
      tctx.strokeStyle = "rgba(224, 184, 76, 0.3)";
      tctx.lineWidth = 1.5;
      tctx.fillRect(18, 78, 184, 128);
      tctx.strokeRect(18, 78, 184, 128);
    }

    tctx.textAlign = "center";
    tctx.textBaseline = "middle";
    tctx.fillStyle = st.arabicColor || "#FFFDF7";
    tctx.font = `bold 26px '${st.arabicFont || "Amiri"}', serif`;
    tctx.fillText("بِسْمِ ٱللَّهِ", 110, 118);

    // Highlighted word indicator
    tctx.fillStyle = st.wordHighlightColor || "#F8E5A6";
    tctx.fillRect(68, 138, 84, 3);

    tctx.fillStyle = st.mealColor || "#E8C978";
    tctx.font = "600 13px 'DM Sans', sans-serif";
    tctx.fillText("1- Rahmân ve Rahîm", 110, 168);

    const url = c.toDataURL("image/jpeg", 0.85);
    styleThumbCache.set(key, url);
    return url;
  }

  function getAllZeminItems() {
    return [...galleryItems, ...MINIMAL_FALLBACK_CATALOG];
  }

  function getZeminById(id) {
    return getAllZeminItems().find((item) => item.id === id) || galleryItems[0] || MINIMAL_FALLBACK_CATALOG[0];
  }

  // Updates the Video Range (MM:SS + Sliders) UI whenever a video is loaded or trimmed
  function syncVideoTrimControlsUI() {
    const startSec = Math.max(0, Number(state.videoTrimStart) || 0);
    const endSec = Math.max(0, Number(state.videoTrimEnd) || 0);
    const dur = (Number.isFinite(activeBgVideoDuration) && activeBgVideoDuration > 0)
      ? Math.round(activeBgVideoDuration)
      : 0;

    const inpStart = document.getElementById("inpTrimStartMMSS");
    const inpEnd = document.getElementById("inpTrimEndMMSS");
    if (inpStart && document.activeElement !== inpStart) {
      inpStart.value = formatMMSS(startSec);
    }
    if (inpEnd && document.activeElement !== inpEnd) {
      inpEnd.value = endSec > 0 ? formatMMSS(endSec) : "00:00";
    }

    const rngStart = document.getElementById("rngTrimStartSec");
    const rngEnd = document.getElementById("rngTrimEndSec");
    // Always allow at least 600s (10:00) on sliders so user is never locked to 20s!
    const maxSlider = Math.max(600, dur, endSec + 60, startSec + 120);
    if (rngStart) {
      rngStart.max = String(maxSlider);
      rngStart.value = String(Math.min(maxSlider, Math.round(startSec)));
    }
    if (rngEnd) {
      rngEnd.max = String(maxSlider);
      rngEnd.value = String(Math.min(maxSlider, Math.round(endSec)));
    }

    const lblStart = document.getElementById("valTrimStartLabel");
    const lblEnd = document.getElementById("valTrimEndLabel");
    if (lblStart) lblStart.textContent = formatMMSS(startSec);
    if (lblEnd) {
      lblEnd.textContent = endSec > startSec ? formatMMSS(endSec) : (dur > 0 ? `Sonu (${formatMMSS(dur)})` : "Tamamı");
    }

    const lblTotal = document.getElementById("lblBgVideoTotalDur");
    if (lblTotal) {
      if (activeBgVideo) {
        const effEnd = endSec > startSec ? endSec : (dur > 0 ? dur : 0);
        const clipLen = effEnd > startSec ? (effEnd - startSec) : 0;
        if (effEnd > 0) {
          lblTotal.textContent = `Seçili: ${formatMMSS(startSec)}–${formatMMSS(effEnd)} (${formatMMSS(clipLen)})`;
        } else {
          lblTotal.textContent = dur > 0 ? `Video Süresi: ${formatMMSS(dur)}` : "Video Hazır";
        }
      } else {
        lblTotal.textContent = "Galerim'den video seçin";
      }
    }
  }

  // Persists trimStart and trimEnd onto the active Galerim item in IndexedDB so each uploaded video remembers its own 00:30-01:45 range
  async function persistActiveVideoTrimToGallery() {
    const item = galleryItems.find((g) => g.id === state.zeminId);
    if (item && item.type === "video") {
      item.trimStart = state.videoTrimStart;
      item.trimEnd = state.videoTrimEnd;
      await saveGalleryItem(item);
      renderZeminGrid();
    }
  }

  async function selectZemin(id, isInitialRestore = false) {
    const item = getZeminById(id);
    state.zeminId = item ? item.id : "studio_dark";

    if (activeBgVideo) {
      try {
        activeBgVideo.pause();
        activeBgVideo.removeAttribute("src");
        activeBgVideo.load();
      } catch (_) {}
      activeBgVideo = null;
    }
    activeBgImage = null;
    activeBgVideoDuration = 0;
    revokeActiveMediaUrls();

    if (item && item.type === "image") {
      const img = new Image();
      let srcUrl = item.src;
      if (item.blob) {
        srcUrl = URL.createObjectURL(item.blob);
        activeObjectUrls.push(srcUrl);
      } else if (srcUrl && !srcUrl.startsWith("data:")) {
        img.crossOrigin = "anonymous";
      }
      img.onload = () => { activeBgImage = img; };
      img.onerror = () => { activeBgImage = null; };
      if (srcUrl) img.src = srcUrl;
    } else if (item && item.type === "video") {
      // Restore this video's saved trim range if present
      if (typeof item.trimStart === "number") state.videoTrimStart = item.trimStart;
      if (typeof item.trimEnd === "number") state.videoTrimEnd = item.trimEnd;

      const vid = document.createElement("video");
      let srcUrl = item.src;
      if (item.blob) {
        srcUrl = URL.createObjectURL(item.blob);
        activeObjectUrls.push(srcUrl);
      } else if (srcUrl && !srcUrl.startsWith("data:")) {
        vid.crossOrigin = "anonymous";
      }
      vid.playsInline = true;
      vid.loop = true;
      vid.playbackRate = Number(state.bgVideoSpeed) || 1.0;
      vid.muted = (state.videoAudioMode === "muted" || state.bgVideoVol <= 0);
      vid.src = srcUrl;
      const refreshVidDuration = () => {
        if (Number.isFinite(vid.duration) && vid.duration > 0) {
          activeBgVideoDuration = Math.max(activeBgVideoDuration || 0, vid.duration);
          if (item.duration !== activeBgVideoDuration) {
            item.duration = activeBgVideoDuration;
            saveGalleryItem(item);
          }
          syncVideoTrimControlsUI();
          renderZeminGrid();
        }
      };
      vid.ondurationchange = refreshVidDuration;
      vid.onloadedmetadata = () => {
        refreshVidDuration();
        vid.playbackRate = Number(state.bgVideoSpeed) || 1.0;
        const tStart = Math.max(0, Number(state.videoTrimStart) || 0);
        if (tStart > 0 && Number.isFinite(vid.duration) && vid.duration > 0) {
          vid.currentTime = tStart < vid.duration ? tStart : (tStart % vid.duration);
        }
        syncVideoTrimControlsUI();
        renderZeminGrid();
        connectBgVideoToGraph(vid, state);
        vid.play().catch(() => {});
      };
      vid.ontimeupdate = () => {
        if (Number.isFinite(vid.duration) && vid.duration > activeBgVideoDuration) {
          refreshVidDuration();
        }
        const tStart = Math.max(0, Number(state.videoTrimStart) || 0);
        const tEnd = Number(state.videoTrimEnd) || 0;
        const vDur = (Number.isFinite(vid.duration) && vid.duration > 0) ? vid.duration : 0;
        const effStart = (vDur > 0 && tStart >= vDur) ? (tStart % vDur) : tStart;
        if (tEnd > tStart && (vDur === 0 || tEnd <= vDur) && vid.currentTime >= tEnd) {
          vid.currentTime = effStart;
          if (vid.paused && (state.isPlaying || state.isRecording)) {
            vid.play().catch(() => {});
          }
        } else if (effStart > 0 && vid.currentTime < effStart - 0.25) {
          vid.currentTime = effStart;
        }
      };
      activeBgVideo = vid;
    }

    syncVideoTrimControlsUI();
    renderZeminGrid();
    if (!isInitialRestore) persistState();
  }

  function renderStylePresetsGrid() {
    const grid = document.getElementById("stylePresetGrid");
    if (!grid) return;
    grid.innerHTML = "";

    STYLE_PRESETS.forEach((st) => {
      const card = document.createElement("div");
      card.className = "zemin-card" + (state.stylePresetId === st.id ? " active" : "");

      const img = document.createElement("img");
      img.className = "zemin-thumb";
      img.alt = st.name;
      img.src = generateStyleCardPreview(st);

      const badge = document.createElement("span");
      badge.className = "zemin-badge";
      badge.textContent = st.sub;

      const label = document.createElement("div");
      label.className = "zemin-label";
      label.textContent = st.name;

      card.appendChild(img);
      card.appendChild(badge);
      card.appendChild(label);

      card.addEventListener("click", () => {
        hapticTap();
        state.stylePresetId = st.id;
        if (!state.lockBgDim && typeof st.bgDim === "number") state.bgDim = st.bgDim;
        if (typeof st.bgWarmth === "number") state.bgWarmth = st.bgWarmth;
        if (st.arabicFont) state.arabicFont = st.arabicFont;
        if (st.arabicColor) state.arabicColor = st.arabicColor;
        if (st.mealColor) state.mealColor = st.mealColor;
        if (st.enMealColor) state.enMealColor = st.enMealColor;
        if (st.wordHighlightColor) state.wordHighlightColor = st.wordHighlightColor;
        if (st.wordHighlightStyle) state.wordHighlightStyle = st.wordHighlightStyle;
        if (st.textBoxStyle) state.textBoxStyle = st.textBoxStyle;
        applyMealStyleById(st.mealStyle, false);

        syncAllControlsFromState();
        persistState();
        showToast(`"${st.name}" yazı ve atmosfer stili uygulandı.`);
      });

      grid.appendChild(card);
    });
  }

  function renderKnownExcerptsList() {
    const list = document.getElementById("knownExcerptsList");
    if (!list) return;
    list.innerHTML = "";

    KNOWN_EXCERPTS.forEach((ex) => {
      const isAct = (state.surahNo === ex.surahNo && state.ayahStart === ex.start && state.ayahEnd === ex.end);
      const item = document.createElement("div");
      item.className = "sebat-list-item" + (isAct ? " active" : "");

      item.innerHTML = `
        <div class="sebat-item-left">
          <div class="sebat-item-title">${ex.title}</div>
          <div class="sebat-item-sub">${ex.sub}</div>
        </div>
        <div class="sebat-item-ar" dir="rtl">${ex.arName}</div>
      `;

      item.addEventListener("click", async () => {
        hapticTap();
        state.surahNo = ex.surahNo;
        populateAyahRangeSelectors(false);
        state.ayahStart = ex.start;
        state.ayahEnd = ex.end;
        document.getElementById("selSurah").value = String(ex.surahNo);
        document.getElementById("selAyahStart").value = String(ex.start);
        document.getElementById("selAyahEnd").value = String(ex.end);
        renderKnownExcerptsList();
        persistState();
        await loadVersesAndPreloadAudio();
        showToast(`${ex.title} yüklendi.`);
      });

      list.appendChild(item);
    });
  }

  function renderRecitersList() {
    const wrap = document.getElementById("recitersListWrap");
    if (!wrap) return;
    wrap.innerHTML = "";

    const q = (state.reciterSearch || "").trim().toLowerCase();
    const filtered = RECITERS.filter((r) => !q || r.name.toLowerCase().includes(q) || r.tag.toLowerCase().includes(q));

    let currentGroup = "";
    filtered.forEach((rec) => {
      if (rec.group !== currentGroup && !q) {
        currentGroup = rec.group;
        const grp = document.createElement("div");
        grp.style.cssText = "font-size:10.5px;font-weight:700;color:var(--gold-light);padding:3px 4px 1px;";
        grp.textContent = currentGroup;
        wrap.appendChild(grp);
      }

      const item = document.createElement("div");
      item.className = "sebat-list-item" + (state.reciterId === rec.id ? " active" : "");
      item.innerHTML = `
        <div class="sebat-item-left">
          <div class="sebat-item-title">${rec.name}</div>
          <div class="sebat-item-sub">${rec.tag}</div>
        </div>
        <span style="color:var(--gold-bright);font-size:13px;">${state.reciterId === rec.id ? "●" : ""}</span>
      `;

      item.addEventListener("click", async () => {
        hapticTap();
        state.reciterId = rec.id;
        renderRecitersList();
        persistState();
        await loadVersesAndPreloadAudio();
        showToast(`Hâfız: ${rec.name}`);
      });

      wrap.appendChild(item);
    });
  }

  // Renders ONLY the user's Galerim items + the single clean Sade Stüdyo Zemini card
  function renderZeminGrid() {
    const grid = document.getElementById("zeminGrid");
    if (!grid) return;
    grid.innerHTML = "";

    const lblTitle = document.getElementById("lblGalleryCountTitle");
    if (lblTitle) {
      lblTitle.textContent = galleryItems.length > 0
        ? `GALERİM (${galleryItems.length} MEDYA YÜKLENDİ)`
        : "GALERİM (KENDİ VİDEO & GÖRSELLERİM)";
    }

    const items = getAllZeminItems();

    items.forEach((item) => {
      const card = document.createElement("div");
      card.className = "zemin-card" + (item.id === state.zeminId ? " active" : "");

      const img = document.createElement("img");
      img.className = "zemin-thumb";
      img.alt = item.name;
      const fallbackUrl = generateStyleCardPreview(STYLE_PRESETS[0]);
      img.src = item.thumbDataUrl || fallbackUrl;
      img.onerror = () => { img.onerror = null; img.src = fallbackUrl; };

      const badge = document.createElement("span");
      badge.className = "zemin-badge";
      if (item.type === "video") {
        const ts = Number(item.trimStart) || 0;
        const te = Number(item.trimEnd) || 0;
        if (ts > 0 || te > 0) {
          badge.textContent = `✂️ ${formatMMSS(ts)}–${te > 0 ? formatMMSS(te) : "Son"}`;
        } else if (item.duration) {
          badge.textContent = `VİDEO · ${formatMMSS(item.duration)}`;
        } else {
          badge.textContent = "VİDEO";
        }
      } else if (item.type === "image") {
        badge.textContent = "GÖRSEL";
      } else {
        badge.textContent = "VARSAYILAN";
      }

      const label = document.createElement("div");
      label.className = "zemin-label";
      label.textContent = item.name;

      card.appendChild(img);
      card.appendChild(badge);
      card.appendChild(label);

      if (item.id !== "studio_dark") {
        const delBtn = document.createElement("button");
        delBtn.type = "button";
        delBtn.className = "zemin-del-btn";
        delBtn.textContent = "✕";
        delBtn.addEventListener("click", async (ev) => {
          ev.stopPropagation();
          hapticTap();
          await deleteGalleryItem(item.id);
          galleryItems = await getAllGalleryItems();
          if (state.zeminId === item.id) {
            await selectZemin(galleryItems[0] ? galleryItems[0].id : "studio_dark");
          } else {
            renderZeminGrid();
          }
          refreshStorageStatsUI();
          showToast("Galerim'den silindi.");
        });
        card.appendChild(delBtn);
      }

      card.addEventListener("click", () => {
        hapticTap();
        selectZemin(item.id);
      });

      grid.appendChild(card);
    });
  }

  function renderAmbientSoundList() {
    const list = document.getElementById("ambientSoundList");
    if (!list) return;
    list.innerHTML = "";

    AMBIENT_SOUNDS.forEach((amb) => {
      const isAct = state.ambientType === amb.id;
      const item = document.createElement("div");
      item.className = "sebat-list-item" + (isAct ? " active" : "");
      item.innerHTML = `
        <div class="sebat-item-left">
          <div class="sebat-item-title">${amb.icon} ${amb.name}</div>
          <div class="sebat-item-sub">${amb.sub}</div>
        </div>
        <span style="color:var(--gold-bright);font-size:13px;">${isAct ? "●" : ""}</span>
      `;
      item.addEventListener("click", () => {
        hapticTap();
        state.ambientType = amb.id;
        if (amb.id !== "none" && state.ambientVol === 0) {
          state.ambientVol = 22;
          document.getElementById("rngAmbientVol").value = 22;
          document.getElementById("valAmbientVol").textContent = "%22";
        }
        renderAmbientSoundList();
        if (state.isPlaying || state.isRecording) {
          startAmbientSound(state);
        }
        persistState();
      });
      list.appendChild(item);
    });
  }

  function renderSwatchGroup(containerId, swatches, currentHex, labelId, inputId, onSelectHex) {
    const row = document.getElementById(containerId);
    if (!row) return;
    row.innerHTML = "";
    swatches.forEach((sw) => {
      const btn = document.createElement("button");
      btn.type = "button";
      const isAct = (currentHex || "").toUpperCase() === sw.hex.toUpperCase();
      btn.className = "color-swatch-circle" + (isAct ? " active" : "");
      btn.style.backgroundColor = sw.hex;
      btn.title = sw.name;
      if (isAct) {
        const lbl = document.getElementById(labelId);
        if (lbl) lbl.textContent = sw.name;
      }
      btn.addEventListener("click", () => {
        hapticTap();
        onSelectHex(sw.hex, sw.name);
        const lbl = document.getElementById(labelId);
        if (lbl) lbl.textContent = sw.name;
        const inp = document.getElementById(inputId);
        if (inp) inp.value = sw.hex;
        renderColorSwatches();
        persistState();
      });
      row.appendChild(btn);
    });
  }

  function renderColorSwatches() {
    renderSwatchGroup(
      "arabicColorSwatches",
      ARABIC_COLOR_SWATCHES,
      state.arabicColor,
      "lblArabicColorName",
      "inpArabicColor",
      (hex) => { state.arabicColor = hex; }
    );
    renderSwatchGroup(
      "mealColorSwatches",
      MEAL_COLOR_SWATCHES,
      state.mealColor,
      "lblMealColorName",
      "inpMealColor",
      (hex) => { state.mealColor = hex; }
    );
    renderSwatchGroup(
      "enColorSwatches",
      EN_COLOR_SWATCHES,
      state.enMealColor,
      "lblEnColorName",
      "inpEnMealColor",
      (hex) => { state.enMealColor = hex; }
    );
    renderSwatchGroup(
      "highlightColorSwatches",
      HIGHLIGHT_COLOR_SWATCHES,
      state.wordHighlightColor,
      "lblHighlightColorName",
      "inpHighlightColor",
      (hex) => { state.wordHighlightColor = hex; }
    );
  }

  function applyMealStyleById(styleId, shouldPersist = true) {
    const st = MEAL_TEXT_STYLES.find((m) => m.id === styleId) || MEAL_TEXT_STYLES[4];
    state.mealStyle = st.id;
    state.mealFont = st.font;
    state.mealWeight = st.weight;
    state.mealItalic = st.italic;
    document.querySelectorAll("#mealStyleGroup .sebat-opt-btn").forEach((b) => {
      b.classList.toggle("active", b.dataset.mstyle === st.id);
    });
    ensureFontsLoaded();
    if (shouldPersist) persistState();
  }

  function renderAyahTimelineStrip() {
    const strip = document.getElementById("ayahTimelineStrip");
    if (!strip) return;
    strip.innerHTML = "";

    const coverBtn = document.createElement("button");
    coverBtn.type = "button";
    const isCoverActive = state.coverPreviewMode === "cover";
    coverBtn.className = "ayah-tl-block cover-tl-block" + (isCoverActive ? " active" : "");
    coverBtn.innerHTML = `
      <span class="ayah-tl-num">🖼 Kapak</span>
      <span class="ayah-tl-dur">${state.coverFirstFrame === "on" ? "1.2s" : "Önizle"}</span>
    `;
    coverBtn.addEventListener("click", () => {
      hapticTap();
      state.coverPreviewMode = state.coverPreviewMode === "cover" ? "ayah" : "cover";
      const chk = document.getElementById("chkPreviewCoverNow");
      if (chk) chk.checked = (state.coverPreviewMode === "cover");
      renderAyahTimelineStrip();
      persistState(false);
    });
    strip.appendChild(coverBtn);

    if (!state.versesLoaded || state.verses.length === 0) return;

    state.verses.forEach((v, idx) => {
      const btn = document.createElement("button");
      btn.type = "button";
      const isAct = (state.coverPreviewMode !== "cover" && idx === state.activeVerseIdx);
      btn.className = "ayah-tl-block" + (isAct ? " active" : "");

      const firstWords = (v.arabic || "").split(/\s+/).slice(0, 2).join(" ");
      const dur = state.audioDurations[idx] ? `${state.audioDurations[idx].toFixed(1)}s` : "";

      btn.innerHTML = `
        <span class="ayah-tl-num">${v.numberInSurah}</span>
        <span class="ayah-tl-ar" dir="rtl">${firstWords}</span>
        ${dur ? `<span class="ayah-tl-dur">${dur}</span>` : ""}
      `;

      btn.addEventListener("click", () => {
        hapticTap();
        state.coverPreviewMode = "ayah";
        const chk = document.getElementById("chkPreviewCoverNow");
        if (chk) chk.checked = false;
        jumpToVerseIndex(idx);
      });

      strip.appendChild(btn);
    });
  }

  function jumpToVerseIndex(idx) {
    if (!state.versesLoaded || idx < 0 || idx >= state.verses.length) return;
    state.activeVerseIdx = idx;
    state.verseStartTime = performance.now();
    state.activeVerseElapsed = 0;

    let passed = state.coverFirstFrame === "on" ? 1.2 : 0;
    for (let i = 0; i < idx; i++) {
      passed += Math.max(0.4, (state.audioDurations[i] || 5) - state.gaplessTrimSec);
    }
    state.elapsedTime = passed;
    document.getElementById("lblCurrentTime").textContent = formatPreciseTime(state.elapsedTime);
    const pct = state.totalDuration > 0 ? Math.min(100, (state.elapsedTime / state.totalDuration) * 100) : 0;
    document.getElementById("progressBarFill").style.width = `${pct}%`;

    renderAyahTimelineStrip();
  }

  function renderCoverTemplateChips() {
    const wrap = document.getElementById("coverTemplateChips");
    if (!wrap) return;
    wrap.innerHTML = "";
    COVER_TEMPLATES.forEach((tpl) => {
      const chip = document.createElement("button");
      chip.type = "button";
      chip.className = "chip" + (state.coverTemplateId === tpl.id ? " active" : "");
      chip.textContent = tpl.name;
      chip.addEventListener("click", () => {
        hapticTap();
        state.coverTemplateId = tpl.id;
        state.coverPreviewMode = "cover";
        const chk = document.getElementById("chkPreviewCoverNow");
        if (chk) chk.checked = true;
        renderCoverTemplateChips();
        renderAyahTimelineStrip();
        persistState();
      });
      wrap.appendChild(chip);
    });
  }

  function renderCoverAyahCircles() {
    const wrap = document.getElementById("coverAyahCircles");
    if (!wrap) return;
    wrap.innerHTML = "";

    const start = state.ayahStart || 1;
    const end = state.ayahEnd || 1;
    if (state.coverAyahNo < start || state.coverAyahNo > end) {
      state.coverAyahNo = start;
    }

    for (let a = start; a <= end; a++) {
      const btn = document.createElement("button");
      btn.type = "button";
      btn.className = "circle-num-btn" + (state.coverAyahNo === a ? " active" : "");
      btn.textContent = String(a);
      btn.addEventListener("click", () => {
        hapticTap();
        state.coverAyahNo = a;
        state.coverPreviewMode = "cover";
        const chk = document.getElementById("chkPreviewCoverNow");
        if (chk) chk.checked = true;
        renderCoverAyahCircles();
        renderAyahTimelineStrip();
        persistState();
      });
      wrap.appendChild(btn);
    }
  }

  function renderUserPresetsList() {
    const sel = document.getElementById("selUserPreset");
    if (!sel) return;
    sel.innerHTML = "";
    const presets = Array.isArray(state.userPresets) ? state.userPresets : [];
    if (presets.length === 0) {
      const opt = document.createElement("option");
      opt.value = "";
      opt.textContent = "Kayıtlı ön ayar yok";
      sel.appendChild(opt);
      return;
    }
    presets.forEach((p, idx) => {
      const opt = document.createElement("option");
      opt.value = String(idx);
      opt.textContent = p.name || `Ön Ayar #${idx + 1}`;
      sel.appendChild(opt);
    });
  }

  async function createCompactThumbAndMetaFromMedia(blob) {
    const isVideo = (blob.type && blob.type.startsWith("video/")) || /\.(mp4|mov|webm|mkv|m4v|3gp|avi)$/i.test(blob.name || "");
    const tempUrl = URL.createObjectURL(blob);
    try {
      if (!isVideo) {
        const img = new Image();
        await new Promise((res, rej) => {
          img.onload = res;
          img.onerror = rej;
          img.src = tempUrl;
        });
        const tc = document.createElement("canvas");
        tc.width = 280;
        tc.height = 498;
        const srcW = img.naturalWidth || 720;
        const srcH = img.naturalHeight || 1280;
        const s = Math.max(280 / srcW, 498 / srcH);
        tc.getContext("2d").drawImage(img, (280 - srcW * s) / 2, (498 - srcH * s) / 2, srcW * s, srcH * s);
        return { thumbDataUrl: tc.toDataURL("image/jpeg", 0.75), duration: 0 };
      } else {
        const vid = document.createElement("video");
        vid.muted = true;
        vid.playsInline = true;
        vid.src = tempUrl;
        await new Promise((res) => {
          vid.onloadeddata = () => {
            vid.currentTime = Math.min(0.5, (vid.duration || 1) * 0.1);
          };
          vid.onseeked = res;
          vid.onerror = res;
          setTimeout(res, 1800);
        });
        const tc = document.createElement("canvas");
        tc.width = 280;
        tc.height = 498;
        const vw = vid.videoWidth || 720;
        const vh = vid.videoHeight || 1280;
        const s = Math.max(280 / vw, 498 / vh);
        tc.getContext("2d").drawImage(vid, (280 - vw * s) / 2, (498 - vh * s) / 2, vw * s, vh * s);
        return { thumbDataUrl: tc.toDataURL("image/jpeg", 0.75), duration: Math.round(vid.duration || 0) };
      }
    } catch (_) {
      return { thumbDataUrl: generateStyleCardPreview(STYLE_PRESETS[0]), duration: 0 };
    } finally {
      URL.revokeObjectURL(tempUrl);
    }
  }

  async function processUploadedFile(file) {
    const isVideo = (file.type && file.type.startsWith("video/")) || /\.(mp4|mov|webm|mkv|m4v|3gp|avi)$/i.test(file.name || "");
    const meta = await createCompactThumbAndMetaFromMedia(file);
    return {
      id: "gal_" + Date.now() + "_" + Math.random().toString(36).slice(2, 6),
      name: file.name.replace(/\.[^.]+$/, "").slice(0, 22),
      type: isVideo ? "video" : "image",
      category: "Galerim",
      blob: file,
      thumbDataUrl: meta.thumbDataUrl,
      duration: meta.duration,
      trimStart: 0,
      trimEnd: 0,
      recommendedDarkness: 40,
      defaultEffect: "none",
      palette: ["#07080A", "#12151C", "#E0B84C"]
    };
  }

  function cleanLeadingBismillah(text, surahNo, ayahNo) {
    if (surahNo === 1 || surahNo === 9 || ayahNo !== 1) return text;
    if (state.bismillahMode === "first_only") return text;
    const patterns = [
      /^بِسْمِ ٱللَّهِ ٱلرَّحْمَـٰنِ ٱلرَّحِيمِ\s*/,
      /^بِسْمِ اللَّهِ الرَّحْمَٰنِ الرَّحِيمِ\s*/
    ];
    let cleaned = text;
    for (const p of patterns) cleaned = cleaned.replace(p, "");
    return cleaned.trim() || text;
  }

  let currentLoadToken = 0;
  function revokePreloadedAudioUrls() {
    while (state.audioObjectUrls.length > 0) {
      const u = state.audioObjectUrls.pop();
      try { URL.revokeObjectURL(u); } catch (_) {}
    }
  }

  async function loadVersesAndPreloadAudio() {
    const token = ++currentLoadToken;
    stopPlaybackAndRecording(true);
    revokePreloadedAudioUrls();

    state.versesLoaded = false;
    state.versesOfflineError = "";
    state.audioReady = false;
    state.textOnlyMode = false;
    state.audioStatuses = [];
    state.audioElements = [];
    state.audioDurations = [];

    const errBox = document.getElementById("ayahAudioAlertBox");
    if (errBox) errBox.style.display = "none";

    const lblState = document.getElementById("lblAudioReadyState");
    if (lblState) lblState.textContent = "Yükleniyor...";

    const btnPlay = document.getElementById("btnPlayPreview");
    const btnRec = document.getElementById("btnRecordExport");
    if (btnPlay) btnPlay.disabled = true;
    if (btnRec) btnRec.disabled = true;
    updateStageBadge("loading", "Hazırlanıyor...");

    const sNo = state.surahNo;
    const start = state.ayahStart;
    const end = state.ayahEnd;

    let loadedVerses = null;
    let fromOfflineCache = false;

    try {
      const url = `https://api.alquran.cloud/v1/surah/${sNo}/editions/quran-uthmani,tr.diyanet,tr.yazir,tr.vakfi,en.sahih`;
      const res = await fetch(url);
      if (!res.ok) throw new Error("API HTTP " + res.status);
      const json = await res.json();
      if (!json || !Array.isArray(json.data) || json.data.length < 5) throw new Error("Invalid API data");

      const arAyahs = json.data[0].ayahs;
      const trDiyanet = json.data[1].ayahs;
      const trYazir = json.data[2].ayahs;
      const trVakfi = json.data[3].ayahs;
      const enSahih = json.data[4].ayahs;

      const verses = [];
      for (let a = start; a <= end; a++) {
        const idx = a - 1;
        if (!arAyahs[idx]) continue;
        verses.push({
          numberInSurah: a,
          arabic: cleanLeadingBismillah(arAyahs[idx].text, sNo, a),
          tr: trDiyanet[idx] ? trDiyanet[idx].text : "",
          tr_yazir: trYazir[idx] ? trYazir[idx].text : "",
          tr_vakfi: trVakfi[idx] ? trVakfi[idx].text : "",
          en: enSahih[idx] ? enSahih[idx].text : ""
        });
      }
      if (verses.length === 0) throw new Error("Empty range");
      loadedVerses = verses;
      await cacheVersesToDB(sNo, verses);
      refreshStorageStatsUI();
    } catch (_) {
      if (token !== currentLoadToken) return;
      const cached = await getCachedVersesRange(sNo, start, end);
      if (cached.ok) {
        loadedVerses = cached.verses;
        fromOfflineCache = true;
      } else {
        state.verses = [];
        state.versesLoaded = false;
        const surahMeta = SURAHS.find((s) => s[0] === sNo) || SURAHS[0];
        state.versesOfflineError = `${surahMeta[1]} Sûresi ${start}–${end}. ayet metinleri henüz çevrimdışı önbelleğe indirilmedi.`;
        if (lblState) lblState.textContent = "Bu ayet henüz indirilmedi (Çevrimdışı)";
        updateStageBadge("error", "Çevrimdışı Eksik");
        return;
      }
    }

    if (token !== currentLoadToken) return;
    state.verses = loadedVerses;
    state.versesLoaded = true;
    state.activeVerseIdx = 0;
    renderCoverAyahCircles();
    renderAyahTimelineStrip();

    const audioResults = await Promise.all(
      state.verses.map((v) => loadSingleAyahAudio(sNo, v.numberInSurah, state.reciterId))
    );
    if (token !== currentLoadToken) return;

    state.audioStatuses = audioResults;
    state.audioElements = audioResults.map((r) => r.audio);
    state.audioDurations = audioResults.map((r) => r.duration);
    audioResults.forEach((r) => {
      if (r.objectUrl) state.audioObjectUrls.push(r.objectUrl);
    });

    const failedItems = audioResults.filter((r) => !r.ok);

    if (failedItems.length === 0) {
      let total = state.coverFirstFrame === "on" ? 1.2 : 0;
      for (let i = 0; i < state.audioDurations.length; i++) {
        const isLast = (i === state.audioDurations.length - 1);
        const eff = isLast
          ? state.audioDurations[i]
          : Math.max(0.4, state.audioDurations[i] - state.gaplessTrimSec);
        total += eff;
      }
      state.totalDuration = total;
      state.audioReady = true;

      document.getElementById("lblTotalDuration").textContent = formatPreciseTime(total);
      document.getElementById("lblCurrentTime").textContent = "00:00.0";
      if (lblState) {
        lblState.textContent = `✓ Hazır (${state.audioDurations.length} âyet · ${formatShortTime(total)}${fromOfflineCache ? " · Çevrimdışı" : ""})`;
      }
      if (btnPlay) btnPlay.disabled = false;
      if (btnRec) btnRec.disabled = false;
      updateStageBadge("ready", "Hazır");
    } else {
      state.audioReady = false;
      if (errBox) {
        errBox.style.display = "flex";
        const failListEl = document.getElementById("ayahAudioFailList");
        if (failListEl) {
          failListEl.innerHTML = failedItems
            .map((f) => `<div>• ${sNo}. Sûre ${f.ayahNo}. âyet sesi yüklenemedi.</div>`)
            .join("");
        }
      }
      if (state.audioFailPolicy === "text_only") {
        enableTextOnlyContinueMode();
      } else {
        if (lblState) lblState.textContent = `${failedItems.length} âyetin sesi yüklenemedi.`;
        updateStageBadge("error", "Ses Eksik");
      }
    }

    renderAyahTimelineStrip();
    updateHeaderAndBottomSummary();
    updateSocialCaptionText();
  }

  function enableTextOnlyContinueMode() {
    if (!state.versesLoaded || state.verses.length === 0) return;
    state.textOnlyMode = true;
    state.audioReady = true;
    state.audioDurations = state.verses.map((v) => {
      const wordCount = (v.arabic || "").split(/\s+/).filter(Boolean).length;
      return Math.max(4.2, Math.min(18, wordCount * 0.75 + 2.5));
    });

    let total = state.coverFirstFrame === "on" ? 1.2 : 0;
    for (const d of state.audioDurations) total += d;
    state.totalDuration = total;

    document.getElementById("lblTotalDuration").textContent = formatPreciseTime(total);
    document.getElementById("lblAudioReadyState").textContent = `Sadece Metin Modu (${state.verses.length} âyet · ${formatShortTime(total)})`;
    document.getElementById("btnPlayPreview").disabled = false;
    document.getElementById("btnRecordExport").disabled = false;
    renderAyahTimelineStrip();
    updateHeaderAndBottomSummary();
    updateStageBadge("ready", "Metin Modu Hazır");
    showToast("Sadece metin modu etkinleştirildi.");
  }

  function updateStageBadge(mode, text) {
    const dot = document.getElementById("recDot");
    const spinner = document.getElementById("stageSpinner");
    const lbl = document.getElementById("stageStatusLabel");
    if (lbl) lbl.textContent = text;
    if (!dot || !spinner) return;

    if (mode === "loading") {
      dot.style.display = "none";
      spinner.style.display = "inline-block";
    } else {
      spinner.style.display = "none";
      dot.style.display = "inline-block";
      dot.className = "rec-dot" + (mode === "recording" ? " recording" : mode === "error" ? " error" : "");
    }
  }

  // Canvas Studio Drawing Engine
  const canvas = document.getElementById("studioCanvas");
  const ctx = canvas.getContext("2d");

  let isDraggingCanvasText = false;
  let activeDragBlockKey = null; // "ar" | "tr" | "en" | "all" | "cover"
  let snapGuideX = false;
  let snapGuideY = false;
  const lastRenderedBlocks = {
    ar: null,
    tr: null,
    en: null
  };

  function wrapCanvasText(context, text, maxWidth) {
    if (!text) return [];
    const words = text.split(/\s+/);
    const lines = [];
    let current = "";
    for (const word of words) {
      const test = current ? current + " " + word : word;
      if (context.measureText(test).width > maxWidth && current) {
        lines.push(current);
        current = word;
      } else {
        current = test;
      }
    }
    if (current) lines.push(current);
    return lines;
  }

  function getSelectedMealText(verse) {
    if (!verse) return "";
    if (state.mealEdition === "tr.yazir") return verse.tr_yazir || verse.tr || "";
    if (state.mealEdition === "tr.vakfi") return verse.tr_vakfi || verse.tr || "";
    return verse.tr || "";
  }

  function drawRoundedBox(context, x, y, width, height, radius, fill, stroke) {
    context.save();
    context.beginPath();
    if (context.roundRect) {
      context.roundRect(x, y, width, height, radius);
    } else {
      context.rect(x, y, width, height);
    }
    if (fill) {
      context.fillStyle = fill;
      context.fill();
    }
    if (stroke) {
      context.strokeStyle = stroke;
      context.lineWidth = 1.5;
      context.stroke();
    }
    context.restore();
  }

  // Unified Cover Scene — Zero Duplicate "Sûre" & Independent Arabic/Turkish Surah Name Controls!
  function drawUnifiedCoverScene(w, h, scaleFactor) {
    const surahMeta = SURAHS.find((s) => s[0] === state.surahNo) || SURAHS[0];
    const reciterMeta = RECITERS.find((r) => r.id === state.reciterId) || RECITERS[0];
    const tpl = COVER_TEMPLATES.find((t) => t.id === state.coverTemplateId) || COVER_TEMPLATES[0];
    const coverVerse = state.verses.find((v) => v.numberInSurah === state.coverAyahNo) || state.verses[0];

    ctx.save();

    if (state.coverBgOverride !== "same") {
      const g = ctx.createRadialGradient(w / 2, h * 0.42, 20, w / 2, h / 2, Math.max(w, h) * 0.78);
      if (state.coverBgOverride === "dark_emerald") {
        g.addColorStop(0, "rgba(14, 48, 38, 0.94)");
        g.addColorStop(1, "rgba(4, 12, 9, 0.98)");
      } else if (state.coverBgOverride === "pure_black") {
        g.addColorStop(0, "rgba(22, 20, 16, 0.94)");
        g.addColorStop(1, "rgba(4, 5, 7, 0.98)");
      } else {
        g.addColorStop(0, "rgba(18, 32, 62, 0.94)");
        g.addColorStop(1, "rgba(5, 9, 18, 0.98)");
      }
      ctx.fillStyle = g;
      ctx.fillRect(0, 0, w, h);
    } else {
      ctx.fillStyle = "rgba(4, 6, 8, 0.28)";
      ctx.fillRect(0, 0, w, h);
    }

    const cScale = ((state.coverScale || 100) / 100) * scaleFactor;
    const pad = 42 * scaleFactor;

    if (tpl.border) {
      ctx.strokeStyle = tpl.accent + "77";
      ctx.lineWidth = 2.2 * scaleFactor;
      ctx.strokeRect(pad, pad, w - pad * 2, h - pad * 2);
      ctx.strokeStyle = tpl.accent + "33";
      ctx.lineWidth = 1 * scaleFactor;
      ctx.strokeRect(pad + 10 * scaleFactor, pad + 10 * scaleFactor, w - (pad + 10 * scaleFactor) * 2, h - (pad + 10 * scaleFactor) * 2);
    }

    if (tpl.arch) {
      ctx.strokeStyle = tpl.accent + "66";
      ctx.lineWidth = 2.8 * scaleFactor;
      ctx.beginPath();
      ctx.moveTo(pad + 18 * scaleFactor, h - pad - 18 * scaleFactor);
      ctx.lineTo(pad + 18 * scaleFactor, h * 0.34);
      ctx.quadraticCurveTo(pad + 18 * scaleFactor, pad + 26 * scaleFactor, w / 2, pad + 18 * scaleFactor);
      ctx.quadraticCurveTo(w - pad - 18 * scaleFactor, pad + 26 * scaleFactor, w - pad - 18 * scaleFactor, h * 0.34);
      ctx.lineTo(w - pad - 18 * scaleFactor, h - pad - 18 * scaleFactor);
      ctx.stroke();
    }

    let baseCenterY = h * 0.50;
    if (state.coverPos === "top") baseCenterY = h * 0.34;
    else if (state.coverPos === "bottom") baseCenterY = h * 0.66;

    const centerX = w * 0.5 + ((state.coverOffsetX || 0) / 100) * w;
    const centerY = baseCenterY + ((state.coverOffsetY || 0) / 100) * h;

    ctx.textAlign = "center";
    ctx.textBaseline = "middle";
    ctx.shadowColor = "rgba(0, 0, 0, 0.9)";
    ctx.shadowBlur = 16 * scaleFactor;

    // 1. Optional Custom Title or Template Badge
    const topBadgeText = (state.coverTitle || "").trim() || tpl.badge;
    if (topBadgeText) {
      ctx.fillStyle = tpl.accent;
      ctx.font = `700 ${Math.round(14 * cScale)}px 'DM Sans', sans-serif`;
      ctx.fillText(topBadgeText.toUpperCase(), centerX, centerY - 148 * cScale);
    }

    // 2. Clean Arabic & Turkish Surah Names (No forced "سُورَةُ" repetition, both independently editable & toggleable!)
    const showArSurah = state.coverShowArSurah !== false;
    const showTrSurah = state.coverShowTrSurah !== false;
    const surahDisplayAr = (state.coverSurahNameAr || "").trim() || surahMeta[2];
    const surahDisplayTr = (state.coverSurahName || "").trim() || `${surahMeta[1]} Sûresi`;

    if (showArSurah && surahDisplayAr) {
      const surahArSize = state.coverLargeSurah ? Math.round(52 * cScale) : Math.round(36 * cScale);
      ctx.fillStyle = tpl.accent || "#F0D78A";
      ctx.font = `700 ${surahArSize}px 'Amiri', serif`;
      ctx.fillText(surahDisplayAr, centerX, centerY - (showTrSurah ? 98 : 68) * cScale);
    }

    if (showTrSurah && surahDisplayTr) {
      const surahTrSize = state.coverLargeSurah ? Math.round(23 * cScale) : Math.round(18 * cScale);
      ctx.fillStyle = "#FFFDF7";
      ctx.font = `700 ${surahTrSize}px 'DM Sans', sans-serif`;
      ctx.fillText(`${surahDisplayTr} · ${reciterMeta.name}`, centerX, centerY - (showArSurah ? 52 : 68) * cScale);
    }

    // Ornamental divider line
    ctx.strokeStyle = "rgba(240, 215, 138, 0.45)";
    ctx.lineWidth = 1.5 * scaleFactor;
    ctx.beginPath();
    ctx.moveTo(centerX - w * 0.2, centerY - 26 * cScale);
    ctx.lineTo(centerX + w * 0.2, centerY - 26 * cScale);
    ctx.stroke();

    // 3. Cover Verse Arabic & Subtitle/Meal
    if (coverVerse) {
      ctx.direction = "rtl";
      ctx.fillStyle = state.arabicColor;
      const arFontPx = Math.round(34 * cScale);
      ctx.font = `700 ${arFontPx}px '${state.arabicFont}', serif`;
      const ayahBadge = `\uFD3F${toArabicIndicDigits(coverVerse.numberInSurah)}\uFD3E`;
      const arLines = wrapCanvasText(ctx, `${coverVerse.arabic} ${ayahBadge}`, w * 0.82);
      const maxArLines = arLines.slice(0, 2);
      maxArLines.forEach((ln, i) => {
        ctx.fillText(ln, centerX, centerY + (14 + i * 48) * cScale);
      });

      ctx.direction = "ltr";
      ctx.fillStyle = state.mealColor;
      const trFontPx = Math.round(19 * cScale);
      ctx.font = `${state.mealItalic ? "italic " : ""}${state.mealWeight} ${trFontPx}px '${state.mealFont}', serif`;
      const customSub = (state.coverSubtitle || "").trim();
      const subStr = customSub || formatVerseTextWithNumber(getSelectedMealText(coverVerse), coverVerse.numberInSurah, state.mealNumberFormat);
      const trLines = wrapCanvasText(ctx, subStr, w * 0.82);
      trLines.slice(0, 2).forEach((ln, i) => {
        ctx.fillText(ln, centerX, centerY + (68 + (maxArLines.length > 1 ? 42 : 0) + i * 28) * cScale);
      });
    }

    ctx.restore();
  }

  function drawOverlaysAndLogo(w, h, scaleFactor, t, verse) {
    const padX = 28 * scaleFactor;
    const topBarPad = state.inVideoProgressBar === "top" ? 18 * scaleFactor : 0;
    const padY = topBarPad + 24 * scaleFactor;
    const surahMeta = SURAHS.find((s) => s[0] === state.surahNo) || SURAHS[0];
    const recMeta = RECITERS.find((r) => r.id === state.reciterId) || RECITERS[0];

    ctx.save();
    ctx.direction = "ltr";
    ctx.imageSmoothingEnabled = true;
    ctx.imageSmoothingQuality = "high";
    ctx.shadowColor = "rgba(0, 0, 0, 0.85)";
    ctx.shadowBlur = 8 * scaleFactor;

    const showCorner =
      (state.inVideoSurahHeader === "both" || state.inVideoSurahHeader === "corner_only") &&
      (state.cornerShowSurah || state.cornerShowAyahs || state.cornerShowReciter);

    if (showCorner) {
      const rangeStr = state.ayahStart === state.ayahEnd ? `${state.ayahStart}` : `${state.ayahStart}-${state.ayahEnd}`;
      const line1Parts = [];
      if (state.cornerShowSurah) line1Parts.push(surahMeta[1]);
      if (state.cornerShowAyahs) line1Parts.push(rangeStr);
      const line1 = line1Parts.join(" ");

      ctx.textAlign = "left";
      ctx.textBaseline = "top";
      let curY = padY;

      if (line1) {
        ctx.fillStyle = "rgba(255, 253, 247, 0.94)";
        ctx.font = `700 ${Math.round(13.5 * scaleFactor)}px 'DM Sans', sans-serif`;
        ctx.fillText(line1, padX, curY);
        curY += 17 * scaleFactor;
      }
      if (state.cornerShowReciter) {
        ctx.fillStyle = "rgba(229, 224, 213, 0.76)";
        ctx.font = `500 ${Math.round(11 * scaleFactor)}px 'DM Sans', sans-serif`;
        ctx.fillText(recMeta.name, padX, curY);
      }
    }

    const showCenterBanner =
      verse &&
      state.coverPreviewMode !== "cover" &&
      (state.inVideoSurahHeader === "both" || state.inVideoSurahHeader === "center_banner");

    if (showCenterBanner) {
      ctx.textAlign = "center";
      ctx.textBaseline = "middle";
      ctx.fillStyle = "#E8C978";
      ctx.font = `600 ${Math.round(15.5 * scaleFactor)}px 'DM Sans', sans-serif`;
      const bannerY = w > h ? h * 0.14 : h * 0.16;
      ctx.fillText(`${surahMeta[1]} Sûresi · ${verse.numberInSurah}. Âyet`, w / 2, bannerY);
    }

    if (state.showSignature && state.logoPos !== "hidden") {
      const lScale = (state.logoScale || 100) / 100;
      const iconSize = Math.round(28 * lScale * scaleFactor);
      const text = (state.watermarkText || "Tilawah World").trim();
      ctx.globalAlpha = Math.max(0.15, Math.min(1, (state.logoOpacity || 90) / 100));
      ctx.font = `600 ${Math.round(13.5 * lScale * scaleFactor)}px 'DM Sans', sans-serif`;
      const tw = text ? ctx.measureText(text).width : 0;
      const logoSource = appLogoLoaded ? appLogoImg : fallbackLogoCanvas;

      if (state.logoPos === "top-right") {
        const rightX = w - padX;
        const midY = padY + iconSize * 0.5;
        ctx.fillStyle = "rgba(255, 253, 247, 0.92)";
        ctx.textAlign = "right";
        ctx.textBaseline = "middle";
        if (text) ctx.fillText(text, rightX, midY);
        ctx.drawImage(logoSource, rightX - tw - iconSize - (text ? 8 * scaleFactor : 0), midY - iconSize / 2, iconSize, iconSize);
      } else if (state.logoPos === "top-left") {
        const leftX = padX;
        const midY = padY + (showCorner ? 40 * scaleFactor : 0) + iconSize * 0.5;
        ctx.drawImage(logoSource, leftX, midY - iconSize / 2, iconSize, iconSize);
        if (text) {
          ctx.fillStyle = "rgba(255, 253, 247, 0.92)";
          ctx.textAlign = "left";
          ctx.textBaseline = "middle";
          ctx.fillText(text, leftX + iconSize + 8 * scaleFactor, midY);
        }
      } else {
        const totalW = iconSize + (text ? 8 * scaleFactor + tw : 0);
        const cx = state.logoPos === "floating" ? w * 0.5 + Math.sin(t * 0.45) * (w * 0.22) : w * 0.5;
        const bottomProgressClearance = (state.inVideoProgressBar === "bottom") ? (34 * scaleFactor) : 0;
        const cy = state.logoPos === "floating"
          ? h * 0.82 + Math.cos(t * 0.35) * (h * 0.04)
          : h - bottomProgressClearance - 32 * scaleFactor;
        const startX = cx - totalW / 2;
        ctx.drawImage(logoSource, startX, cy - iconSize / 2, iconSize, iconSize);
        if (text) {
          ctx.fillStyle = "rgba(255, 253, 247, 0.92)";
          ctx.textAlign = "left";
          ctx.textBaseline = "middle";
          ctx.fillText(text, startX + iconSize + 8 * scaleFactor, cy);
        }
      }
    }

    ctx.restore();
  }

  function drawInVideoProgressBar(w, h, scaleFactor, underTextY) {
    const mode = state.inVideoProgressBar || "bottom";
    if (mode === "off") return;

    let prog = 0;
    if (state.isPlaying || state.isRecording) {
      prog = state.totalDuration > 0 ? Math.max(0, Math.min(1, state.elapsedTime / state.totalDuration)) : 0;
    } else if (state.verses.length > 0) {
      prog = Math.max(0.08, Math.min(1, (state.activeVerseIdx + 0.35) / state.verses.length));
    }

    ctx.save();
    if (mode === "bottom" || mode === "top") {
      const barH = Math.max(4, Math.round(5.5 * scaleFactor));
      const padSide = Math.round(w * 0.06);
      const trackW = w - padSide * 2;
      const y = mode === "bottom"
        ? h - Math.round(16 * scaleFactor) - barH
        : Math.round(12 * scaleFactor);

      ctx.fillStyle = "rgba(255, 255, 255, 0.18)";
      ctx.beginPath();
      if (ctx.roundRect) ctx.roundRect(padSide, y, trackW, barH, 999);
      else ctx.rect(padSide, y, trackW, barH);
      ctx.fill();

      const fillW = Math.max(barH, trackW * prog);
      const grad = ctx.createLinearGradient(padSide, y, padSide + fillW, y);
      grad.addColorStop(0, "#D8B456");
      grad.addColorStop(1, "#F8E5A6");
      ctx.fillStyle = grad;
      ctx.shadowColor = "rgba(240, 215, 138, 0.65)";
      ctx.shadowBlur = 8 * scaleFactor;
      ctx.beginPath();
      if (ctx.roundRect) ctx.roundRect(padSide, y, fillW, barH, 999);
      else ctx.rect(padSide, y, fillW, barH);
      ctx.fill();
    } else if (mode === "under_text" && underTextY) {
      const barW = Math.round(w * 0.44);
      const barH = Math.max(3, Math.round(4 * scaleFactor));
      const x = Math.round((w - barW) / 2);
      const y = Math.min(h - 45 * scaleFactor, underTextY + Math.round(18 * scaleFactor));

      ctx.fillStyle = "rgba(255, 255, 255, 0.16)";
      ctx.fillRect(x, y, barW, barH);

      ctx.fillStyle = "#F0D78A";
      ctx.shadowColor = "rgba(240, 215, 138, 0.65)";
      ctx.shadowBlur = 6 * scaleFactor;
      ctx.fillRect(x, y, barW * prog, barH);
    }
    ctx.restore();
  }

  function drawArabicLinesWithWordHighlight(ctx, verse, maxTextW, centerX, startY, lineH, arPx, scaleFactor, activeWordGlobalIdx, highlightEnabled) {
    const rawWords = (verse.arabic || "").trim().split(/\s+/).filter(Boolean);
    const ayahBadge = `\uFD3F${toArabicIndicDigits(verse.numberInSurah)}\uFD3E`;
    const allTokens = [...rawWords, ayahBadge];

    const lines = [];
    let curTokens = [];
    for (let i = 0; i < allTokens.length; i++) {
      const tok = allTokens[i];
      const testStr = [...curTokens.map((t) => t.text), tok].join(" ");
      if (ctx.measureText(testStr).width > maxTextW && curTokens.length > 0) {
        lines.push(curTokens);
        curTokens = [{ text: tok, wordIdx: i < rawWords.length ? i : -1 }];
      } else {
        curTokens.push({ text: tok, wordIdx: i < rawWords.length ? i : -1 });
      }
    }
    if (curTokens.length > 0) lines.push(curTokens);

    const hlColor = state.wordHighlightColor || "#F8E5A6";
    const hlStyle = state.wordHighlightStyle || "glow";

    lines.forEach((lineTokens, lineIdx) => {
      const y = startY + lineIdx * lineH;
      const fullLineStr = lineTokens.map((t) => t.text).join(" ");

      if (!highlightEnabled) {
        if (state.textReadability === "outline") {
          ctx.strokeStyle = "rgba(0,0,0,0.9)";
          ctx.lineWidth = 3.5 * scaleFactor;
          ctx.strokeText(fullLineStr, centerX, y);
        }
        ctx.fillStyle = state.arabicColor;
        ctx.fillText(fullLineStr, centerX, y);
        return;
      }

      const spaceW = ctx.measureText(" ").width;
      const tokenWidths = lineTokens.map((t) => ctx.measureText(t.text).width);
      const totalLineW = tokenWidths.reduce((a, b) => a + b, 0) + Math.max(0, lineTokens.length - 1) * spaceW;
      let rightEdgeCursor = centerX + totalLineW / 2;

      lineTokens.forEach((tokObj, tIdx) => {
        const tw = tokenWidths[tIdx];
        const wordCenterX = rightEdgeCursor - tw / 2;
        const isHighlighted = (tokObj.wordIdx === activeWordGlobalIdx);

        ctx.save();
        if (isHighlighted) {
          if (hlStyle === "pill_scale") {
            const padW = 8 * scaleFactor;
            const padH = arPx * 0.62;
            drawRoundedBox(
              ctx,
              wordCenterX - tw / 2 - padW,
              y - padH,
              tw + padW * 2,
              padH * 2,
              10 * scaleFactor,
              hlColor + "28",
              hlColor + "88"
            );
            ctx.translate(wordCenterX, y);
            ctx.scale(1.06, 1.06);
            ctx.translate(-wordCenterX, -y);
          }

          ctx.fillStyle = hlColor;
          ctx.shadowColor = hlColor;
          ctx.shadowBlur = 18 * scaleFactor;

          if (hlStyle === "underline") {
            const ulY = y + arPx * 0.56;
            const ulH = Math.max(2.5, 3.2 * scaleFactor);
            ctx.fillRect(wordCenterX - tw * 0.48, ulY, tw * 0.96, ulH);
          }
        } else {
          ctx.fillStyle = state.arabicColor;
        }

        if (state.textReadability === "outline") {
          ctx.strokeStyle = "rgba(0,0,0,0.9)";
          ctx.lineWidth = 3.2 * scaleFactor;
          ctx.strokeText(tokObj.text, wordCenterX, y);
        }
        ctx.fillText(tokObj.text, wordCenterX, y);
        ctx.restore();

        rightEdgeCursor -= (tw + spaceW);
      });
    });

    return lines.length;
  }

  let lastFrameMs = performance.now();
  let simTime = 0;

  function renderStudioFrame(nowMs) {
    const currentMs = nowMs || performance.now();
    const dt = Math.max(0.001, Math.min(0.05, (currentMs - lastFrameMs) / 1000));
    lastFrameMs = currentMs;
    simTime += dt;
    const t = simTime;

    const w = canvas.width;
    const h = canvas.height;
    const isLandscape = w > h;
    const scaleFactor = Math.min(w, h) / 720;

    ctx.clearRect(0, 0, w, h);

    // 1. Background: Galerim video/image if loaded, otherwise clean pure Studio Backdrop
    const currentZemin = getZeminById(state.zeminId);
    const activeStyle = STYLE_PRESETS.find((s) => s.id === state.stylePresetId) || STYLE_PRESETS[0];
    const mediaEl = activeBgVideo || activeBgImage;
    let mediaDrawn = false;
    if (mediaEl) {
      mediaDrawn = drawBackgroundMediaWithFilters(ctx, mediaEl, Boolean(activeBgVideo), w, h, t, state);
    }
    if (!mediaDrawn) {
      drawProceduralScene(ctx, w, h, t, dt, currentZemin, activeStyle);
    }

    // 2. Darkness
    if (state.bgDim > 0) {
      ctx.fillStyle = `rgba(4, 6, 8, ${state.bgDim / 100})`;
      ctx.fillRect(0, 0, w, h);
    }

    // 3. Vignette & Visual Particles
    drawCinematicVignette(ctx, w, h, state.vignette !== "off");
    drawVisualEffectOverlay(ctx, w, h, t, dt, state);

    // 4. Filter Warmth
    drawFilterWarmthAndCinemaBars(ctx, w, h, state);

    const activeVerse = state.verses[state.activeVerseIdx] || state.verses[0];

    // 5. Corner Info Badges, Centered Surah Header & Crisp 512px Logo Signature
    drawOverlaysAndLogo(w, h, scaleFactor, t, activeVerse);

    // 6. Main Content (Cover or Verse)
    const showCoverNow =
      state.coverPreviewMode === "cover" ||
      (state.coverFirstFrame === "on" && (state.isPlaying || state.isRecording) && state.elapsedTime < 1.2);

    let lastContentBottomY = h * 0.65;

    if (showCoverNow) {
      drawUnifiedCoverScene(w, h, scaleFactor);
    } else if (state.subtitleMode !== "blank" && activeVerse) {
      let alpha = 1;
      let slideY = 0;
      const sinceVerse = Math.max(0, (performance.now() - state.verseStartTime) / 1000);
      if (state.transitionMode !== "none") {
        const dur = state.transitionMode === "soft" ? 0.65 : 0.42;
        const prog = Math.min(1, sinceVerse / dur);
        const ease = 1 - Math.pow(1 - prog, 3);
        alpha = ease;
        if (state.transitionMode === "slide") {
          slideY = (1 - ease) * 26 * scaleFactor;
        }
      }

      ctx.save();
      ctx.globalAlpha = alpha;
      ctx.translate(0, slideY);
      ctx.textAlign = "center";
      ctx.textBaseline = "middle";

      if (state.textReadability === "shadow") {
        ctx.shadowColor = "rgba(0, 0, 0, 0.92)";
        ctx.shadowBlur = (state.textShadow || 14) * scaleFactor;
      } else if (state.textReadability === "plain") {
        ctx.shadowColor = "rgba(0, 0, 0, 0.45)";
        ctx.shadowBlur = 5 * scaleFactor;
      } else {
        ctx.shadowBlur = 0;
      }

      const maxTextW = isLandscape ? w * 0.8 : w * 0.84;
      const arPx = Math.round(state.arabicSize * scaleFactor * (isLandscape ? 0.86 : 1));
      const mealPx = Math.round(state.mealSize * scaleFactor * (isLandscape ? 0.86 : 1));
      const enPx = Math.round((state.enMealSize || 18) * scaleFactor * (isLandscape ? 0.86 : 1));

      const showAr = (state.subtitleMode !== "meal_only" && state.subtitleMode !== "tr_en_only");
      const showTr = (state.subtitleMode === "tr" || state.subtitleMode === "meal_only" || state.subtitleMode === "both" || state.subtitleMode === "tr_en_only");
      const showEn = (state.subtitleMode === "en" || state.subtitleMode === "both" || state.subtitleMode === "tr_en_only");

      ctx.font = `700 ${arPx}px '${state.arabicFont}', serif`;
      const ayahBadge = `\uFD3F${toArabicIndicDigits(activeVerse.numberInSurah)}\uFD3E`;
      const arLinesPreview = showAr ? wrapCanvasText(ctx, `${activeVerse.arabic} ${ayahBadge}`, maxTextW) : [];
      const arLineH = arPx * 1.62;
      const totalArH = arLinesPreview.length * arLineH;

      ctx.font = `${state.mealItalic ? "italic " : ""}${state.mealWeight} ${mealPx}px '${state.mealFont}', serif`;
      const numberedMeal = showTr ? formatVerseTextWithNumber(getSelectedMealText(activeVerse), activeVerse.numberInSurah, state.mealNumberFormat) : "";
      const trLines = showTr ? wrapCanvasText(ctx, numberedMeal, maxTextW) : [];
      const trLineH = mealPx * 1.44;
      const totalTrH = trLines.length * trLineH;

      ctx.font = `400 ${enPx}px 'DM Sans', sans-serif`;
      const numberedEnMeal = showEn ? formatVerseTextWithNumber(activeVerse.en || "", activeVerse.numberInSurah, state.mealNumberFormat) : "";
      const enLines = showEn ? wrapCanvasText(ctx, numberedEnMeal, maxTextW) : [];
      const enLineH = enPx * 1.42;
      const totalEnH = enLines.length * enLineH;

      const showBismillahCrown =
        state.bismillahMode === "separate" &&
        state.surahNo !== 1 &&
        state.surahNo !== 9 &&
        activeVerse.numberInSurah === 1 &&
        showAr;
      const bismillahH = showBismillahCrown ? 46 * scaleFactor : 0;

      const gapArTr = (showAr && (showTr || showEn)) ? 26 * scaleFactor : 0;
      const gapTrEn = (showTr && showEn) ? 14 * scaleFactor : 0;
      const totalBlockH = bismillahH + totalArH + gapArTr + totalTrH + gapTrEn + totalEnH;

      let baseCenterY = h * 0.50;
      if (state.textAlignPos === "top") baseCenterY = h * 0.34;
      else if (state.textAlignPos === "bottom") baseCenterY = h * 0.66;

      const globalCenterX = w * 0.5 + ((state.textOffsetX || 0) / 100) * w;
      const globalCenterY = baseCenterY + ((state.textOffsetY || 0) / 100) * h;
      const startTopY = globalCenterY - totalBlockH / 2;

      // Default vertical top positions of each block before independent offsets
      const arDefaultTopY = startTopY;
      const trDefaultTopY = startTopY + bismillahH + totalArH + gapArTr;
      const enDefaultTopY = trDefaultTopY + totalTrH + gapTrEn;

      // Apply independent offsets for Arabic, Turkish, and English blocks
      const arCenterX = globalCenterX + ((state.arOffsetX || 0) / 100) * w;
      const arTopY = arDefaultTopY + ((state.arOffsetY || 0) / 100) * h;

      const trCenterX = globalCenterX + ((state.trOffsetX || 0) / 100) * w;
      const trTopY = trDefaultTopY + ((state.trOffsetY || 0) / 100) * h;

      const enCenterX = globalCenterX + ((state.enOffsetX || 0) / 100) * w;
      const enTopY = enDefaultTopY + ((state.enOffsetY || 0) / 100) * h;

      const hasIndependentOffset =
        Boolean(state.arOffsetX || state.arOffsetY || state.trOffsetX || state.trOffsetY || state.enOffsetX || state.enOffsetY);

      lastRenderedBlocks.ar = showAr && (bismillahH + totalArH > 0)
        ? { cx: arCenterX, cy: arTopY + (bismillahH + totalArH) / 2, top: arTopY, bottom: arTopY + bismillahH + totalArH, w: maxTextW }
        : null;
      lastRenderedBlocks.tr = showTr && totalTrH > 0
        ? { cx: trCenterX, cy: trTopY + totalTrH / 2, top: trTopY, bottom: trTopY + totalTrH, w: maxTextW }
        : null;
      lastRenderedBlocks.en = showEn && totalEnH > 0
        ? { cx: enCenterX, cy: enTopY + totalEnH / 2, top: enTopY, bottom: enTopY + totalEnH, w: maxTextW }
        : null;

      const fillCol = state.textBoxStyle === "frosted" ? "rgba(18, 22, 28, 0.54)" : "rgba(4, 6, 8, 0.78)";
      const strokeCol = state.textBoxStyle === "frosted" ? "rgba(240, 215, 138, 0.34)" : "rgba(224, 184, 76, 0.22)";
      const boxPadX = 24 * scaleFactor;
      const boxPadY = 16 * scaleFactor;
      const boxW = Math.min(w - 32 * scaleFactor, maxTextW + boxPadX * 2);

      if (state.textBoxStyle !== "none" && !hasIndependentOffset) {
        drawRoundedBox(ctx, globalCenterX - boxW / 2, startTopY - boxPadY, boxW, totalBlockH + boxPadY * 2, 18 * scaleFactor, fillCol, strokeCol);
      }

      // 1. Draw Arabic Block
      if (showAr) {
        if (state.textBoxStyle !== "none" && hasIndependentOffset && lastRenderedBlocks.ar) {
          drawRoundedBox(ctx, arCenterX - boxW / 2, arTopY - boxPadY, boxW, (bismillahH + totalArH) + boxPadY * 2, 16 * scaleFactor, fillCol, strokeCol);
        }
        let arCurY = arTopY;
        if (showBismillahCrown) {
          ctx.fillStyle = "#F0D78A";
          ctx.font = `700 ${Math.round(25 * scaleFactor)}px 'Amiri', serif`;
          ctx.fillText("بِسْمِ ٱللَّهِ ٱلرَّحْمَـٰنِ ٱلرَّحِيمِ", arCenterX, arCurY + 16 * scaleFactor);
          arCurY += bismillahH;
        }

        ctx.direction = "rtl";
        ctx.font = `700 ${arPx}px '${state.arabicFont}', serif`;
        if ("letterSpacing" in ctx) {
          ctx.letterSpacing = `${state.arabicLetterSpacing || 0}px`;
        }

        const rawWords = (activeVerse.arabic || "").trim().split(/\s+/).filter(Boolean);
        const verseDur = state.audioDurations[state.activeVerseIdx] || 5.0;
        let activeWordIdx = -1;
        if (state.wordHighlight && rawWords.length > 0) {
          if (state.isPlaying || state.isRecording) {
            const adjustedElapsed = Math.max(0, state.activeVerseElapsed + (Number(state.wordTimingOffset) || 0));
            const ratio = Math.max(0, Math.min(0.999, adjustedElapsed / Math.max(0.5, verseDur * 0.92)));
            activeWordIdx = Math.floor(ratio * rawWords.length);
          } else {
            activeWordIdx = 0;
          }
        }

        drawArabicLinesWithWordHighlight(
          ctx,
          activeVerse,
          maxTextW,
          arCenterX,
          arCurY + arLineH / 2,
          arLineH,
          arPx,
          scaleFactor,
          activeWordIdx,
          Boolean(state.wordHighlight)
        );

        if ("letterSpacing" in ctx) {
          ctx.letterSpacing = "0px";
        }
      }

      if (gapArTr > 0 && !hasIndependentOffset) {
        ctx.strokeStyle = "rgba(240, 215, 138, 0.36)";
        ctx.lineWidth = 1.3 * scaleFactor;
        ctx.beginPath();
        ctx.moveTo(globalCenterX - 42 * scaleFactor, arDefaultTopY + bismillahH + totalArH + gapArTr * 0.5);
        ctx.lineTo(globalCenterX + 42 * scaleFactor, arDefaultTopY + bismillahH + totalArH + gapArTr * 0.5);
        ctx.stroke();
      }

      // 2. Draw Turkish Meal Block
      ctx.direction = "ltr";
      if (showTr && trLines.length > 0) {
        if (state.textBoxStyle !== "none" && hasIndependentOffset && lastRenderedBlocks.tr) {
          drawRoundedBox(ctx, trCenterX - boxW / 2, trTopY - boxPadY * 0.8, boxW, totalTrH + boxPadY * 1.6, 14 * scaleFactor, fillCol, strokeCol);
        }
        ctx.font = `${state.mealItalic ? "italic " : ""}${state.mealWeight} ${mealPx}px '${state.mealFont}', serif`;
        ctx.fillStyle = state.mealColor;
        let trCurY = trTopY;
        trLines.forEach((line) => {
          trCurY += trLineH / 2;
          if (state.textReadability === "outline") {
            ctx.strokeStyle = "rgba(0,0,0,0.9)";
            ctx.lineWidth = 2.8 * scaleFactor;
            ctx.strokeText(line, trCenterX, trCurY);
          }
          ctx.fillText(line, trCenterX, trCurY);
          trCurY += trLineH / 2;
        });
      }

      // 3. Draw English Meal Block
      if (showEn && enLines.length > 0) {
        if (state.textBoxStyle !== "none" && hasIndependentOffset && lastRenderedBlocks.en) {
          drawRoundedBox(ctx, enCenterX - boxW / 2, enTopY - boxPadY * 0.8, boxW, totalEnH + boxPadY * 1.6, 14 * scaleFactor, fillCol, strokeCol);
        }
        ctx.font = `500 ${enPx}px 'DM Sans', sans-serif`;
        ctx.fillStyle = state.enMealColor || "#CBD5E1";
        let enCurY = enTopY;
        enLines.forEach((line) => {
          enCurY += enLineH / 2;
          if (state.textReadability === "outline") {
            ctx.strokeStyle = "rgba(0,0,0,0.9)";
            ctx.lineWidth = 2.4 * scaleFactor;
            ctx.strokeText(line, enCenterX, enCurY);
          }
          ctx.fillText(line, enCenterX, enCurY);
          enCurY += enLineH / 2;
        });
      }

      // Highlight active dragged block with a subtle dashed gold outline while dragging
      if (isDraggingCanvasText && !state.isRecording && activeDragBlockKey && lastRenderedBlocks[activeDragBlockKey]) {
        const blk = lastRenderedBlocks[activeDragBlockKey];
        ctx.save();
        ctx.strokeStyle = "rgba(248, 229, 166, 0.65)";
        ctx.lineWidth = 1.5 * scaleFactor;
        ctx.setLineDash([5 * scaleFactor, 4 * scaleFactor]);
        ctx.strokeRect(blk.cx - (blk.w * 0.52), blk.top - 10 * scaleFactor, blk.w * 1.04, (blk.bottom - blk.top) + 20 * scaleFactor);
        ctx.restore();
      }

      const maxBot = Math.max(
        lastRenderedBlocks.ar ? lastRenderedBlocks.ar.bottom : 0,
        lastRenderedBlocks.tr ? lastRenderedBlocks.tr.bottom : 0,
        lastRenderedBlocks.en ? lastRenderedBlocks.en.bottom : 0
      );
      lastContentBottomY = maxBot > 0 ? maxBot : (startTopY + totalBlockH);
      ctx.restore();
    } else if (!state.versesLoaded && state.versesOfflineError) {
      ctx.save();
      ctx.fillStyle = "rgba(7, 8, 9, 0.85)";
      ctx.fillRect(w * 0.08, h * 0.38, w * 0.84, h * 0.22);
      ctx.strokeStyle = "rgba(239, 68, 68, 0.65)";
      ctx.strokeRect(w * 0.08, h * 0.38, w * 0.84, h * 0.22);
      ctx.fillStyle = "#FCA5A5";
      ctx.textAlign = "center";
      ctx.font = `700 ${Math.round(20 * scaleFactor)}px 'DM Sans', sans-serif`;
      const errLines = wrapCanvasText(ctx, state.versesOfflineError, w * 0.75);
      errLines.forEach((l, idx) => {
        ctx.fillText(l, w / 2, h * 0.46 + idx * 28 * scaleFactor);
      });
      ctx.restore();
    }

    // 7. In-Video Progress Bar
    drawInVideoProgressBar(w, h, scaleFactor, lastContentBottomY);

    // 8. Magnetic Gold Center Snap Guides while Dragging
    if (isDraggingCanvasText && !state.isRecording) {
      ctx.save();
      ctx.strokeStyle = "rgba(248, 229, 166, 0.82)";
      ctx.lineWidth = Math.max(1.5, 2 * scaleFactor);
      ctx.setLineDash([8 * scaleFactor, 6 * scaleFactor]);
      if (snapGuideX) {
        ctx.beginPath();
        ctx.moveTo(w / 2, 0);
        ctx.lineTo(w / 2, h);
        ctx.stroke();
      }
      if (snapGuideY) {
        ctx.beginPath();
        ctx.moveTo(0, h / 2);
        ctx.lineTo(w, h / 2);
        ctx.stroke();
      }
      ctx.restore();
    }

    // 9. Smooth End Fade-Out Overlay
    if (state.isFadingOut && state.fadeOutProgress > 0) {
      ctx.save();
      ctx.fillStyle = `rgba(4, 5, 7, ${Math.min(1, state.fadeOutProgress)})`;
      ctx.fillRect(0, 0, w, h);
      ctx.restore();
    }
  }

  let renderRafId = null;
  let hiddenRenderInterval = null;

  function startRenderLoop() {
    const loop = (now) => {
      renderStudioFrame(now);
      renderRafId = requestAnimationFrame(loop);
    };
    renderRafId = requestAnimationFrame(loop);

    document.addEventListener("visibilitychange", () => {
      if (document.hidden && (state.isRecording || state.isPlaying)) {
        if (!hiddenRenderInterval) {
          hiddenRenderInterval = setInterval(() => {
            renderStudioFrame(performance.now());
          }, 33);
        }
      } else if (hiddenRenderInterval) {
        clearInterval(hiddenRenderInterval);
        hiddenRenderInterval = null;
      }
    });
  }

  let mediaRecorder = null;
  let recordedChunks = [];
  let sessionAborted = false;
  let recorderCompletedNaturally = false;
  let playbackTimerIds = [];
  let activeAudioElement = null;

  function clearPlaybackTimers() {
    while (playbackTimerIds.length > 0) {
      clearTimeout(playbackTimerIds.pop());
    }
  }

  function stopPlaybackAndRecording(isAbort = true) {
    sessionAborted = isAbort;
    clearPlaybackTimers();
    stopActiveAyahPlayback();

    if (activeAudioElement) {
      try {
        activeAudioElement.onended = null;
        activeAudioElement.ontimeupdate = null;
        activeAudioElement.pause();
        activeAudioElement.currentTime = 0;
      } catch (_) {}
      activeAudioElement = null;
    }

    state.audioElements.forEach((a) => {
      if (a) {
        try {
          a.onended = null;
          a.ontimeupdate = null;
          a.pause();
          a.currentTime = 0;
        } catch (_) {}
      }
    });

    stopAmbientSound();
    resetMasterGain();
    releaseScreenWakeLock();

    if (mediaRecorder && mediaRecorder.state !== "inactive") {
      try {
        if (!isAbort && mediaRecorder.state === "recording") {
          mediaRecorder.requestData();
        }
        mediaRecorder.stop();
      } catch (_) {}
    }

    state.isPlaying = false;
    state.isRecording = false;
    state.isFadingOut = false;
    state.fadeOutProgress = 0;

    const wrap = document.getElementById("canvasWrap");
    if (wrap) wrap.classList.remove("recording-active", "clean-ui");

    document.getElementById("lblPlayBtn").textContent = "▶";
    document.getElementById("lblRecordBtn").textContent = "🎬 Oluştur";
    document.getElementById("progressBarFill").style.width = "0%";
    document.getElementById("lblCurrentTime").textContent = "00:00.0";

    if (state.audioReady) {
      updateStageBadge("ready", "Hazır");
    }
  }

  function showExportReadyModal() {
    if (!state.lastExportBlob) return;
    const modal = document.getElementById("exportReadyModal");
    const vid = document.getElementById("exportPreviewVideo");
    const meta = document.getElementById("lblExportModalMeta");
    const lnk = document.getElementById("lnkModalDownloadVideo");

    if (state.lastExportObjectUrl) {
      try { URL.revokeObjectURL(state.lastExportObjectUrl); } catch (_) {}
    }
    state.lastExportObjectUrl = URL.createObjectURL(state.lastExportBlob);
    const fileName = formatExportFileName(state, SURAHS, RECITERS, state.lastExportExt);
    const sizeMB = (state.lastExportBlob.size / (1024 * 1024)).toFixed(2);

    if (vid) {
      vid.src = state.lastExportObjectUrl;
      vid.load();
    }
    if (meta) {
      meta.textContent = `${fileName} · ${sizeMB} MB · ${state.platformRatio} (${state.resolution}p)`;
    }
    if (lnk) {
      lnk.href = state.lastExportObjectUrl;
      lnk.download = fileName;
    }
    if (modal) {
      modal.classList.add("show");
    }
  }

  async function shareExportedVideo() {
    if (!state.lastExportBlob) {
      showToast("Önce '🎬 Oluştur' düğmesiyle videoyu hazırlayın.");
      return;
    }
    const fileName = formatExportFileName(state, SURAHS, RECITERS, state.lastExportExt);
    const cleanMime = state.lastExportCleanMime || (state.lastExportExt === "mp4" ? "video/mp4" : "video/webm");
    const caption = (document.getElementById("txtSocialCaption") && document.getElementById("txtSocialCaption").value) || "";

    if (navigator.share) {
      try {
        const file = new File([state.lastExportBlob], fileName, {
          type: cleanMime,
          lastModified: Date.now()
        });
        // Try sharing file + text first; if browser only accepts file alone, fallback to files-only share
        try {
          await navigator.share({
            files: [file],
            title: fileName,
            text: caption
          });
          return;
        } catch (err1) {
          if (err1 && err1.name === "AbortError") return;
          await navigator.share({
            files: [file]
          });
          return;
        }
      } catch (err2) {
        if (err2 && err2.name === "AbortError") return;
      }
    }

    // Fallback if Web Share API for files is unsupported in this browser/WebView
    downloadExportedVideo();
    showToast("Tarayıcınız doğrudan dosya paylaşımını desteklemiyor; video cihazınıza indirildi.");
  }

  async function startStudioSession(recordMode = false) {
    if (!state.versesLoaded || state.verses.length === 0) {
      showToast("Bu âyet metni henüz yüklenmedi.");
      return;
    }
    if (!state.audioReady) {
      showToast("Ses dosyaları henüz hazır değil.");
      return;
    }

    // Unlock AudioContext immediately on user tap before any await!
    const { mixDest } = ensureAudioGraph(state, activeBgVideo);

    await ensureFontsLoaded();
    stopPlaybackAndRecording(true);

    sessionAborted = false;
    recorderCompletedNaturally = false;
    state.coverPreviewMode = "ayah";
    const chkPrev = document.getElementById("chkPreviewCoverNow");
    if (chkPrev) chkPrev.checked = false;

    if (activeBgVideo) {
      try {
        activeBgVideo.playbackRate = Number(state.bgVideoSpeed) || 1.0;
        const tStart = Math.max(0, Number(state.videoTrimStart) || 0);
        if (tStart < (activeBgVideo.duration || 99999)) {
          activeBgVideo.currentTime = tStart;
        }
        activeBgVideo.play().catch(() => {});
      } catch (_) {}
    }

    ensureAudioGraph(state, activeBgVideo);

    state.isPlaying = !recordMode;
    state.isRecording = recordMode;
    state.activeVerseIdx = 0;
    state.activeVerseElapsed = 0;
    state.elapsedTime = 0;
    state.isFadingOut = false;
    state.fadeOutProgress = 0;
    renderAyahTimelineStrip();

    document.getElementById("lblPlayBtn").textContent = "■";
    document.getElementById("lblRecordBtn").textContent = recordMode ? "✕ İptal Et" : "🎬 Oluştur";

    const wrap = document.getElementById("canvasWrap");
    if (recordMode) {
      await requestScreenWakeLock();
      if (wrap) wrap.classList.add("recording-active");
      updateStageBadge("recording", "Kaydediliyor...");
    } else {
      updateStageBadge("ready", "Önizleniyor");
      const hideId = setTimeout(() => {
        if (state.isPlaying && wrap) wrap.classList.add("clean-ui");
      }, 2000);
      playbackTimerIds.push(hideId);
    }

    let recorderStarted = false;
    let recordStartPerf = 0;
    const caps = detectRecorderCapabilities();
    const chosenFormat = caps.best;

    if (recordMode) {
      state.lastExportExt = chosenFormat.ext;
      state.lastExportMime = chosenFormat.mime || "video/webm";
      state.lastExportCleanMime = chosenFormat.cleanMime || (chosenFormat.ext === "mp4" ? "video/mp4" : "video/webm");

      // Render one fresh frame before capturing stream so stream starts non-empty
      renderStudioFrame(performance.now());
      const canvasStream = canvas.captureStream(30);
      const combinedTracks = [
        ...canvasStream.getVideoTracks(),
        ...(mixDest ? mixDest.stream.getAudioTracks() : [])
      ];
      const mixedStream = new MediaStream(combinedTracks);

      const recOptions = {
        videoBitsPerSecond: (state.bitrateMbps || 8) * 1000000
      };
      if (chosenFormat.mime) recOptions.mimeType = chosenFormat.mime;

      recordedChunks = [];
      try {
        mediaRecorder = new MediaRecorder(mixedStream, recOptions);
      } catch (_) {
        mediaRecorder = new MediaRecorder(mixedStream);
      }

      mediaRecorder.ondataavailable = (ev) => {
        if (ev.data && ev.data.size > 0) recordedChunks.push(ev.data);
      };

      mediaRecorder.onstop = async () => {
        if (sessionAborted || !recorderCompletedNaturally || recordedChunks.length === 0) {
          recordedChunks = [];
          return;
        }
        const totalDurationMs = Math.max(1000, performance.now() - recordStartPerf);
        const rawBlob = new Blob(recordedChunks, { type: state.lastExportCleanMime });
        const finalBlob = await patchWebmDuration(rawBlob, totalDurationMs, state.lastExportCleanMime);
        state.lastExportBlob = finalBlob;

        const btnDl = document.getElementById("btnDownloadLastVideo");
        if (btnDl) btnDl.disabled = false;

        const btnShare = document.getElementById("btnShareLastVideo");
        if (btnShare) btnShare.disabled = false;

        showExportReadyModal();
        downloadExportedVideo();
      };
    }

    const completeSessionSmoothly = () => {
      if (sessionAborted) return;
      if (state.smoothFadeOut === "on") {
        state.isFadingOut = true;
        triggerSmoothFadeOut(1.2);
        const fadeStart = performance.now();
        const fadeStep = () => {
          if (sessionAborted) return;
          const p = (performance.now() - fadeStart) / 1200;
          state.fadeOutProgress = p;
          if (p < 1) {
            requestAnimationFrame(fadeStep);
          } else {
            recorderCompletedNaturally = true;
            stopPlaybackAndRecording(false);
          }
        };
        requestAnimationFrame(fadeStep);
      } else {
        recorderCompletedNaturally = true;
        stopPlaybackAndRecording(false);
      }
    };

    const playVerseAtIndex = (idx) => {
      if (sessionAborted || (!state.isPlaying && !state.isRecording)) return;
      if (idx >= state.verses.length) {
        completeSessionSmoothly();
        return;
      }

      state.activeVerseIdx = idx;
      state.activeVerseElapsed = 0;
      state.verseStartTime = performance.now();
      renderAyahTimelineStrip();

      const isLastVerse = (idx === state.verses.length - 1);

      if (state.textOnlyMode) {
        if (recordMode && !recorderStarted) {
          recorderStarted = true;
          recordStartPerf = performance.now();
          mediaRecorder.start(200);
          startAmbientSound(state);
        } else if (!recordMode && idx === 0) {
          startAmbientSound(state);
        }

        const vDur = state.audioDurations[idx] || 5.0;
        const vStartPerf = performance.now();

        const stepTextTimeline = () => {
          if (sessionAborted || (!state.isPlaying && !state.isRecording)) return;
          if (state.activeVerseIdx !== idx) return;

          const curInVerse = (performance.now() - vStartPerf) / 1000;
          state.activeVerseElapsed = curInVerse;
          let passed = state.coverFirstFrame === "on" ? 1.2 : 0;
          for (let i = 0; i < idx; i++) passed += state.audioDurations[i];
          passed += Math.min(vDur, curInVerse);
          state.elapsedTime = passed;

          document.getElementById("lblCurrentTime").textContent = formatPreciseTime(passed);
          const pct = state.totalDuration > 0 ? Math.min(100, (passed / state.totalDuration) * 100) : 0;
          document.getElementById("progressBarFill").style.width = `${pct}%`;

          if (curInVerse < vDur) {
            const tid = setTimeout(stepTextTimeline, 50);
            playbackTimerIds.push(tid);
          } else {
            playVerseAtIndex(idx + 1);
          }
        };
        stepTextTimeline();
        return;
      }

      const statusItem = state.audioStatuses[idx];
      const dur = state.audioDurations[idx] || 5.0;
      if (!statusItem) {
        stopPlaybackAndRecording(true);
        return;
      }

      if (recordMode && !recorderStarted) {
        recorderStarted = true;
        recordStartPerf = performance.now();
        mediaRecorder.start(200);
        startAmbientSound(state);
      } else if (!recordMode && idx === 0) {
        startAmbientSound(state);
      }

      let advancedToNext = false;
      const goNext = () => {
        if (advancedToNext || sessionAborted) return;
        advancedToNext = true;
        stopActiveAyahPlayback();
        playVerseAtIndex(idx + 1);
      };

      playAyahItem(
        statusItem,
        (curTime, totalDur) => {
          if (sessionAborted) return;
          state.activeVerseElapsed = curTime;

          let passed = state.coverFirstFrame === "on" ? 1.2 : 0;
          for (let i = 0; i < idx; i++) {
            passed += Math.max(0.4, state.audioDurations[i] - state.gaplessTrimSec);
          }
          passed += curTime;
          state.elapsedTime = passed;

          document.getElementById("lblCurrentTime").textContent = formatPreciseTime(passed);
          const pct = state.totalDuration > 0 ? Math.min(100, (passed / state.totalDuration) * 100) : 0;
          document.getElementById("progressBarFill").style.width = `${pct}%`;

          if (!isLastVerse && state.gaplessTrimSec > 0 && totalDur > 1.2) {
            if (curTime >= totalDur - state.gaplessTrimSec) {
              goNext();
            }
          }
        },
        () => goNext(),
        () => {
          stopPlaybackAndRecording(true);
          showToast("Ses oynatılamadı. Lütfen tekrar dokunun.");
        }
      );
    };

    if (state.coverFirstFrame === "on") {
      if (recordMode) {
        recorderStarted = true;
        recordStartPerf = performance.now();
        mediaRecorder.start(200);
      }
      startAmbientSound(state);
      const cStart = performance.now();
      const tickCover = () => {
        if (sessionAborted || (!state.isPlaying && !state.isRecording)) return;
        const el = (performance.now() - cStart) / 1000;
        if (el < 1.2) {
          state.elapsedTime = el;
          document.getElementById("lblCurrentTime").textContent = formatPreciseTime(el);
          requestAnimationFrame(tickCover);
        }
      };
      requestAnimationFrame(tickCover);
      const cid = setTimeout(() => {
        playVerseAtIndex(0);
      }, 1200);
      playbackTimerIds.push(cid);
    } else {
      playVerseAtIndex(0);
    }
  }

  function updateSocialCaptionText() {
    const surahMeta = SURAHS.find((s) => s[0] === state.surahNo) || SURAHS[0];
    const reciterMeta = RECITERS.find((r) => r.id === state.reciterId) || RECITERS[0];
    const firstVerse = state.verses[0];
    const mealSnippet = firstVerse ? `"${getSelectedMealText(firstVerse)}"` : "";
    const surahTag = normalizeHashtagWord(surahMeta[1]);
    const plat = state.captionPlatform || "reels";

    let tags = `#Kuran #Tilavet #${surahTag}Suresi #Ayet #Huzur #TilawahWorld #Reels #Keşfet`;
    let header = `📖 ${surahMeta[1]} Sûresi (${state.ayahStart}-${state.ayahEnd}. Âyetler)
🎙️ Hâfız: ${reciterMeta.name}`;

    if (plat === "tiktok") {
      tags = `#kuranıkerim #tilavet #${surahTag.toLowerCase()}suresi #ayetler #huzur #keşfet #fyp`;
    } else if (plat === "shorts") {
      header = `📖 ${surahMeta[1]} Sûresi ${state.ayahStart}-${state.ayahEnd}. Âyetler | ${reciterMeta.name} #Shorts`;
      tags = `#Shorts #Kuran #Tilavet #${surahTag}Suresi #Ayet`;
    } else if (plat === "youtube") {
      header = `${surahMeta[1]} Sûresi (${state.ayahStart}-${state.ayahEnd}. Âyetler) - Huzur Veren Kur'ân-ı Kerîm Tilâveti
Okuyan Hâfız: ${reciterMeta.name}`;
      tags = `#KuranıKerim #Tilavet #${surahTag}Suresi #Meal #Tefekkür`;
    } else if (plat === "whatsapp") {
      header = `✨ *${surahMeta[1]} Sûresi (${state.ayahStart}-${state.ayahEnd}. Âyetler)*
🎙️ _${reciterMeta.name}_`;
      tags = `🌿 _Tilawah World_`;
    }

    const txt = document.getElementById("txtSocialCaption");
    if (txt) txt.value = `${header}

` + (mealSnippet ? `${mealSnippet}

` : "") + tags;
  }

  function downloadExportedVideo() {
    if (!state.lastExportBlob || !(state.lastExportBlob instanceof Blob)) {
      showToast("Önce '🎬 Oluştur' düğmesiyle video hazırlayın.");
      return;
    }
    const fileName = formatExportFileName(state, SURAHS, RECITERS, state.lastExportExt);
    const dlUrl = state.lastExportObjectUrl || URL.createObjectURL(state.lastExportBlob);
    const a = document.createElement("a");
    a.href = dlUrl;
    a.download = fileName;
    a.style.display = "none";
    document.body.appendChild(a);
    a.click();
    setTimeout(() => a.remove(), 400);
    showToast(`Video hazır: ${fileName}`);
  }

  const TAB_TITLES = {
    stil: "STİL — 8 SADE TİPOGRAFİ VE ATMOSFER STİLİ",
    kesit: "KESİT — SÛRE ARAMA VE ÂYET ARALIĞI",
    hafiz: "HÂFIZ — KIRAAT İMAMI SEÇİMİ",
    zemin: "ZEMİN — SADECE GALERİM & VİDEO ARALIĞI (00:30–01:45)",
    ortam: "ORTAM — DOĞA, YAĞMUR VE MİKSER",
    metin: "METİN — ARAPÇA, TÜRKÇE, İNGİLİZCE VE VURGU",
    gorunum: "GÖRÜNÜM — DÜZEN, SÜRE ŞERİDİ VE KONUM",
    filtre: "FİLTRE — KARARTMA, BULANIKLIK VE EFEKT",
    kapak: "KAPAK — ŞABLON, ARAPÇA/TÜRKÇE SÛRE ADI VE KONUM",
    bicim: "BİÇİM — ORAN, KALİTE, LOGO VE PAYLAŞIM"
  };

  function switchToolTab(tabId) {
    const drawer = document.getElementById("toolDrawer");
    if (state.activeTab === tabId && !state.drawerCollapsed) {
      state.drawerCollapsed = true;
      if (drawer) drawer.classList.add("collapsed");
      document.querySelectorAll(".tool-btn").forEach((b) => b.classList.remove("active"));
      setTimeout(fitCanvasWrapToStage, 230);
      return;
    }

    state.activeTab = tabId;
    state.drawerCollapsed = false;
    if (drawer) drawer.classList.remove("collapsed");

    document.querySelectorAll(".tool-btn").forEach((b) => {
      b.classList.toggle("active", b.dataset.tab === tabId);
    });
    document.querySelectorAll(".tab-pane").forEach((p) => {
      p.classList.toggle("active", p.id === `tab-${tabId}`);
    });

    const titleEl = document.getElementById("drawerTitle");
    if (titleEl) titleEl.textContent = TAB_TITLES[tabId] || tabId.toUpperCase();

    if (tabId === "kapak") {
      state.coverPreviewMode = "cover";
      const chk = document.getElementById("chkPreviewCoverNow");
      if (chk) chk.checked = true;
      renderAyahTimelineStrip();
    } else if (state.coverPreviewMode === "cover") {
      state.coverPreviewMode = "ayah";
      const chk = document.getElementById("chkPreviewCoverNow");
      if (chk) chk.checked = false;
      renderAyahTimelineStrip();
    }
    setTimeout(fitCanvasWrapToStage, 230);
  }

  function populateSurahAndReciterSelectors(filterQuery = "") {
    const selSurah = document.getElementById("selSurah");
    if (selSurah) {
      selSurah.innerHTML = "";
      const q = normalizeHashtagWord(filterQuery).toLowerCase();
      const rawQ = (filterQuery || "").trim().toLowerCase();

      const matching = SURAHS.filter(([no, nameTr, nameAr]) => {
        if (!rawQ) return true;
        const normTr = normalizeHashtagWord(nameTr).toLowerCase();
        return (
          String(no).includes(rawQ) ||
          nameTr.toLowerCase().includes(rawQ) ||
          normTr.includes(q) ||
          nameAr.includes(rawQ)
        );
      });

      const listToUse = matching.length > 0 ? matching : SURAHS;
      listToUse.forEach(([no, nameTr, nameAr, count]) => {
        const opt = document.createElement("option");
        opt.value = no;
        opt.textContent = `${no}. ${nameTr} (${count})`;
        if (no === state.surahNo) opt.selected = true;
        selSurah.appendChild(opt);
      });
    }
    populateAyahRangeSelectors(true);
  }

  function populateAyahRangeSelectors(preserveCurrent = false) {
    const surahMeta = SURAHS.find((s) => s[0] === state.surahNo) || SURAHS[0];
    const maxAyah = surahMeta[3];
    if (!preserveCurrent) {
      state.ayahStart = 1;
      state.ayahEnd = Math.min(7, maxAyah);
    } else {
      state.ayahStart = Math.max(1, Math.min(maxAyah, state.ayahStart || 1));
      state.ayahEnd = Math.max(state.ayahStart, Math.min(maxAyah, state.ayahEnd || state.ayahStart));
    }

    const selStart = document.getElementById("selAyahStart");
    const selEnd = document.getElementById("selAyahEnd");
    if (!selStart || !selEnd) return;
    selStart.innerHTML = "";
    selEnd.innerHTML = "";

    for (let i = 1; i <= maxAyah; i++) {
      const o1 = document.createElement("option");
      o1.value = i;
      o1.textContent = `${i}`;
      if (i === state.ayahStart) o1.selected = true;
      selStart.appendChild(o1);

      const o2 = document.createElement("option");
      o2.value = i;
      o2.textContent = `${i}`;
      if (i === state.ayahEnd) o2.selected = true;
      selEnd.appendChild(o2);
    }
  }

  function fitCanvasWrapToStage() {
    const stage = document.getElementById("stageArea");
    const wrap = document.getElementById("canvasWrap");
    if (!stage || !wrap) return;

    const availW = Math.max(120, stage.clientWidth - 20);
    const availH = Math.max(120, stage.clientHeight - 8);
    const targetRatio = (canvas.width || 1080) / (canvas.height || 1920);

    let boxH = availH;
    let boxW = boxH * targetRatio;
    if (boxW > availW) {
      boxW = availW;
      boxH = boxW / targetRatio;
    }

    wrap.style.width = `${Math.round(boxW)}px`;
    wrap.style.height = `${Math.round(boxH)}px`;
  }

  function updateCanvasResolutionAndRatio() {
    const wrap = document.getElementById("canvasWrap");
    if (wrap) wrap.classList.remove("ratio-4-5", "ratio-1-1", "ratio-16-9");

    const baseDim = state.resolution === 1080 ? 1080 : 720;
    if (state.platformRatio === "9:16") {
      canvas.width = baseDim;
      canvas.height = Math.round((baseDim * 16) / 9);
    } else if (state.platformRatio === "4:5") {
      if (wrap) wrap.classList.add("ratio-4-5");
      canvas.width = baseDim;
      canvas.height = Math.round((baseDim * 5) / 4);
    } else if (state.platformRatio === "16:9") {
      if (wrap) wrap.classList.add("ratio-16-9");
      canvas.width = Math.round((baseDim * 16) / 9);
      canvas.height = baseDim;
    } else {
      if (wrap) wrap.classList.add("ratio-1-1");
      canvas.width = baseDim;
      canvas.height = baseDim;
    }

    document.querySelectorAll("#ratioCardsList .sebat-list-item").forEach((el) => {
      const isAct = el.dataset.ratio === state.platformRatio;
      el.classList.toggle("active", isAct);
      const dot = el.querySelector(".ratio-dot");
      if (dot) dot.textContent = isAct ? "●" : "";
    });

    fitCanvasWrapToStage();
    updateHeaderAndBottomSummary();
  }

  function syncAllControlsFromState() {
    document.documentElement.setAttribute("data-theme", state.uiTheme || "black");

    populateSurahAndReciterSelectors(state.surahSearch);
    renderStylePresetsGrid();
    renderKnownExcerptsList();
    renderRecitersList();
    renderAmbientSoundList();
    renderColorSwatches();
    renderCoverTemplateChips();
    renderCoverAyahCircles();
    renderUserPresetsList();

    const setVal = (id, v) => { const el = document.getElementById(id); if (el && typeof v !== "undefined") el.value = v; };
    const setTxt = (id, t) => { const el = document.getElementById(id); if (el) el.textContent = t; };
    const setChk = (id, b) => { const el = document.getElementById(id); if (el) el.checked = Boolean(b); };

    setVal("rngBgZoom", state.bgZoom);
    setTxt("valBgZoom", `${(state.bgZoom / 100).toFixed(2)}x`);
    setVal("rngBgPanX", state.bgPanX);
    setTxt("valBgPanX", `${state.bgPanX}%`);
    setVal("rngBgPanY", state.bgPanY);
    setTxt("valBgPanY", `${state.bgPanY}%`);
    setChk("chkBgMirror", state.bgMirror);
    setChk("chkVideoSmoothLoop", state.videoSmoothLoop !== false);

    document.querySelectorAll("#bgVideoSpeedGroup .sebat-opt-btn").forEach((b) => {
      b.classList.toggle("active", Number(b.dataset.vspeed) === Number(state.bgVideoSpeed || 1));
    });

    setVal("rngZeminVideoVol", state.bgVideoVol || 0);
    setTxt("valZeminVideoVol", state.bgVideoVol > 0 ? `%${state.bgVideoVol}` : "%0 (Sessiz)");

    syncVideoTrimControlsUI();

    setVal("selBismillahMode", state.bismillahMode);

    setVal("rngAmbientVol", state.ambientVol);
    setTxt("valAmbientVol", `%${state.ambientVol}`);
    setVal("rngReciterVol", state.reciterVol);
    setTxt("valReciterVol", `%${state.reciterVol}`);
    setVal("selVideoAudioMode", state.videoAudioMode);
    setVal("rngBgVideoVol", state.bgVideoVol);
    setTxt("valBgVideoVol", `%${state.bgVideoVol}`);
    setVal("rngGaplessTrim", state.gaplessTrimSec);
    setTxt("valGaplessTrim", `${Number(state.gaplessTrimSec).toFixed(2)} sn`);
    setVal("selSmoothFadeOut", state.smoothFadeOut);
    setVal("selAudioFailPolicy", state.audioFailPolicy);

    document.querySelectorAll("#arabicFontGroup .sebat-opt-btn").forEach((b) => {
      b.classList.toggle("active", b.dataset.arfont === state.arabicFont);
    });
    setVal("inpArabicColor", state.arabicColor);
    setVal("rngArabicSize", state.arabicSize);
    setTxt("valArabicSize", `${state.arabicSize} px`);
    setVal("rngArabicLetterSpacing", state.arabicLetterSpacing);
    setTxt("valArabicLetterSpacing", `${state.arabicLetterSpacing} px`);
    setVal("rngTextShadow", state.textShadow);
    setTxt("valTextShadow", `${state.textShadow} px`);

    document.querySelectorAll("#mealEditionGroup .sebat-opt-btn").forEach((b) => {
      b.classList.toggle("active", b.dataset.edition === state.mealEdition);
    });
    document.querySelectorAll("#mealStyleGroup .sebat-opt-btn").forEach((b) => {
      b.classList.toggle("active", b.dataset.mstyle === state.mealStyle);
    });
    setVal("inpMealColor", state.mealColor);
    setVal("rngMealSize", state.mealSize);
    setTxt("valMealSize", `${state.mealSize} px`);

    document.querySelectorAll("#mealNumFormatGroup .sebat-opt-btn").forEach((b) => {
      b.classList.toggle("active", b.dataset.numfmt === (state.mealNumberFormat || "hyphen"));
    });

    setChk("chkShowEnMealQuick", state.subtitleMode === "both" || state.subtitleMode === "en");
    setVal("inpEnMealColor", state.enMealColor || "#CBD5E1");
    setVal("rngEnMealSize", state.enMealSize || 18);
    setTxt("valEnMealSize", `${state.enMealSize || 18} px`);

    document.querySelectorAll("#wordHighlightGroup .sebat-opt-btn").forEach((b) => {
      b.classList.toggle("active", (b.dataset.wh === "on") === Boolean(state.wordHighlight));
    });
    setVal("inpHighlightColor", state.wordHighlightColor || "#F8E5A6");
    document.querySelectorAll("#highlightStyleGroup .sebat-opt-btn").forEach((b) => {
      b.classList.toggle("active", b.dataset.hlstyle === (state.wordHighlightStyle || "glow"));
    });
    const wOff = Number(state.wordTimingOffset) || 0;
    setVal("rngWordTimingOffset", wOff);
    setTxt("valWordTimingOffset", `${wOff > 0 ? "+" : ""}${wOff.toFixed(2)} sn`);

    document.querySelectorAll("#subtitleModeGroup .sebat-opt-btn").forEach((b) => {
      b.classList.toggle("active", b.dataset.submode === state.subtitleMode);
    });
    setVal("selInVideoProgressBar", state.inVideoProgressBar);
    setVal("selInVideoSurahHeader", state.inVideoSurahHeader);

    document.getElementById("btnCornerSurah").classList.toggle("active", Boolean(state.cornerShowSurah));
    document.getElementById("btnCornerAyahs").classList.toggle("active", Boolean(state.cornerShowAyahs));
    document.getElementById("btnCornerReciter").classList.toggle("active", Boolean(state.cornerShowReciter));

    document.querySelectorAll("#textBoxStyleGroup .sebat-opt-btn").forEach((b) => {
      b.classList.toggle("active", b.dataset.box === state.textBoxStyle);
    });
    document.querySelectorAll("#textReadabilityGroup .sebat-opt-btn").forEach((b) => {
      b.classList.toggle("active", b.dataset.read === state.textReadability);
    });
    document.querySelectorAll("#textAlignPosGroup .sebat-opt-btn").forEach((b) => {
      b.classList.toggle("active", b.dataset.pos === state.textAlignPos);
    });
    setVal("rngTextOffsetY", state.textOffsetY);
    setTxt("valTextOffsetY", `${state.textOffsetY}%`);
    setVal("rngTextOffsetX", state.textOffsetX || 0);
    setTxt("valTextOffsetX", `${state.textOffsetX || 0}%`);
    document.querySelectorAll("#transitionModeGroup .sebat-opt-btn").forEach((b) => {
      b.classList.toggle("active", b.dataset.trans === state.transitionMode);
    });

    const bOff = state.bgBrightnessOffset || 0;
    setVal("rngBrightnessOffset", bOff);
    setTxt("valBrightnessOffset", bOff > 0 ? `+${bOff}` : `${bOff}`);

    const warmth = state.bgWarmth || 0;
    setVal("rngBgWarmth", warmth);
    setTxt("valBgWarmth", warmth > 0 ? `+${warmth}` : `${warmth}`);

    setVal("rngBgDim", state.bgDim);
    setTxt("valBgDim", `%${state.bgDim}`);
    setChk("chkLockBgDim", state.lockBgDim);
    setVal("rngBgBlur", state.bgBlur);
    setTxt("valBgBlur", `%${Math.round((state.bgBlur / 20) * 100)}`);
    setVal("selVisualEffect", state.visualEffect);
    setVal("rngEffectIntensity", state.effectIntensity);
    setTxt("valEffectIntensity", `%${state.effectIntensity}`);

    setChk("chkCoverLargeSurah", state.coverLargeSurah);
    setChk("chkCoverWithVideo", state.coverFirstFrame === "on");
    setChk("chkPreviewCoverNow", state.coverPreviewMode === "cover");
    setChk("chkCoverShowArSurah", state.coverShowArSurah !== false);
    setChk("chkCoverShowTrSurah", state.coverShowTrSurah !== false);
    setVal("inpCoverSurahNameAr", state.coverSurahNameAr || "");
    setVal("inpCoverSurahName", state.coverSurahName || "");
    setVal("inpCoverTitle", state.coverTitle);
    setVal("inpCoverSubtitle", state.coverSubtitle);
    setVal("rngCoverScale", state.coverScale);
    setTxt("valCoverScale", `%${state.coverScale}`);
    setVal("rngCoverOffsetY", state.coverOffsetY);
    setTxt("valCoverOffsetY", `${state.coverOffsetY}%`);
    setVal("rngCoverOffsetX", state.coverOffsetX);
    setTxt("valCoverOffsetX", `${state.coverOffsetX}%`);
    setVal("selCoverPos", state.coverPos);
    setVal("selCoverBgOverride", state.coverBgOverride);

    document.querySelectorAll("#qualityGroup .sebat-opt-btn").forEach((b) => {
      b.classList.toggle("active", Number(b.dataset.res) === Number(state.resolution));
    });
    setVal("selBitrateMbps", state.bitrateMbps);
    setVal("selExportEngine", state.exportEngine);
    setVal("selFileNameFormat", state.fileNameFormat);
    setChk("chkShowSignature", state.showSignature);
    setVal("selLogoPos", state.logoPos);
    setVal("rngLogoScale", state.logoScale);
    setTxt("valLogoScale", `%${state.logoScale}`);
    setVal("rngLogoOpacity", state.logoOpacity);
    setTxt("valLogoOpacity", `%${state.logoOpacity}`);
    setVal("inpWatermarkText", state.watermarkText);
    setVal("selCaptionPlatform", state.captionPlatform);
    setVal("selUiTheme", state.uiTheme);

    updateCanvasResolutionAndRatio();
  }

  async function refreshStorageStatsUI() {
    const stats = await getStorageStats();
    const el = document.getElementById("lblStorageStatsSummary");
    if (el) {
      el.textContent = `${stats.galleryCount} kişisel medya (${stats.galleryMB} MB) · ${stats.cachedAyahCount} çevrimdışı âyet önbellekte`;
    }
  }

  function enhanceSlidersWithSteppersAndReset() {
    document.querySelectorAll('input[type="range"]').forEach((rng) => {
      if (rng.parentElement && rng.parentElement.classList.contains("slider-stepper-wrap")) return;
      const wrap = document.createElement("div");
      wrap.className = "slider-stepper-wrap";

      const btnMinus = document.createElement("button");
      btnMinus.type = "button";
      btnMinus.className = "step-btn";
      btnMinus.textContent = "−";
      btnMinus.title = "Azalt";

      const btnPlus = document.createElement("button");
      btnPlus.type = "button";
      btnPlus.className = "step-btn";
      btnPlus.textContent = "+";
      btnPlus.title = "Artır";

      rng.parentNode.insertBefore(wrap, rng);
      wrap.appendChild(btnMinus);
      wrap.appendChild(rng);
      wrap.appendChild(btnPlus);

      const stepSlider = (dir) => {
        hapticTap(6);
        const step = Number(rng.step) || 1;
        const min = Number(rng.min);
        const max = Number(rng.max);
        const cur = Number(rng.value);
        const next = Math.max(min, Math.min(max, Number((cur + dir * step).toFixed(3))));
        rng.value = String(next);
        rng.dispatchEvent(new Event("input", { bubbles: true }));
      };

      btnMinus.addEventListener("click", () => stepSlider(-1));
      btnPlus.addEventListener("click", () => stepSlider(1));
    });

    document.querySelectorAll(".slider-val[data-reset-target]").forEach((badge) => {
      badge.addEventListener("click", () => {
        const targetId = badge.getAttribute("data-reset-target");
        const resetVal = badge.getAttribute("data-reset-val");
        const rng = document.getElementById(targetId);
        if (rng && resetVal !== null) {
          hapticTap(12);
          rng.value = resetVal;
          rng.dispatchEvent(new Event("input", { bubbles: true }));
          showToast("Varsayılan değere sıfırlandı.");
        }
      });
    });
  }

  function syncMoveSlidersFromActiveTarget() {
    const mode = state.activeMoveTarget || "auto";
    let ox = state.textOffsetX || 0;
    let oy = state.textOffsetY || 0;
    if (mode === "ar") { ox = state.arOffsetX || 0; oy = state.arOffsetY || 0; }
    else if (mode === "tr") { ox = state.trOffsetX || 0; oy = state.trOffsetY || 0; }
    else if (mode === "en") { ox = state.enOffsetX || 0; oy = state.enOffsetY || 0; }

    const rx = document.getElementById("rngTextOffsetX");
    const ry = document.getElementById("rngTextOffsetY");
    if (rx) { rx.min = "-45"; rx.max = "45"; rx.value = String(ox); }
    if (ry) { ry.min = "-45"; ry.max = "45"; ry.value = String(oy); }
    const vx = document.getElementById("valTextOffsetX");
    const vy = document.getElementById("valTextOffsetY");
    if (vx) vx.textContent = `${ox}%`;
    if (vy) vy.textContent = `${oy}%`;

    document.querySelectorAll("#moveTargetGroup .sebat-opt-btn").forEach((b) => {
      b.classList.toggle("active", b.dataset.mtarget === mode);
    });
  }

  function detectClosestTextBlock(canvasX, canvasY) {
    if (state.activeMoveTarget && state.activeMoveTarget !== "auto") {
      return state.activeMoveTarget;
    }
    const candidates = [];
    ["ar", "tr", "en"].forEach((key) => {
      const b = lastRenderedBlocks[key];
      if (!b) return;
      let dy = 0;
      if (canvasY < b.top) dy = b.top - canvasY;
      else if (canvasY > b.bottom) dy = canvasY - b.bottom;
      candidates.push({ key, dist: dy, centerDist: Math.abs(canvasY - b.cy) });
    });
    if (candidates.length === 0) return "all";
    candidates.sort((a, b) => (a.dist - b.dist) || (a.centerDist - b.centerDist));
    return candidates[0].key;
  }

  function bindCanvasDirectTouchDrag() {
    let startClientX = 0;
    let startClientY = 0;
    let startOffX = 0;
    let startOffY = 0;
    let movedSignificantly = false;
    let pointerActive = false;

    const hintEl = document.getElementById("stageDragHint");
    const blockNames = {
      ar: "Arapça Hat",
      tr: "Türkçe Meal",
      en: "İngilizce Meal",
      all: "Tüm Metinler",
      cover: "Kapak"
    };

    canvas.addEventListener("pointerdown", (ev) => {
      if (state.isRecording) return;
      pointerActive = true;
      movedSignificantly = false;
      startClientX = ev.clientX;
      startClientY = ev.clientY;

      const rect = canvas.getBoundingClientRect();
      const canvasX = ((ev.clientX - rect.left) / Math.max(1, rect.width)) * canvas.width;
      const canvasY = ((ev.clientY - rect.top) / Math.max(1, rect.height)) * canvas.height;

      const isCover = state.coverPreviewMode === "cover";
      if (isCover) {
        activeDragBlockKey = "cover";
        startOffX = state.coverOffsetX || 0;
        startOffY = state.coverOffsetY || 0;
      } else {
        activeDragBlockKey = detectClosestTextBlock(canvasX, canvasY);
        if (activeDragBlockKey === "ar") {
          startOffX = state.arOffsetX || 0;
          startOffY = state.arOffsetY || 0;
        } else if (activeDragBlockKey === "tr") {
          startOffX = state.trOffsetX || 0;
          startOffY = state.trOffsetY || 0;
        } else if (activeDragBlockKey === "en") {
          startOffX = state.enOffsetX || 0;
          startOffY = state.enOffsetY || 0;
        } else {
          startOffX = state.textOffsetX || 0;
          startOffY = state.textOffsetY || 0;
        }
      }

      try { canvas.setPointerCapture(ev.pointerId); } catch (_) {}
    });

    canvas.addEventListener("pointermove", (ev) => {
      if (!pointerActive) return;
      const dxPx = ev.clientX - startClientX;
      const dyPx = ev.clientY - startClientY;

      if (!movedSignificantly && Math.hypot(dxPx, dyPx) < 6) return;
      movedSignificantly = true;
      isDraggingCanvasText = true;

      const rect = canvas.getBoundingClientRect();
      const pctX = (dxPx / Math.max(100, rect.width)) * 100;
      const pctY = (dyPx / Math.max(100, rect.height)) * 100;

      const maxX = activeDragBlockKey === "cover" ? 30 : 45;
      const maxY = activeDragBlockKey === "cover" ? 35 : 45;

      let newX = Math.round(Math.max(-maxX, Math.min(maxX, startOffX + pctX)));
      let newY = Math.round(Math.max(-maxY, Math.min(maxY, startOffY + pctY)));

      snapGuideX = Math.abs(newX) <= 2;
      snapGuideY = Math.abs(newY) <= 2;
      if (snapGuideX) newX = 0;
      if (snapGuideY) newY = 0;

      if (activeDragBlockKey === "cover") {
        state.coverOffsetX = newX;
        state.coverOffsetY = newY;
        const rx = document.getElementById("rngCoverOffsetX");
        const ry = document.getElementById("rngCoverOffsetY");
        if (rx) rx.value = newX;
        if (ry) ry.value = newY;
        document.getElementById("valCoverOffsetX").textContent = `${newX}%`;
        document.getElementById("valCoverOffsetY").textContent = `${newY}%`;
      } else if (activeDragBlockKey === "ar") {
        state.arOffsetX = newX;
        state.arOffsetY = newY;
        syncMoveSlidersFromActiveTarget();
      } else if (activeDragBlockKey === "tr") {
        state.trOffsetX = newX;
        state.trOffsetY = newY;
        syncMoveSlidersFromActiveTarget();
      } else if (activeDragBlockKey === "en") {
        state.enOffsetX = newX;
        state.enOffsetY = newY;
        syncMoveSlidersFromActiveTarget();
      } else {
        state.textOffsetX = newX;
        state.textOffsetY = newY;
        syncMoveSlidersFromActiveTarget();
      }

      if (hintEl) {
        const label = blockNames[activeDragBlockKey] || "Metin";
        hintEl.textContent = `✥ ${label}: X ${newX}% · Y ${newY}%`;
        hintEl.classList.add("visible");
      }
    });

    const endDrag = (ev) => {
      if (!pointerActive) return;
      pointerActive = false;
      try { canvas.releasePointerCapture(ev.pointerId); } catch (_) {}

      if (movedSignificantly) {
        isDraggingCanvasText = false;
        activeDragBlockKey = null;
        snapGuideX = false;
        snapGuideY = false;
        if (hintEl) hintEl.classList.remove("visible");
        persistState();
      } else {
        const wrap = document.getElementById("canvasWrap");
        if (wrap) wrap.classList.toggle("clean-ui");
      }
    };

    canvas.addEventListener("pointerup", endDrag);
    canvas.addEventListener("pointercancel", endDrag);
  }

  function bindEvents() {
    enhanceSlidersWithSteppersAndReset();
    bindCanvasDirectTouchDrag();

    // Sub-tab Switching inside Drawer Panels
    document.querySelectorAll(".subtab-bar .subtab-btn").forEach((btn) => {
      btn.addEventListener("click", () => {
        hapticTap();
        const bar = btn.closest(".subtab-bar");
        const group = bar ? bar.dataset.subtabGroup : "";
        const targetId = `subtab-${btn.dataset.subtab}`;

        if (bar) {
          bar.querySelectorAll(".subtab-btn").forEach((b) => b.classList.toggle("active", b === btn));
        }
        document.querySelectorAll(`.subtab-pane[data-subtab-group="${group}"]`).forEach((pane) => {
          pane.classList.toggle("active", pane.id === targetId);
        });
      });
    });

    // 10-Tool Grid Navigation
    document.querySelectorAll(".tool-btn").forEach((btn) => {
      btn.addEventListener("click", () => {
        hapticTap();
        switchToolTab(btn.dataset.tab);
      });
    });

    document.getElementById("btnCloseDrawer").addEventListener("click", () => {
      hapticTap();
      state.drawerCollapsed = true;
      document.getElementById("toolDrawer").classList.add("collapsed");
      document.querySelectorAll(".tool-btn").forEach((b) => b.classList.remove("active"));
      setTimeout(fitCanvasWrapToStage, 230);
    });

    document.getElementById("btnToggleCleanUI").addEventListener("click", () => {
      hapticTap();
      const wrap = document.getElementById("canvasWrap");
      if (wrap) {
        const isClean = wrap.classList.toggle("clean-ui");
        showToast(isClean ? "Temiz önizleme (butonlar gizlendi)" : "Önizleme butonları görünür");
      }
    });

    document.getElementById("headerLogoImg").addEventListener("click", () => {
      hapticTap();
      const themes = ["black", "emerald", "midnight"];
      const next = themes[(themes.indexOf(state.uiTheme) + 1) % themes.length];
      state.uiTheme = next;
      document.documentElement.setAttribute("data-theme", next);
      document.getElementById("selUiTheme").value = next;
      persistState();
      showToast(next === "black" ? "Siyah & Altın Tema" : next === "emerald" ? "Derin Zümrüt Tema" : "Gece Mavisi Tema");
    });

    // Undo / Redo
    document.getElementById("btnUndo").addEventListener("click", async () => {
      if (historyPointer > 0) {
        hapticTap();
        historyPointer--;
        await applyHistorySnapshot(historyStack[historyPointer]);
        showToast("Geri alındı.");
      }
    });
    document.getElementById("btnRedo").addEventListener("click", async () => {
      if (historyPointer < historyStack.length - 1) {
        hapticTap();
        historyPointer++;
        await applyHistorySnapshot(historyStack[historyPointer]);
        showToast("İleri alındı.");
      }
    });

    // On-Canvas Play & Fullscreen Buttons
    document.getElementById("btnPlayPreview").addEventListener("click", () => {
      hapticTap();
      if (state.isPlaying || state.isRecording) {
        stopPlaybackAndRecording(true);
      } else {
        startStudioSession(false);
      }
    });

    document.getElementById("btnFullscreenPreview").addEventListener("click", () => {
      hapticTap();
      const drawer = document.getElementById("toolDrawer");
      state.drawerCollapsed = !state.drawerCollapsed;
      drawer.classList.toggle("collapsed", state.drawerCollapsed);
      setTimeout(fitCanvasWrapToStage, 230);
    });

    // Bottom Export & Share Buttons
    document.getElementById("btnRecordExport").addEventListener("click", () => {
      hapticTap(20);
      if (state.isRecording) {
        stopPlaybackAndRecording(true);
        showToast("Video kaydı iptal edildi.");
      } else {
        startStudioSession(true);
      }
    });
    document.getElementById("btnDownloadLastVideo").addEventListener("click", () => {
      hapticTap();
      downloadExportedVideo();
    });
    document.getElementById("btnShareLastVideo").addEventListener("click", () => {
      hapticTap();
      shareExportedVideo();
    });
    const btnModalShare = document.getElementById("btnModalShareVideo");
    if (btnModalShare) {
      btnModalShare.addEventListener("click", () => {
        hapticTap();
        shareExportedVideo();
      });
    }
    const btnCloseModal = document.getElementById("btnCloseExportModal");
    if (btnCloseModal) {
      btnCloseModal.addEventListener("click", () => {
        hapticTap();
        const modal = document.getElementById("exportReadyModal");
        const vid = document.getElementById("exportPreviewVideo");
        if (vid) { try { vid.pause(); } catch (_) {} }
        if (modal) modal.classList.remove("show");
      });
    }

    // Timeline Scrubber Click
    document.getElementById("progressBarTrack").addEventListener("click", (ev) => {
      if (!state.versesLoaded || state.verses.length === 0) return;
      const rect = ev.currentTarget.getBoundingClientRect();
      const ratio = Math.max(0, Math.min(1, (ev.clientX - rect.left) / rect.width));
      const idx = Math.min(state.verses.length - 1, Math.floor(ratio * state.verses.length));
      state.coverPreviewMode = "ayah";
      const chk = document.getElementById("chkPreviewCoverNow");
      if (chk) chk.checked = false;
      jumpToVerseIndex(idx);
    });

    // Kesit Controls
    document.getElementById("inpSurahSearch").addEventListener("input", async (e) => {
      state.surahSearch = e.target.value;
      populateSurahAndReciterSelectors(state.surahSearch);
      const sel = document.getElementById("selSurah");
      if (sel && sel.options.length > 0) {
        const firstNo = Number(sel.options[0].value);
        if (firstNo && firstNo !== state.surahNo) {
          state.surahNo = firstNo;
          populateAyahRangeSelectors(false);
          renderKnownExcerptsList();
          persistState();
          await loadVersesAndPreloadAudio();
        }
      }
    });

    document.getElementById("selSurah").addEventListener("change", async (e) => {
      state.surahNo = Number(e.target.value);
      populateAyahRangeSelectors(false);
      renderKnownExcerptsList();
      persistState();
      await loadVersesAndPreloadAudio();
    });
    document.getElementById("selAyahStart").addEventListener("change", async (e) => {
      state.ayahStart = Number(e.target.value);
      if (state.ayahEnd < state.ayahStart) {
        state.ayahEnd = state.ayahStart;
        document.getElementById("selAyahEnd").value = state.ayahEnd;
      }
      renderKnownExcerptsList();
      persistState();
      await loadVersesAndPreloadAudio();
    });
    document.getElementById("selAyahEnd").addEventListener("change", async (e) => {
      state.ayahEnd = Number(e.target.value);
      if (state.ayahEnd < state.ayahStart) {
        state.ayahStart = state.ayahEnd;
        document.getElementById("selAyahStart").value = state.ayahStart;
      }
      renderKnownExcerptsList();
      persistState();
      await loadVersesAndPreloadAudio();
    });

    document.getElementById("btnAyahMinus").addEventListener("click", async () => {
      if (state.ayahEnd > state.ayahStart) {
        hapticTap();
        state.ayahEnd--;
        document.getElementById("selAyahEnd").value = String(state.ayahEnd);
        renderKnownExcerptsList();
        persistState();
        await loadVersesAndPreloadAudio();
      } else {
        showToast("En az 1 âyet seçili olmalıdır.");
      }
    });
    document.getElementById("btnAyahPlus").addEventListener("click", async () => {
      const surahMeta = SURAHS.find((s) => s[0] === state.surahNo) || SURAHS[0];
      const maxAyah = surahMeta[3];
      if (state.ayahEnd < maxAyah) {
        hapticTap();
        state.ayahEnd++;
        document.getElementById("selAyahEnd").value = String(state.ayahEnd);
        renderKnownExcerptsList();
        persistState();
        await loadVersesAndPreloadAudio();
      } else {
        showToast("Sûrenin son âyetine ulaşıldı.");
      }
    });

    document.getElementById("selBismillahMode").addEventListener("change", async (e) => {
      state.bismillahMode = e.target.value;
      persistState();
      await loadVersesAndPreloadAudio();
    });
    document.getElementById("btnRetryFailedAudio").addEventListener("click", () => {
      hapticTap();
      loadVersesAndPreloadAudio();
    });
    document.getElementById("btnContinueTextOnly").addEventListener("click", () => {
      hapticTap();
      enableTextOnlyContinueMode();
    });

    // Hâfız Search
    document.getElementById("inpReciterSearch").addEventListener("input", (e) => {
      state.reciterSearch = e.target.value;
      renderRecitersList();
    });

    // ZEMİN — Galerim Upload, Clear, Direct URL
    const upEl = document.getElementById("inpUploadMedia"); if (upEl) upEl.setAttribute("accept", "*/*");
    document.getElementById("inpUploadMedia").addEventListener("change", async (e) => {
      const files = Array.from(e.target.files || []);
      if (files.length === 0) return;
      showToast("Medya Galerim'e ekleniyor...");
      let lastId = null;
      let lastIsVideo = false;
      for (const f of files) {
        try {
          const item = await processUploadedFile(f);
          await saveGalleryItem(item);
          lastId = item.id;
          lastIsVideo = (item.type === "video");
        } catch (_) {}
      }
      galleryItems = await getAllGalleryItems();
      if (lastId) await selectZemin(lastId);
      refreshStorageStatsUI();
      if (lastIsVideo) {
        showToast("Video yüklendi! '✂️ Video Aralığı' sekmesinden dakika:saniye seçebilirsiniz.");
      } else {
        showToast("Görsel Galerim'e eklendi.");
      }
    });

    document.getElementById("btnClearGallery").addEventListener("click", async () => {
      hapticTap();
      await clearAllGallery();
      galleryItems = [];
      await selectZemin("studio_dark");
      refreshStorageStatsUI();
      showToast("Galerim temizlendi.");
    });

    document.getElementById("btnAddDirectMediaUrl").addEventListener("click", async () => {
      const url = (document.getElementById("inpDirectMediaUrl").value || "").trim();
      if (!url) {
        showToast("Lütfen geçerli bir video veya görsel URL'si girin.");
        return;
      }
      const isVid = /\.(mp4|webm|mov)(\?|$)/i.test(url);
      const item = {
        id: "url_" + Date.now(),
        name: "URL Medya",
        type: isVid ? "video" : "image",
        src: url,
        category: "Galerim",
        trimStart: 0,
        trimEnd: 0,
        recommendedDarkness: 40,
        defaultEffect: "none",
        palette: ["#07080A", "#12151C", "#E0B84C"]
      };
      await saveGalleryItem(item);
      galleryItems = await getAllGalleryItems();
      await selectZemin(item.id);
      document.getElementById("inpDirectMediaUrl").value = "";
      showToast("URL medyası Galerim'e eklendi.");
    });

    // ZEMİN — Sub-tab 2: Dakika:Saniye (00:30 – 01:45) Video Range Controls
    const applyNewTrimRange = async (newStart, newEnd, seekTarget) => {
      let s = Math.max(0, Math.round(Number(newStart) || 0));
      let e = Math.max(0, Math.round(Number(newEnd) || 0));
      if (e > 0 && e <= s) {
        e = s + 1;
      }

      state.videoTrimStart = s;
      state.videoTrimEnd = e;
      syncVideoTrimControlsUI();

      if (activeBgVideo) {
        try {
          const vDur = (Number.isFinite(activeBgVideo.duration) && activeBgVideo.duration > 0) ? activeBgVideo.duration : 0;
          const rawTarget = (seekTarget === "end" && e > 0) ? Math.max(s, e - 0.5) : s;
          activeBgVideo.currentTime = (vDur > 0 && rawTarget >= vDur) ? (rawTarget % vDur) : rawTarget;
        } catch (_) {}
      }

      await persistActiveVideoTrimToGallery();
      persistState();
    };

    document.getElementById("inpTrimStartMMSS").addEventListener("change", (ev) => {
      const parsed = parseMMSS(ev.target.value);
      applyNewTrimRange(parsed, state.videoTrimEnd, "start");
      showToast(`Başlangıç: ${formatMMSS(state.videoTrimStart)}`);
    });

    document.getElementById("inpTrimEndMMSS").addEventListener("change", (ev) => {
      const parsed = parseMMSS(ev.target.value);
      applyNewTrimRange(state.videoTrimStart, parsed, "end");
      showToast(state.videoTrimEnd > 0 ? `Bitiş: ${formatMMSS(state.videoTrimEnd)}` : "Bitiş: Videonun sonu");
    });

    document.getElementById("rngTrimStartSec").addEventListener("input", (ev) => {
      const s = Number(ev.target.value) || 0;
      applyNewTrimRange(s, state.videoTrimEnd, "start");
    });

    document.getElementById("rngTrimEndSec").addEventListener("input", (ev) => {
      const e = Number(ev.target.value) || 0;
      applyNewTrimRange(state.videoTrimStart, e, "end");
    });

    document.getElementById("btnSetTrimStartNow").addEventListener("click", () => {
      hapticTap();
      if (!activeBgVideo) {
        showToast("Önce Galerim'den bir video yükleyin veya seçin.");
        return;
      }
      const cur = Math.floor(activeBgVideo.currentTime || 0);
      applyNewTrimRange(cur, state.videoTrimEnd, "start");
      showToast(`Başlangıç ${formatMMSS(cur)} olarak ayarlandı.`);
    });

    document.getElementById("btnSetTrimEndNow").addEventListener("click", () => {
      hapticTap();
      if (!activeBgVideo) {
        showToast("Önce Galerim'den bir video yükleyin veya seçin.");
        return;
      }
      const cur = Math.ceil(activeBgVideo.currentTime || 0);
      applyNewTrimRange(state.videoTrimStart, Math.max(state.videoTrimStart + 1, cur), "end");
      showToast(`Bitiş ${formatMMSS(state.videoTrimEnd)} olarak ayarlandı.`);
    });

    document.getElementById("btnResetTrimRange").addEventListener("click", () => {
      hapticTap();
      applyNewTrimRange(0, 0, "start");
      showToast("Video aralığı sıfırlandı (tamamı kullanılacak).");
    });

    document.getElementById("chkVideoSmoothLoop").addEventListener("change", (e) => {
      state.videoSmoothLoop = e.target.checked;
      persistState();
    });

    // ZEMİN — Sub-tab 3: Video Speed, Own Audio, Mirror, Zoom & Pan
    document.querySelectorAll("#bgVideoSpeedGroup .sebat-opt-btn").forEach((btn) => {
      btn.addEventListener("click", () => {
        hapticTap();
        state.bgVideoSpeed = Number(btn.dataset.vspeed) || 1.0;
        document.querySelectorAll("#bgVideoSpeedGroup .sebat-opt-btn").forEach((b) => b.classList.toggle("active", b === btn));
        if (activeBgVideo) {
          try { activeBgVideo.playbackRate = state.bgVideoSpeed; } catch (_) {}
        }
        persistState();
        showToast(`Video hızı: ${state.bgVideoSpeed}x`);
      });
    });

    document.getElementById("rngZeminVideoVol").addEventListener("input", (e) => {
      const v = Number(e.target.value) || 0;
      state.bgVideoVol = v;
      state.videoAudioMode = v > 0 ? "mix" : "muted";
      document.getElementById("valZeminVideoVol").textContent = v > 0 ? `%${v}` : "%0 (Sessiz)";
      document.getElementById("rngBgVideoVol").value = String(v);
      document.getElementById("valBgVideoVol").textContent = `%${v}`;
      document.getElementById("selVideoAudioMode").value = state.videoAudioMode;
      updateVolumes(state, activeBgVideo);
      persistState();
    });

    document.getElementById("chkBgMirror").addEventListener("change", (e) => {
      state.bgMirror = e.target.checked;
      persistState();
      showToast(state.bgMirror ? "Yatay ayna modu açık" : "Yatay ayna modu kapalı");
    });

    document.getElementById("rngBgZoom").addEventListener("input", (e) => {
      state.bgZoom = Number(e.target.value);
      document.getElementById("valBgZoom").textContent = `${(state.bgZoom / 100).toFixed(2)}x`;
      persistState();
    });
    document.getElementById("rngBgPanX").addEventListener("input", (e) => {
      state.bgPanX = Number(e.target.value);
      document.getElementById("valBgPanX").textContent = `${state.bgPanX}%`;
      persistState();
    });
    document.getElementById("rngBgPanY").addEventListener("input", (e) => {
      state.bgPanY = Number(e.target.value);
      document.getElementById("valBgPanY").textContent = `${state.bgPanY}%`;
      persistState();
    });

    // Ortam & Ses
    document.getElementById("rngAmbientVol").addEventListener("input", (e) => {
      state.ambientVol = Number(e.target.value);
      document.getElementById("valAmbientVol").textContent = `%${state.ambientVol}`;
      updateVolumes(state, activeBgVideo);
      persistState();
    });
    document.getElementById("rngReciterVol").addEventListener("input", (e) => {
      state.reciterVol = Number(e.target.value);
      document.getElementById("valReciterVol").textContent = `%${state.reciterVol}`;
      updateVolumes(state, activeBgVideo);
      persistState();
    });
    document.getElementById("selVideoAudioMode").addEventListener("change", (e) => {
      state.videoAudioMode = e.target.value;
      if (state.videoAudioMode === "mix" && state.bgVideoVol === 0) {
        state.bgVideoVol = 35;
      }
      document.getElementById("rngZeminVideoVol").value = String(state.bgVideoVol);
      document.getElementById("valZeminVideoVol").textContent = state.bgVideoVol > 0 ? `%${state.bgVideoVol}` : "%0 (Sessiz)";
      updateVolumes(state, activeBgVideo);
      persistState();
    });
    document.getElementById("rngBgVideoVol").addEventListener("input", (e) => {
      state.bgVideoVol = Number(e.target.value);
      if (state.bgVideoVol > 0) state.videoAudioMode = "mix";
      document.getElementById("valBgVideoVol").textContent = `%${state.bgVideoVol}`;
      document.getElementById("rngZeminVideoVol").value = String(state.bgVideoVol);
      document.getElementById("valZeminVideoVol").textContent = state.bgVideoVol > 0 ? `%${state.bgVideoVol}` : "%0 (Sessiz)";
      document.getElementById("selVideoAudioMode").value = state.videoAudioMode;
      updateVolumes(state, activeBgVideo);
      persistState();
    });
    document.getElementById("rngGaplessTrim").addEventListener("input", (e) => {
      state.gaplessTrimSec = Number(e.target.value);
      document.getElementById("valGaplessTrim").textContent = `${state.gaplessTrimSec.toFixed(2)} sn`;
      persistState();
    });
    document.getElementById("selSmoothFadeOut").addEventListener("change", (e) => {
      state.smoothFadeOut = e.target.value;
      persistState();
    });
    document.getElementById("selAudioFailPolicy").addEventListener("change", (e) => {
      state.audioFailPolicy = e.target.value;
      persistState();
    });

    // Metin — Subtab 1: Arapça Hat
    document.querySelectorAll("#arabicFontGroup .sebat-opt-btn").forEach((btn) => {
      btn.addEventListener("click", () => {
        hapticTap();
        state.arabicFont = btn.dataset.arfont;
        document.querySelectorAll("#arabicFontGroup .sebat-opt-btn").forEach((b) => b.classList.toggle("active", b === btn));
        ensureFontsLoaded();
        persistState();
      });
    });
    document.getElementById("inpArabicColor").addEventListener("input", (e) => {
      state.arabicColor = e.target.value;
      document.getElementById("lblArabicColorName").textContent = state.arabicColor.toUpperCase();
      renderColorSwatches();
      persistState();
    });
    document.getElementById("rngArabicSize").addEventListener("input", (e) => {
      state.arabicSize = Number(e.target.value);
      document.getElementById("valArabicSize").textContent = `${state.arabicSize} px`;
      persistState();
    });
    document.getElementById("rngArabicLetterSpacing").addEventListener("input", (e) => {
      state.arabicLetterSpacing = Number(e.target.value);
      document.getElementById("valArabicLetterSpacing").textContent = `${state.arabicLetterSpacing} px`;
      persistState();
    });
    document.getElementById("rngTextShadow").addEventListener("input", (e) => {
      state.textShadow = Number(e.target.value);
      document.getElementById("valTextShadow").textContent = `${state.textShadow} px`;
      persistState();
    });

    // Metin — Subtab 2: Türkçe Meal & Âyet Numarası Biçimi
    document.querySelectorAll("#mealEditionGroup .sebat-opt-btn").forEach((btn) => {
      btn.addEventListener("click", () => {
        hapticTap();
        state.mealEdition = btn.dataset.edition;
        document.querySelectorAll("#mealEditionGroup .sebat-opt-btn").forEach((b) => b.classList.toggle("active", b === btn));
        persistState();
      });
    });
    document.querySelectorAll("#mealStyleGroup .sebat-opt-btn").forEach((btn) => {
      btn.addEventListener("click", () => {
        hapticTap();
        applyMealStyleById(btn.dataset.mstyle, true);
      });
    });
    document.getElementById("inpMealColor").addEventListener("input", (e) => {
      state.mealColor = e.target.value;
      document.getElementById("lblMealColorName").textContent = state.mealColor.toUpperCase();
      renderColorSwatches();
      persistState();
    });
    document.getElementById("rngMealSize").addEventListener("input", (e) => {
      state.mealSize = Number(e.target.value);
      document.getElementById("valMealSize").textContent = `${state.mealSize} px`;
      persistState();
    });
    document.querySelectorAll("#mealNumFormatGroup .sebat-opt-btn").forEach((btn) => {
      btn.addEventListener("click", () => {
        hapticTap();
        state.mealNumberFormat = btn.dataset.numfmt;
        document.querySelectorAll("#mealNumFormatGroup .sebat-opt-btn").forEach((b) => b.classList.toggle("active", b === btn));
        persistState();
      });
    });

    // Metin — Subtab 3: İngilizce Meal Rengi & Boyutu
    document.getElementById("chkShowEnMealQuick").addEventListener("change", (e) => {
      if (e.target.checked) {
        state.subtitleMode = state.subtitleMode === "ar_only" ? "en" : "both";
      } else if (state.subtitleMode === "both" || state.subtitleMode === "en") {
        state.subtitleMode = "tr";
      }
      document.querySelectorAll("#subtitleModeGroup .sebat-opt-btn").forEach((b) => {
        b.classList.toggle("active", b.dataset.submode === state.subtitleMode);
      });
      persistState();
    });
    document.getElementById("inpEnMealColor").addEventListener("input", (e) => {
      state.enMealColor = e.target.value;
      document.getElementById("lblEnColorName").textContent = state.enMealColor.toUpperCase();
      renderColorSwatches();
      persistState();
    });
    document.getElementById("rngEnMealSize").addEventListener("input", (e) => {
      state.enMealSize = Number(e.target.value);
      document.getElementById("valEnMealSize").textContent = `${state.enMealSize} px`;
      persistState();
    });

    // Metin — Subtab 4: Okunan Kelime Vurgusu
    document.querySelectorAll("#wordHighlightGroup .sebat-opt-btn").forEach((btn) => {
      btn.addEventListener("click", () => {
        hapticTap();
        state.wordHighlight = (btn.dataset.wh === "on");
        document.querySelectorAll("#wordHighlightGroup .sebat-opt-btn").forEach((b) => b.classList.toggle("active", b === btn));
        persistState();
      });
    });
    document.getElementById("inpHighlightColor").addEventListener("input", (e) => {
      state.wordHighlightColor = e.target.value;
      document.getElementById("lblHighlightColorName").textContent = state.wordHighlightColor.toUpperCase();
      renderColorSwatches();
      persistState();
    });
    document.querySelectorAll("#highlightStyleGroup .sebat-opt-btn").forEach((btn) => {
      btn.addEventListener("click", () => {
        hapticTap();
        state.wordHighlightStyle = btn.dataset.hlstyle;
        document.querySelectorAll("#highlightStyleGroup .sebat-opt-btn").forEach((b) => b.classList.toggle("active", b === btn));
        persistState();
      });
    });
    document.getElementById("rngWordTimingOffset").addEventListener("input", (e) => {
      state.wordTimingOffset = Number(e.target.value);
      const wOff = state.wordTimingOffset;
      document.getElementById("valWordTimingOffset").textContent = `${wOff > 0 ? "+" : ""}${wOff.toFixed(2)} sn`;
      persistState();
    });

    // Görünüm Controls: Auto-inject "Türkçe + İngilizce Meal" (tr_en_only) button if not already in HTML
    const subGroup = document.getElementById("subtitleModeGroup");
    if (subGroup && !subGroup.querySelector('[data-submode="tr_en_only"]')) {
      const mealOnlyBtn = subGroup.querySelector('[data-submode="meal_only"]');
      if (mealOnlyBtn) mealOnlyBtn.textContent = "Sadece Türkçe Meal";
      const trEnBtn = document.createElement("button");
      trEnBtn.type = "button";
      trEnBtn.className = "sebat-opt-btn" + (state.subtitleMode === "tr_en_only" ? " active" : "");
      trEnBtn.setAttribute("data-submode", "tr_en_only");
      trEnBtn.textContent = "Türkçe + İngilizce Meal";
      if (mealOnlyBtn && mealOnlyBtn.nextSibling) {
        subGroup.insertBefore(trEnBtn, mealOnlyBtn.nextSibling);
      } else {
        subGroup.appendChild(trEnBtn);
      }
    }

    // Auto-inject Independent Block Selector (Dokunduğumu Taşı / Arapça / Türkçe / İngilizce / Tümü + Sıfırla) in Görünüm -> Metin Konumu card
    const posGroup = document.getElementById("textAlignPosGroup");
    if (posGroup && !document.getElementById("moveTargetGroup")) {
      const targetWrap = document.createElement("div");
      targetWrap.style.cssText = "display:flex;flex-direction:column;gap:5px;margin-bottom:4px;padding-bottom:6px;border-bottom:1px solid rgba(255,255,255,0.06);";
      targetWrap.innerHTML = `
        <div style="display:flex;align-items:center;justify-content:space-between;">
          <span style="font-size:10px;color:var(--gold-light);font-weight:700;">BAĞIMSIZ METİN TAŞIMA HEDEFİ</span>
          <button type="button" id="btnResetIndependentOffsets" class="btn btn-sm" style="padding:2px 8px;font-size:10px;">↺ Konumları Sıfırla</button>
        </div>
        <div class="sebat-btn-group" id="moveTargetGroup">
          <button type="button" class="sebat-opt-btn active" data-mtarget="auto" title="Tuvalde hangi yazıya dokunursanız sadece onu taşır">👆 Dokunduğumu</button>
          <button type="button" class="sebat-opt-btn" data-mtarget="ar">Arapça</button>
          <button type="button" class="sebat-opt-btn" data-mtarget="tr">Türkçe</button>
          <button type="button" class="sebat-opt-btn" data-mtarget="en">İngilizce</button>
          <button type="button" class="sebat-opt-btn" data-mtarget="all">Tümü</button>
        </div>
      `;
      posGroup.parentNode.insertBefore(targetWrap, posGroup);

      document.querySelectorAll("#moveTargetGroup .sebat-opt-btn").forEach((b) => {
        b.addEventListener("click", () => {
          hapticTap();
          state.activeMoveTarget = b.dataset.mtarget;
          syncMoveSlidersFromActiveTarget();
        });
      });

      document.getElementById("btnResetIndependentOffsets").addEventListener("click", () => {
        hapticTap();
        state.arOffsetX = 0; state.arOffsetY = 0;
        state.trOffsetX = 0; state.trOffsetY = 0;
        state.enOffsetX = 0; state.enOffsetY = 0;
        state.textOffsetX = 0; state.textOffsetY = 0;
        syncMoveSlidersFromActiveTarget();
        persistState();
        showToast("Arapça, Türkçe ve İngilizce metin konumları sıfırlandı.");
      });
    }

    document.querySelectorAll("#subtitleModeGroup .sebat-opt-btn").forEach((btn) => {
      btn.addEventListener("click", () => {
        hapticTap();
        state.subtitleMode = btn.dataset.submode;
        document.querySelectorAll("#subtitleModeGroup .sebat-opt-btn").forEach((b) => b.classList.toggle("active", b === btn));
        const chkEn = document.getElementById("chkShowEnMealQuick");
        if (chkEn) chkEn.checked = (state.subtitleMode === "both" || state.subtitleMode === "en");
        persistState();
      });
    });

    document.getElementById("selInVideoProgressBar").addEventListener("change", (e) => {
      state.inVideoProgressBar = e.target.value;
      persistState();
    });
    document.getElementById("selInVideoSurahHeader").addEventListener("change", (e) => {
      state.inVideoSurahHeader = e.target.value;
      persistState();
    });

    document.getElementById("btnCornerSurah").addEventListener("click", (e) => {
      hapticTap();
      state.cornerShowSurah = !state.cornerShowSurah;
      e.currentTarget.classList.toggle("active", state.cornerShowSurah);
      persistState();
    });
    document.getElementById("btnCornerAyahs").addEventListener("click", (e) => {
      hapticTap();
      state.cornerShowAyahs = !state.cornerShowAyahs;
      e.currentTarget.classList.toggle("active", state.cornerShowAyahs);
      persistState();
    });
    document.getElementById("btnCornerReciter").addEventListener("click", (e) => {
      hapticTap();
      state.cornerShowReciter = !state.cornerShowReciter;
      e.currentTarget.classList.toggle("active", state.cornerShowReciter);
      persistState();
    });

    document.querySelectorAll("#textBoxStyleGroup .sebat-opt-btn").forEach((btn) => {
      btn.addEventListener("click", () => {
        hapticTap();
        state.textBoxStyle = btn.dataset.box;
        document.querySelectorAll("#textBoxStyleGroup .sebat-opt-btn").forEach((b) => b.classList.toggle("active", b === btn));
        persistState();
      });
    });

    document.querySelectorAll("#textReadabilityGroup .sebat-opt-btn").forEach((btn) => {
      btn.addEventListener("click", () => {
        hapticTap();
        state.textReadability = btn.dataset.read;
        document.querySelectorAll("#textReadabilityGroup .sebat-opt-btn").forEach((b) => b.classList.toggle("active", b === btn));
        persistState();
      });
    });

    document.querySelectorAll("#textAlignPosGroup .sebat-opt-btn").forEach((btn) => {
      btn.addEventListener("click", () => {
        hapticTap();
        state.textAlignPos = btn.dataset.pos;
        document.querySelectorAll("#textAlignPosGroup .sebat-opt-btn").forEach((b) => b.classList.toggle("active", b === btn));
        persistState();
      });
    });

    document.getElementById("rngTextOffsetY").addEventListener("input", (e) => {
      const val = Number(e.target.value);
      const mode = state.activeMoveTarget || "auto";
      if (mode === "ar") state.arOffsetY = val;
      else if (mode === "tr") state.trOffsetY = val;
      else if (mode === "en") state.enOffsetY = val;
      else state.textOffsetY = val;
      document.getElementById("valTextOffsetY").textContent = `${val}%`;
      persistState();
    });
    document.getElementById("rngTextOffsetX").addEventListener("input", (e) => {
      const val = Number(e.target.value);
      const mode = state.activeMoveTarget || "auto";
      if (mode === "ar") state.arOffsetX = val;
      else if (mode === "tr") state.trOffsetX = val;
      else if (mode === "en") state.enOffsetX = val;
      else state.textOffsetX = val;
      document.getElementById("valTextOffsetX").textContent = `${val}%`;
      persistState();
    });

    document.querySelectorAll("#transitionModeGroup .sebat-opt-btn").forEach((btn) => {
      btn.addEventListener("click", () => {
        hapticTap();
        state.transitionMode = btn.dataset.trans;
        document.querySelectorAll("#transitionModeGroup .sebat-opt-btn").forEach((b) => b.classList.toggle("active", b === btn));
        persistState();
      });
    });

    // Filtre Controls
    document.getElementById("rngBrightnessOffset").addEventListener("input", (e) => {
      const v = Number(e.target.value);
      state.bgBrightnessOffset = v;
      document.getElementById("valBrightnessOffset").textContent = v > 0 ? `+${v}` : `${v}`;
      persistState();
    });
    document.getElementById("rngBgWarmth").addEventListener("input", (e) => {
      const v = Number(e.target.value);
      state.bgWarmth = v;
      document.getElementById("valBgWarmth").textContent = v > 0 ? `+${v}` : `${v}`;
      persistState();
    });
    document.getElementById("rngBgDim").addEventListener("input", (e) => {
      state.bgDim = Number(e.target.value);
      document.getElementById("valBgDim").textContent = `%${state.bgDim}`;
      persistState();
    });
    document.getElementById("chkLockBgDim").addEventListener("change", (e) => {
      state.lockBgDim = e.target.checked;
      persistState();
    });
    document.getElementById("rngBgBlur").addEventListener("input", (e) => {
      state.bgBlur = Number(e.target.value);
      document.getElementById("valBgBlur").textContent = `%${Math.round((state.bgBlur / 20) * 100)}`;
      persistState();
    });
    document.getElementById("selVisualEffect").addEventListener("change", (e) => {
      state.visualEffect = e.target.value;
      persistState();
    });
    document.getElementById("rngEffectIntensity").addEventListener("input", (e) => {
      state.effectIntensity = Number(e.target.value);
      document.getElementById("valEffectIntensity").textContent = `%${state.effectIntensity}`;
      persistState();
    });

    // Kapak (Editable Arabic & Turkish Surah Name + Visibility Checkboxes)
    document.getElementById("inpCoverSurahNameAr").addEventListener("input", (e) => {
      state.coverSurahNameAr = e.target.value;
      state.coverPreviewMode = "cover";
      document.getElementById("chkPreviewCoverNow").checked = true;
      renderAyahTimelineStrip();
      persistState();
    });
    document.getElementById("inpCoverSurahName").addEventListener("input", (e) => {
      state.coverSurahName = e.target.value;
      state.coverPreviewMode = "cover";
      document.getElementById("chkPreviewCoverNow").checked = true;
      renderAyahTimelineStrip();
      persistState();
    });
    document.getElementById("chkCoverShowArSurah").addEventListener("change", (e) => {
      state.coverShowArSurah = e.target.checked;
      state.coverPreviewMode = "cover";
      document.getElementById("chkPreviewCoverNow").checked = true;
      renderAyahTimelineStrip();
      persistState();
    });
    document.getElementById("chkCoverShowTrSurah").addEventListener("change", (e) => {
      state.coverShowTrSurah = e.target.checked;
      state.coverPreviewMode = "cover";
      document.getElementById("chkPreviewCoverNow").checked = true;
      renderAyahTimelineStrip();
      persistState();
    });
    document.getElementById("btnResetCoverSurahName").addEventListener("click", () => {
      hapticTap();
      state.coverSurahNameAr = "";
      state.coverSurahName = "";
      state.coverShowArSurah = true;
      state.coverShowTrSurah = true;
      document.getElementById("inpCoverSurahNameAr").value = "";
      document.getElementById("inpCoverSurahName").value = "";
      document.getElementById("chkCoverShowArSurah").checked = true;
      document.getElementById("chkCoverShowTrSurah").checked = true;
      persistState();
      showToast("Kapak Arapça ve Türkçe sûre adı sıfırlandı.");
    });

    document.getElementById("chkCoverLargeSurah").addEventListener("change", (e) => {
      state.coverLargeSurah = e.target.checked;
      state.coverPreviewMode = "cover";
      document.getElementById("chkPreviewCoverNow").checked = true;
      renderAyahTimelineStrip();
      persistState();
    });
    document.getElementById("chkCoverWithVideo").addEventListener("change", (e) => {
      state.coverFirstFrame = e.target.checked ? "on" : "off";
      renderAyahTimelineStrip();
      persistState();
    });
    document.getElementById("chkPreviewCoverNow").addEventListener("change", (e) => {
      state.coverPreviewMode = e.target.checked ? "cover" : "ayah";
      renderAyahTimelineStrip();
      persistState(false);
    });
    document.getElementById("inpCoverTitle").addEventListener("input", (e) => {
      state.coverTitle = e.target.value;
      state.coverPreviewMode = "cover";
      document.getElementById("chkPreviewCoverNow").checked = true;
      renderAyahTimelineStrip();
      persistState();
    });
    document.getElementById("inpCoverSubtitle").addEventListener("input", (e) => {
      state.coverSubtitle = e.target.value;
      state.coverPreviewMode = "cover";
      document.getElementById("chkPreviewCoverNow").checked = true;
      renderAyahTimelineStrip();
      persistState();
    });
    document.getElementById("rngCoverScale").addEventListener("input", (e) => {
      state.coverScale = Number(e.target.value);
      document.getElementById("valCoverScale").textContent = `%${state.coverScale}`;
      state.coverPreviewMode = "cover";
      document.getElementById("chkPreviewCoverNow").checked = true;
      renderAyahTimelineStrip();
      persistState();
    });
    document.getElementById("rngCoverOffsetY").addEventListener("input", (e) => {
      state.coverOffsetY = Number(e.target.value);
      document.getElementById("valCoverOffsetY").textContent = `${state.coverOffsetY}%`;
      state.coverPreviewMode = "cover";
      document.getElementById("chkPreviewCoverNow").checked = true;
      renderAyahTimelineStrip();
      persistState();
    });
    document.getElementById("rngCoverOffsetX").addEventListener("input", (e) => {
      state.coverOffsetX = Number(e.target.value);
      document.getElementById("valCoverOffsetX").textContent = `${state.coverOffsetX}%`;
      state.coverPreviewMode = "cover";
      document.getElementById("chkPreviewCoverNow").checked = true;
      renderAyahTimelineStrip();
      persistState();
    });
    document.getElementById("selCoverPos").addEventListener("change", (e) => {
      state.coverPos = e.target.value;
      state.coverPreviewMode = "cover";
      document.getElementById("chkPreviewCoverNow").checked = true;
      renderAyahTimelineStrip();
      persistState();
    });
    document.getElementById("selCoverBgOverride").addEventListener("change", (e) => {
      state.coverBgOverride = e.target.value;
      state.coverPreviewMode = "cover";
      document.getElementById("chkPreviewCoverNow").checked = true;
      renderAyahTimelineStrip();
      persistState();
    });

    document.getElementById("btnDownloadCoverPng").addEventListener("click", () => {
      hapticTap();
      const prev = state.coverPreviewMode;
      state.coverPreviewMode = "cover";
      renderStudioFrame(performance.now());
      const dataUrl = canvas.toDataURL("image/png");
      state.coverPreviewMode = prev;
      const surahMeta = SURAHS.find((s) => s[0] === state.surahNo) || SURAHS[0];
      const a = document.createElement("a");
      a.href = dataUrl;
      a.download = `Tilawah_Kapak_${normalizeHashtagWord(surahMeta[1])}_${state.coverAyahNo}.png`;
      document.body.appendChild(a);
      a.click();
      a.remove();
      showToast("Kapak görseli (.PNG) indirildi.");
    });

    // Biçim, Logo, Ön Ayarlar & Ayarlar
    document.querySelectorAll("#ratioCardsList .sebat-list-item").forEach((item) => {
      item.addEventListener("click", () => {
        hapticTap();
        state.platformRatio = item.dataset.ratio;
        updateCanvasResolutionAndRatio();
        persistState();
      });
    });

    document.querySelectorAll("#qualityGroup .sebat-opt-btn").forEach((btn) => {
      btn.addEventListener("click", () => {
        hapticTap();
        state.resolution = Number(btn.dataset.res);
        document.querySelectorAll("#qualityGroup .sebat-opt-btn").forEach((b) => b.classList.toggle("active", b === btn));
        updateCanvasResolutionAndRatio();
        persistState();
      });
    });

    document.getElementById("selBitrateMbps").addEventListener("change", (e) => {
      state.bitrateMbps = Number(e.target.value);
      persistState();
    });
    document.getElementById("selExportEngine").addEventListener("change", (e) => {
      state.exportEngine = e.target.value;
      persistState();
    });
    document.getElementById("selFileNameFormat").addEventListener("change", (e) => {
      state.fileNameFormat = e.target.value;
      persistState();
    });

    document.getElementById("chkShowSignature").addEventListener("change", (e) => {
      state.showSignature = e.target.checked;
      persistState();
    });
    document.getElementById("selLogoPos").addEventListener("change", (e) => {
      state.logoPos = e.target.value;
      persistState();
    });
    document.getElementById("rngLogoScale").addEventListener("input", (e) => {
      state.logoScale = Number(e.target.value);
      document.getElementById("valLogoScale").textContent = `%${state.logoScale}`;
      persistState();
    });
    document.getElementById("rngLogoOpacity").addEventListener("input", (e) => {
      state.logoOpacity = Number(e.target.value);
      document.getElementById("valLogoOpacity").textContent = `%${state.logoOpacity}`;
      persistState();
    });
    document.getElementById("inpWatermarkText").addEventListener("input", (e) => {
      state.watermarkText = e.target.value;
      persistState();
    });

    // User Presets
    document.getElementById("btnSaveUserPreset").addEventListener("click", () => {
      hapticTap();
      const nameInput = document.getElementById("inpNewPresetName");
      const name = (nameInput.value || "").trim() || `Ön Ayarım ${(state.userPresets || []).length + 1}`;
      const snap = captureStateSnapshot();
      delete snap.userPresets;
      state.userPresets = [...(state.userPresets || []), { name, snap }];
      nameInput.value = "";
      renderUserPresetsList();
      persistState();
      showToast(`"${name}" ön ayarı kaydedildi.`);
    });

    document.getElementById("btnLoadUserPreset").addEventListener("click", async () => {
      const sel = document.getElementById("selUserPreset");
      const idx = Number(sel.value);
      const list = state.userPresets || [];
      if (!list[idx]) {
        showToast("Yüklenecek ön ayar seçin.");
        return;
      }
      hapticTap();
      await applyHistorySnapshot({ ...list[idx].snap, userPresets: state.userPresets });
      showToast(`"${list[idx].name}" ön ayarı yüklendi.`);
    });

    document.getElementById("selCaptionPlatform").addEventListener("change", (e) => {
      state.captionPlatform = e.target.value;
      updateSocialCaptionText();
      persistState();
    });
    document.getElementById("btnCopyCaption").addEventListener("click", async () => {
      hapticTap();
      const txt = document.getElementById("txtSocialCaption").value;
      try {
        await navigator.clipboard.writeText(txt);
        showToast("Açıklama panoya kopyalandı!");
      } catch (_) {
        showToast("Kopyalandı.");
      }
    });

    document.getElementById("selUiTheme").addEventListener("change", (e) => {
      state.uiTheme = e.target.value;
      document.documentElement.setAttribute("data-theme", state.uiTheme);
      persistState();
    });

    document.getElementById("btnResetAllSettings").addEventListener("click", async () => {
      hapticTap(20);
      const def = resetSettingsToDefault();
      Object.assign(state, def);
      syncAllControlsFromState();
      await selectZemin(galleryItems[0] ? galleryItems[0].id : "studio_dark", true);
      await loadVersesAndPreloadAudio();
      showToast("Tüm ayarlar varsayılana (9:16 & Siyah Tema) sıfırlandı.");
    });

    document.getElementById("btnExportSettingsJson").addEventListener("click", () => {
      hapticTap();
      const payload = captureStateSnapshot();
      const blob = new Blob([JSON.stringify(payload, null, 2)], { type: "application/json" });
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = "tilawah-world-ayarlar-v7.json";
      document.body.appendChild(a);
      a.click();
      a.remove();
      setTimeout(() => URL.revokeObjectURL(url), 2000);
      showToast("Ayarlar JSON olarak dışa aktarıldı.");
    });

    document.getElementById("inpImportSettingsJson").addEventListener("change", async (e) => {
      const file = e.target.files && e.target.files[0];
      if (!file) return;
      try {
        const text = await file.text();
        const parsed = JSON.parse(text);
        await applyHistorySnapshot(parsed);
        showToast("Ayarlar başarıyla içe aktarıldı.");
      } catch (_) {
        showToast("Geçersiz JSON dosyası.");
      }
    });

    const stageAreaEl = document.getElementById("stageArea");
    if (stageAreaEl && window.ResizeObserver) {
      const ro = new ResizeObserver(() => fitCanvasWrapToStage());
      ro.observe(stageAreaEl);
    }
    window.addEventListener("resize", fitCanvasWrapToStage);

    pushHistorySnapshot();
  }

  function initServiceWorker() {
    if (!("serviceWorker" in navigator)) return;
    if (location.protocol !== "https:" && location.hostname !== "localhost" && location.hostname !== "127.0.0.1") {
      return;
    }
    navigator.serviceWorker.register("sw.js").then((reg) => {
      const banner = document.getElementById("swUpdateBanner");
      const btnReload = document.getElementById("btnSwReload");
      const showUpdate = (worker) => {
        if (!banner) return;
        banner.classList.add("show");
        if (btnReload) {
          btnReload.onclick = () => {
            worker.postMessage({ type: "SKIP_WAITING" });
            window.location.reload();
          };
        }
      };
      if (reg.waiting) showUpdate(reg.waiting);
      reg.addEventListener("updatefound", () => {
        const nw = reg.installing;
        if (!nw) return;
        nw.addEventListener("statechange", () => {
          if (nw.state === "installed" && navigator.serviceWorker.controller) {
            showUpdate(nw);
          }
        });
      });
    }).catch(() => {});
  }

  (async function bootstrap() {
    await initDB().catch(() => {});
    galleryItems = await getAllGalleryItems();

    syncAllControlsFromState();
    bindEvents();
    fitCanvasWrapToStage();

    await ensureFontsLoaded();
    startRenderLoop();

    setTimeout(() => {
      const splash = document.getElementById("pwaSplash");
      if (splash) splash.classList.add("hidden");
    }, 450);

    // If user has uploaded Galerim items and zeminId matches one (or default to first Galerim item if present)
    const initialZeminId = galleryItems.some((g) => g.id === state.zeminId)
      ? state.zeminId
      : (galleryItems[0] ? galleryItems[0].id : "studio_dark");
    await selectZemin(initialZeminId, true);
    await loadVersesAndPreloadAudio();
    await refreshStorageStatsUI();
    initServiceWorker();
  })();
})();
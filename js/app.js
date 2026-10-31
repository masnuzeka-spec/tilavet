"use strict";

(function () {
  const {
    SURAHS,
    RECITERS,
    STYLE_PRESETS,
    KNOWN_EXCERPTS,
    MINIMAL_FALLBACK_CATALOG,
    ZEMIN_CATEGORIES,
    AMBIENT_SOUNDS,
    ARABIC_COLOR_SWATCHES,
    MEAL_COLOR_SWATCHES,
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
    loadSingleAyahAudio
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
  if (window.visualViewport) {
    window.visualViewport.addEventListener("resize", syncAppViewportHeight);
  }
  syncAppViewportHeight();

  function toArabicIndicDigits(num) {
    const map = ["٠", "١", "٢", "٣", "٤", "٥", "٦", "٧", "٨", "٩"];
    return String(num).replace(/\d/g, (d) => map[Number(d)]);
  }

  const initialSettings = loadSettings();
  const state = {
    ...initialSettings,
    zeminSearch: "",
    reciterSearch: "",
    verses: [],
    versesLoaded: false,
    versesOfflineError: "",
    audioElements: [],
    audioDurations: [],
    audioStatuses: [],
    audioObjectUrls: [],
    totalDuration: 0,
    audioReady: false,
    textOnlyMode: false,
    fontsReady: false,
    activeVerseIdx: 0,
    activeVerseElapsed: 0,
    verseStartTime: 0,
    isPlaying: false,
    isRecording: false,
    isBuffering: false,
    isFadingOut: false,
    fadeOutProgress: 0,
    elapsedTime: 0,
    lastExportBlob: null,
    lastExportExt: "mp4",
    lastExportMime: "",
    lastExportDuration: 0
  };

  // Undo / Redo History Stack
  const historyStack = [];
  const redoStack = [];
  let isRestoringHistory = false;

  function captureSnapshot() {
    const snap = {};
    PERSISTED_KEYS.forEach((k) => {
      if (k !== "favoriteAyahs" && k !== "userPresets") {
        snap[k] = state[k];
      }
    });
    return JSON.stringify(snap);
  }

  let lastSnapshotStr = captureSnapshot();

  function pushUndoSnapshot() {
    if (isRestoringHistory) return;
    const cur = captureSnapshot();
    if (cur !== lastSnapshotStr) {
      historyStack.push(lastSnapshotStr);
      if (historyStack.length > 30) historyStack.shift();
      redoStack.length = 0;
      lastSnapshotStr = cur;
      updateUndoRedoButtons();
    }
  }

  function updateUndoRedoButtons() {
    const uBtn = document.getElementById("btnUndo");
    const rBtn = document.getElementById("btnRedo");
    if (uBtn) uBtn.disabled = historyStack.length === 0;
    if (rBtn) rBtn.disabled = redoStack.length === 0;
  }

  async function performUndo() {
    if (historyStack.length === 0) return;
    hapticTap();
    isRestoringHistory = true;
    redoStack.push(captureSnapshot());
    const prevStr = historyStack.pop();
    lastSnapshotStr = prevStr;
    const prevObj = JSON.parse(prevStr);
    const prevSurah = state.surahNo, prevStart = state.ayahStart, prevEnd = state.ayahEnd, prevRec = state.reciterId, prevZem = state.zeminId;
    Object.assign(state, prevObj);
    syncAllControlsFromState();
    if (state.zeminId !== prevZem) await selectZemin(state.zeminId, true);
    if (state.surahNo !== prevSurah || state.ayahStart !== prevStart || state.ayahEnd !== prevEnd || state.reciterId !== prevRec) {
      await loadVersesAndPreloadAudio();
    }
    saveSettings(state, null, true);
    updateUndoRedoButtons();
    isRestoringHistory = false;
    showToast("↶ Geri alındı", 1400);
  }

  async function performRedo() {
    if (redoStack.length === 0) return;
    hapticTap();
    isRestoringHistory = true;
    historyStack.push(captureSnapshot());
    const nextStr = redoStack.pop();
    lastSnapshotStr = nextStr;
    const nextObj = JSON.parse(nextStr);
    const prevSurah = state.surahNo, prevStart = state.ayahStart, prevEnd = state.ayahEnd, prevRec = state.reciterId, prevZem = state.zeminId;
    Object.assign(state, nextObj);
    syncAllControlsFromState();
    if (state.zeminId !== prevZem) await selectZemin(state.zeminId, true);
    if (state.surahNo !== prevSurah || state.ayahStart !== prevStart || state.ayahEnd !== prevEnd || state.reciterId !== prevRec) {
      await loadVersesAndPreloadAudio();
    }
    saveSettings(state, null, true);
    updateUndoRedoButtons();
    isRestoringHistory = false;
    showToast("↷ İleri alındı", 1400);
  }

  let toastTimer = null;
  function showToast(msg, duration = 2400) {
    const box = document.getElementById("toastBox");
    if (!box) return;
    box.textContent = msg;
    box.classList.add("show");
    clearTimeout(toastTimer);
    toastTimer = setTimeout(() => box.classList.remove("show"), duration);
  }

  function persistState() {
    pushUndoSnapshot();
    updateHeaderAndBottomSummary();
    saveSettings(state);
  }

  function hapticTap(ms = 10) {
    if (!state.hapticEnabled) return;
    if (navigator.vibrate) {
      try { navigator.vibrate(ms); } catch (_) {}
    }
  }

  function formatShortTime(sec) {
    if (!Number.isFinite(sec) || sec < 0) return "0:00";
    const totalSec = Math.round(sec);
    const m = Math.floor(totalSec / 60);
    const s = totalSec % 60;
    return `${m}:${String(s).padStart(2, "0")}`;
  }

  function formatPreciseTime(sec) {
    if (!Number.isFinite(sec) || sec < 0) return "00:00.0";
    const m = Math.floor(sec / 60);
    const s = (sec % 60).toFixed(1);
    return `${String(m).padStart(2, "0")}:${s.padStart(4, "0")}`;
  }

  function updateHeaderAndBottomSummary() {
    const surahMeta = SURAHS.find((s) => s[0] === state.surahNo) || SURAHS[86];
    const recMeta = RECITERS.find((r) => r.id === state.reciterId) || RECITERS[0];
    const rangeStr = state.ayahStart === state.ayahEnd ? `${state.ayahStart}` : `${state.ayahStart}-${state.ayahEnd}`;

    const hdrSum = document.getElementById("headerProjectSummary");
    if (hdrSum) {
      hdrSum.textContent = `${surahMeta[1]} ${rangeStr} · ${recMeta.name}`;
    }

    const kesitRec = document.getElementById("lblCurrentReciterInKesit");
    if (kesitRec) {
      kesitRec.textContent = recMeta.name;
    }

    const durSec = state.totalDuration || ((state.ayahEnd - state.ayahStart + 1) * 5.8);
    const durFormatted = formatShortTime(durSec);

    const specLine = document.getElementById("lblBottomExportSpecs");
    if (specLine) {
      specLine.textContent = `${state.platformRatio} · ${state.resolution}p · ≈ ${durFormatted}`;
    }

    const estRenderSec = Math.max(3, Math.round(durSec * 0.25));
    const estMB = Math.max(2, Math.round((durSec * (state.resolution === 1080 ? 0.75 : 0.42))));
    const elRender = document.getElementById("lblBottomEstRender");
    const elSize = document.getElementById("lblBottomEstSize");
    if (elRender) elRender.textContent = `⏱ ≈ ${formatShortTime(estRenderSec)}`;
    if (elSize) elSize.textContent = `💾 ${estMB} MB`;

    const kesitDur = document.getElementById("lblKesitDuration");
    const kesitFill = document.getElementById("kesitDurationFill");
    if (kesitDur) kesitDur.textContent = `≈ ${durFormatted}`;
    if (kesitFill) {
      const pct = Math.min(100, Math.max(4, (durSec / 600) * 100));
      kesitFill.style.width = `${pct}%`;
    }

    updateTimelineRulerMarks(durSec);
  }

  function updateTimelineRulerMarks(totalSec) {
    const ruler = document.getElementById("timelineRulerRow");
    if (!ruler) return;
    const dur = Math.max(5, totalSec || 20);
    const marks = [];
    for (let i = 0; i <= 4; i++) {
      marks.push(`<span>${formatShortTime((dur * i) / 4)}</span>`);
    }
    ruler.innerHTML = marks.join("");
  }

  async function ensureFontsLoaded() {
    if (document.fonts && document.fonts.load) {
      try {
        await Promise.allSettled([
          document.fonts.load(`700 44px '${state.arabicFont}'`),
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

  const appLogoImg = new Image();
  let appLogoLoaded = false;
  const fallbackLogoCanvas = document.createElement("canvas");
  fallbackLogoCanvas.width = 256;
  fallbackLogoCanvas.height = 256;

  function buildFallbackLogo() {
    const lctx = fallbackLogoCanvas.getContext("2d");
    lctx.clearRect(0, 0, 256, 256);
    const grad = lctx.createRadialGradient(128, 128, 20, 128, 128, 120);
    grad.addColorStop(0, "#1A1C23");
    grad.addColorStop(1, "#070809");
    lctx.fillStyle = grad;
    lctx.beginPath();
    lctx.arc(128, 128, 120, 0, Math.PI * 2);
    lctx.fill();
    lctx.lineWidth = 6;
    lctx.strokeStyle = "#E0B84C";
    lctx.stroke();
    lctx.fillStyle = "#F5DF98";
    lctx.font = "bold 54px 'Amiri', serif";
    lctx.textAlign = "center";
    lctx.textBaseline = "middle";
    lctx.fillText("تلاوة", 128, 128);
  }
  buildFallbackLogo();

  appLogoImg.onload = () => { appLogoLoaded = true; };
  appLogoImg.onerror = () => {
    appLogoLoaded = false;
    const hdr = document.getElementById("headerLogoImg");
    if (hdr) hdr.src = fallbackLogoCanvas.toDataURL("image/png");
    const spl = document.getElementById("splashLogoImg");
    if (spl) spl.src = fallbackLogoCanvas.toDataURL("image/png");
  };
  appLogoImg.src = window.__TW_INLINE_LOGO_DATA__ || "icons/logo.png";

  let catalogItems = window.__TW_INLINE_CATALOG_ITEMS__ || [...MINIMAL_FALLBACK_CATALOG];
  let galleryItems = [];
  let pexelsSearchItems = [];
  let activeObjectUrls = [];
  const thumbCache = new Map();
  let activeBgImage = null;
  let activeBgVideo = null;

  function revokeActiveMediaUrls() {
    while (activeObjectUrls.length > 0) {
      const u = activeObjectUrls.pop();
      try { URL.revokeObjectURL(u); } catch (_) {}
    }
  }

  function revokeAudioObjectUrls() {
    while (state.audioObjectUrls.length > 0) {
      const u = state.audioObjectUrls.pop();
      try { URL.revokeObjectURL(u); } catch (_) {}
    }
  }

  async function loadExternalCatalogJson() {
    if (window.__TW_INLINE_CATALOG_ITEMS__ && window.__TW_INLINE_CATALOG_ITEMS__.length > 2) {
      catalogItems = window.__TW_INLINE_CATALOG_ITEMS__;
      return;
    }
    try {
      const res = await fetch("media/catalog.json", { cache: "no-cache" });
      if (res.ok) {
        const data = await res.json();
        if (Array.isArray(data.items) && data.items.length > 0) {
          catalogItems = data.items;
        }
      }
    } catch (_) {}
  }

  function generateProceduralThumb(palette = ["#070809", "#181A20", "#E0B84C"], label = "") {
    const key = palette.join("_") + "_" + label;
    if (thumbCache.has(key)) return thumbCache.get(key);

    const c = document.createElement("canvas");
    c.width = 180;
    c.height = 320;
    const tctx = c.getContext("2d");

    const grad = tctx.createLinearGradient(0, 0, 0, 320);
    grad.addColorStop(0, palette[0] || "#070809");
    grad.addColorStop(0.55, palette[1] || "#181A20");
    grad.addColorStop(1, "#040506");
    tctx.fillStyle = grad;
    tctx.fillRect(0, 0, 180, 320);

    const rad = tctx.createRadialGradient(90, 110, 8, 90, 110, 110);
    rad.addColorStop(0, (palette[2] || "#E0B84C") + "66");
    rad.addColorStop(1, "transparent");
    tctx.fillStyle = rad;
    tctx.fillRect(0, 0, 180, 320);

    const url = c.toDataURL("image/jpeg", 0.78);
    thumbCache.set(key, url);
    return url;
  }

  function getAllZeminItems() {
    return [...galleryItems, ...pexelsSearchItems, ...catalogItems];
  }

  function getZeminById(id) {
    return getAllZeminItems().find((item) => item.id === id) || catalogItems[0] || MINIMAL_FALLBACK_CATALOG[0];
  }

  async function selectZemin(id, isInitialRestore = false) {
    const item = getZeminById(id);
    state.zeminId = item ? item.id : "vid_forest_stream";

    if (activeBgVideo) {
      try {
        activeBgVideo.pause();
        activeBgVideo.removeAttribute("src");
        activeBgVideo.load();
      } catch (_) {}
      activeBgVideo = null;
    }
    activeBgImage = null;
    revokeActiveMediaUrls();

    if (item && !isInitialRestore) {
      if (!state.lockBgDim && typeof item.recommendedDarkness === "number") {
        state.bgDim = item.recommendedDarkness;
        const rng = document.getElementById("rngBgDim");
        const val = document.getElementById("valBgDim");
        if (rng) rng.value = state.bgDim;
        if (val) val.textContent = `%${state.bgDim}`;
      }
    }

    if (state.zeminId) {
      state.recentZeminIds = [state.zeminId, ...(state.recentZeminIds || []).filter((x) => x !== state.zeminId)].slice(0, 12);
    }

    const trimBox = document.getElementById("videoTrimBox");
    if (item && item.type === "image") {
      if (trimBox) trimBox.style.display = "none";
      const img = new Image();
      let srcUrl = item.src;
      if (item.blob) {
        srcUrl = URL.createObjectURL(item.blob);
        activeObjectUrls.push(srcUrl);
      } else if (!srcUrl.startsWith("data:")) {
        img.crossOrigin = "anonymous";
      }
      img.onload = () => { activeBgImage = img; };
      img.onerror = () => { activeBgImage = null; };
      img.src = srcUrl;
    } else if (item && item.type === "video") {
      if (trimBox) trimBox.style.display = "grid";
      const vid = document.createElement("video");
      let srcUrl = item.src;
      if (item.blob) {
        srcUrl = URL.createObjectURL(item.blob);
        activeObjectUrls.push(srcUrl);
      } else if (!srcUrl.startsWith("data:")) {
        vid.crossOrigin = "anonymous";
      }
      vid.playsInline = true;
      vid.loop = true;
      vid.muted = (state.videoAudioMode === "muted" || state.bgVideoVol <= 0);
      vid.src = srcUrl;
      vid.onloadedmetadata = () => {
        if (state.videoTrimStart > 0 && state.videoTrimStart < vid.duration) {
          vid.currentTime = state.videoTrimStart;
        }
        connectBgVideoToGraph(vid, state);
        vid.play().catch(() => {});
      };
      vid.ontimeupdate = () => {
        if (state.videoTrimEnd > state.videoTrimStart && vid.currentTime >= state.videoTrimEnd) {
          vid.currentTime = state.videoTrimStart || 0;
        }
      };
      activeBgVideo = vid;
    } else {
      if (trimBox) trimBox.style.display = "none";
    }

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

      const zItem = getZeminById(st.zeminId);
      const img = document.createElement("img");
      img.className = "zemin-thumb";
      img.alt = st.name;
      const fb = generateProceduralThumb(st.palette, st.name);
      img.src = (zItem && (zItem.thumbDataUrl || zItem.thumb)) || fb;
      img.onerror = () => { img.onerror = null; img.src = fb; };

      const badge = document.createElement("span");
      badge.className = "zemin-badge";
      badge.textContent = st.sub;

      const label = document.createElement("div");
      label.className = "zemin-label";
      label.textContent = st.name;

      card.appendChild(img);
      card.appendChild(badge);
      card.appendChild(label);

      card.addEventListener("click", async () => {
        hapticTap();
        state.stylePresetId = st.id;
        state.zeminId = st.zeminId;
        state.ambientType = st.ambientType;
        if (st.ambientType !== "none" && state.ambientVol === 0) state.ambientVol = st.ambientVol || 20;
        if (!state.lockBgDim) state.bgDim = st.bgDim;
        state.bgWarmth = st.bgWarmth;
        state.visualEffect = st.visualEffect;
        state.arabicColor = st.arabicColor;
        state.mealColor = st.mealColor;
        applyMealStyleById(st.mealStyle, false);

        syncAllControlsFromState();
        renderStylePresetsGrid();
        await selectZemin(state.zeminId, true);
        if (state.isPlaying || state.isRecording) {
          ensureAudioGraph(state, activeBgVideo);
          startAmbientSound(state);
        }
        persistState();
        showToast(`✨ "${st.name}" stili uygulandı`, 1800);
      });

      grid.appendChild(card);
    });
  }

  function renderKnownExcerptsList() {
    const wrap = document.getElementById("knownExcerptsList");
    if (!wrap) return;
    wrap.innerHTML = "";
    const list = state.favoriteAyahs && state.favoriteAyahs.length > 0 ? state.favoriteAyahs : KNOWN_EXCERPTS;

    list.forEach((ex) => {
      const surahMeta = SURAHS.find((s) => s[0] === ex.surahNo) || SURAHS[0];
      const isCurrent = (state.surahNo === ex.surahNo && state.ayahStart === ex.start && state.ayahEnd === ex.end);
      const row = document.createElement("div");
      row.className = "sebat-list-item" + (isCurrent ? " active" : "");
      row.innerHTML = `
        <div>
          <div class="sebat-item-title">${ex.title || ex.label}</div>
          <div class="sebat-item-sub">${ex.sub || `${surahMeta[1]} ${ex.start}-${ex.end}`}</div>
        </div>
        <div class="sebat-item-ar" dir="rtl">${ex.arName || surahMeta[4] || surahMeta[2]}</div>
      `;
      row.addEventListener("click", () => {
        hapticTap();
        state.surahNo = ex.surahNo;
        state.ayahStart = ex.start;
        state.ayahEnd = ex.end;
        state.coverAyahNo = ex.start;
        populateSurahAndReciterSelectors();
        renderKnownExcerptsList();
        persistState();
        loadVersesAndPreloadAudio();
      });
      wrap.appendChild(row);
    });
  }

  function renderRecitersList() {
    const wrap = document.getElementById("reciterFullList");
    if (!wrap) return;
    wrap.innerHTML = "";
    const q = (state.reciterSearch || "").trim().toLowerCase();

    const filtered = RECITERS.filter((r) =>
      !q || r.name.toLowerCase().includes(q) || (r.tag || "").toLowerCase().includes(q)
    );

    let lastGroup = "";
    filtered.forEach((r) => {
      const grp = r.group || r.name.charAt(0).toUpperCase();
      if (grp !== lastGroup) {
        lastGroup = grp;
        const hdr = document.createElement("div");
        hdr.style.cssText = "padding:6px 10px 2px;font-size:11px;font-weight:700;color:var(--gold-light);";
        hdr.textContent = grp;
        wrap.appendChild(hdr);
      }

      const row = document.createElement("div");
      row.className = "sebat-list-item" + (state.reciterId === r.id ? " active" : "");
      row.innerHTML = `
        <div>
          <div class="sebat-item-title">${r.name}</div>
          <div class="sebat-item-sub">${r.tag || "İndirilebilir"}</div>
        </div>
        <span style="color:var(--gold-bright);font-weight:700;">${state.reciterId === r.id ? "●" : ""}</span>
      `;
      row.addEventListener("click", () => {
        hapticTap();
        state.reciterId = r.id;
        renderRecitersList();
        persistState();
        loadVersesAndPreloadAudio();
        showToast(`🎙️ Hâfız: ${r.name}`, 1800);
      });
      wrap.appendChild(row);
    });
  }

  function renderZeminCategories() {
    const bar = document.getElementById("zeminCategoryBar");
    if (!bar) return;
    bar.innerHTML = "";
    ZEMIN_CATEGORIES.forEach((cat) => {
      const btn = document.createElement("button");
      btn.type = "button";
      const isGal = cat === "Galerim";
      btn.className = "chip" + (state.zeminCategory === cat ? " active" : "");
      btn.textContent = isGal ? `★ Galerim (${galleryItems.length})` : cat;
      btn.addEventListener("click", () => {
        hapticTap();
        state.zeminCategory = cat;
        renderZeminCategories();
        renderZeminGrid();
      });
      bar.appendChild(btn);
    });
  }

  function renderZeminGrid() {
    const grid = document.getElementById("zeminGrid");
    const manageBar = document.getElementById("galleryManageBar");
    const lblCount = document.getElementById("lblGalleryCount");
    if (!grid) return;

    if (manageBar) manageBar.style.display = state.zeminCategory === "Galerim" ? "flex" : "none";
    if (lblCount) lblCount.textContent = `${galleryItems.length} kişisel medya kayıtlı`;

    const query = (state.zeminSearch || "").trim().toLowerCase();
    let list = getAllZeminItems();

    if (state.zeminCategory === "Son Kullanılanlar") {
      list = (state.recentZeminIds || []).map((id) => getZeminById(id)).filter(Boolean);
    } else if (state.zeminCategory !== "Tümü") {
      list = list.filter((i) => i.category === state.zeminCategory);
    }
    if (query) {
      list = list.filter((i) =>
        i.name.toLowerCase().includes(query) ||
        (i.category || "").toLowerCase().includes(query)
      );
    }

    grid.innerHTML = "";
    if (list.length === 0) {
      grid.innerHTML = `<div style="grid-column:1/-1;padding:18px;text-align:center;color:var(--text-muted);font-size:12px;">Bu kategoride medya yok. "+ Yükle" ile kendi fotoğraf veya videonuzu ekleyebilirsiniz.</div>`;
      return;
    }

    list.forEach((item) => {
      const isUserGal = item.category === "Galerim";
      const card = document.createElement("div");
      card.className = "zemin-card" + (state.zeminId === item.id ? " active" : "");

      const img = document.createElement("img");
      img.className = "zemin-thumb";
      img.loading = "lazy";
      img.alt = item.name;
      const fallbackThumb = generateProceduralThumb(item.palette || ["#070809", "#181A20", "#E0B84C"], item.name);
      img.src = item.thumbDataUrl || item.thumb || fallbackThumb;
      img.onerror = () => { img.onerror = null; img.src = fallbackThumb; };

      const badge = document.createElement("span");
      badge.className = "zemin-badge";
      badge.textContent = item.type === "video" ? "VİDEO" : item.type === "image" ? "1080P" : "CANLI";

      const label = document.createElement("div");
      label.className = "zemin-label";
      label.textContent = item.name;

      card.appendChild(img);
      card.appendChild(badge);
      card.appendChild(label);

      if (isUserGal) {
        const delBtn = document.createElement("button");
        delBtn.type = "button";
        delBtn.className = "zemin-del-btn";
        delBtn.textContent = "✕";
        delBtn.addEventListener("click", async (ev) => {
          ev.stopPropagation();
          hapticTap();
          await deleteGalleryItem(item.id);
          galleryItems = await getAllGalleryItems();
          renderZeminCategories();
          renderZeminGrid();
          refreshStorageStatsUI();
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
    const wrap = document.getElementById("ambientSoundList");
    if (!wrap) return;
    wrap.innerHTML = "";

    AMBIENT_SOUNDS.forEach((s) => {
      const isAct = state.ambientType === s.id;
      const row = document.createElement("div");
      row.className = "sebat-list-item" + (isAct ? " active" : "");
      row.innerHTML = `
        <div style="display:flex;align-items:center;gap:10px;">
          <span style="font-size:17px;">${s.icon}</span>
          <div>
            <div class="sebat-item-title">${s.name}</div>
            <div class="sebat-item-sub">${s.sub}</div>
          </div>
        </div>
        <span style="color:var(--gold-bright);font-weight:700;">${isAct ? "● Seçili" : ""}</span>
      `;
      row.addEventListener("click", () => {
        hapticTap();
        state.ambientType = s.id;
        if (s.id !== "none" && state.ambientVol === 0) {
          state.ambientVol = 22;
          document.getElementById("rngAmbientVol").value = 22;
          document.getElementById("valAmbientVol").textContent = "%22";
        }
        renderAmbientSoundList();
        ensureAudioGraph(state, activeBgVideo);
        if (s.id === "none") {
          stopAmbientSound();
        } else {
          startAmbientSound(state);
        }
        persistState();
      });
      wrap.appendChild(row);
    });
  }

  function renderColorSwatches() {
    const arRow = document.getElementById("arabicSwatchRow");
    const mealRow = document.getElementById("mealSwatchRow");
    if (arRow) {
      arRow.innerHTML = "";
      ARABIC_COLOR_SWATCHES.forEach((sw) => {
        const btn = document.createElement("button");
        btn.type = "button";
        btn.className = "color-swatch-btn" + (state.arabicColor.toLowerCase() === sw.hex.toLowerCase() ? " active" : "");
        btn.style.backgroundColor = sw.hex;
        btn.title = sw.name;
        btn.addEventListener("click", () => {
          hapticTap();
          state.arabicColor = sw.hex;
          state.arabicColorName = sw.name;
          const lbl = document.getElementById("lblArabicColorName");
          if (lbl) lbl.textContent = sw.name;
          const inp = document.getElementById("inpArabicColor");
          if (inp) inp.value = sw.hex;
          renderColorSwatches();
          persistState();
        });
        arRow.appendChild(btn);
      });
    }

    if (mealRow) {
      mealRow.innerHTML = "";
      MEAL_COLOR_SWATCHES.forEach((sw) => {
        const btn = document.createElement("button");
        btn.type = "button";
        btn.className = "color-swatch-btn" + (state.mealColor.toLowerCase() === sw.hex.toLowerCase() ? " active" : "");
        btn.style.backgroundColor = sw.hex;
        btn.title = sw.name;
        btn.addEventListener("click", () => {
          hapticTap();
          state.mealColor = sw.hex;
          state.mealColorName = sw.name;
          const lbl = document.getElementById("lblMealColorName");
          if (lbl) lbl.textContent = sw.name;
          const inp = document.getElementById("inpMealColor");
          if (inp) inp.value = sw.hex;
          renderColorSwatches();
          persistState();
        });
        mealRow.appendChild(btn);
      });
    }
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

    if (!state.versesLoaded || state.verses.length === 0) return;

    state.verses.forEach((v, idx) => {
      const btn = document.createElement("button");
      btn.type = "button";
      const isAct = idx === state.activeVerseIdx;
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
        persistState();
      });
      wrap.appendChild(chip);
    });
  }

  function renderCoverAyahCircles() {
    const wrap = document.getElementById("coverAyahCircles");
    if (!wrap) return;
    wrap.innerHTML = "";

    const validCoverAyah =
      state.coverAyahNo >= state.ayahStart && state.coverAyahNo <= state.ayahEnd
        ? state.coverAyahNo
        : state.ayahStart;
    state.coverAyahNo = validCoverAyah;

    for (let a = state.ayahStart; a <= state.ayahEnd; a++) {
      const btn = document.createElement("button");
      btn.type = "button";
      btn.className = "cover-ayah-btn" + (state.coverAyahNo === a ? " active" : "");
      btn.textContent = a;
      btn.addEventListener("click", () => {
        hapticTap();
        state.coverAyahNo = a;
        state.coverPreviewMode = "cover";
        const chkPrev = document.getElementById("chkPreviewCoverNow");
        if (chkPrev) chkPrev.checked = true;
        renderCoverAyahCircles();
        persistState();
      });
      wrap.appendChild(btn);
    }
  }

  function renderUserPresetsList() {
    const sel = document.getElementById("selUserPreset");
    if (!sel) return;
    sel.innerHTML = `<option value="">-- Kayıtlı Ön Ayar Seçin --</option>`;
    (state.userPresets || []).forEach((p) => {
      const opt = document.createElement("option");
      opt.value = p.id;
      opt.textContent = p.name;
      sel.appendChild(opt);
    });
  }

  async function processUploadedFile(file) {
    const lower = file.name.toLowerCase();
    const isVideo = file.type.startsWith("video/") || lower.endsWith(".mp4") || lower.endsWith(".webm") || lower.endsWith(".mov");
    const id = "gal_" + Date.now() + "_" + Math.random().toString(36).slice(2, 7);

    if (!isVideo) {
      const tempUrl = URL.createObjectURL(file);
      const img = new Image();
      await new Promise((res, rej) => { img.onload = res; img.onerror = rej; img.src = tempUrl; });
      URL.revokeObjectURL(tempUrl);

      const srcW = img.naturalWidth || 720;
      const srcH = img.naturalHeight || 1280;
      const tc = document.createElement("canvas");
      tc.width = 280;
      tc.height = 498;
      const s = Math.max(280 / srcW, 498 / srcH);
      tc.getContext("2d").drawImage(img, (280 - srcW * s) / 2, (498 - srcH * s) / 2, srcW * s, srcH * s);

      return {
        id,
        name: file.name.replace(/\.[^.]+$/, ""),
        type: "image",
        blob: file,
        thumbDataUrl: tc.toDataURL("image/jpeg", 0.74),
        category: "Galerim",
        recommendedDarkness: 40,
        defaultEffect: "none",
        createdAt: Date.now()
      };
    } else {
      return {
        id,
        name: file.name.replace(/\.[^.]+$/, ""),
        type: "video",
        blob: file,
        thumbDataUrl: generateProceduralThumb(["#070809", "#181A20", "#E0B84C"], "VİDEO"),
        category: "Galerim",
        recommendedDarkness: 40,
        defaultEffect: "none",
        createdAt: Date.now()
      };
    }
  }

  function stripLeadingBismillah(arabicText, surahNo, ayahNo) {
    if (surahNo === 1 || surahNo === 9 || ayahNo !== 1) return arabicText;
    const text = (arabicText || "").trim();
    const words = text.split(/\s+/);
    if (words.length > 4) {
      const normalizeAr = (s) =>
        s
          .replace(/[\u0610-\u061A\u064B-\u065F\u0670\u06D6-\u06ED\u0640]/g, "")
          .replace(/[ٱأإآ]/g, "ا");
      const first4 = normalizeAr(words.slice(0, 4).join(" "));
      if (first4 === "بسم الله الرحمن الرحيم") {
        return words.slice(4).join(" ").trim();
      }
    }
    return text.replace(
      /^بِسْمِ\s+[ٱا]للَّهِ\s+[ٱا]لرَّحْمَـ?ٰنِ\s+[ٱا]لرَّحِيمِ\s*/u,
      ""
    ).trim() || text;
  }

  let currentLoadToken = 0;

  async function loadVersesAndPreloadAudio() {
    const token = ++currentLoadToken;
    stopPlaybackAndRecording(true);
    revokeAudioObjectUrls();

    state.audioReady = false;
    state.textOnlyMode = false;
    state.versesLoaded = false;
    state.versesOfflineError = "";
    state.totalDuration = 0;

    const btnPlay = document.getElementById("btnPlayPreview");
    const btnRec = document.getElementById("btnRecordExport");
    const lblDur = document.getElementById("lblTotalDuration");
    const lblState = document.getElementById("lblAudioReadyState");
    const errBox = document.getElementById("ayahAudioErrorBox");

    if (btnPlay) btnPlay.disabled = true;
    if (btnRec) btnRec.disabled = true;
    if (lblDur) lblDur.textContent = "≈ ...";
    if (lblState) lblState.textContent = "Ayetler ve tilâvet sesleri yükleniyor...";
    if (errBox) errBox.style.display = "none";
    updateStageBadge("loading", "Hazırlanıyor...");

    const sNo = state.surahNo;
    const start = state.ayahStart;
    const end = state.ayahEnd;
    const count = end - start + 1;
    const offset = start - 1;

    let loadedVerses = null;
    let fromOfflineCache = false;

    try {
      const url = `https://api.alquran.cloud/v1/surah/${sNo}/editions/quran-uthmani,tr.diyanet,tr.yazir,tr.vakfi,en.sahih?offset=${offset}&limit=${count}`;
      const res = await fetch(url);
      if (!res.ok) throw new Error("HTTP " + res.status);
      const json = await res.json();
      if (token !== currentLoadToken) return;

      const [arEd, trDiyanet, trYazir, trVakfi, enEd] = json.data;
      const verses = [];
      for (let i = 0; i < arEd.ayahs.length; i++) {
        const ayahNum = arEd.ayahs[i].numberInSurah;
        const rawAr = arEd.ayahs[i].text;
        const cleanAr = stripLeadingBismillah(rawAr, sNo, ayahNum);
        verses.push({
          numberInSurah: ayahNum,
          arabic: cleanAr,
          hasBismillahHeader: (ayahNum === 1 && sNo !== 1 && sNo !== 9),
          tr: trDiyanet && trDiyanet.ayahs[i] ? trDiyanet.ayahs[i].text : "",
          tr_yazir: trYazir && trYazir.ayahs[i] ? trYazir.ayahs[i].text : "",
          tr_vakfi: trVakfi && trVakfi.ayahs[i] ? trVakfi.ayahs[i].text : "",
          en: enEd && enEd.ayahs[i] ? enEd.ayahs[i].text : ""
        });
      }
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
      state.textOnlyMode = false;

      if (lblDur) lblDur.textContent = formatPreciseTime(total);
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

  // Unified Cover Scene: Combines 9 Templates (Borders/Mihrab Arch/Badges) + Sebat Cover Ayah & Large Surah Calligraphy + Custom Title/Subtitle + Scale (60-160%) + Precise X/Y Offset + Cover Background Override!
  function drawUnifiedCoverScene(w, h, scaleFactor) {
    const tpl = COVER_TEMPLATES.find((t) => t.id === state.coverTemplateId) || COVER_TEMPLATES[0];
    const surahMeta = SURAHS.find((s) => s[0] === state.surahNo) || SURAHS[86];
    const reciterMeta = RECITERS.find((r) => r.id === state.reciterId) || RECITERS[0];
    const coverVerse =
      state.verses.find((v) => v.numberInSurah === state.coverAyahNo) ||
      state.verses[0];

    // 1. Optional Cover Background Override
    if (state.coverBgOverride && state.coverBgOverride !== "same") {
      const map = {
        pure_black: ["#050608", "#0d0f14"],
        dark_gold: ["#120e07", "#291f0e"],
        emerald: ["#061612", "#0f2e24"],
        midnight: ["#060b16", "#132242"]
      };
      const pal = map[state.coverBgOverride] || map.pure_black;
      const g = ctx.createLinearGradient(0, 0, 0, h);
      g.addColorStop(0, pal[0]);
      g.addColorStop(1, pal[1]);
      ctx.fillStyle = g;
      ctx.fillRect(0, 0, w, h);
    }

    const cScale = ((state.coverScale || 100) / 100) * scaleFactor;
    const baseCenterY = state.coverPos === "upper" ? h * 0.34 : state.coverPos === "lower" ? h * 0.66 : h * 0.5;
    const centerY = baseCenterY + ((state.coverOffsetY || 0) / 100) * h;
    const centerX = w * 0.5 + ((state.coverOffsetX || 0) / 100) * w;

    ctx.save();

    // 2. Template Decorative Frame & Mihrab Arch
    if (tpl.border) {
      const pad = 38 * scaleFactor;
      ctx.strokeStyle = (tpl.accent || "#D8B456") + "88";
      ctx.lineWidth = 2.5 * scaleFactor;
      ctx.strokeRect(pad, pad, w - pad * 2, h - pad * 2);
    }
    if (tpl.arch) {
      ctx.strokeStyle = (tpl.accent || "#F3D77D") + "55";
      ctx.lineWidth = 2 * scaleFactor;
      ctx.beginPath();
      ctx.arc(centerX, centerY - 52 * cScale, 178 * cScale, Math.PI, 0);
      ctx.stroke();
    }

    ctx.textAlign = "center";
    ctx.textBaseline = "middle";
    ctx.shadowColor = "rgba(0,0,0,0.88)";
    ctx.shadowBlur = (state.textShadow || 14) * scaleFactor;

    // 3. Optional Template Badge
    if (tpl.badge) {
      ctx.direction = "ltr";
      ctx.fillStyle = tpl.accent || "#E0B84C";
      ctx.font = `700 ${Math.round(14 * cScale)}px 'DM Sans', sans-serif`;
      ctx.fillText(tpl.badge, centerX, centerY - 128 * cScale);
    }

    const customMain = (state.coverTitle || "").trim();
    const customSub = (state.coverSubtitle || "").trim();

    if (state.coverLargeSurah) {
      // Large Arabic Surah Calligraphy + Title + Subtitle + Selected Cover Ayah
      ctx.direction = "rtl";
      ctx.fillStyle = "rgba(255, 253, 247, 0.94)";
      ctx.font = `700 ${Math.round(66 * cScale)}px '${state.arabicFont}', serif`;
      ctx.fillText(surahMeta[4] || surahMeta[2], centerX, centerY - 64 * cScale);

      ctx.direction = "ltr";
      ctx.fillStyle = tpl.accent || "#FFFDF7";
      ctx.font = `700 ${Math.round(28 * cScale)}px '${state.mealFont || "DM Sans"}', serif`;
      ctx.fillText(customMain || surahMeta[1], centerX, centerY - 2 * cScale);

      const rangeLabel = customSub || `${state.ayahStart}-${state.ayahEnd}. âyetler · ${reciterMeta.name}`;
      ctx.fillStyle = "rgba(229, 224, 213, 0.85)";
      ctx.font = `500 ${Math.round(14.5 * cScale)}px 'DM Sans', sans-serif`;
      ctx.fillText(rangeLabel, centerX, centerY + 30 * cScale);

      if (coverVerse) {
        ctx.direction = "rtl";
        ctx.fillStyle = state.arabicColor;
        ctx.font = `700 ${Math.round(25 * cScale)}px '${state.arabicFont}', serif`;
        const maxW = w * 0.82;
        const lines = wrapCanvasText(ctx, coverVerse.arabic, maxW);
        lines.slice(0, 2).forEach((ln, i) => {
          ctx.fillText(ln, centerX, centerY + (74 + i * 34) * cScale);
        });
      }
    } else if (coverVerse) {
      // Selected Cover Ayah Arabic + Meal (with custom title override if typed)
      if (customMain) {
        ctx.direction = "ltr";
        ctx.fillStyle = tpl.accent || "#E0B84C";
        ctx.font = `700 ${Math.round(22 * cScale)}px 'DM Sans', sans-serif`;
        ctx.fillText(customMain, centerX, centerY - 78 * cScale);
      }

      ctx.direction = "rtl";
      ctx.fillStyle = state.arabicColor;
      ctx.font = `700 ${Math.round(38 * cScale)}px '${state.arabicFont}', serif`;
      const arLines = wrapCanvasText(ctx, coverVerse.arabic, w * 0.82);
      arLines.slice(0, 2).forEach((ln, i) => {
        ctx.fillText(ln, centerX, centerY - 22 * cScale + i * 48 * cScale);
      });

      ctx.direction = "ltr";
      ctx.fillStyle = state.mealColor;
      const italicPrefix = state.mealItalic ? "italic " : "";
      ctx.font = `${italicPrefix}${state.mealWeight || 500} ${Math.round(20 * cScale)}px '${state.mealFont}', serif`;
      const subStr = customSub || `${coverVerse.numberInSurah}- ${getSelectedMealText(coverVerse)}`;
      const trLines = wrapCanvasText(ctx, subStr, w * 0.82);
      trLines.slice(0, 2).forEach((ln, i) => {
        ctx.fillText(ln, centerX, centerY + (36 + (arLines.length > 1 ? 32 : 0) + i * 28) * cScale);
      });
    }

    ctx.restore();
  }

  // Draws Top-Left Corner Info + Centered Surah Header + Top-Right/Bottom Logo Signature
  function drawOverlaysAndLogo(w, h, scaleFactor, t, verse) {
    const barOffset = state.cinemaBars ? Math.round(h * 0.085) : 0;
    const padX = 28 * scaleFactor;
    const padY = barOffset + 26 * scaleFactor;
    const surahMeta = SURAHS.find((s) => s[0] === state.surahNo) || SURAHS[86];
    const recMeta = RECITERS.find((r) => r.id === state.reciterId) || RECITERS[0];

    ctx.save();
    ctx.direction = "ltr";
    ctx.shadowColor = "rgba(0, 0, 0, 0.85)";
    ctx.shadowBlur = 8 * scaleFactor;

    // 1. Top-Left Corner Info Badge ("Köşe Yazısı": Sûre / Âyetler / Hâfız)
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
        ctx.fillStyle = "rgba(255, 253, 247, 0.92)";
        ctx.font = `700 ${Math.round(13.5 * scaleFactor)}px 'DM Sans', sans-serif`;
        ctx.fillText(line1, padX, curY);
        curY += 17 * scaleFactor;
      }
      if (state.cornerShowReciter) {
        ctx.fillStyle = "rgba(229, 224, 213, 0.74)";
        ctx.font = `500 ${Math.round(11 * scaleFactor)}px 'DM Sans', sans-serif`;
        ctx.fillText(recMeta.name, padX, curY);
      }
    }

    // 2. Centered Classic Surah & Ayah Header Strip inside video ("A'lâ Sûresi · 1. Âyet")
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

    // 3. Detailed Logo & Signature Watermark
    if (state.showSignature && state.logoPos !== "hidden") {
      const lScale = (state.logoScale || 100) / 100;
      const iconSize = 26 * lScale * scaleFactor;
      const text = (state.watermarkText || "Tilawah World").trim();
      ctx.globalAlpha = Math.max(0.15, Math.min(1, (state.logoOpacity || 90) / 100));
      ctx.font = `600 ${Math.round(13.5 * lScale * scaleFactor)}px 'DM Sans', sans-serif`;
      const tw = text ? ctx.measureText(text).width : 0;
      const logoSource = appLogoLoaded ? appLogoImg : fallbackLogoCanvas;

      if (state.logoPos === "top-right") {
        const rightX = w - padX;
        const midY = padY + iconSize * 0.5;
        ctx.fillStyle = "rgba(255, 253, 247, 0.9)";
        ctx.textAlign = "right";
        ctx.textBaseline = "middle";
        if (text) ctx.fillText(text, rightX, midY);
        ctx.drawImage(logoSource, rightX - tw - iconSize - (text ? 7 * scaleFactor : 0), midY - iconSize / 2, iconSize, iconSize);
      } else if (state.logoPos === "top-left") {
        const leftX = padX;
        const midY = padY + (showCorner ? 42 * scaleFactor : 0) + iconSize * 0.5;
        ctx.drawImage(logoSource, leftX, midY - iconSize / 2, iconSize, iconSize);
        if (text) {
          ctx.fillStyle = "rgba(255, 253, 247, 0.9)";
          ctx.textAlign = "left";
          ctx.textBaseline = "middle";
          ctx.fillText(text, leftX + iconSize + 7 * scaleFactor, midY);
        }
      } else {
        // bottom-center or floating
        const totalW = iconSize + (text ? 8 * scaleFactor + tw : 0);
        const cx = state.logoPos === "floating" ? w * 0.5 + Math.sin(t * 0.45) * (w * 0.22) : w * 0.5;
        const cy = state.logoPos === "floating" ? h * 0.82 + Math.cos(t * 0.35) * (h * 0.04) : h - barOffset - 36 * scaleFactor;
        const startX = cx - totalW / 2;
        ctx.drawImage(logoSource, startX, cy - iconSize / 2, iconSize, iconSize);
        if (text) {
          ctx.fillStyle = "rgba(255, 253, 247, 0.9)";
          ctx.textAlign = "left";
          ctx.textBaseline = "middle";
          ctx.fillText(text, startX + iconSize + 8 * scaleFactor, cy);
        }
      }
    }

    ctx.restore();
  }

  // In-Video Progress Bar (Süre İlerleme Şeridi directly inside the exported video!)
  function drawInVideoProgressBar(w, h, scaleFactor, underTextY) {
    const mode = state.inVideoProgressBar || "bottom";
    if (mode === "off") return;

    let prog = 0;
    if (state.isPlaying || state.isRecording) {
      prog = state.totalDuration > 0 ? Math.max(0, Math.min(1, state.elapsedTime / state.totalDuration)) : 0;
    } else if (state.verses.length > 0) {
      prog = Math.max(0.08, Math.min(1, (state.activeVerseIdx + 0.35) / state.verses.length));
    }

    const barOffset = state.cinemaBars ? Math.round(h * 0.085) : 0;

    ctx.save();
    if (mode === "bottom" || mode === "top") {
      const barH = Math.max(4, Math.round(5.5 * scaleFactor));
      const padSide = Math.round(w * 0.06);
      const trackW = w - padSide * 2;
      const y = mode === "bottom"
        ? h - barOffset - Math.round(16 * scaleFactor) - barH
        : barOffset + Math.round(12 * scaleFactor);

      // Track background
      ctx.fillStyle = "rgba(255, 255, 255, 0.18)";
      ctx.beginPath();
      if (ctx.roundRect) ctx.roundRect(padSide, y, trackW, barH, 999);
      else ctx.rect(padSide, y, trackW, barH);
      ctx.fill();

      // Active fill
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
      const y = Math.min(h - barOffset - 45 * scaleFactor, underTextY + Math.round(18 * scaleFactor));

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
          ctx.fillStyle = "#F472B6";
          ctx.shadowColor = "rgba(244, 114, 182, 0.8)";
          ctx.shadowBlur = 18 * scaleFactor;
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

    // 1. Background
    const currentZemin = getZeminById(state.zeminId);
    const mediaEl = activeBgVideo || activeBgImage;
    if (mediaEl) {
      drawBackgroundMediaWithFilters(ctx, mediaEl, Boolean(activeBgVideo), w, h, t, state);
    } else {
      drawProceduralScene(ctx, w, h, t, dt, currentZemin);
    }

    // 2. Darkness
    if (state.bgDim > 0) {
      ctx.fillStyle = `rgba(4, 6, 8, ${state.bgDim / 100})`;
      ctx.fillRect(0, 0, w, h);
    }

    // 3. Vignette & Visual Particles
    drawCinematicVignette(ctx, w, h, state.vignette !== "off");
    drawVisualEffectOverlay(ctx, w, h, t, dt, state);

    // 4. Filter Warmth & Cinema Letterbox Bars
    drawFilterWarmthAndCinemaBars(ctx, w, h, state);

    const activeVerse = state.verses[state.activeVerseIdx] || state.verses[0];

    // 5. Corner Info Badges, Centered Surah Header & Logo Signature
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

      const showAr = (state.subtitleMode !== "meal_only");
      const showTr = (state.subtitleMode === "tr" || state.subtitleMode === "meal_only" || state.subtitleMode === "both");
      const showEn = (state.subtitleMode === "en" || state.subtitleMode === "both");

      ctx.font = `700 ${arPx}px '${state.arabicFont}', serif`;
      const ayahBadge = `\uFD3F${toArabicIndicDigits(activeVerse.numberInSurah)}\uFD3E`;
      const arLinesPreview = showAr ? wrapCanvasText(ctx, `${activeVerse.arabic} ${ayahBadge}`, maxTextW) : [];
      const arLineH = arPx * 1.62;
      const totalArH = arLinesPreview.length * arLineH;

      const italicStr = state.mealItalic ? "italic " : "";
      ctx.font = `${italicStr}${state.mealWeight || 500} ${mealPx}px '${state.mealFont || "DM Sans"}', serif`;
      const mealTextStr = `${activeVerse.numberInSurah}- ${getSelectedMealText(activeVerse)}`;
      const trLines = showTr ? wrapCanvasText(ctx, mealTextStr, maxTextW) : [];
      const trLineH = mealPx * 1.44;

      const enPx = Math.round(mealPx * 0.86);
      ctx.font = `400 ${enPx}px 'DM Sans', sans-serif`;
      const enLines = showEn ? wrapCanvasText(ctx, activeVerse.en, maxTextW) : [];
      const enLineH = enPx * 1.38;

      const totalBlockH =
        totalArH +
        (trLines.length > 0 ? (showAr ? 20 * scaleFactor : 0) + trLines.length * trLineH : 0) +
        (enLines.length > 0 ? 14 * scaleFactor + enLines.length * enLineH : 0);

      const posMap = {
        top: isLandscape ? h * 0.36 : h * 0.33,
        center: h * 0.50,
        bottom: isLandscape ? h * 0.68 : h * 0.68
      };
      const anchorY = posMap[state.textPosition] || h * 0.50;
      const blockStartY = anchorY - totalBlockH / 2;

      // Optional Bismillah Header above Ayah 1
      const showBismillah =
        activeVerse.hasBismillahHeader &&
        (state.bismillahMode === "separate" || (state.bismillahMode === "first_only" && state.activeVerseIdx === 0));

      if (showBismillah) {
        ctx.direction = "rtl";
        ctx.fillStyle = "#F0D78A";
        ctx.font = `700 ${Math.round(arPx * 0.72)}px '${state.arabicFont}', serif`;
        ctx.fillText("بِسْمِ اللَّهِ الرَّحْمَٰنِ الرَّحِيمِ", w / 2, blockStartY - 38 * scaleFactor);
      }

      if (state.textReadability === "box") {
        const padY = 22 * scaleFactor;
        ctx.fillStyle = "rgba(5, 7, 10, 0.70)";
        const bx = w * 0.06;
        const bw = w * 0.88;
        ctx.beginPath();
        if (ctx.roundRect) {
          ctx.roundRect(bx, blockStartY - padY, bw, totalBlockH + padY * 2, 16 * scaleFactor);
        } else {
          ctx.rect(bx, blockStartY - padY, bw, totalBlockH + padY * 2);
        }
        ctx.fill();
      }

      let cursorY = blockStartY + arLineH / 2;

      if (showAr) {
        ctx.direction = "rtl";
        ctx.font = `700 ${arPx}px '${state.arabicFont}', serif`;
        if (state.arabicLetterSpacing > 0 && "letterSpacing" in ctx) {
          ctx.letterSpacing = `${state.arabicLetterSpacing}px`;
        }

        const words = (activeVerse.arabic || "").trim().split(/\s+/).filter(Boolean);
        let activeWordIdx = -1;
        const isWordHighlight = (state.transitionMode === "word_highlight");
        if (isWordHighlight && words.length > 0) {
          const vDur = state.audioDurations[state.activeVerseIdx] || 5.0;
          if (state.isPlaying || state.isRecording) {
            const frac = Math.max(0, Math.min(0.999, (state.activeVerseElapsed || 0) / vDur));
            const weights = words.map((wStr) => Math.max(2, wStr.length));
            const totalWeight = weights.reduce((a, b) => a + b, 0);
            let target = frac * totalWeight;
            for (let wi = 0; wi < weights.length; wi++) {
              if (target <= weights[wi]) {
                activeWordIdx = wi;
                break;
              }
              target -= weights[wi];
            }
            if (activeWordIdx === -1) activeWordIdx = words.length - 1;
          } else {
            activeWordIdx = Math.floor(t * 1.1) % words.length;
          }
        }

        drawArabicLinesWithWordHighlight(
          ctx,
          activeVerse,
          maxTextW,
          w / 2,
          cursorY,
          arLineH,
          arPx,
          scaleFactor,
          activeWordIdx,
          isWordHighlight
        );
        if ("letterSpacing" in ctx) ctx.letterSpacing = "0px";
        cursorY += totalArH + 18 * scaleFactor;
      }

      ctx.direction = "ltr";
      if (trLines.length > 0) {
        ctx.fillStyle = state.mealColor;
        ctx.font = `${italicStr}${state.mealWeight || 500} ${mealPx}px '${state.mealFont || "DM Sans"}', serif`;
        trLines.forEach((line, i) => {
          const ly = cursorY + i * trLineH;
          if (state.textReadability === "outline") {
            ctx.strokeStyle = "rgba(0,0,0,0.9)";
            ctx.lineWidth = 2.8 * scaleFactor;
            ctx.strokeText(line, w / 2, ly);
          }
          ctx.fillText(line, w / 2, ly);
        });
        cursorY += trLines.length * trLineH + 14 * scaleFactor;
      }

      if (enLines.length > 0) {
        ctx.fillStyle = "#CBD5E1";
        ctx.font = `400 ${enPx}px 'DM Sans', sans-serif`;
        enLines.forEach((line, i) => {
          ctx.fillText(line, w / 2, cursorY + i * enLineH);
        });
        cursorY += enLines.length * enLineH;
      }

      lastContentBottomY = cursorY;
      ctx.restore();
    }

    // 7. In-Video Progress Bar (Süre Şeridi videonun içinde!)
    drawInVideoProgressBar(w, h, scaleFactor, lastContentBottomY);

    if (state.isFadingOut && state.fadeOutProgress > 0) {
      ctx.save();
      ctx.fillStyle = `rgba(4, 6, 8, ${Math.min(0.92, state.fadeOutProgress)})`;
      ctx.fillRect(0, 0, w, h);
      ctx.restore();
    }
  }

  let animLoopId = null;
  function startRenderLoop() {
    function step(now) {
      if (!document.hidden || state.isRecording) {
        renderStudioFrame(now);
      }
      animLoopId = requestAnimationFrame(step);
    }
    if (!animLoopId) animLoopId = requestAnimationFrame(step);
  }

  // Recording & Playback Session
  let mediaRecorder = null;
  let recordedChunks = [];
  let sessionAborted = false;
  let recorderCompletedNaturally = false;
  let wakeLockSentinel = null;
  let playbackRafId = null;
  let textModeTimerId = null;

  async function requestScreenWakeLock() {
    if ("wakeLock" in navigator) {
      try { wakeLockSentinel = await navigator.wakeLock.request("screen"); } catch (_) {}
    }
  }

  function releaseScreenWakeLock() {
    if (wakeLockSentinel) {
      try { wakeLockSentinel.release(); } catch (_) {}
      wakeLockSentinel = null;
    }
  }

  function stopPlaybackAndRecording(aborted = true) {
    if (aborted) {
      sessionAborted = true;
      recorderCompletedNaturally = false;
    }

    cancelAnimationFrame(playbackRafId);
    playbackRafId = null;
    clearTimeout(textModeTimerId);

    (state.audioElements || []).forEach((a) => {
      if (!a) return;
      try {
        a.onended = null;
        a.onwaiting = null;
        a.onplaying = null;
        a.pause();
        a.currentTime = 0;
      } catch (_) {}
    });
    stopAmbientSound();
    resetMasterGain();

    if (mediaRecorder && mediaRecorder.state !== "inactive") {
      try { mediaRecorder.stop(); } catch (_) {}
    }

    state.isPlaying = false;
    state.isRecording = false;
    state.isBuffering = false;
    state.isFadingOut = false;
    state.fadeOutProgress = 0;
    releaseScreenWakeLock();

    const wrap = document.getElementById("canvasWrap");
    if (wrap) wrap.classList.remove("recording-active");
    const pill = document.getElementById("bufferingPill");
    if (pill) pill.classList.remove("active");

    updateStageBadge(state.audioReady ? "ready" : "error", state.audioReady ? "Hazır" : "Ses Bekleniyor");
    const lblPlay = document.getElementById("lblPlayBtn");
    const lblRec = document.getElementById("lblRecordBtn");
    if (lblPlay) lblPlay.textContent = "▶";
    if (lblRec) lblRec.textContent = "🎬 Oluştur";
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

    await ensureFontsLoaded();
    stopPlaybackAndRecording(true);

    sessionAborted = false;
    recorderCompletedNaturally = false;
    const { mixDest } = ensureAudioGraph(state, activeBgVideo);

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
    }

    let recorderStarted = false;
    let recordStartPerf = 0;
    const caps = detectRecorderCapabilities();
    const chosenFormat = caps.best;

    if (recordMode) {
      state.lastExportExt = chosenFormat.ext;
      state.lastExportMime = chosenFormat.mime || "video/webm";

      const canvasStream = canvas.captureStream(30);
      const combinedTracks = [
        ...canvasStream.getVideoTracks(),
        ...mixDest.stream.getAudioTracks()
      ];
      const finalStream = new MediaStream(combinedTracks);
      const bps = (state.bitrateMbps || (state.resolution === 1080 ? 8 : 5)) * 1000000;
      const opts = chosenFormat.mime
        ? { mimeType: chosenFormat.mime, videoBitsPerSecond: bps }
        : { videoBitsPerSecond: bps };

      recordedChunks = [];
      mediaRecorder = new MediaRecorder(finalStream, opts);
      mediaRecorder.ondataavailable = (e) => {
        if (e.data && e.data.size > 0) recordedChunks.push(e.data);
      };

      mediaRecorder.onstop = async () => {
        if (sessionAborted || !recorderCompletedNaturally || recordedChunks.length === 0) {
          recordedChunks = [];
          return;
        }

        const rawBlob = new Blob(recordedChunks, { type: state.lastExportMime });
        const actualMs = Math.max(500, performance.now() - recordStartPerf);
        const patchedBlob = await patchWebmDuration(rawBlob, actualMs);
        state.lastExportBlob = patchedBlob;
        state.lastExportDuration = actualMs / 1000;

        document.getElementById("btnQuickShare").disabled = false;
        const card = document.getElementById("exportResultCard");
        if (card) card.classList.add("ready");
        const meta = document.getElementById("lblExportMeta");
        if (meta) {
          meta.textContent = `${formatShortTime(state.lastExportDuration)} · ${(patchedBlob.size / (1024 * 1024)).toFixed(1)} MB · .${state.lastExportExt.toUpperCase()}`;
        }

        switchTab("bicim");
        hapticTap(25);
        showToast(`✓ Video hazır! (${formatShortTime(state.lastExportDuration)} · .${state.lastExportExt.toUpperCase()})`, 3600);
      };
    }

    const completeSessionSmoothly = () => {
      if (sessionAborted) return;
      if (state.fadeOutEnd === "on") {
        state.isFadingOut = true;
        triggerSmoothFadeOut(0.75);
        const fadeStart = performance.now();
        const fadeStep = () => {
          if (sessionAborted) return;
          const p = Math.min(1, (performance.now() - fadeStart) / 750);
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
          state.elapsedTime = Math.min(state.totalDuration, passed);

          document.getElementById("lblCurrentTime").textContent = formatPreciseTime(state.elapsedTime);
          const pct = state.totalDuration > 0 ? Math.min(100, (state.elapsedTime / state.totalDuration) * 100) : 0;
          document.getElementById("progressBarFill").style.width = `${pct}%`;

          if (curInVerse >= vDur) {
            playVerseAtIndex(idx + 1);
            return;
          }
          playbackRafId = requestAnimationFrame(stepTextTimeline);
        };
        playbackRafId = requestAnimationFrame(stepTextTimeline);
        return;
      }

      const aud = state.audioElements[idx];
      let handedOver = false;
      aud.currentTime = 0;

      aud.onwaiting = () => {
        state.isBuffering = true;
        document.getElementById("bufferingPill").classList.add("active");
        if (mediaRecorder && mediaRecorder.state === "recording") {
          try { mediaRecorder.pause(); } catch (_) {}
        }
      };

      aud.onplaying = () => {
        state.isBuffering = false;
        document.getElementById("bufferingPill").classList.remove("active");
        if (mediaRecorder && mediaRecorder.state === "paused") {
          try { mediaRecorder.resume(); } catch (_) {}
        }
        if (recordMode && !recorderStarted) {
          recorderStarted = true;
          recordStartPerf = performance.now();
          mediaRecorder.start(200);
          startAmbientSound(state);
        } else if (!recordMode && idx === 0) {
          startAmbientSound(state);
        }
      };

      aud.onended = () => {
        if (!handedOver) {
          handedOver = true;
          playVerseAtIndex(idx + 1);
        }
      };

      aud.play().catch(() => {
        showToast("Ses oynatılamadı. Kayıt iptal edildi.");
        stopPlaybackAndRecording(true);
      });

      const monitorStep = () => {
        if (sessionAborted || (!state.isPlaying && !state.isRecording)) return;
        if (state.activeVerseIdx !== idx) return;

        state.activeVerseElapsed = aud.currentTime || 0;
        let passed = state.coverFirstFrame === "on" ? 1.2 : 0;
        for (let i = 0; i < idx; i++) {
          passed += Math.max(0.4, state.audioDurations[i] - state.gaplessTrimSec);
        }
        passed += state.activeVerseElapsed;
        state.elapsedTime = Math.min(state.totalDuration, passed);

        document.getElementById("lblCurrentTime").textContent = formatPreciseTime(state.elapsedTime);
        const pct = state.totalDuration > 0 ? Math.min(100, (state.elapsedTime / state.totalDuration) * 100) : 0;
        document.getElementById("progressBarFill").style.width = `${pct}%`;

        if (!isLastVerse && !handedOver && aud.duration > 0 && state.gaplessTrimSec > 0) {
          if (aud.currentTime >= aud.duration - state.gaplessTrimSec) {
            handedOver = true;
            aud.onended = null;
            aud.pause();
            playVerseAtIndex(idx + 1);
            return;
          }
        }
        playbackRafId = requestAnimationFrame(monitorStep);
      };
      playbackRafId = requestAnimationFrame(monitorStep);
    };

    if (state.coverFirstFrame === "on") {
      if (recordMode && !recorderStarted) {
        recorderStarted = true;
        recordStartPerf = performance.now();
        mediaRecorder.start(200);
        startAmbientSound(state);
      }
      textModeTimerId = setTimeout(() => {
        if (!sessionAborted && (state.isPlaying || state.isRecording)) {
          playVerseAtIndex(0);
        }
      }, 1200);
    } else {
      playVerseAtIndex(0);
    }
  }

  function updateSocialCaptionText() {
    const surahMeta = SURAHS.find((s) => s[0] === state.surahNo) || SURAHS[86];
    const reciterMeta = RECITERS.find((r) => r.id === state.reciterId) || RECITERS[0];
    const firstVerse = state.verses[0];
    const mealSnippet = firstVerse ? `"${getSelectedMealText(firstVerse)}"` : "";
    const surahTag = surahMeta[1].replace(/[^a-zA-Z0-9ğüşıöçĞÜŞİÖÇ]/g, "");
    const plat = state.captionPlatform || "reels";

    let tags = `#Kuran #Tilavet #${surahTag}Suresi #Ayet #Huzur #TilawahWorld #Reels #Keşfet`;
    let header = `📖 ${surahMeta[1]} Sûresi (${state.ayahStart}-${state.ayahEnd}. Âyetler)\n🎙️ Hâfız: ${reciterMeta.name}`;

    if (plat === "tiktok") {
      tags = `#kuranıkerim #tilavet #${surahTag.toLowerCase()}suresi #ayetler #huzur #keşfet #fyp`;
    } else if (plat === "shorts") {
      header = `📖 ${surahMeta[1]} Sûresi ${state.ayahStart}-${state.ayahEnd}. Âyetler | ${reciterMeta.name} #Shorts`;
      tags = `#Shorts #Kuran #Tilavet #${surahTag}Suresi #Ayet`;
    } else if (plat === "youtube") {
      header = `${surahMeta[1]} Sûresi (${state.ayahStart}-${state.ayahEnd}. Âyetler) - Huzur Veren Kur'ân-ı Kerîm Tilâveti\nOkuyan Hâfız: ${reciterMeta.name}`;
      tags = `#KuranıKerim #Tilavet #${surahTag}Suresi #Meal #Tefekkür`;
    } else if (plat === "whatsapp") {
      header = `✨ *${surahMeta[1]} Sûresi (${state.ayahStart}-${state.ayahEnd}. Âyetler)*\n🎙️ _${reciterMeta.name}_`;
      tags = `🌿 _Tilawah World_`;
    }

    const txt = document.getElementById("txtSocialCaption");
    if (txt) txt.value = `${header}\n\n` + (mealSnippet ? `${mealSnippet}\n\n` : "") + tags;
  }

  function downloadExportedVideo() {
    if (!state.lastExportBlob) {
      showToast("Önce 'Oluştur' düğmesiyle video hazırlayın.");
      return;
    }
    const fileName = formatExportFileName(state, SURAHS, RECITERS, state.lastExportExt);
    const url = URL.createObjectURL(state.lastExportBlob);
    const a = document.createElement("a");
    a.href = url;
    a.download = fileName;
    document.body.appendChild(a);
    a.click();
    a.remove();
    setTimeout(() => URL.revokeObjectURL(url), 4000);
    showToast(`Video indirildi: ${fileName}`);
  }

  async function shareExportedVideo() {
    if (!state.lastExportBlob) {
      showToast("Önce bir video oluşturun.");
      return;
    }
    const surahMeta = SURAHS.find((s) => s[0] === state.surahNo) || SURAHS[86];
    const fileName = formatExportFileName(state, SURAHS, RECITERS, state.lastExportExt);
    const mimeType = state.lastExportExt === "mp4" ? "video/mp4" : "video/webm";
    const file = new File([state.lastExportBlob], fileName, { type: mimeType });
    const caption = document.getElementById("txtSocialCaption").value;

    if (navigator.canShare && navigator.canShare({ files: [file] })) {
      try {
        await navigator.share({
          title: `${surahMeta[1]} Sûresi Tilâveti`,
          text: caption,
          files: [file]
        });
        return;
      } catch (err) {
        if (err && err.name === "AbortError") return;
      }
    }
    downloadExportedVideo();
  }

  const sheetTitles = {
    stil: "Stil",
    kesit: "Kesit",
    hafiz: "Hâfız",
    zemin: "Zemin & Kadraj",
    ortam: "Ortam & Ses",
    metin: "Metin & Hat",
    gorunum: "Görünüm & Video İçi Şerit",
    filtre: "Filtre & Atmosfer",
    kapak: "Kapak Tasarımı & Konum",
    bicim: "Biçim, İmza & Ayarlar"
  };

  let activeTabName = "stil";

  function switchTab(tabName) {
    hapticTap();
    activeTabName = tabName;
    const shell = document.getElementById("appShell");
    if (shell && shell.classList.contains("panel-collapsed")) {
      shell.classList.remove("panel-collapsed");
    }

    document.querySelectorAll(".tool-btn").forEach((btn) => {
      btn.classList.toggle("active", btn.dataset.tab === tabName);
    });
    document.querySelectorAll(".tab-pane").forEach((pane) => {
      pane.classList.toggle("active", pane.id === `pane-${tabName}`);
    });
    const titleEl = document.getElementById("sheetTitleText");
    if (titleEl) titleEl.textContent = sheetTitles[tabName] || "Ayarlar";

    if (tabName === "kapak") {
      state.coverPreviewMode = "cover";
      const chk = document.getElementById("chkPreviewCoverNow");
      if (chk) chk.checked = true;
    } else if (state.coverPreviewMode === "cover") {
      state.coverPreviewMode = "ayah";
      const chk = document.getElementById("chkPreviewCoverNow");
      if (chk) chk.checked = false;
    }

    if (tabName === "bicim") refreshStorageStatsUI();
  }

  function populateSurahAndReciterSelectors() {
    const selSurah = document.getElementById("selSurah");
    if (selSurah) {
      selSurah.innerHTML = "";
      SURAHS.forEach(([no, nameTr, nameAr, count]) => {
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
    const surahMeta = SURAHS.find((s) => s[0] === state.surahNo) || SURAHS[86];
    const maxAyah = surahMeta[3];
    if (!preserveCurrent) {
      state.ayahStart = 1;
      state.ayahEnd = Math.min(5, maxAyah);
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

    updateHeaderAndBottomSummary();
  }

  function syncAllControlsFromState() {
    document.documentElement.setAttribute("data-theme", state.uiTheme || "black");

    populateSurahAndReciterSelectors();
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

    document.querySelectorAll("#photoMotionGroup .sebat-opt-btn").forEach((b) => {
      b.classList.toggle("active", b.dataset.motion === state.photoMotion);
    });
    setVal("rngBgZoom", state.bgZoom);
    setTxt("valBgZoom", `${(state.bgZoom / 100).toFixed(2)}x`);
    setVal("rngBgPanX", state.bgPanX);
    setTxt("valBgPanX", `${state.bgPanX}%`);
    setVal("rngBgPanY", state.bgPanY);
    setTxt("valBgPanY", `${state.bgPanY}%`);
    setVal("inpVideoTrimStart", state.videoTrimStart);
    setVal("inpVideoTrimEnd", state.videoTrimEnd);

    document.querySelectorAll("#mealStyleGroup .sebat-opt-btn").forEach((b) => {
      b.classList.toggle("active", b.dataset.mstyle === state.mealStyle);
    });
    document.querySelectorAll("#arabicFontGroup .sebat-opt-btn").forEach((b) => {
      b.classList.toggle("active", b.dataset.afont === state.arabicFont);
    });
    document.querySelectorAll("#readabilityGroup .sebat-opt-btn").forEach((b) => {
      b.classList.toggle("active", b.dataset.read === state.textReadability);
    });
    document.querySelectorAll("#textPositionGroup .sebat-opt-btn").forEach((b) => {
      b.classList.toggle("active", b.dataset.pos === state.textPosition);
    });

    document.querySelectorAll("#displayModeGroup .sebat-opt-btn").forEach((b) => {
      b.classList.toggle("active", b.dataset.disp === state.subtitleMode);
    });
    document.querySelectorAll("#mealEditionGroup .sebat-opt-btn").forEach((b) => {
      b.classList.toggle("active", b.dataset.ed === state.mealEdition);
    });
    document.querySelectorAll("#transitionGroup .sebat-opt-btn").forEach((b) => {
      b.classList.toggle("active", b.dataset.trans === state.transitionMode);
    });

    document.querySelectorAll("#qualityGroup .sebat-opt-btn").forEach((b) => {
      b.classList.toggle("active", Number(b.dataset.res) === Number(state.resolution));
    });

    setTxt("lblArabicColorName", state.arabicColorName || "Fildişi");
    setTxt("lblMealColorName", state.mealColorName || "Zer");
    setVal("inpArabicColor", state.arabicColor);
    setVal("inpMealColor", state.mealColor);

    setVal("rngArabicSize", state.arabicSize);
    setTxt("valArabicSize", `${state.arabicSize} px`);
    setVal("rngMealSize", state.mealSize);
    setTxt("valMealSize", `${state.mealSize} px`);
    setVal("rngTextShadow", state.textShadow);
    setTxt("valTextShadow", `${state.textShadow} px`);
    setVal("rngArabicLetterSpacing", state.arabicLetterSpacing);
    setTxt("valArabicLetterSpacing", `${state.arabicLetterSpacing} px`);
    setVal("selBismillahMode", state.bismillahMode);

    setVal("rngReciterVol", state.reciterVol);
    setTxt("valReciterVol", `%${state.reciterVol}`);
    setVal("rngAmbientVol", state.ambientVol);
    setTxt("valAmbientVol", `%${state.ambientVol}`);
    setVal("rngBgVideoVol", state.bgVideoVol);
    setTxt("valBgVideoVol", `%${state.bgVideoVol}`);
    setVal("rngGaplessTrim", Math.round(state.gaplessTrimSec * 100));
    setTxt("valGaplessTrim", `${state.gaplessTrimSec.toFixed(2)} sn`);
    setVal("selFadeOutEnd", state.fadeOutEnd);
    setVal("selAudioFailPolicy", state.audioFailPolicy);

    setVal("selInVideoProgressBar", state.inVideoProgressBar);
    setVal("selInVideoSurahHeader", state.inVideoSurahHeader);
    setChk("chkCornerSurah", state.cornerShowSurah);
    setChk("chkCornerAyahs", state.cornerShowAyahs);
    setChk("chkCornerReciter", state.cornerShowReciter);

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
    setChk("chkCinemaBars", state.cinemaBars);
    setVal("selVisualEffect", state.visualEffect);
    setVal("rngEffectIntensity", state.effectIntensity);
    setTxt("valEffectIntensity", `%${state.effectIntensity}`);

    setChk("chkCoverLargeSurah", state.coverLargeSurah);
    setChk("chkCoverWithVideo", state.coverFirstFrame === "on");
    setChk("chkPreviewCoverNow", state.coverPreviewMode === "cover");
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

    const szOverlay = document.getElementById("safeZoneOverlay");
    if (szOverlay) szOverlay.classList.toggle("active", Boolean(state.safeZoneVisible));

    updateCanvasResolutionAndRatio();
  }

  async function refreshStorageStatsUI() {
    const stats = await getStorageStats();
    const el = document.getElementById("lblStorageStatsSummary");
    if (el) {
      el.textContent = `${stats.galleryCount} kişisel medya (${stats.galleryMB} MB) · ${stats.cachedAyahCount} çevrimdışı âyet önbellekte`;
    }
  }

  async function searchPexelsMedia(query) {
    const q = (query || "rain mosque nature").trim();
    const key = (state.pexelsApiKey || "").trim();
    if (!key) {
      state.zeminSearch = q;
      state.zeminCategory = "Tümü";
      renderZeminCategories();
      renderZeminGrid();
      const box = document.getElementById("pexelsKeyPromptBox");
      if (box) box.style.display = "flex";
      showToast(`Katalogda "${q}" filtrelendi. Çevrimiçi arama için Pexels API anahtarı girebilirsiniz.`);
      return;
    }

    showToast(`Pexels üzerinde "${q}" aranıyor...`);
    try {
      const vidRes = await fetch(`https://api.pexels.com/videos/search?query=${encodeURIComponent(q)}&orientation=portrait&per_page=8`, {
        headers: { Authorization: key }
      });
      const found = [];
      if (vidRes.ok) {
        const vData = await vidRes.json();
        (vData.videos || []).forEach((v) => {
          const hdFile = (v.video_files || []).find((f) => f.height >= 720 && f.file_type === "video/mp4") || (v.video_files || [])[0];
          if (hdFile && hdFile.link) {
            found.push({
              id: `pexels_vid_${v.id}`,
              name: `Pexels Video #${v.id}`,
              type: "video",
              src: hdFile.link,
              thumb: v.image,
              category: "Hareketli",
              recommendedDarkness: 40,
              defaultEffect: "none",
              palette: ["#070809", "#181A20", "#E0B84C"]
            });
          }
        });
      }
      if (found.length > 0) {
        pexelsSearchItems = found;
        state.zeminCategory = "Hareketli";
        renderZeminCategories();
        renderZeminGrid();
        showToast(`Pexels'ten ${found.length} video eklendi!`);
      }
    } catch (_) {
      showToast("Pexels API bağlantısı kurulamadı.");
    }
  }

  function bindEvents() {
    document.querySelectorAll(".tool-btn").forEach((btn) => {
      btn.addEventListener("click", () => {
        const tab = btn.dataset.tab;
        const shell = document.getElementById("appShell");
        if (activeTabName === tab && shell && !shell.classList.contains("panel-collapsed")) {
          shell.classList.toggle("panel-collapsed");
        } else {
          switchTab(tab);
        }
      });
    });

    document.getElementById("btnCloseSheet").addEventListener("click", () => {
      hapticTap();
      document.getElementById("appShell").classList.add("panel-collapsed");
    });

    document.getElementById("btnExpandSheet").addEventListener("click", () => {
      hapticTap();
      const shell = document.getElementById("appShell");
      shell.classList.remove("panel-collapsed");
      shell.classList.toggle("panel-expanded");
    });

    document.getElementById("btnFullscreenPreview").addEventListener("click", () => {
      hapticTap();
      const shell = document.getElementById("appShell");
      shell.classList.remove("panel-expanded");
      shell.classList.toggle("panel-collapsed");
    });

    // Interactive Progress Scrubber Bar Click
    document.getElementById("progressTrackBar").addEventListener("click", (e) => {
      if (!state.versesLoaded || state.verses.length === 0) return;
      const rect = e.currentTarget.getBoundingClientRect();
      const frac = Math.max(0, Math.min(0.999, (e.clientX - rect.left) / rect.width));
      const targetIdx = Math.min(state.verses.length - 1, Math.floor(frac * state.verses.length));
      jumpToVerseIndex(targetIdx);
    });

    document.getElementById("btnUndo").addEventListener("click", () => performUndo());
    document.getElementById("btnRedo").addEventListener("click", () => performRedo());

    document.getElementById("btnSafeZoneToggle").addEventListener("click", () => {
      hapticTap();
      state.safeZoneVisible = !state.safeZoneVisible;
      document.getElementById("safeZoneOverlay").classList.toggle("active", state.safeZoneVisible);
      persistState();
    });

    document.getElementById("btnRandomZeminHeader").addEventListener("click", () => {
      hapticTap();
      const all = getAllZeminItems();
      const pick = all[Math.floor(Math.random() * all.length)];
      if (pick) {
        selectZemin(pick.id);
        showToast(`🎲 Zemin: ${pick.name}`, 1600);
      }
    });

    document.getElementById("btnPlayPreview").addEventListener("click", () => {
      hapticTap();
      if (state.isPlaying || state.isRecording) {
        stopPlaybackAndRecording(true);
      } else {
        startStudioSession(false);
      }
    });

    document.getElementById("btnRecordExport").addEventListener("click", () => {
      hapticTap();
      if (state.isRecording || state.isPlaying) {
        stopPlaybackAndRecording(true);
        showToast("Kayıt iptal edildi — yarım video üretilmedi.");
      } else {
        startStudioSession(true);
      }
    });

    document.getElementById("btnQuickShare").addEventListener("click", () => shareExportedVideo());
    document.getElementById("btnDownloadExport").addEventListener("click", () => downloadExportedVideo());
    document.getElementById("btnShareExport").addEventListener("click", () => shareExportedVideo());

    // Kesit & Hâfız
    document.getElementById("btnJumpToHafizFromKesit").addEventListener("click", () => switchTab("hafiz"));

    document.getElementById("selSurah").addEventListener("change", (e) => {
      state.surahNo = Number(e.target.value);
      populateAyahRangeSelectors(false);
      state.coverAyahNo = state.ayahStart;
      renderKnownExcerptsList();
      persistState();
      loadVersesAndPreloadAudio();
    });

    document.getElementById("selAyahStart").addEventListener("change", (e) => {
      state.ayahStart = Number(e.target.value);
      if (state.ayahEnd < state.ayahStart) {
        state.ayahEnd = state.ayahStart;
        document.getElementById("selAyahEnd").value = state.ayahEnd;
      }
      state.coverAyahNo = state.ayahStart;
      renderKnownExcerptsList();
      persistState();
      loadVersesAndPreloadAudio();
    });

    document.getElementById("selAyahEnd").addEventListener("change", (e) => {
      state.ayahEnd = Number(e.target.value);
      if (state.ayahEnd < state.ayahStart) {
        state.ayahStart = state.ayahEnd;
        document.getElementById("selAyahStart").value = state.ayahStart;
      }
      renderKnownExcerptsList();
      persistState();
      loadVersesAndPreloadAudio();
    });

    document.getElementById("btnAddCurrentToFavorites").addEventListener("click", () => {
      hapticTap();
      const surahMeta = SURAHS.find((s) => s[0] === state.surahNo) || SURAHS[0];
      const title = `${surahMeta[1]} ${state.ayahStart}–${state.ayahEnd}`;
      state.favoriteAyahs = [
        { id: "fav_" + Date.now(), title, sub: `${surahMeta[1]} ${state.ayahStart}-${state.ayahEnd}`, arName: surahMeta[4], surahNo: state.surahNo, start: state.ayahStart, end: state.ayahEnd },
        ...(state.favoriteAyahs || [])
      ];
      renderKnownExcerptsList();
      persistState();
      showToast(`★ "${title}" bilinen kesitlere eklendi!`);
    });

    document.getElementById("btnRetryFailedAudio").addEventListener("click", () => loadVersesAndPreloadAudio());
    document.getElementById("btnContinueTextOnly").addEventListener("click", () => enableTextOnlyContinueMode());

    document.getElementById("inpReciterSearch").addEventListener("input", (e) => {
      state.reciterSearch = e.target.value;
      renderRecitersList();
    });

    // Zemin & Kadraj
    document.getElementById("inpZeminSearch").addEventListener("input", (e) => {
      state.zeminSearch = e.target.value;
      renderZeminGrid();
    });

    document.getElementById("btnSearchPexels").addEventListener("click", () => {
      searchPexelsMedia(document.getElementById("inpZeminSearch").value.trim());
    });

    document.getElementById("btnSavePexelsKeyInline").addEventListener("click", () => {
      state.pexelsApiKey = document.getElementById("inpPexelsKeyInline").value.trim();
      document.getElementById("pexelsKeyPromptBox").style.display = "none";
      persistState();
      if (state.pexelsApiKey) searchPexelsMedia(document.getElementById("inpZeminSearch").value.trim());
    });

    document.getElementById("inpGalleryUpload").addEventListener("change", async (e) => {
      const files = Array.from(e.target.files || []);
      e.target.value = "";
      if (files.length === 0) return;
      let lastId = null;
      for (const f of files) {
        try {
          const item = await processUploadedFile(f);
          await saveGalleryItem(item);
          lastId = item.id;
        } catch (_) {}
      }
      galleryItems = await getAllGalleryItems();
      state.zeminCategory = "Galerim";
      renderZeminCategories();
      if (lastId) await selectZemin(lastId);
      refreshStorageStatsUI();
      showToast("Medya Galerim'e eklendi.");
    });

    document.getElementById("btnClearGallery").addEventListener("click", async () => {
      hapticTap();
      await clearAllGallery();
      galleryItems = [];
      renderZeminCategories();
      await selectZemin("vid_forest_stream");
      refreshStorageStatsUI();
      showToast("Kişisel galeriniz temizlendi.");
    });

    document.querySelectorAll("#photoMotionGroup .sebat-opt-btn").forEach((btn) => {
      btn.addEventListener("click", () => {
        hapticTap();
        state.photoMotion = btn.dataset.motion;
        document.querySelectorAll("#photoMotionGroup .sebat-opt-btn").forEach((b) => b.classList.toggle("active", b === btn));
        persistState();
      });
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
    document.getElementById("inpVideoTrimStart").addEventListener("change", (e) => {
      state.videoTrimStart = Math.max(0, Number(e.target.value) || 0);
      persistState();
    });
    document.getElementById("inpVideoTrimEnd").addEventListener("change", (e) => {
      state.videoTrimEnd = Math.max(0, Number(e.target.value) || 0);
      persistState();
    });
    document.getElementById("btnLoadDirectUrl").addEventListener("click", async () => {
      const url = document.getElementById("inpDirectMediaUrl").value.trim();
      if (!url) {
        showToast("Lütfen doğrudan bir .mp4, .webm veya .jpg bağlantısı girin.");
        return;
      }
      showToast("Bağlantı indiriliyor...");
      try {
        const res = await fetch(url, { mode: "cors" });
        if (!res.ok) throw new Error("HTTP " + res.status);
        const blob = await res.blob();
        const ext = url.split("?")[0].split(".").pop().toLowerCase() || "mp4";
        const fakeFile = new File([blob], `Baglanti_${Date.now()}.${ext}`, {
          type: blob.type || (ext === "jpg" ? "image/jpeg" : "video/mp4")
        });
        const item = await processUploadedFile(fakeFile);
        await saveGalleryItem(item);
        galleryItems = await getAllGalleryItems();
        state.zeminCategory = "Galerim";
        renderZeminCategories();
        await selectZemin(item.id);
        document.getElementById("inpDirectMediaUrl").value = "";
        refreshStorageStatsUI();
        showToast("Bağlantıdaki medya eklendi.");
      } catch (_) {
        showToast("CORS engeli nedeniyle indirilemedi. Lütfen cihazınızdan '+ Yükle' ile seçin.");
      }
    });

    // Ortam & Ses
    document.getElementById("rngReciterVol").addEventListener("input", (e) => {
      state.reciterVol = Number(e.target.value);
      document.getElementById("valReciterVol").textContent = `%${state.reciterVol}`;
      updateVolumes(state, activeBgVideo);
      persistState();
    });
    document.getElementById("rngAmbientVol").addEventListener("input", (e) => {
      state.ambientVol = Number(e.target.value);
      document.getElementById("valAmbientVol").textContent = `%${state.ambientVol}`;
      updateVolumes(state, activeBgVideo);
      persistState();
    });
    document.getElementById("rngBgVideoVol").addEventListener("input", (e) => {
      state.bgVideoVol = Number(e.target.value);
      document.getElementById("valBgVideoVol").textContent = `%${state.bgVideoVol}`;
      state.videoAudioMode = state.bgVideoVol > 0 ? "unmuted" : "muted";
      ensureAudioGraph(state, activeBgVideo);
      updateVolumes(state, activeBgVideo);
      persistState();
    });
    document.getElementById("rngGaplessTrim").addEventListener("input", (e) => {
      state.gaplessTrimSec = Number(e.target.value) / 100;
      document.getElementById("valGaplessTrim").textContent = `${state.gaplessTrimSec.toFixed(2)} sn`;
      persistState();
    });
    document.getElementById("selFadeOutEnd").addEventListener("change", (e) => {
      state.fadeOutEnd = e.target.value;
      persistState();
    });
    document.getElementById("selAudioFailPolicy").addEventListener("change", (e) => {
      state.audioFailPolicy = e.target.value;
      persistState();
    });

    // Metin & Hat
    document.querySelectorAll("#mealStyleGroup .sebat-opt-btn").forEach((btn) => {
      btn.addEventListener("click", () => {
        hapticTap();
        applyMealStyleById(btn.dataset.mstyle, true);
      });
    });

    document.querySelectorAll("#arabicFontGroup .sebat-opt-btn").forEach((btn) => {
      btn.addEventListener("click", () => {
        hapticTap();
        state.arabicFont = btn.dataset.afont;
        document.querySelectorAll("#arabicFontGroup .sebat-opt-btn").forEach((b) => b.classList.toggle("active", b === btn));
        ensureFontsLoaded();
        persistState();
      });
    });

    document.getElementById("inpArabicColor").addEventListener("input", (e) => {
      state.arabicColor = e.target.value;
      state.arabicColorName = e.target.value.toUpperCase();
      document.getElementById("lblArabicColorName").textContent = state.arabicColorName;
      renderColorSwatches();
      persistState();
    });
    document.getElementById("inpMealColor").addEventListener("input", (e) => {
      state.mealColor = e.target.value;
      state.mealColorName = e.target.value.toUpperCase();
      document.getElementById("lblMealColorName").textContent = state.mealColorName;
      renderColorSwatches();
      persistState();
    });

    document.querySelectorAll("#readabilityGroup .sebat-opt-btn").forEach((btn) => {
      btn.addEventListener("click", () => {
        hapticTap();
        state.textReadability = btn.dataset.read;
        document.querySelectorAll("#readabilityGroup .sebat-opt-btn").forEach((b) => b.classList.toggle("active", b === btn));
        persistState();
      });
    });

    document.querySelectorAll("#textPositionGroup .sebat-opt-btn").forEach((btn) => {
      btn.addEventListener("click", () => {
        hapticTap();
        state.textPosition = btn.dataset.pos;
        document.querySelectorAll("#textPositionGroup .sebat-opt-btn").forEach((b) => b.classList.toggle("active", b === btn));
        persistState();
      });
    });

    document.getElementById("rngArabicSize").addEventListener("input", (e) => {
      state.arabicSize = Number(e.target.value);
      document.getElementById("valArabicSize").textContent = `${state.arabicSize} px`;
      persistState();
    });
    document.getElementById("rngMealSize").addEventListener("input", (e) => {
      state.mealSize = Number(e.target.value);
      document.getElementById("valMealSize").textContent = `${state.mealSize} px`;
      persistState();
    });
    document.getElementById("rngTextShadow").addEventListener("input", (e) => {
      state.textShadow = Number(e.target.value);
      document.getElementById("valTextShadow").textContent = `${state.textShadow} px`;
      persistState();
    });
    document.getElementById("rngArabicLetterSpacing").addEventListener("input", (e) => {
      state.arabicLetterSpacing = Number(e.target.value);
      document.getElementById("valArabicLetterSpacing").textContent = `${state.arabicLetterSpacing} px`;
      persistState();
    });
    document.getElementById("selBismillahMode").addEventListener("change", (e) => {
      state.bismillahMode = e.target.value;
      persistState();
    });

    // Görünüm & Video İçi Şerit
    document.querySelectorAll("#displayModeGroup .sebat-opt-btn").forEach((btn) => {
      btn.addEventListener("click", () => {
        hapticTap();
        state.subtitleMode = btn.dataset.disp;
        document.querySelectorAll("#displayModeGroup .sebat-opt-btn").forEach((b) => b.classList.toggle("active", b === btn));
        persistState();
      });
    });

    document.querySelectorAll("#mealEditionGroup .sebat-opt-btn").forEach((btn) => {
      btn.addEventListener("click", () => {
        hapticTap();
        state.mealEdition = btn.dataset.ed;
        document.querySelectorAll("#mealEditionGroup .sebat-opt-btn").forEach((b) => b.classList.toggle("active", b === btn));
        updateSocialCaptionText();
        persistState();
      });
    });

    document.querySelectorAll("#transitionGroup .sebat-opt-btn").forEach((btn) => {
      btn.addEventListener("click", () => {
        hapticTap();
        state.transitionMode = btn.dataset.trans;
        state.verseStartTime = performance.now();
        document.querySelectorAll("#transitionGroup .sebat-opt-btn").forEach((b) => b.classList.toggle("active", b === btn));
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

    document.getElementById("chkCornerSurah").addEventListener("change", (e) => {
      state.cornerShowSurah = e.target.checked;
      persistState();
    });
    document.getElementById("chkCornerAyahs").addEventListener("change", (e) => {
      state.cornerShowAyahs = e.target.checked;
      persistState();
    });
    document.getElementById("chkCornerReciter").addEventListener("change", (e) => {
      state.cornerShowReciter = e.target.checked;
      persistState();
    });

    // Filtre
    document.getElementById("rngBrightnessOffset").addEventListener("input", (e) => {
      const v = Number(e.target.value);
      state.bgBrightnessOffset = v;
      state.bgBrightness = 100 + v;
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
      state.lockBgDim = true;
      document.getElementById("chkLockBgDim").checked = true;
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
    document.getElementById("chkCinemaBars").addEventListener("change", (e) => {
      state.cinemaBars = e.target.checked;
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

    // Kapak (Full Unified Controls: Scale, Offset X/Y, Pos, Title, Subtitle, Bg Override)
    document.getElementById("chkCoverLargeSurah").addEventListener("change", (e) => {
      state.coverLargeSurah = e.target.checked;
      state.coverPreviewMode = "cover";
      document.getElementById("chkPreviewCoverNow").checked = true;
      persistState();
    });
    document.getElementById("chkCoverWithVideo").addEventListener("change", (e) => {
      state.coverFirstFrame = e.target.checked ? "on" : "off";
      persistState();
    });
    document.getElementById("chkPreviewCoverNow").addEventListener("change", (e) => {
      state.coverPreviewMode = e.target.checked ? "cover" : "ayah";
      persistState();
    });
    document.getElementById("inpCoverTitle").addEventListener("input", (e) => {
      state.coverTitle = e.target.value;
      state.coverPreviewMode = "cover";
      document.getElementById("chkPreviewCoverNow").checked = true;
      persistState();
    });
    document.getElementById("inpCoverSubtitle").addEventListener("input", (e) => {
      state.coverSubtitle = e.target.value;
      state.coverPreviewMode = "cover";
      document.getElementById("chkPreviewCoverNow").checked = true;
      persistState();
    });
    document.getElementById("rngCoverScale").addEventListener("input", (e) => {
      state.coverScale = Number(e.target.value);
      document.getElementById("valCoverScale").textContent = `%${state.coverScale}`;
      state.coverPreviewMode = "cover";
      document.getElementById("chkPreviewCoverNow").checked = true;
      persistState();
    });
    document.getElementById("rngCoverOffsetY").addEventListener("input", (e) => {
      state.coverOffsetY = Number(e.target.value);
      document.getElementById("valCoverOffsetY").textContent = `${state.coverOffsetY}%`;
      state.coverPreviewMode = "cover";
      document.getElementById("chkPreviewCoverNow").checked = true;
      persistState();
    });
    document.getElementById("rngCoverOffsetX").addEventListener("input", (e) => {
      state.coverOffsetX = Number(e.target.value);
      document.getElementById("valCoverOffsetX").textContent = `${state.coverOffsetX}%`;
      state.coverPreviewMode = "cover";
      document.getElementById("chkPreviewCoverNow").checked = true;
      persistState();
    });
    document.getElementById("selCoverPos").addEventListener("change", (e) => {
      state.coverPos = e.target.value;
      state.coverPreviewMode = "cover";
      document.getElementById("chkPreviewCoverNow").checked = true;
      persistState();
    });
    document.getElementById("selCoverBgOverride").addEventListener("change", (e) => {
      state.coverBgOverride = e.target.value;
      state.coverPreviewMode = "cover";
      document.getElementById("chkPreviewCoverNow").checked = true;
      persistState();
    });

    document.getElementById("btnDownloadCoverPng").addEventListener("click", () => {
      hapticTap();
      const prev = state.coverPreviewMode;
      state.coverPreviewMode = "cover";
      renderStudioFrame(performance.now());
      const dataUrl = canvas.toDataURL("image/png");
      state.coverPreviewMode = prev;
      const surahMeta = SURAHS.find((s) => s[0] === state.surahNo) || SURAHS[86];
      const a = document.createElement("a");
      a.href = dataUrl;
      a.download = `Tilawah_Kapak_${surahMeta[1]}_${state.coverAyahNo}.png`;
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
        document.getElementById("txtSocialCaption").select();
        document.execCommand("copy");
        showToast("Açıklama kopyalandı!");
      }
    });

    document.getElementById("btnSaveUserPreset").addEventListener("click", () => {
      hapticTap();
      const nameInp = document.getElementById("inpNewPresetName");
      const name = (nameInp.value || "").trim() || `Ön Ayar ${(state.userPresets || []).length + 1}`;
      const snapshot = {};
      PERSISTED_KEYS.forEach((k) => {
        if (k !== "userPresets" && k !== "favoriteAyahs") snapshot[k] = state[k];
      });
      state.userPresets = [
        { id: "preset_" + Date.now(), name, data: snapshot },
        ...(state.userPresets || [])
      ];
      nameInp.value = "";
      renderUserPresetsList();
      persistState();
      showToast(`✓ "${name}" ön ayarı kaydedildi.`);
    });

    document.getElementById("btnLoadUserPreset").addEventListener("click", async () => {
      hapticTap();
      const sel = document.getElementById("selUserPreset");
      const preset = (state.userPresets || []).find((p) => p.id === sel.value);
      if (!preset) {
        showToast("Lütfen listeden bir ön ayar seçin.");
        return;
      }
      Object.assign(state, preset.data);
      syncAllControlsFromState();
      await selectZemin(state.zeminId, true);
      await loadVersesAndPreloadAudio();
      persistState();
      showToast(`✓ "${preset.name}" ön ayarı yüklendi!`);
    });

    document.getElementById("selUiTheme").addEventListener("change", (e) => {
      state.uiTheme = e.target.value;
      document.documentElement.setAttribute("data-theme", state.uiTheme);
      persistState();
    });

    document.getElementById("btnExportSettingsJson").addEventListener("click", () => {
      hapticTap();
      const payload = {};
      PERSISTED_KEYS.forEach((k) => { payload[k] = state[k]; });
      const blob = new Blob([JSON.stringify(payload, null, 2)], { type: "application/json" });
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = `TilawahWorld_v5_Ayarlar.json`;
      document.body.appendChild(a);
      a.click();
      a.remove();
      setTimeout(() => URL.revokeObjectURL(url), 2500);
      showToast("Ayarlar (.JSON) dışa aktarıldı.");
    });

    document.getElementById("inpImportSettingsJson").addEventListener("change", async (e) => {
      const file = e.target.files && e.target.files[0];
      e.target.value = "";
      if (!file) return;
      try {
        const parsed = JSON.parse(await file.text());
        PERSISTED_KEYS.forEach((k) => {
          if (typeof parsed[k] !== "undefined") state[k] = parsed[k];
        });
        syncAllControlsFromState();
        await selectZemin(state.zeminId, true);
        await loadVersesAndPreloadAudio();
        saveSettings(state, null, true);
        showToast("✓ Ayarlar yüklendi!");
      } catch (_) {
        showToast("Geçersiz JSON dosyası.");
      }
    });

    document.getElementById("btnResetAllSettings").addEventListener("click", async () => {
      hapticTap(20);
      const defaults = resetSettingsToDefault();
      Object.assign(state, defaults);
      syncAllControlsFromState();
      await selectZemin(state.zeminId, true);
      await loadVersesAndPreloadAudio();
      saveSettings(state, null, true);
      showToast("Tüm ayarlar varsayılanlara döndürüldü (9:16 · Siyah Tema).");
    });

    document.addEventListener("visibilitychange", () => {
      if (document.hidden && state.isPlaying && !state.isRecording) {
        stopPlaybackAndRecording(true);
      }
    });
  }

  function initServiceWorker() {
    if (!("serviceWorker" in navigator) || window.__TW_INLINE_CANVAS_MODE__) return;
    navigator.serviceWorker.register("sw.js").then((reg) => {
      if (reg.waiting) {
        const banner = document.getElementById("swUpdateBanner");
        if (banner) banner.classList.add("active");
      }
    }).catch(() => {});
  }

  (async function bootstrap() {
    await initDB().catch(() => {});
    galleryItems = await getAllGalleryItems();
    await loadExternalCatalogJson();

    renderZeminCategories();
    syncAllControlsFromState();
    bindEvents();

    await ensureFontsLoaded();
    startRenderLoop();

    setTimeout(() => {
      const splash = document.getElementById("pwaSplash");
      if (splash) splash.classList.add("hidden");
    }, 500);

    await selectZemin(state.zeminId || "vid_forest_stream", true);
    await loadVersesAndPreloadAudio();
    await refreshStorageStatsUI();
    initServiceWorker();
  })();
})();

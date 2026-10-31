"use strict";

(function () {
  const {
    SURAHS,
    RECITERS,
    MINIMAL_FALLBACK_CATALOG,
    ZEMIN_CATEGORIES,
    COVER_TEMPLATES,
    CURATED_FAVORITE_AYAHS
  } = window.TW_DATA;

  const {
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

  // Viewport height sync
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

  // Load persisted settings into state (Fixes Bug #1: settings ARE restored on startup!)
  const initialSettings = loadSettings();
  const state = {
    ...initialSettings,
    zeminSearch: "",
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

  let toastTimer = null;
  function showToast(msg, duration = 2600) {
    const box = document.getElementById("toastBox");
    if (!box) return;
    box.textContent = msg;
    box.classList.add("show");
    clearTimeout(toastTimer);
    toastTimer = setTimeout(() => box.classList.remove("show"), duration);
  }

  function persistState(showSavedBadge = true) {
    saveSettings(state, () => {
      if (showSavedBadge) {
        const sub = document.getElementById("statusSubText");
        if (sub) {
          const prev = sub.textContent;
          sub.textContent = "✓ Kaydedildi";
          setTimeout(() => {
            if (sub.textContent === "✓ Kaydedildi") sub.textContent = prev;
          }, 1400);
        }
      }
    });
  }

  function hapticTap(ms = 10) {
    if (!state.hapticEnabled) return;
    if (navigator.vibrate) {
      try { navigator.vibrate(ms); } catch (_) {}
    }
  }

  function formatTime(sec) {
    if (!Number.isFinite(sec) || sec < 0) return "00:00.0";
    const m = Math.floor(sec / 60);
    const s = (sec % 60).toFixed(1);
    return `${String(m).padStart(2, "0")}:${s.padStart(4, "0")}`;
  }

  // Font loading check (Fixes Bug #9: Wait for Arabic & Meal fonts before drawing/recording)
  async function ensureFontsLoaded() {
    if (document.fonts && document.fonts.load) {
      try {
        await Promise.allSettled([
          document.fonts.load(`700 42px '${state.arabicFont}'`),
          document.fonts.load("700 42px 'Amiri'"),
          document.fonts.load("700 42px 'Scheherazade New'"),
          document.fonts.load("700 42px 'Noto Naskh Arabic'"),
          document.fonts.load(`500 22px '${state.mealFont || "DM Sans"}'`)
        ]);
        await document.fonts.ready;
      } catch (_) {}
    }
    state.fontsReady = true;
  }

  // Logo setup with fallback canvas
  const appLogoImg = new Image();
  let appLogoLoaded = false;
  const fallbackLogoCanvas = document.createElement("canvas");
  fallbackLogoCanvas.width = 256;
  fallbackLogoCanvas.height = 256;

  function buildFallbackLogo() {
    const lctx = fallbackLogoCanvas.getContext("2d");
    lctx.clearRect(0, 0, 256, 256);
    const grad = lctx.createRadialGradient(128, 128, 20, 128, 128, 120);
    grad.addColorStop(0, "#143026");
    grad.addColorStop(1, "#08110E");
    lctx.fillStyle = grad;
    lctx.beginPath();
    lctx.arc(128, 128, 120, 0, Math.PI * 2);
    lctx.fill();
    lctx.lineWidth = 6;
    lctx.strokeStyle = "#D8B456";
    lctx.stroke();
    lctx.fillStyle = "#F0D78A";
    lctx.font = "bold 46px 'Amiri', serif";
    lctx.textAlign = "center";
    lctx.textBaseline = "middle";
    lctx.fillText("تلاوة", 128, 102);
    lctx.fillStyle = "#D8B456";
    lctx.font = "bold 22px 'DM Sans', sans-serif";
    lctx.fillText("TILAWAH", 128, 152);
    lctx.font = "600 15px 'DM Sans', sans-serif";
    lctx.fillStyle = "#E5E0D5";
    lctx.fillText("WORLD", 128, 176);
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

  // Catalog & Personal Gallery Management (Fixes v2-6: Single Source of Truth is media/catalog.json)
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

  function generateProceduralThumb(palette = ["#08110E", "#142820", "#d8b456"], label = "") {
    const key = palette.join("_") + "_" + label;
    if (thumbCache.has(key)) return thumbCache.get(key);

    const c = document.createElement("canvas");
    c.width = 180;
    c.height = 320;
    const tctx = c.getContext("2d");

    const grad = tctx.createLinearGradient(0, 0, 0, 320);
    grad.addColorStop(0, palette[0] || "#08110E");
    grad.addColorStop(0.55, palette[1] || "#142820");
    grad.addColorStop(1, "#040806");
    tctx.fillStyle = grad;
    tctx.fillRect(0, 0, 180, 320);

    const rad = tctx.createRadialGradient(90, 110, 8, 90, 110, 110);
    rad.addColorStop(0, (palette[2] || "#d8b456") + "66");
    rad.addColorStop(1, "transparent");
    tctx.fillStyle = rad;
    tctx.fillRect(0, 0, 180, 320);

    tctx.strokeStyle = (palette[2] || "#d8b456") + "48";
    tctx.lineWidth = 1.5;
    tctx.beginPath();
    tctx.arc(90, 115, 44, 0, Math.PI * 2);
    tctx.stroke();

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

  // Select Background (Fixes Bug #8: Does NOT overwrite user's bgDim if lockBgDim is enabled!)
  async function selectZemin(id, isInitialRestore = false) {
    const item = getZeminById(id);
    state.zeminId = item ? item.id : "live_rain_window";

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

  function renderZeminCategories() {
    const bar = document.getElementById("zeminCategoryBar");
    if (!bar) return;
    bar.innerHTML = "";
    ZEMIN_CATEGORIES.forEach((cat) => {
      const btn = document.createElement("button");
      const isGal = cat === "Galerim";
      btn.className = "chip" + (isGal ? " gallery-chip" : "") + (state.zeminCategory === cat ? " active" : "");
      btn.textContent = isGal ? `★ Galerim (${galleryItems.length})` : cat;
      btn.addEventListener("click", () => {
        hapticTap();
        state.zeminCategory = cat;
        renderZeminCategories();
        renderZeminGrid();
        persistState(false);
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
      grid.innerHTML = `
        <div class="empty-state-box">
          <svg width="28" height="28" viewBox="0 0 24 24" fill="none" stroke="var(--gold-light)" stroke-width="1.8">
            <rect x="3" y="3" width="18" height="18" rx="3"/>
            <circle cx="8.5" cy="8.5" r="1.5"/>
            <polyline points="21 15 16 10 5 21"/>
          </svg>
          <div><strong>Henüz medya eklemediniz veya eşleşen sahne bulunamadı.</strong><br/>"+ Galerim'e Ekle" düğmesiyle kendi fotoğraf/videonuzu yükleyebilir veya Pexels'ten arayabilirsiniz.</div>
        </div>`;
      return;
    }

    list.forEach((item) => {
      const isUserGal = item.category === "Galerim";
      const card = document.createElement("div");
      card.className =
        "zemin-card" +
        (isUserGal ? " user-gallery-card" : "") +
        (state.zeminId === item.id ? " active" : "");

      const img = document.createElement("img");
      img.className = "zemin-thumb";
      img.loading = "lazy";
      img.alt = item.name;
      const fallbackThumb = generateProceduralThumb(item.palette || ["#08110E", "#142820", "#d8b456"], item.type.toUpperCase());
      img.src = item.thumbDataUrl || item.thumb || fallbackThumb;
      img.onerror = () => {
        img.onerror = null;
        img.src = fallbackThumb;
      };

      const badge = document.createElement("span");
      badge.className = "zemin-badge";
      badge.textContent = item.type === "video" ? "VİDEO" : item.type === "image" ? "1080P FOTO" : "CANLI SAHNE";

      const label = document.createElement("div");
      label.className = "zemin-label";
      label.textContent = item.name;

      card.appendChild(img);
      card.appendChild(badge);
      card.appendChild(label);

      if (isUserGal) {
        const delBtn = document.createElement("button");
        delBtn.className = "zemin-del-btn";
        delBtn.title = "Galerim'den Sil";
        delBtn.textContent = "✕";
        delBtn.addEventListener("click", async (ev) => {
          ev.stopPropagation();
          hapticTap();
          await deleteGalleryItem(item.id);
          galleryItems = await getAllGalleryItems();
          renderZeminCategories();
          if (state.zeminId === item.id) {
            await selectZemin("live_rain_window");
          } else {
            renderZeminGrid();
          }
          refreshStorageStatsUI();
          showToast("Medya Galerim'den silindi.");
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

  // Upload processing
  async function processUploadedFile(file) {
    const lower = file.name.toLowerCase();
    if (lower.endsWith(".heic") || lower.endsWith(".heif") || file.type.includes("heic")) {
      throw new Error("HEIC formatı tarayıcıda doğrudan işlenemez. Lütfen JPG veya PNG seçin.");
    }
    const isVideo = file.type.startsWith("video/") || lower.endsWith(".mp4") || lower.endsWith(".webm") || lower.endsWith(".mov");
    const id = "gal_" + Date.now() + "_" + Math.random().toString(36).slice(2, 7);

    if (!isVideo) {
      let bmp = null;
      if (window.createImageBitmap) {
        try {
          bmp = await createImageBitmap(file, { imageOrientation: "from-image" });
        } catch (_) {
          try { bmp = await createImageBitmap(file); } catch (__) {}
        }
      }
      const tempUrl = URL.createObjectURL(file);
      const img = new Image();
      await new Promise((res, rej) => {
        img.onload = res;
        img.onerror = rej;
        img.src = tempUrl;
      });
      URL.revokeObjectURL(tempUrl);

      const srcW = bmp ? bmp.width : img.naturalWidth;
      const srcH = bmp ? bmp.height : img.naturalHeight;

      const tc = document.createElement("canvas");
      tc.width = 280;
      tc.height = 498;
      const tctx = tc.getContext("2d");
      const scaleCover = Math.max(280 / srcW, 498 / srcH);
      const dw = srcW * scaleCover;
      const dh = srcH * scaleCover;
      tctx.drawImage(bmp || img, (280 - dw) / 2, (498 - dh) / 2, dw, dh);
      const thumbDataUrl = tc.toDataURL("image/jpeg", 0.74);
      if (bmp && bmp.close) bmp.close();

      return {
        id,
        name: file.name.replace(/\.[^.]+$/, ""),
        type: "image",
        blob: file,
        thumbDataUrl,
        category: "Galerim",
        recommendedDarkness: 40,
        defaultEffect: "none",
        createdAt: Date.now()
      };
    } else {
      const tempUrl = URL.createObjectURL(file);
      const vid = document.createElement("video");
      vid.muted = true;
      vid.playsInline = true;
      vid.preload = "metadata";
      vid.src = tempUrl;

      const thumbDataUrl = await new Promise((resolve) => {
        const timeout = setTimeout(() => resolve(generateProceduralThumb(["#08110E", "#142820", "#d8b456"], "VİDEO")), 2500);
        vid.onloadeddata = () => {
          vid.currentTime = Math.min(0.5, (vid.duration || 1) * 0.1);
        };
        vid.onseeked = () => {
          clearTimeout(timeout);
          const tc = document.createElement("canvas");
          tc.width = 280;
          tc.height = 498;
          const vw = vid.videoWidth || 720;
          const vh = vid.videoHeight || 1280;
          const s = Math.max(280 / vw, 498 / vh);
          tc.getContext("2d").drawImage(vid, (280 - vw * s) / 2, (498 - vh * s) / 2, vw * s, vh * s);
          resolve(tc.toDataURL("image/jpeg", 0.74));
        };
        vid.onerror = () => {
          clearTimeout(timeout);
          resolve(generateProceduralThumb(["#08110E", "#142820", "#d8b456"], "VİDEO"));
        };
      });
      URL.revokeObjectURL(tempUrl);

      return {
        id,
        name: file.name.replace(/\.[^.]+$/, ""),
        type: "video",
        blob: file,
        thumbDataUrl,
        category: "Galerim",
        recommendedDarkness: 40,
        defaultEffect: "none",
        createdAt: Date.now()
      };
    }
  }

  // Strip Bismillah from Ayah 1 except Surah 1 & 9
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

  // Verse & Audio Loader (Fixes Bug #5, v2-3, and v2-4!)
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
    const statusBox = document.getElementById("ayahAudioLoadingBox");

    if (btnPlay) btnPlay.disabled = true;
    if (btnRec) btnRec.disabled = true;
    if (lblDur) lblDur.textContent = "Süre ölçülüyor...";
    if (lblState) {
      lblState.innerHTML = `<span class="crescent-spinner"></span> Hazırlanıyor...`;
    }
    if (errBox) errBox.style.display = "none";
    if (statusBox) statusBox.classList.remove("has-error");
    updateStageBadge("loading", "Ayet ve Ses Yükleniyor...");

    const sNo = state.surahNo;
    const start = state.ayahStart;
    const end = state.ayahEnd;
    const count = end - start + 1;
    const offset = start - 1;

    let loadedVerses = null;
    let fromOfflineCache = false;

    try {
      const url = `https://api.alquran.cloud/v1/surah/${sNo}/editions/quran-uthmani,tr.diyanet,en.sahih?offset=${offset}&limit=${count}`;
      const res = await fetch(url);
      if (!res.ok) throw new Error("HTTP " + res.status);
      const json = await res.json();
      if (token !== currentLoadToken) return;

      if (!json || !Array.isArray(json.data) || json.data.length < 3) {
        throw new Error("Geçersiz API yanıtı");
      }

      const [arEd, trEd, enEd] = json.data;
      const verses = [];
      for (let i = 0; i < arEd.ayahs.length; i++) {
        const ayahNum = arEd.ayahs[i].numberInSurah;
        const rawAr = arEd.ayahs[i].text;
        const cleanAr = stripLeadingBismillah(rawAr, sNo, ayahNum);
        verses.push({
          numberInSurah: ayahNum,
          arabic: cleanAr,
          hasBismillahHeader: (ayahNum === 1 && sNo !== 1 && sNo !== 9),
          tr: trEd.ayahs[i] ? trEd.ayahs[i].text : "",
          en: enEd.ayahs[i] ? enEd.ayahs[i].text : ""
        });
      }
      loadedVerses = verses;
      // Save to IndexedDB cache for offline use!
      await cacheVersesToDB(sNo, verses);
      refreshStorageStatsUI();
    } catch (_) {
      if (token !== currentLoadToken) return;
      // Hata 5 & v2-4 Düzeltmesi: ASLA yanlış sûre/ayet (Duhâ 1) gösterme! Önce IndexedDB + Seed önbelleğine bak:
      const cached = await getCachedVersesRange(sNo, start, end);
      if (cached.ok) {
        loadedVerses = cached.verses;
        fromOfflineCache = true;
        showToast("Çevrimdışı mod: Bu sûre/ayet aralığı cihaz önbelleğinden yüklendi.");
      } else {
        state.verses = [];
        state.versesLoaded = false;
        const surahMeta = SURAHS.find((s) => s[0] === sNo) || SURAHS[0];
        state.versesOfflineError = `${surahMeta[1]} Sûresi ${start}–${end}. ayet metinleri henüz çevrimdışı önbelleğe indirilmedi. Yanlış ayet gösterilmemesi için metin gizlendi.`;
        if (lblState) lblState.textContent = "Ayet metni henüz indirilmedi (Çevrimdışı)";
        if (lblDur) lblDur.textContent = "Çevrimdışı";
        updateStageBadge("error", "Bu Ayet Henüz İndirilmedi");
        showToast("Bu ayet henüz indirilmedi. Lütfen internet bağlantınızı kontrol edin.", 3800);
        return;
      }
    }

    if (token !== currentLoadToken) return;
    state.verses = loadedVerses;
    state.versesLoaded = true;
    state.activeVerseIdx = 0;

    // Now load MP3 audio for each verse (v2-3 fix: NO fake 6.0s duration on failure!)
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

      if (lblDur) lblDur.textContent = formatTime(total);
      if (lblState) {
        lblState.innerHTML = `<span class="wave-bars"><span></span><span></span><span></span></span> Hazır (${state.audioDurations.length} Ayet · ${formatTime(total)}${fromOfflineCache ? " · Çevrimdışı" : ""})`;
      }
      if (btnPlay) btnPlay.disabled = false;
      if (btnRec) btnRec.disabled = false;
      updateStageBadge("ready", "Önizleme Hazır");
    } else {
      // At least one audio failed! Keep audioReady = false unless user policy is text_only
      state.audioReady = false;
      if (statusBox) statusBox.classList.add("has-error");
      if (errBox) {
        errBox.style.display = "flex";
        const failListEl = document.getElementById("ayahAudioFailList");
        if (failListEl) {
          failListEl.innerHTML = failedItems
            .map((f) => `<div>• <strong>${sNo}. Sûre ${f.ayahNo}. Ayet</strong> sesi yüklenemedi.</div>`)
            .join("");
        }
      }

      if (state.audioFailPolicy === "text_only") {
        enableTextOnlyContinueMode(false);
      } else {
        if (lblDur) lblDur.textContent = "Ses Hatası";
        if (lblState) lblState.textContent = `${failedItems.length} ayetin sesi yüklenemedi · Kayıt engellendi`;
        if (btnPlay) btnPlay.disabled = true;
        if (btnRec) btnRec.disabled = true;
        updateStageBadge("error", `${failedItems.length} Ayet Sesi Yüklenemedi`);
      }
    }

    updateSocialCaptionText();
    updatePlatformDurationWarning();
  }

  function enableTextOnlyContinueMode(notify = true) {
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

    const lblDur = document.getElementById("lblTotalDuration");
    const lblState = document.getElementById("lblAudioReadyState");
    const btnPlay = document.getElementById("btnPlayPreview");
    const btnRec = document.getElementById("btnRecordExport");

    if (lblDur) lblDur.textContent = formatTime(total);
    if (lblState) lblState.textContent = `Sadece Metin Modu (${state.verses.length} Ayet · ${formatTime(total)})`;
    if (btnPlay) btnPlay.disabled = false;
    if (btnRec) btnRec.disabled = false;
    updateStageBadge("ready", "Sadece Metin Modu Hazır");
    if (notify) {
      showToast("Sadece metin (sessiz/ambiyans) modu etkinleştirildi.");
    }
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

  // Canvas Rendering Engine
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

  function drawCoverScene(w, h, scaleFactor) {
    const tpl = COVER_TEMPLATES.find((t) => t.id === state.coverTemplateId) || COVER_TEMPLATES[0];
    const surahMeta = SURAHS.find((s) => s[0] === state.surahNo) || SURAHS[92];
    const reciterMeta = RECITERS.find((r) => r.id === state.reciterId) || RECITERS[0];

    if (state.coverBgOverride !== "same") {
      const map = {
        dark_gold: ["#120e07", "#291f0e"],
        emerald: ["#061612", "#0f2e24"],
        midnight: ["#060b16", "#132242"]
      };
      const pal = map[state.coverBgOverride] || map.dark_gold;
      const g = ctx.createLinearGradient(0, 0, 0, h);
      g.addColorStop(0, pal[0]);
      g.addColorStop(1, pal[1]);
      ctx.fillStyle = g;
      ctx.fillRect(0, 0, w, h);
    }

    const cScale = (state.coverScale / 100) * scaleFactor;
    const centerY = state.coverPos === "upper" ? h * 0.36 : state.coverPos === "lower" ? h * 0.64 : h * 0.5;

    ctx.save();
    if (tpl.border) {
      const pad = 38 * scaleFactor;
      ctx.strokeStyle = tpl.accent + "88";
      ctx.lineWidth = 2.5 * scaleFactor;
      ctx.strokeRect(pad, pad, w - pad * 2, h - pad * 2);
    }

    if (tpl.arch) {
      ctx.strokeStyle = tpl.accent + "55";
      ctx.lineWidth = 2 * scaleFactor;
      ctx.beginPath();
      ctx.arc(w / 2, centerY - 52 * cScale, 175 * cScale, Math.PI, 0);
      ctx.stroke();
    }

    ctx.textAlign = "center";
    ctx.textBaseline = "middle";
    ctx.shadowColor = "rgba(0,0,0,0.85)";
    ctx.shadowBlur = 16 * scaleFactor;

    ctx.direction = "ltr";
    ctx.fillStyle = tpl.accent;
    ctx.font = `700 ${Math.round(15 * cScale)}px '${state.mealFont || "DM Sans"}', sans-serif`;
    ctx.fillText(tpl.badge, w / 2, centerY - 115 * cScale);

    ctx.direction = "rtl";
    ctx.fillStyle = "#FFFDF7";
    ctx.font = `700 ${Math.round(50 * cScale)}px '${state.arabicFont}', serif`;
    ctx.fillText(surahMeta[2], w / 2, centerY - 46 * cScale);

    ctx.direction = "ltr";
    const mainTitle = state.coverTitle.trim() || `${surahMeta[1]} Sûresi`;
    ctx.fillStyle = tpl.accent;
    ctx.font = `700 ${Math.round(32 * cScale)}px '${state.mealFont || "DM Sans"}', sans-serif`;
    ctx.fillText(mainTitle, w / 2, centerY + 20 * cScale);

    const subTitle = state.coverSubtitle.trim() || `${state.ayahStart} - ${state.ayahEnd}. Ayetler · ${reciterMeta.name.split("(")[0].trim()}`;
    ctx.fillStyle = "#E5E0D5";
    ctx.font = `500 ${Math.round(19 * cScale)}px '${state.mealFont || "DM Sans"}', sans-serif`;
    ctx.fillText(subTitle, w / 2, centerY + 68 * cScale);

    ctx.restore();
  }

  function drawLogoWatermark(w, h, scaleFactor, t) {
    if (state.logoPos === "hidden") return;

    const baseSize = 48 * (state.logoScale / 100) * scaleFactor;
    const pad = 30 * scaleFactor;
    let x = w / 2;
    let y = h - pad - baseSize / 2;

    if (state.logoPos === "top-right") {
      x = w - pad - baseSize - 95 * scaleFactor;
      y = pad + baseSize / 2;
    } else if (state.logoPos === "top-left") {
      x = pad + baseSize / 2;
      y = pad + baseSize / 2;
    } else if (state.logoPos === "floating") {
      x = w * 0.5 + Math.sin(t * 0.45) * (w * 0.24);
      y = h * 0.8 + Math.cos(t * 0.35) * (h * 0.05);
    }

    ctx.save();
    ctx.globalAlpha = Math.max(0.15, Math.min(1, (state.logoOpacity || 92) / 100));
    ctx.direction = "ltr";
    ctx.shadowColor = "rgba(0,0,0,0.75)";
    ctx.shadowBlur = 10 * scaleFactor;

    const logoSource = appLogoLoaded ? appLogoImg : fallbackLogoCanvas;
    const text = (state.watermarkText || "").trim();

    if (state.logoPos === "bottom-center" || state.logoPos === "floating") {
      ctx.font = `600 ${Math.round(15 * (state.logoScale / 100) * scaleFactor)}px '${state.mealFont || "DM Sans"}', sans-serif`;
      const tw = text ? ctx.measureText(text).width : 0;
      const totalW = baseSize + (text ? 10 * scaleFactor + tw : 0);
      const startX = x - totalW / 2;

      ctx.drawImage(logoSource, startX, y - baseSize / 2, baseSize, baseSize);
      if (text) {
        ctx.fillStyle = "rgba(245, 242, 235, 0.94)";
        ctx.textAlign = "left";
        ctx.textBaseline = "middle";
        ctx.fillText(text, startX + baseSize + 10 * scaleFactor, y);
      }
    } else {
      ctx.drawImage(logoSource, x, y - baseSize / 2, baseSize, baseSize);
      if (text) {
        ctx.font = `600 ${Math.round(14 * (state.logoScale / 100) * scaleFactor)}px '${state.mealFont || "DM Sans"}', sans-serif`;
        ctx.fillStyle = "rgba(245, 242, 235, 0.94)";
        ctx.textAlign = "left";
        ctx.textBaseline = "middle";
        ctx.fillText(text, x + baseSize + 8 * scaleFactor, y);
      }
    }
    ctx.restore();
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

    // 1. Background (Video / Photo with iOS Safari Filter Fallback / 24 Procedural Scenes)
    const currentZemin = getZeminById(state.zeminId);
    const mediaEl = activeBgVideo || activeBgImage;
    if (mediaEl) {
      drawBackgroundMediaWithFilters(ctx, mediaEl, Boolean(activeBgVideo), w, h, t, state);
    } else {
      drawProceduralScene(ctx, w, h, t, dt, currentZemin);
    }

    // 2. Darkness overlay
    if (state.bgDim > 0) {
      ctx.fillStyle = `rgba(5, 10, 8, ${state.bgDim / 100})`;
      ctx.fillRect(0, 0, w, h);
    }

    // 3. Cinematic Vignette
    drawCinematicVignette(ctx, w, h, state.vignette !== "off");

    // 4. Visual Particles Overlay (Delta-time independent)
    drawVisualEffectOverlay(ctx, w, h, t, dt, state);

    // 5. Content (Cover or Verse or Offline Warning)
    const showCoverNow =
      state.coverPreviewMode === "cover" ||
      (state.coverFirstFrame === "on" && (state.isPlaying || state.isRecording) && state.elapsedTime < 1.2);

    if (showCoverNow) {
      drawCoverScene(w, h, scaleFactor);
    } else if (!state.versesLoaded && state.versesOfflineError) {
      // Offline cache miss notice (Never show wrong verse!)
      ctx.save();
      ctx.fillStyle = "rgba(8, 17, 14, 0.85)";
      const boxW = w * 0.84;
      const boxH = 160 * scaleFactor;
      ctx.fillRect((w - boxW) / 2, (h - boxH) / 2, boxW, boxH);
      ctx.strokeStyle = "#EF4444";
      ctx.lineWidth = 2 * scaleFactor;
      ctx.strokeRect((w - boxW) / 2, (h - boxH) / 2, boxW, boxH);
      ctx.fillStyle = "#FCA5A5";
      ctx.textAlign = "center";
      ctx.textBaseline = "middle";
      ctx.font = `600 ${Math.round(20 * scaleFactor)}px '${state.mealFont || "DM Sans"}', sans-serif`;
      const errLines = wrapCanvasText(ctx, state.versesOfflineError, boxW * 0.88);
      errLines.forEach((ln, idx) => {
        ctx.fillText(ln, w / 2, h / 2 - ((errLines.length - 1) * 14 * scaleFactor) + idx * 28 * scaleFactor);
      });
      ctx.restore();
    } else {
      const verse = state.verses[state.activeVerseIdx] || state.verses[0];
      if (verse) {
        let alpha = 1;
        let slideY = 0;
        if ((state.isPlaying || state.isRecording) && state.transitionMode !== "none") {
          const sinceVerse = Math.max(0, (performance.now() - state.verseStartTime) / 1000);
          const prog = Math.min(1, sinceVerse / 0.45);
          const ease = 1 - Math.pow(1 - prog, 3);
          if (state.transitionMode === "fade") alpha = ease;
          if (state.transitionMode === "slide") {
            alpha = ease;
            slideY = (1 - ease) * 26 * scaleFactor;
          }
        }

        ctx.save();
        ctx.globalAlpha = alpha;
        ctx.translate(0, slideY);
        ctx.textAlign = "center";
        ctx.textBaseline = "middle";

        // Soft gold-tinted shadow for Arabic & crisp contrast for translations
        const maxTextW = isLandscape ? w * 0.82 : w * 0.84;
        const arPx = Math.round(state.arabicSize * scaleFactor * (isLandscape ? 0.88 : 1));
        const mealPx = Math.round(state.mealSize * scaleFactor * (isLandscape ? 0.88 : 1));

        // Pre-measure lines to center vertically and optionally draw translucent backdrop strip
        ctx.font = `700 ${arPx}px '${state.arabicFont}', serif`;
        const ayahBadge = `\uFD3F${toArabicIndicDigits(verse.numberInSurah)}\uFD3E`;
        const arLines = wrapCanvasText(ctx, `${verse.arabic} ${ayahBadge}`, maxTextW);
        const arLineH = arPx * 1.62;
        const totalArH = arLines.length * arLineH;

        ctx.font = `${state.mealWeight || 500} ${mealPx}px '${state.mealFont || "DM Sans"}', sans-serif`;
        const trLines = (state.subtitleMode === "tr" || state.subtitleMode === "both")
          ? wrapCanvasText(ctx, verse.tr, maxTextW)
          : [];
        const trLineH = mealPx * 1.42;

        const enPx = state.subtitleMode === "both" ? Math.round(mealPx * 0.88) : mealPx;
        ctx.font = `400 ${enPx}px '${state.mealFont || "DM Sans"}', sans-serif`;
        const enLines = (state.subtitleMode === "en" || state.subtitleMode === "both")
          ? wrapCanvasText(ctx, verse.en, maxTextW)
          : [];
        const enLineH = enPx * 1.38;

        const showBismillah =
          verse.hasBismillahHeader &&
          (state.bismillahMode === "separate" || (state.bismillahMode === "first_only" && state.activeVerseIdx === 0));

        const totalBlockH =
          totalArH +
          (trLines.length > 0 ? 24 * scaleFactor + trLines.length * trLineH : 0) +
          (enLines.length > 0 ? 16 * scaleFactor + enLines.length * enLineH : 0);

        const centerY = isLandscape ? h * 0.54 : h * 0.48;
        const arStartY = centerY - totalBlockH / 2 + arLineH / 2;

        // Text Backdrop Strip Option (for low darkness / high contrast readability)
        const useStrip =
          state.textBackdrop === "bar" ||
          (state.textBackdrop === "auto" && state.bgDim < 28);

        if (useStrip) {
          const padY = 24 * scaleFactor;
          const stripTop = arStartY - arLineH / 2 - padY;
          const stripH = totalBlockH + padY * 2;
          ctx.fillStyle = "rgba(6, 13, 10, 0.58)";
          const rx = w * 0.05;
          const rw = w * 0.9;
          ctx.beginPath();
          if (ctx.roundRect) {
            ctx.roundRect(rx, stripTop, rw, stripH, 18 * scaleFactor);
          } else {
            ctx.rect(rx, stripTop, rw, stripH);
          }
          ctx.fill();
          ctx.strokeStyle = "rgba(216, 180, 86, 0.22)";
          ctx.lineWidth = 1 * scaleFactor;
          ctx.stroke();
        }

        // Surah & Ayah Header
        ctx.direction = "ltr";
        ctx.shadowColor = "rgba(0, 0, 0, 0.88)";
        ctx.shadowBlur = state.textShadow * scaleFactor;
        const surahMeta = SURAHS.find((s) => s[0] === state.surahNo) || SURAHS[92];
        ctx.fillStyle = "#E8C978";
        ctx.font = `600 ${Math.round(15.5 * scaleFactor)}px '${state.mealFont || "DM Sans"}', sans-serif`;
        const headerY = isLandscape ? h * 0.13 : h * 0.15;
        ctx.fillText(`${surahMeta[1]} Sûresi · ${verse.numberInSurah}. Ayet`, w / 2, headerY);

        // Bismillah Header
        ctx.direction = "rtl";
        if (showBismillah) {
          ctx.fillStyle = "#F0D78A";
          ctx.font = `700 ${Math.round(arPx * 0.74)}px '${state.arabicFont}', serif`;
          ctx.fillText("بِسْمِ اللَّهِ الرَّحْمَٰنِ الرَّحِيمِ", w / 2, isLandscape ? h * 0.22 : h * 0.23);
        }

        // Arabic Text with Subtle Warm Gold-Toned Shadow
        ctx.shadowColor = "rgba(12, 9, 3, 0.92)";
        ctx.shadowBlur = (state.textShadow + 4) * scaleFactor;
        ctx.fillStyle = state.arabicColor;
        ctx.font = `700 ${arPx}px '${state.arabicFont}', serif`;
        if (state.arabicLetterSpacing > 0 && "letterSpacing" in ctx) {
          ctx.letterSpacing = `${state.arabicLetterSpacing}px`;
        }
        arLines.forEach((line, i) => {
          ctx.fillText(line, w / 2, arStartY + i * arLineH);
        });
        if ("letterSpacing" in ctx) ctx.letterSpacing = "0px";

        // Translations (WCAG AA high-contrast)
        ctx.direction = "ltr";
        ctx.shadowColor = "rgba(0, 0, 0, 0.92)";
        ctx.shadowBlur = state.textShadow * scaleFactor;
        let mealCursorY = arStartY + (arLines.length - 0.5) * arLineH + 26 * scaleFactor;

        if (trLines.length > 0) {
          ctx.fillStyle = state.mealColor;
          ctx.font = `${state.mealWeight || 500} ${mealPx}px '${state.mealFont || "DM Sans"}', sans-serif`;
          trLines.forEach((line, i) => {
            ctx.fillText(line, w / 2, mealCursorY + i * trLineH);
          });
          mealCursorY += trLines.length * trLineH + 16 * scaleFactor;
        }

        if (enLines.length > 0) {
          ctx.fillStyle = state.subtitleMode === "both" ? "#CBD5E1" : state.mealColor;
          ctx.font = `400 ${enPx}px '${state.mealFont || "DM Sans"}', sans-serif`;
          enLines.forEach((line, i) => {
            ctx.fillText(line, w / 2, mealCursorY + i * enLineH);
          });
        }

        ctx.restore();
      }
    }

    // 6. Logo Watermark
    drawLogoWatermark(w, h, scaleFactor, t);

    // 7. Smooth visual fade-to-black at the very end of recording/playback if fadeOutEnd is enabled
    if (state.isFadingOut && state.fadeOutProgress > 0) {
      ctx.save();
      ctx.fillStyle = `rgba(4, 8, 6, ${Math.min(0.92, state.fadeOutProgress)})`;
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

  // Recording & Playback Session Manager (Fixes Bug #6: Abort/Cancel NEVER produces a half video!)
  let mediaRecorder = null;
  let recordedChunks = [];
  let sessionAborted = false;
  let recorderCompletedNaturally = false;
  let wakeLockSentinel = null;
  let playbackRafId = null;
  let textModeTimerId = null;
  let fadeOutTimerId = null;

  async function requestScreenWakeLock() {
    if ("wakeLock" in navigator) {
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

  function stopPlaybackAndRecording(aborted = true) {
    if (aborted) {
      sessionAborted = true;
      recorderCompletedNaturally = false;
    }

    cancelAnimationFrame(playbackRafId);
    playbackRafId = null;
    clearTimeout(textModeTimerId);
    clearTimeout(fadeOutTimerId);

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

    updateStageBadge(state.audioReady ? "ready" : "error", state.audioReady ? "Önizleme Hazır" : "Ses Bekleniyor");
    const lblPlay = document.getElementById("lblPlayBtn");
    const lblRec = document.getElementById("lblRecordBtn");
    if (lblPlay) lblPlay.textContent = "▶ Önizle";
    if (lblRec) lblRec.textContent = "● Video Oluştur";
  }

  async function startStudioSession(recordMode = false) {
    if (!state.versesLoaded || state.verses.length === 0) {
      showToast("Bu ayet metni henüz yüklenmedi.");
      return;
    }
    if (!state.audioReady) {
      showToast("Ses dosyaları hazır değil. Lütfen bekleyin veya 'Sadece Metin İle Devam Et' seçeneğini kullanın.");
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
    state.elapsedTime = 0;
    state.isFadingOut = false;
    state.fadeOutProgress = 0;

    document.getElementById("lblPlayBtn").textContent = recordMode ? "▶ Önizle" : "■ Durdur";
    document.getElementById("lblRecordBtn").textContent = recordMode ? "✕ İptal Et" : "● Video Oluştur";

    const wrap = document.getElementById("canvasWrap");
    if (recordMode) {
      await requestScreenWakeLock();
      if (wrap) wrap.classList.add("recording-active");
      updateStageBadge("recording", "Kayıt Başlatılıyor...");
    } else {
      updateStageBadge("ready", "Önizleniyor...");
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
        // Hata 6 Düzeltmesi: İptal edildiyse veya kayıt doğal olarak tamamlanmadıysa yarım videoyu ÇIKARMA!
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
          meta.textContent = `${formatTime(state.lastExportDuration)} · ${(patchedBlob.size / (1024 * 1024)).toFixed(1)} MB · .${state.lastExportExt.toUpperCase()}`;
        }

        switchTab("paylas");
        hapticTap(25);
        showToast(`✓ Video hazır! (${formatTime(state.lastExportDuration)} · .${state.lastExportExt.toUpperCase()})`, 3600);
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
      state.verseStartTime = performance.now();
      const isLastVerse = (idx === state.verses.length - 1);

      // Text-only mode (silent or ambient only)
      if (state.textOnlyMode) {
        if (recordMode && !recorderStarted) {
          recorderStarted = true;
          recordStartPerf = performance.now();
          mediaRecorder.start(200);
          startAmbientSound(state);
          updateStageBadge("recording", "Kaydediliyor (Sadece Metin)...");
        } else if (!recordMode && idx === 0) {
          startAmbientSound(state);
        }

        const vDur = state.audioDurations[idx] || 5.0;
        const vStartPerf = performance.now();

        const stepTextTimeline = () => {
          if (sessionAborted || (!state.isPlaying && !state.isRecording)) return;
          if (state.activeVerseIdx !== idx) return;

          const curInVerse = (performance.now() - vStartPerf) / 1000;
          let passed = state.coverFirstFrame === "on" ? 1.2 : 0;
          for (let i = 0; i < idx; i++) passed += state.audioDurations[i];
          passed += Math.min(vDur, curInVerse);
          state.elapsedTime = Math.min(state.totalDuration, passed);

          document.getElementById("lblCurrentTime").textContent = formatTime(state.elapsedTime);
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

      // Standard Reciter Audio Playback
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
          updateStageBadge("recording", "Kaydediliyor...");
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

        let passed = state.coverFirstFrame === "on" ? 1.2 : 0;
        for (let i = 0; i < idx; i++) {
          passed += Math.max(0.4, state.audioDurations[i] - state.gaplessTrimSec);
        }
        passed += aud.currentTime || 0;
        state.elapsedTime = Math.min(state.totalDuration, passed);

        document.getElementById("lblCurrentTime").textContent = formatTime(state.elapsedTime);
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
        updateStageBadge("recording", "Kapak Kaydediliyor...");
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

  // Platform-Specific Social Media Caption & Hashtag Generator
  function updateSocialCaptionText() {
    const surahMeta = SURAHS.find((s) => s[0] === state.surahNo) || SURAHS[92];
    const reciterMeta = RECITERS.find((r) => r.id === state.reciterId) || RECITERS[0];
    const recName = reciterMeta.name.split("(")[0].trim();
    const firstVerse = state.verses[0];
    const mealSnippet = firstVerse && firstVerse.tr ? `"${firstVerse.tr}"` : "";
    const surahTag = surahMeta[1].replace(/[^a-zA-Z0-9ğüşıöçĞÜŞİÖÇ]/g, "");
    const plat = state.captionPlatform || "reels";

    let tags = `#Kuran #Tilavet #${surahTag}Suresi #Ayet #Huzur #TilawahWorld #Reels #Keşfet`;
    let header = `📖 ${surahMeta[1]} Sûresi (${state.ayahStart}-${state.ayahEnd}. Ayetler)\n🎙️ Hâfız: ${recName}`;

    if (plat === "tiktok") {
      tags = `#kuranıkerim #tilavet #${surahTag.toLowerCase()}suresi #ayetler #huzur #keşfet #fyp #islamitiktok`;
    } else if (plat === "shorts") {
      header = `📖 ${surahMeta[1]} Sûresi ${state.ayahStart}-${state.ayahEnd}. Ayetler | ${recName} #Shorts`;
      tags = `#Shorts #Kuran #Tilavet #${surahTag}Suresi #Ayet #İslam`;
    } else if (plat === "youtube") {
      header = `${surahMeta[1]} Sûresi (${state.ayahStart}-${state.ayahEnd}. Ayetler) - Huzur Veren Kur'ân-ı Kerîm Tilâveti\nOkuyan Hâfız: ${recName}`;
      tags = `#KuranıKerim #Tilavet #${surahTag}Suresi #Meal #Tefekkür #TilawahWorld`;
    } else if (plat === "whatsapp") {
      header = `✨ *${surahMeta[1]} Sûresi (${state.ayahStart}-${state.ayahEnd}. Ayetler)*\n🎙️ _${recName}_`;
      tags = `🌿 _Tilawah World_`;
    }

    const caption = `${header}\n\n` + (mealSnippet ? `${mealSnippet}\n\n` : "") + tags;
    const txt = document.getElementById("txtSocialCaption");
    if (txt) txt.value = caption;
  }

  function updatePlatformDurationWarning() {
    const box = document.getElementById("platformDurationWarning");
    if (!box) return;
    if (state.totalDuration > 60 && state.platformRatio === "9:16") {
      box.style.display = "block";
      box.textContent = `Bilgi: Seçilen tilâvet süresi (${formatTime(state.totalDuration)}), klasik 60 sn sınırını aşıyor. Instagram Reels, TikTok ve güncel YouTube Shorts (3 dk) için sorunsuz paylaşabilirsiniz.`;
    } else {
      box.style.display = "none";
    }
  }

  function downloadExportedVideo() {
    if (!state.lastExportBlob) {
      showToast("Önce 'Video Oluştur' düğmesiyle video hazırlayın.");
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
    const surahMeta = SURAHS.find((s) => s[0] === state.surahNo) || SURAHS[92];
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
    showToast("Video cihazınıza indirildi; Instagram, TikTok veya YouTube uygulamasından paylaşabilirsiniz.", 4000);
  }

  // Tab & Docked Panel Controller (Fixes Bug #2: Preview is ALWAYS visible on top, tabs switch directly!)
  const sheetTitles = {
    ayet: "Ayet, Hâfız & Favoriler",
    zemin: "Zemin, Stok Medya & Efektler",
    yazi: "Tipografi, Hat & Logo",
    ses: "Ses & Ambiyans Mikseri",
    kapak: "Kapak Tasarımı & Şablonlar",
    paylas: "Çıktı, Oran & Paylaşım",
    ayarlar: "Stüdyo Ayarları & Veri Yönetimi"
  };

  let activeTabName = "ayet";

  function switchTab(tabName) {
    hapticTap();
    activeTabName = tabName;
    const shell = document.getElementById("appShell");
    if (shell && shell.classList.contains("panel-collapsed")) {
      shell.classList.remove("panel-collapsed");
      const btnCol = document.getElementById("btnTogglePanelCollapse");
      if (btnCol) btnCol.textContent = "Küçült ▾";
    }

    document.querySelectorAll(".nav-tab").forEach((btn) => {
      btn.classList.toggle("active", btn.dataset.tab === tabName);
    });
    document.querySelectorAll(".tab-pane").forEach((pane) => {
      pane.classList.toggle("active", pane.id === `pane-${tabName}`);
    });
    const titleEl = document.getElementById("sheetTitleText");
    if (titleEl) titleEl.textContent = sheetTitles[tabName] || "Stüdyo Ayarları";

    if (tabName === "ayarlar") {
      refreshStorageStatsUI();
    }
  }

  function populateSurahAndReciterSelectors() {
    const selSurah = document.getElementById("selSurah");
    if (selSurah) {
      selSurah.innerHTML = "";
      SURAHS.forEach(([no, nameTr, nameAr, count]) => {
        const opt = document.createElement("option");
        opt.value = no;
        opt.textContent = `${no}. ${nameTr} (${nameAr}) · ${count} Ayet`;
        if (no === state.surahNo) opt.selected = true;
        selSurah.appendChild(opt);
      });
    }

    const selReciter = document.getElementById("selReciter");
    if (selReciter) {
      selReciter.innerHTML = "";
      RECITERS.forEach((r) => {
        const opt = document.createElement("option");
        opt.value = r.id;
        opt.textContent = r.name;
        if (r.id === state.reciterId) opt.selected = true;
        selReciter.appendChild(opt);
      });
    }

    populateAyahRangeSelectors(true);
  }

  function populateAyahRangeSelectors(preserveCurrent = false) {
    const surahMeta = SURAHS.find((s) => s[0] === state.surahNo) || SURAHS[92];
    const maxAyah = surahMeta[3];
    if (!preserveCurrent) {
      state.ayahStart = 1;
      state.ayahEnd = Math.min(3, maxAyah);
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
      o1.textContent = `${i}. Ayet`;
      if (i === state.ayahStart) o1.selected = true;
      selStart.appendChild(o1);

      const o2 = document.createElement("option");
      o2.value = i;
      o2.textContent = `${i}. Ayet`;
      if (i === state.ayahEnd) o2.selected = true;
      selEnd.appendChild(o2);
    }
  }

  function renderFavoriteAyahChips() {
    const wrap = document.getElementById("favoriteAyahChips");
    if (!wrap) return;
    wrap.innerHTML = "";
    const favs = state.favoriteAyahs || CURATED_FAVORITE_AYAHS;
    favs.forEach((fav) => {
      const chip = document.createElement("button");
      const isCurrent = (state.surahNo === fav.surahNo && state.ayahStart === fav.start && state.ayahEnd === fav.end);
      chip.className = "chip" + (isCurrent ? " active" : "");
      chip.textContent = `★ ${fav.label}`;
      chip.addEventListener("click", () => {
        hapticTap();
        state.surahNo = fav.surahNo;
        state.ayahStart = fav.start;
        state.ayahEnd = fav.end;
        const selSurah = document.getElementById("selSurah");
        if (selSurah) selSurah.value = state.surahNo;
        populateAyahRangeSelectors(true);
        renderFavoriteAyahChips();
        persistState();
        loadVersesAndPreloadAudio();
      });
      wrap.appendChild(chip);
    });
  }

  function renderCoverTemplateChips() {
    const wrap = document.getElementById("coverTemplateChips");
    if (!wrap) return;
    wrap.innerHTML = "";
    COVER_TEMPLATES.forEach((tpl) => {
      const chip = document.createElement("button");
      chip.className = "chip" + (state.coverTemplateId === tpl.id ? " active" : "");
      chip.textContent = tpl.name;
      chip.addEventListener("click", () => {
        hapticTap();
        state.coverTemplateId = tpl.id;
        state.coverPreviewMode = "cover";
        const selPrev = document.getElementById("selCoverPreviewMode");
        if (selPrev) selPrev.value = "cover";
        renderCoverTemplateChips();
        persistState();
      });
      wrap.appendChild(chip);
    });
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
    updatePlatformDurationWarning();
  }

  function applyThemeAndMode() {
    document.documentElement.setAttribute("data-theme", state.uiTheme || "emerald");
    document.body.classList.toggle("advanced-mode", state.uiMode === "advanced");
    const btnSimple = document.getElementById("btnModeSimple");
    const btnAdv = document.getElementById("btnModeAdvanced");
    if (btnSimple) btnSimple.classList.toggle("active", state.uiMode !== "advanced");
    if (btnAdv) btnAdv.classList.toggle("active", state.uiMode === "advanced");
  }

  // Sync ALL UI elements from restored state (Fixes Bug #1 completely!)
  function syncAllControlsFromState() {
    const setVal = (id, val) => {
      const el = document.getElementById(id);
      if (el && typeof val !== "undefined") el.value = val;
    };
    const setTxt = (id, txt) => {
      const el = document.getElementById(id);
      if (el) el.textContent = txt;
    };
    const setChk = (id, boolVal) => {
      const el = document.getElementById(id);
      if (el) el.checked = Boolean(boolVal);
    };

    applyThemeAndMode();
    populateSurahAndReciterSelectors();
    renderFavoriteAyahChips();
    renderCoverTemplateChips();
    renderUserPresetsList();

    setVal("selSubtitleMode", state.subtitleMode);
    setVal("selBismillahMode", state.bismillahMode);
    setVal("selVisualEffect", state.visualEffect);
    setVal("rngEffectIntensity", state.effectIntensity);
    setTxt("valEffectIntensity", `%${state.effectIntensity}`);

    setVal("rngBgDim", state.bgDim);
    setTxt("valBgDim", `%${state.bgDim}`);
    setChk("chkLockBgDim", state.lockBgDim);

    setVal("rngBgBlur", state.bgBlur);
    setTxt("valBgBlur", `${state.bgBlur} px`);
    setVal("rngBgBrightness", state.bgBrightness);
    setTxt("valBgBrightness", `%${state.bgBrightness}`);
    setVal("rngBgZoom", state.bgZoom);
    setTxt("valBgZoom", `${(state.bgZoom / 100).toFixed(2)}x`);
    setVal("rngBgPanX", state.bgPanX);
    setTxt("valBgPanX", `${state.bgPanX}%`);
    setVal("rngBgPanY", state.bgPanY);
    setTxt("valBgPanY", `${state.bgPanY}%`);
    setVal("selKenBurns", state.kenBurns);
    setVal("selVignette", state.vignette);
    setVal("selVideoAudioMode", state.videoAudioMode);
    setVal("inpVideoTrimStart", state.videoTrimStart);
    setVal("inpVideoTrimEnd", state.videoTrimEnd);

    document.querySelectorAll("#arabicFontCards .mini-preview-card").forEach((card) => {
      card.classList.toggle("active", card.dataset.font === state.arabicFont);
    });
    setVal("selMealFont", state.mealFont);
    setVal("selMealWeight", state.mealWeight);
    setVal("rngArabicSize", state.arabicSize);
    setTxt("valArabicSize", `${state.arabicSize} px`);
    setVal("rngMealSize", state.mealSize);
    setTxt("valMealSize", `${state.mealSize} px`);
    setVal("rngArabicLetterSpacing", state.arabicLetterSpacing);
    setTxt("valArabicLetterSpacing", `${state.arabicLetterSpacing} px`);
    setVal("selTransitionMode", state.transitionMode);
    setVal("rngTextShadow", state.textShadow);
    setTxt("valTextShadow", `${state.textShadow} px`);
    setVal("selTextBackdrop", state.textBackdrop);
    setVal("inpArabicColor", state.arabicColor);
    setVal("inpMealColor", state.mealColor);
    setVal("selLogoPos", state.logoPos);
    setVal("rngLogoScale", state.logoScale);
    setTxt("valLogoScale", `%${state.logoScale}`);
    setVal("rngLogoOpacity", state.logoOpacity);
    setTxt("valLogoOpacity", `%${state.logoOpacity}`);
    setVal("inpWatermarkText", state.watermarkText);

    setVal("rngReciterVol", state.reciterVol);
    setTxt("valReciterVol", `%${state.reciterVol}`);
    setVal("selAmbientType", state.ambientType);
    setVal("rngAmbientVol", state.ambientVol);
    setTxt("valAmbientVol", `%${state.ambientVol}`);
    setVal("rngBgVideoVol", state.bgVideoVol);
    setTxt("valBgVideoVol", `%${state.bgVideoVol}`);
    setVal("rngGaplessTrim", Math.round(state.gaplessTrimSec * 100));
    setTxt("valGaplessTrim", `${state.gaplessTrimSec.toFixed(2)} sn`);
    setVal("selFadeOutEnd", state.fadeOutEnd);
    setVal("selAudioFailPolicy", state.audioFailPolicy);

    setVal("selCoverFirstFrame", state.coverFirstFrame);
    setVal("selCoverPreviewMode", state.coverPreviewMode);
    setVal("inpCoverTitle", state.coverTitle);
    setVal("inpCoverSubtitle", state.coverSubtitle);
    setVal("selCoverPos", state.coverPos);
    setVal("rngCoverScale", state.coverScale);
    setTxt("valCoverScale", `%${state.coverScale}`);
    setVal("selCoverBgOverride", state.coverBgOverride);

    setVal("selPlatformRatio", state.platformRatio);
    setVal("selResolution", state.resolution);
    setVal("selBitrateMbps", state.bitrateMbps);
    setVal("selExportEngine", state.exportEngine);
    setVal("selFileNameFormat", state.fileNameFormat);
    setVal("selCaptionPlatform", state.captionPlatform);

    // Settings Tab Controls
    setVal("selUiTheme", state.uiTheme);
    setVal("selUiLang", state.uiLang);
    setChk("chkAutoSave", state.autoSave);
    setChk("chkHapticEnabled", state.hapticEnabled);
    setVal("inpPexelsApiKey", state.pexelsApiKey);

    const szOverlay = document.getElementById("safeZoneOverlay");
    if (szOverlay) szOverlay.classList.toggle("active", Boolean(state.safeZoneVisible));

    updateCanvasResolutionAndRatio();
  }

  async function refreshStorageStatsUI() {
    const stats = await getStorageStats();
    const el = document.getElementById("lblStorageStatsSummary");
    if (el) {
      el.textContent = `${stats.galleryCount} kişisel medya (${stats.galleryMB} MB) · ${stats.cachedAyahCount} çevrimdışı ayet önbellekte`;
    }
    const caps = detectRecorderCapabilities();
    const mimeEl = document.getElementById("lblMimeDiagnostics");
    if (mimeEl) {
      mimeEl.textContent = `Aktif Kodlayıcı: ${caps.best.label} · WebCodecs H.264: ${caps.hasWebCodecs ? "Destekleniyor" : "MediaRecorder"}`;
    }
  }

  // Pexels API Search Integration
  async function searchPexelsMedia(query) {
    const q = (query || "rain mosque nature night").trim();
    const key = (state.pexelsApiKey || "").trim();

    if (!key) {
      // Filter built-in catalog by query and open API key helper
      state.zeminSearch = q;
      state.zeminCategory = "Tümü";
      const inp = document.getElementById("inpZeminSearch");
      if (inp) inp.value = q;
      renderZeminCategories();
      renderZeminGrid();
      const box = document.getElementById("pexelsKeyPromptBox");
      if (box) box.style.display = "flex";
      showToast(`Yerel katalogda "${q}" filtrelendi. Binlerce çevrimiçi dikey video için ücretsiz Pexels API anahtarınızı girebilirsiniz.`);
      return;
    }

    showToast(`Pexels üzerinde "${q}" dikey videoları aranıyor...`);
    try {
      const [vidRes, photoRes] = await Promise.all([
        fetch(`https://api.pexels.com/videos/search?query=${encodeURIComponent(q)}&orientation=portrait&per_page=8`, {
          headers: { Authorization: key }
        }),
        fetch(`https://api.pexels.com/v1/search?query=${encodeURIComponent(q)}&orientation=portrait&per_page=8`, {
          headers: { Authorization: key }
        })
      ]);

      const found = [];
      if (vidRes.ok) {
        const vData = await vidRes.json();
        (vData.videos || []).forEach((v) => {
          const hdFile = (v.video_files || []).find((f) => f.height >= 720 && f.height <= 1920 && f.file_type === "video/mp4") || (v.video_files || [])[0];
          if (hdFile && hdFile.link) {
            found.push({
              id: `pexels_vid_${v.id}`,
              name: `Pexels Video #${v.id}`,
              type: "video",
              src: hdFile.link,
              thumb: v.image,
              category: "Tümü",
              recommendedDarkness: 40,
              defaultEffect: "none",
              palette: ["#08110E", "#142820", "#d8b456"]
            });
          }
        });
      }
      if (photoRes.ok) {
        const pData = await photoRes.json();
        (pData.photos || []).forEach((p) => {
          if (p.src && p.src.large2x) {
            found.push({
              id: `pexels_img_${p.id}`,
              name: p.alt || `Pexels Foto #${p.id}`,
              type: "image",
              src: p.src.large2x,
              thumb: p.src.medium || p.src.small,
              category: "Tümü",
              recommendedDarkness: 40,
              defaultEffect: "none",
              palette: ["#08110E", "#142820", "#d8b456"]
            });
          }
        });
      }

      if (found.length > 0) {
        pexelsSearchItems = found;
        state.zeminCategory = "Tümü";
        state.zeminSearch = "";
        const inp = document.getElementById("inpZeminSearch");
        if (inp) inp.value = "";
        renderZeminCategories();
        renderZeminGrid();
        showToast(`Pexels'ten ${found.length} yeni dikey video/fotoğraf galeriye eklendi!`);
      } else {
        showToast("Eşleşen Pexels medyası bulunamadı.");
      }
    } catch (_) {
      showToast("Pexels API bağlantısı kurulamadı. API anahtarınızı kontrol edin.");
    }
  }

  function bindEvents() {
    // Navigation tabs (No backdrop interference!)
    document.querySelectorAll(".nav-tab").forEach((btn) => {
      btn.addEventListener("click", () => {
        const tab = btn.dataset.tab;
        const shell = document.getElementById("appShell");
        if (activeTabName === tab && shell && !shell.classList.contains("panel-collapsed")) {
          // Clicking active tab toggles expand/normal height while keeping preview visible
          shell.classList.toggle("panel-expanded");
        } else {
          switchTab(tab);
        }
      });
    });

    // Panel Collapse / Expand & Basit / Gelişmiş Mode Switch
    const btnCol = document.getElementById("btnTogglePanelCollapse");
    if (btnCol) {
      btnCol.addEventListener("click", () => {
        hapticTap();
        const shell = document.getElementById("appShell");
        shell.classList.remove("panel-expanded");
        const collapsed = shell.classList.toggle("panel-collapsed");
        btnCol.textContent = collapsed ? "Paneli Aç ▴" : "Küçült ▾";
      });
    }

    const dragPill = document.getElementById("sheetDragPill");
    if (dragPill) {
      dragPill.addEventListener("click", () => {
        const shell = document.getElementById("appShell");
        shell.classList.toggle("panel-expanded");
      });
    }

    document.getElementById("btnModeSimple").addEventListener("click", () => {
      hapticTap();
      state.uiMode = "simple";
      applyThemeAndMode();
      persistState();
    });
    document.getElementById("btnModeAdvanced").addEventListener("click", () => {
      hapticTap();
      state.uiMode = "advanced";
      applyThemeAndMode();
      persistState();
    });

    // Safe-zone & Random Zemin shortcuts
    document.getElementById("btnSafeZoneToggle").addEventListener("click", () => {
      hapticTap();
      state.safeZoneVisible = !state.safeZoneVisible;
      document.getElementById("safeZoneOverlay").classList.toggle("active", state.safeZoneVisible);
      persistState();
    });

    document.getElementById("btnRandomZeminHeader").addEventListener("click", () => {
      hapticTap();
      const all = getAllZeminItems();
      const candidates = all.filter((i) => i.id !== state.zeminId);
      const pick = candidates[Math.floor(Math.random() * candidates.length)] || all[0];
      if (pick) {
        selectZemin(pick.id);
        showToast(`🎲 Zemin: ${pick.name}`, 1800);
      }
    });

    document.getElementById("btnRandomZeminTab").addEventListener("click", () => {
      document.getElementById("btnRandomZeminHeader").click();
    });

    // Transport Controls
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

    // Ayet & Reciter Controls
    document.getElementById("selSurah").addEventListener("change", (e) => {
      state.surahNo = Number(e.target.value);
      populateAyahRangeSelectors(false);
      renderFavoriteAyahChips();
      persistState();
      loadVersesAndPreloadAudio();
    });

    document.getElementById("selAyahStart").addEventListener("change", (e) => {
      state.ayahStart = Number(e.target.value);
      if (state.ayahEnd < state.ayahStart) {
        state.ayahEnd = state.ayahStart;
        document.getElementById("selAyahEnd").value = state.ayahEnd;
      }
      renderFavoriteAyahChips();
      persistState();
      loadVersesAndPreloadAudio();
    });

    document.getElementById("selAyahEnd").addEventListener("change", (e) => {
      state.ayahEnd = Number(e.target.value);
      if (state.ayahEnd < state.ayahStart) {
        state.ayahStart = state.ayahEnd;
        document.getElementById("selAyahStart").value = state.ayahStart;
      }
      renderFavoriteAyahChips();
      persistState();
      loadVersesAndPreloadAudio();
    });

    document.getElementById("selReciter").addEventListener("change", (e) => {
      state.reciterId = e.target.value;
      persistState();
      loadVersesAndPreloadAudio();
    });

    document.getElementById("selSubtitleMode").addEventListener("change", (e) => {
      state.subtitleMode = e.target.value;
      persistState();
    });

    document.getElementById("selBismillahMode").addEventListener("change", (e) => {
      state.bismillahMode = e.target.value;
      persistState();
    });

    document.getElementById("btnAddCurrentToFavorites").addEventListener("click", () => {
      hapticTap();
      const surahMeta = SURAHS.find((s) => s[0] === state.surahNo) || SURAHS[0];
      const exists = (state.favoriteAyahs || []).some(
        (f) => f.surahNo === state.surahNo && f.start === state.ayahStart && f.end === state.ayahEnd
      );
      if (exists) {
        showToast("Bu ayet aralığı zaten favorilerinizde.");
        return;
      }
      const label = `${surahMeta[1]} ${state.ayahStart}–${state.ayahEnd}`;
      state.favoriteAyahs = [
        { id: "fav_" + Date.now(), label, surahNo: state.surahNo, start: state.ayahStart, end: state.ayahEnd },
        ...(state.favoriteAyahs || [])
      ].slice(0, 16);
      renderFavoriteAyahChips();
      persistState();
      showToast(`★ "${label}" favorilere eklendi!`);
    });

    // Audio Error Action Buttons (v2-3 fix)
    document.getElementById("btnRetryFailedAudio").addEventListener("click", () => {
      hapticTap();
      loadVersesAndPreloadAudio();
    });
    document.getElementById("btnContinueTextOnly").addEventListener("click", () => {
      hapticTap();
      enableTextOnlyContinueMode(true);
    });

    // Zemin & Pexels Controls
    document.getElementById("inpZeminSearch").addEventListener("input", (e) => {
      state.zeminSearch = e.target.value;
      renderZeminGrid();
    });

    document.getElementById("btnSearchPexels").addEventListener("click", () => {
      hapticTap();
      const q = document.getElementById("inpZeminSearch").value.trim() || "islamic mosque rain nature";
      searchPexelsMedia(q);
    });

    document.getElementById("btnSavePexelsKeyInline").addEventListener("click", () => {
      const k = document.getElementById("inpPexelsKeyInline").value.trim();
      state.pexelsApiKey = k;
      document.getElementById("inpPexelsApiKey").value = k;
      document.getElementById("pexelsKeyPromptBox").style.display = "none";
      persistState();
      if (k) {
        searchPexelsMedia(document.getElementById("inpZeminSearch").value.trim() || "rain night");
      }
    });

    document.getElementById("inpGalleryUpload").addEventListener("change", async (e) => {
      const files = Array.from(e.target.files || []);
      e.target.value = "";
      if (files.length === 0) return;

      showToast(`${files.length} medya işleniyor...`);
      let lastAddedId = null;

      for (const file of files) {
        try {
          const item = await processUploadedFile(file);
          await saveGalleryItem(item);
          lastAddedId = item.id;
        } catch (err) {
          showToast(err.message || "Medya yüklenirken hata oluştu.");
        }
      }

      galleryItems = await getAllGalleryItems();
      state.zeminCategory = "Galerim";
      renderZeminCategories();
      if (lastAddedId) {
        await selectZemin(lastAddedId);
        showToast("Medya Galerim'e eklendi ve seçildi.");
      }
      refreshStorageStatsUI();
    });

    document.getElementById("btnClearGallery").addEventListener("click", async () => {
      hapticTap();
      await clearAllGallery();
      galleryItems = [];
      renderZeminCategories();
      await selectZemin("live_rain_window");
      refreshStorageStatsUI();
      showToast("Kişisel galeriniz temizlendi.");
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
        showToast("Bağlantıdaki medya başarıyla eklendi.");
      } catch (_) {
        showToast("Karşı sunucu CORS izni vermiyor. Lütfen dosyayı indirip '+ Galerim'e Ekle' ile seçin.", 4200);
      }
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

    // Hata 8 Düzeltmesi: Kullanıcı karartmayı değiştirdiğinde otomatik olarak kilitlenir ve zemin değişiminde ezilmez
    document.getElementById("rngBgDim").addEventListener("input", (e) => {
      state.bgDim = Number(e.target.value);
      state.lockBgDim = true;
      const chk = document.getElementById("chkLockBgDim");
      if (chk) chk.checked = true;
      document.getElementById("valBgDim").textContent = `%${state.bgDim}`;
      persistState();
    });
    document.getElementById("chkLockBgDim").addEventListener("change", (e) => {
      state.lockBgDim = e.target.checked;
      persistState();
    });

    document.getElementById("rngBgBlur").addEventListener("input", (e) => {
      state.bgBlur = Number(e.target.value);
      document.getElementById("valBgBlur").textContent = `${state.bgBlur} px`;
      persistState();
    });
    document.getElementById("rngBgBrightness").addEventListener("input", (e) => {
      state.bgBrightness = Number(e.target.value);
      document.getElementById("valBgBrightness").textContent = `%${state.bgBrightness}`;
      persistState();
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
    document.getElementById("selKenBurns").addEventListener("change", (e) => {
      state.kenBurns = e.target.value;
      persistState();
    });
    document.getElementById("selVignette").addEventListener("change", (e) => {
      state.vignette = e.target.value;
      persistState();
    });
    document.getElementById("selVideoAudioMode").addEventListener("change", (e) => {
      state.videoAudioMode = e.target.value;
      if (state.videoAudioMode === "unmuted" && state.bgVideoVol === 0) {
        state.bgVideoVol = 50;
        document.getElementById("rngBgVideoVol").value = 50;
        document.getElementById("valBgVideoVol").textContent = "%50";
      }
      updateVolumes(state, activeBgVideo);
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

    // Typography & Logo Controls
    document.querySelectorAll("#arabicFontCards .mini-preview-card").forEach((card) => {
      card.addEventListener("click", () => {
        hapticTap();
        document.querySelectorAll("#arabicFontCards .mini-preview-card").forEach((c) => c.classList.remove("active"));
        card.classList.add("active");
        state.arabicFont = card.dataset.font;
        ensureFontsLoaded();
        persistState();
      });
    });

    document.getElementById("selMealFont").addEventListener("change", (e) => {
      state.mealFont = e.target.value;
      ensureFontsLoaded();
      persistState();
    });
    document.getElementById("selMealWeight").addEventListener("change", (e) => {
      state.mealWeight = Number(e.target.value);
      persistState();
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
    document.getElementById("rngArabicLetterSpacing").addEventListener("input", (e) => {
      state.arabicLetterSpacing = Number(e.target.value);
      document.getElementById("valArabicLetterSpacing").textContent = `${state.arabicLetterSpacing} px`;
      persistState();
    });
    document.getElementById("selTransitionMode").addEventListener("change", (e) => {
      state.transitionMode = e.target.value;
      persistState();
    });
    document.getElementById("rngTextShadow").addEventListener("input", (e) => {
      state.textShadow = Number(e.target.value);
      document.getElementById("valTextShadow").textContent = `${state.textShadow} px`;
      persistState();
    });
    document.getElementById("selTextBackdrop").addEventListener("change", (e) => {
      state.textBackdrop = e.target.value;
      persistState();
    });
    document.getElementById("inpArabicColor").addEventListener("input", (e) => {
      state.arabicColor = e.target.value;
      persistState();
    });
    document.getElementById("inpMealColor").addEventListener("input", (e) => {
      state.mealColor = e.target.value;
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

    // Audio Controls (Fixes Bug #7: bgVideoVol updates Web Audio gain node!)
    document.getElementById("rngReciterVol").addEventListener("input", (e) => {
      state.reciterVol = Number(e.target.value);
      document.getElementById("valReciterVol").textContent = `%${state.reciterVol}`;
      updateVolumes(state, activeBgVideo);
      persistState();
    });
    document.getElementById("selAmbientType").addEventListener("change", (e) => {
      state.ambientType = e.target.value;
      if (state.isPlaying || state.isRecording) {
        ensureAudioGraph(state, activeBgVideo);
        startAmbientSound(state);
      }
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
      if (state.bgVideoVol > 0 && state.videoAudioMode === "muted") {
        state.videoAudioMode = "unmuted";
        document.getElementById("selVideoAudioMode").value = "unmuted";
      }
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

    // Cover Controls
    document.getElementById("selCoverFirstFrame").addEventListener("change", (e) => {
      state.coverFirstFrame = e.target.value;
      persistState();
      loadVersesAndPreloadAudio();
    });
    document.getElementById("selCoverPreviewMode").addEventListener("change", (e) => {
      state.coverPreviewMode = e.target.value;
      persistState();
    });
    document.getElementById("inpCoverTitle").addEventListener("input", (e) => {
      state.coverTitle = e.target.value;
      persistState();
    });
    document.getElementById("inpCoverSubtitle").addEventListener("input", (e) => {
      state.coverSubtitle = e.target.value;
      persistState();
    });
    document.getElementById("selCoverPos").addEventListener("change", (e) => {
      state.coverPos = e.target.value;
      persistState();
    });
    document.getElementById("rngCoverScale").addEventListener("input", (e) => {
      state.coverScale = Number(e.target.value);
      document.getElementById("valCoverScale").textContent = `%${state.coverScale}`;
      persistState();
    });
    document.getElementById("selCoverBgOverride").addEventListener("change", (e) => {
      state.coverBgOverride = e.target.value;
      persistState();
    });

    document.getElementById("btnDownloadCoverPng").addEventListener("click", () => {
      hapticTap();
      const prevMode = state.coverPreviewMode;
      state.coverPreviewMode = "cover";
      renderStudioFrame(performance.now());
      const dataUrl = canvas.toDataURL("image/png");
      state.coverPreviewMode = prevMode;

      const surahMeta = SURAHS.find((s) => s[0] === state.surahNo) || SURAHS[92];
      const a = document.createElement("a");
      a.href = dataUrl;
      a.download = `TilawahWorld_Kapak_${surahMeta[1]}_${state.ayahStart}-${state.ayahEnd}.png`;
      document.body.appendChild(a);
      a.click();
      a.remove();
      showToast("Kapak görseli (.PNG) indirildi.");
    });

    // Export & Share Controls (Includes 16:9!)
    document.getElementById("selPlatformRatio").addEventListener("change", (e) => {
      state.platformRatio = e.target.value;
      updateCanvasResolutionAndRatio();
      persistState();
    });
    document.getElementById("selResolution").addEventListener("change", (e) => {
      state.resolution = Number(e.target.value);
      updateCanvasResolutionAndRatio();
      persistState();
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
        showToast("Açıklama ve etiketler panoya kopyalandı!");
      } catch (_) {
        document.getElementById("txtSocialCaption").select();
        document.execCommand("copy");
        showToast("Açıklama kopyalandı!");
      }
    });

    // Settings Tab Accordion & Actions
    document.querySelectorAll(".acc-header").forEach((hdr) => {
      hdr.addEventListener("click", () => {
        hapticTap();
        const item = hdr.closest(".acc-item");
        if (item) item.classList.toggle("open");
      });
    });

    document.getElementById("selUiTheme").addEventListener("change", (e) => {
      state.uiTheme = e.target.value;
      applyThemeAndMode();
      persistState();
      showToast("Tema rengi güncellendi.");
    });
    document.getElementById("selUiLang").addEventListener("change", (e) => {
      state.uiLang = e.target.value;
      persistState();
    });
    document.getElementById("chkAutoSave").addEventListener("change", (e) => {
      state.autoSave = e.target.checked;
      saveSettings(state, null, true);
      showToast(state.autoSave ? "Otomatik kaydetme açıldı." : "Otomatik kaydetme kapatıldı.");
    });
    document.getElementById("chkHapticEnabled").addEventListener("change", (e) => {
      state.hapticEnabled = e.target.checked;
      persistState();
    });
    document.getElementById("inpPexelsApiKey").addEventListener("change", (e) => {
      state.pexelsApiKey = e.target.value.trim();
      persistState();
      showToast("Pexels API anahtarı kaydedildi.");
    });

    // User Presets Save & Load
    document.getElementById("btnSaveUserPreset").addEventListener("click", () => {
      hapticTap();
      const nameInp = document.getElementById("inpNewPresetName");
      const name = (nameInp.value || "").trim() || `Ön Ayar ${(state.userPresets || []).length + 1}`;
      const snapshot = {};
      window.TW_STORAGE.PERSISTED_KEYS.forEach((k) => {
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

    // Export / Import / Reset Settings JSON
    document.getElementById("btnExportSettingsJson").addEventListener("click", () => {
      hapticTap();
      const payload = {};
      window.TW_STORAGE.PERSISTED_KEYS.forEach((k) => { payload[k] = state[k]; });
      const blob = new Blob([JSON.stringify(payload, null, 2)], { type: "application/json" });
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = `TilawahWorld_Ayarlar_${new Date().toISOString().slice(0, 10)}.json`;
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
        const text = await file.text();
        const parsed = JSON.parse(text);
        window.TW_STORAGE.PERSISTED_KEYS.forEach((k) => {
          if (typeof parsed[k] !== "undefined") state[k] = parsed[k];
        });
        syncAllControlsFromState();
        await selectZemin(state.zeminId, true);
        await loadVersesAndPreloadAudio();
        saveSettings(state, null, true);
        showToast("✓ Ayarlar JSON dosyasından başarıyla yüklendi!");
      } catch (_) {
        showToast("Geçersiz JSON ayar dosyası.");
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
      showToast("Tüm ayarlar varsayılan değerlere döndürüldü.");
    });

    document.getElementById("btnClearGallerySettings").addEventListener("click", () => {
      document.getElementById("btnClearGallery").click();
    });

    document.getElementById("btnTestSwBanner").addEventListener("click", () => {
      hapticTap();
      const banner = document.getElementById("swUpdateBanner");
      if (banner) banner.classList.add("active");
      showToast("Güncelleme bildirim çubuğu test için açıldı.");
    });

    document.addEventListener("visibilitychange", () => {
      if (document.hidden && state.isPlaying && !state.isRecording) {
        stopPlaybackAndRecording(true);
      }
    });
  }

  // Service Worker Registration & Messages (v2-8 fix)
  function initServiceWorker() {
    if (!("serviceWorker" in navigator) || window.__TW_INLINE_CANVAS_MODE__) return;
    let refreshing = false;
    navigator.serviceWorker.addEventListener("controllerchange", () => {
      if (!refreshing) {
        refreshing = true;
        window.location.reload();
      }
    });

    navigator.serviceWorker.addEventListener("message", (event) => {
      if (!event.data) return;
      if (event.data.type === "SW_CACHE_WARNING") {
        showToast(event.data.message || "Bazı çevrimdışı dosyalar önbelleğe alınamadı.", 4500);
      }
    });

    navigator.serviceWorker.register("sw.js").then((reg) => {
      if (reg.waiting) {
        showSwUpdateBanner(reg.waiting);
      }
      reg.addEventListener("updatefound", () => {
        const newWorker = reg.installing;
        if (!newWorker) return;
        newWorker.addEventListener("statechange", () => {
          if (newWorker.state === "installed" && navigator.serviceWorker.controller) {
            showSwUpdateBanner(newWorker);
          }
        });
      });
    }).catch(() => {});
  }

  function showSwUpdateBanner(worker) {
    const banner = document.getElementById("swUpdateBanner");
    const btn = document.getElementById("btnReloadSw");
    if (!banner || !btn) return;
    banner.classList.add("active");
    btn.onclick = () => {
      if (worker && worker.postMessage) {
        worker.postMessage({ type: "SKIP_WAITING" });
      } else {
        banner.classList.remove("active");
        window.location.reload();
      }
    };
  }

  // Bootstrap Application
  (async function bootstrap() {
    syncAllControlsFromState();
    bindEvents();

    await ensureFontsLoaded();
    startRenderLoop();

    // Hide splash smoothly after fonts & initial frame
    setTimeout(() => {
      const splash = document.getElementById("pwaSplash");
      if (splash) splash.classList.add("hidden");
    }, 550);

    await initDB().catch(() => {});
    galleryItems = await getAllGalleryItems();
    await loadExternalCatalogJson();

    renderZeminCategories();
    await selectZemin(state.zeminId || "live_rain_window", true);
    await loadVersesAndPreloadAudio();
    await refreshStorageStatsUI();
    initServiceWorker();
  })();
})();

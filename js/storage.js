"use strict";

window.TW_STORAGE = (() => {
  const SETTINGS_KEY = "tilawah_world_settings_v3";
  const LEGACY_PREFS_KEY = "tilawah_world_preferences_v1";
  const DB_NAME = "TilawahWorldGalleryDB";
  const DB_VERSION = 2;
  const MEDIA_STORE = "user_media";
  const AYAH_STORE = "ayah_cache";

  const DEFAULT_SETTINGS = {
    // A. Genel
    uiLang: "tr",
    uiTheme: "emerald",
    autoSave: true,
    hapticEnabled: true,
    uiMode: "simple", // "simple" | "advanced"
    pexelsApiKey: "",
    // B. Varsayılan Tilavet
    surahNo: 93,
    ayahStart: 1,
    ayahEnd: 3,
    reciterId: "Alafasy_128kbps",
    subtitleMode: "tr",
    bismillahMode: "separate", // "separate" | "strip" | "first_only"
    // C. Görsel & Sahne
    zeminId: "live_rain_window",
    zeminCategory: "Tümü",
    recentZeminIds: ["live_rain_window", "vid_rain_window", "vid_mosque_dawn", "live_arch_mihrab"],
    visualEffect: "none",
    effectIntensity: 50,
    bgDim: 40,
    lockBgDim: true, // Hata 8 düzeltmesi: Zemin değişince kullanıcının karartma ayarını koru
    bgBlur: 0,
    bgBrightness: 100,
    bgZoom: 100,
    bgPanX: 0,
    bgPanY: 0,
    kenBurns: "off",
    vignette: "on",
    videoAudioMode: "muted",
    videoTrimStart: 0,
    videoTrimEnd: 0,
    safeZoneVisible: false,
    // D. Metin & Tipografi
    arabicFont: "Amiri",
    arabicLetterSpacing: 0,
    mealFont: "DM Sans",
    mealWeight: 500,
    arabicSize: 42,
    mealSize: 22,
    transitionMode: "slide",
    textShadow: 14,
    textBackdrop: "auto", // "none" | "bar" | "auto"
    arabicColor: "#FFFDF7",
    mealColor: "#E5E0D5",
    logoPos: "bottom-center",
    logoScale: 110,
    logoOpacity: 92,
    watermarkText: "Tilawah World",
    // E. Ses & Zamanlama
    reciterVol: 100,
    ambientType: "none",
    ambientVol: 18,
    bgVideoVol: 0,
    gaplessTrimSec: 0.14,
    fadeOutEnd: "on",
    audioFailPolicy: "block", // "block" | "text_only"
    // F.Kapak & Çıktı (Export)
    coverTemplateId: "classic_gold",
    coverFirstFrame: "off",
    coverPreviewMode: "ayah",
    coverTitle: "",
    coverSubtitle: "",
    coverPos: "center",
    coverScale: 100,
    coverBgOverride: "same",
    platformRatio: "9:16",
    resolution: 720,
    bitrateMbps: 6,
    exportEngine: "auto", // "auto" | "mediarecorder" | "webcodecs"
    fileNameFormat: "surah_ayah", // "surah_ayah" | "date_surah" | "reciter_surah"
    captionPlatform: "reels", // "reels" | "tiktok" | "shorts" | "youtube" | "whatsapp"
    // G. Favoriler & Ön Ayarlar
    favoriteAyahs: [...(window.TW_DATA ? window.TW_DATA.CURATED_FAVORITE_AYAHS : [])],
    userPresets: []
  };

  const PERSISTED_KEYS = Object.keys(DEFAULT_SETTINGS);

  function loadSettings() {
    let merged = { ...DEFAULT_SETTINGS };
    try {
      const legacyRaw = localStorage.getItem(LEGACY_PREFS_KEY);
      if (legacyRaw) {
        const legacy = JSON.parse(legacyRaw);
        Object.keys(legacy).forEach((k) => {
          if (k in merged && typeof legacy[k] !== "undefined") {
            merged[k] = legacy[k];
          }
        });
      }
      const raw = localStorage.getItem(SETTINGS_KEY);
      if (raw) {
        const parsed = JSON.parse(raw);
        Object.keys(parsed).forEach((k) => {
          if (k in merged && typeof parsed[k] !== "undefined") {
            merged[k] = parsed[k];
          }
        });
      }
    } catch (_) {}
    return merged;
  }

  let saveTimer = null;
  function saveSettings(stateObj, onSavedCallback, immediate = false) {
    if (stateObj && stateObj.autoSave === false && !immediate) return;
    clearTimeout(saveTimer);
    const runSave = () => {
      try {
        const payload = {};
        PERSISTED_KEYS.forEach((k) => {
          if (typeof stateObj[k] !== "undefined") {
            payload[k] = stateObj[k];
          }
        });
        localStorage.setItem(SETTINGS_KEY, JSON.stringify(payload));
        if (typeof onSavedCallback === "function") onSavedCallback();
      } catch (_) {}
    };
    if (immediate) {
      runSave();
    } else {
      saveTimer = setTimeout(runSave, 220);
    }
  }

  function resetSettingsToDefault() {
    try {
      localStorage.removeItem(SETTINGS_KEY);
      localStorage.removeItem(LEGACY_PREFS_KEY);
    } catch (_) {}
    return { ...DEFAULT_SETTINGS };
  }

  // IndexedDB for Personal Gallery & Offline Ayah Cache
  let dbInstance = null;

  async function initDB() {
    if (dbInstance) return dbInstance;
    if (navigator.storage && navigator.storage.persist) {
      try { await navigator.storage.persist(); } catch (_) {}
    }
    return new Promise((resolve, reject) => {
      const req = indexedDB.open(DB_NAME, DB_VERSION);
      req.onupgradeneeded = (e) => {
        const db = e.target.result;
        if (!db.objectStoreNames.contains(MEDIA_STORE)) {
          db.createObjectStore(MEDIA_STORE, { keyPath: "id" });
        }
        if (!db.objectStoreNames.contains(AYAH_STORE)) {
          db.createObjectStore(AYAH_STORE, { keyPath: "key" });
        }
      };
      req.onsuccess = (e) => {
        dbInstance = e.target.result;
        resolve(dbInstance);
      };
      req.onerror = (e) => reject(e.target.error);
    });
  }

  async function getAllGalleryItems() {
    try {
      const db = await initDB();
      return await new Promise((resolve) => {
        const tx = db.transaction(MEDIA_STORE, "readonly");
        const req = tx.objectStore(MEDIA_STORE).getAll();
        req.onsuccess = () => {
          const items = (req.result || []).sort((a, b) => (b.createdAt || 0) - (a.createdAt || 0));
          resolve(items);
        };
        req.onerror = () => resolve([]);
      });
    } catch (_) {
      return [];
    }
  }

  async function saveGalleryItem(item) {
    const db = await initDB();
    return new Promise((resolve, reject) => {
      const tx = db.transaction(MEDIA_STORE, "readwrite");
      const req = tx.objectStore(MEDIA_STORE).put(item);
      req.onsuccess = () => resolve(true);
      req.onerror = (e) => reject(e.target.error);
    });
  }

  async function deleteGalleryItem(id) {
    const db = await initDB();
    return new Promise((resolve) => {
      const tx = db.transaction(MEDIA_STORE, "readwrite");
      tx.objectStore(MEDIA_STORE).delete(id);
      tx.oncomplete = () => resolve(true);
      tx.onerror = () => resolve(false);
    });
  }

  async function clearAllGallery() {
    const db = await initDB();
    return new Promise((resolve) => {
      const tx = db.transaction(MEDIA_STORE, "readwrite");
      tx.objectStore(MEDIA_STORE).clear();
      tx.oncomplete = () => resolve(true);
      tx.onerror = () => resolve(false);
    });
  }

  // Offline Ayah Text Cache (IndexedDB + Built-in Seed)
  async function cacheVersesToDB(surahNo, versesArray) {
    try {
      const db = await initDB();
      const tx = db.transaction(AYAH_STORE, "readwrite");
      const store = tx.objectStore(AYAH_STORE);
      for (const v of versesArray) {
        store.put({
          key: `${surahNo}:${v.numberInSurah}`,
          surahNo,
          numberInSurah: v.numberInSurah,
          arabic: v.arabic,
          hasBismillahHeader: v.hasBismillahHeader,
          tr: v.tr,
          en: v.en,
          updatedAt: Date.now()
        });
      }
    } catch (_) {}
  }

  async function getCachedVersesRange(surahNo, startAyah, endAyah) {
    const results = [];
    const missing = [];
    let db = null;
    try {
      db = await initDB();
    } catch (_) {}

    const seed = (window.TW_DATA && window.TW_DATA.OFFLINE_VERSE_SEED) || {};

    for (let a = startAyah; a <= endAyah; a++) {
      const key = `${surahNo}:${a}`;
      let found = null;
      if (db) {
        found = await new Promise((resolve) => {
          try {
            const tx = db.transaction(AYAH_STORE, "readonly");
            const req = tx.objectStore(AYAH_STORE).get(key);
            req.onsuccess = () => resolve(req.result || null);
            req.onerror = () => resolve(null);
          } catch (_) {
            resolve(null);
          }
        });
      }
      if (!found && seed[key]) {
        found = {
          key,
          surahNo,
          numberInSurah: a,
          arabic: seed[key].arabic,
          hasBismillahHeader: (a === 1 && surahNo !== 1 && surahNo !== 9),
          tr: seed[key].tr,
          en: seed[key].en
        };
      }
      if (found) {
        results.push(found);
      } else {
        missing.push(a);
      }
    }

    return {
      ok: missing.length === 0 && results.length > 0,
      verses: results,
      missingAyahs: missing
    };
  }

  async function getStorageStats() {
    let galleryCount = 0;
    let galleryBytes = 0;
    let cachedAyahCount = 0;
    try {
      const items = await getAllGalleryItems();
      galleryCount = items.length;
      for (const it of items) {
        if (it.blob && it.blob.size) galleryBytes += it.blob.size;
      }
      const db = await initDB();
      cachedAyahCount = await new Promise((resolve) => {
        const tx = db.transaction(AYAH_STORE, "readonly");
        const req = tx.objectStore(AYAH_STORE).count();
        req.onsuccess = () => resolve(req.result || 0);
        req.onerror = () => resolve(0);
      });
    } catch (_) {}
    const seedCount = Object.keys((window.TW_DATA && window.TW_DATA.OFFLINE_VERSE_SEED) || {}).length;
    return {
      galleryCount,
      galleryMB: (galleryBytes / (1024 * 1024)).toFixed(2),
      cachedAyahCount: cachedAyahCount + seedCount
    };
  }

  return {
    DEFAULT_SETTINGS,
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
  };
})();

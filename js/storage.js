"use strict";

window.TW_STORAGE = (() => {
  const SETTINGS_KEY = "tilawah_world_settings_v6";
  const DB_NAME = "TilawahWorldDB_v3";
  const DB_VERSION = 3;
  const STORE_GALLERY = "gallery";
  const STORE_VERSES = "verses";

  const DEFAULT_SETTINGS = {
    // 1. Stil
    stylePresetId: "stil_dere",
    // 2. Kesit (Sûre & Âyet)
    surahNo: 1,
    ayahStart: 1,
    ayahEnd: 7,
    // 3. Hâfız & Kıraat
    reciterId: "MaherAlMuaiqly128kbps",
    bismillahMode: "separate", // "separate" | "first_only" | "strip"
    // 4. Zemin & İnce Ayar (Sadece Hareketli Sahneler + Galerim)
    zeminId: "vid_forest_stream",
    zeminCategory: "Tümü",
    recentZeminIds: ["vid_forest_stream", "vid_rain_window", "vid_mosque_dawn", "vid_golden_mihrab"],
    photoMotion: "pan", // "still" | "zoom_in" | "zoom_out" | "pan" (Galerim yüklemeleri için)
    bgZoom: 100,
    bgPanX: 0,
    bgPanY: 0,
    videoTrimStart: 0,
    videoTrimEnd: 0,
    // 5. Ortam & Ses & Zaman
    ambientType: "stream",
    ambientVol: 22,
    reciterVol: 100,
    videoAudioMode: "muted", // "muted" | "mix"
    bgVideoVol: 35,
    gaplessTrimSec: 0.25,
    smoothFadeOut: "on",
    audioFailPolicy: "strict", // "strict" | "text_only"
    // 6. Metin & Tipografi (Arapça, Türkçe Meal, İngilizce Meal, Kelime Vurgusu)
    arabicFont: "Amiri",
    arabicSize: 44,
    arabicColor: "#FFFDF7",
    arabicLetterSpacing: 0,
    mealEdition: "tr.diyanet", // "tr.diyanet" | "tr.yazir" | "tr.vakfi"
    mealStyle: "zarif",
    mealFont: "Cormorant Garamond",
    mealWeight: 600,
    mealItalic: true,
    mealSize: 23,
    mealColor: "#E8C978",
    enMealColor: "#CBD5E1",
    enMealSize: 18,
    mealNumberFormat: "hyphen", // "hyphen" (1- ) | "dot" (1. ) | "bracket" ([1] ) | "none"
    textShadow: 14,
    // 7. Görünüm & Kelime Vurgusu & Video İçi Süre Şeridi
    subtitleMode: "tr", // "tr" | "ar_only" | "meal_only" | "en" | "both" | "blank"
    wordHighlight: true,
    wordHighlightColor: "#F8E5A6",
    wordHighlightStyle: "glow", // "glow" | "underline" | "pill_scale"
    wordTimingOffset: 0, // -0.50 .. +0.50 sn
    textBoxStyle: "none", // "none" | "frosted" | "dark_pill"
    textReadability: "shadow", // "shadow" | "outline" | "plain"
    textAlignPos: "center", // "top" | "center" | "bottom"
    textOffsetY: 0,
    textOffsetX: 0,
    transitionMode: "soft", // "soft" | "slide" | "none"
    inVideoProgressBar: "bottom", // "bottom" | "under_text" | "top" | "off"
    inVideoSurahHeader: "both", // "both" | "center_banner" | "corner_only" | "off"
    cornerShowSurah: true,
    cornerShowAyahs: true,
    cornerShowReciter: true,
    // 8. Filtre
    bgBrightnessOffset: 0, // -40 .. +40
    bgWarmth: 0, // -50 .. +50
    bgDim: 45, // 0 .. 85
    lockBgDim: false,
    bgBlur: 0, // 0 .. 20
    visualEffect: "none", // "none" | "rain" | "snow" | "dust" | "sparks" | "stars"
    effectIntensity: 65,
    vignette: "on",
    // 9. Kapak (Detaylı Boyut, Konum, Sûre Adı Düzeltme & Başlık Ayarları)
    coverTemplateId: "sebat_hat",
    coverAyahNo: 1,
    coverLargeSurah: true,
    coverFirstFrame: "on",
    coverPreviewMode: "ayah", // "ayah" | "cover"
    coverSurahName: "",
    coverTitle: "",
    coverSubtitle: "",
    coverScale: 100, // 60% .. 160%
    coverOffsetY: 0, // -35% .. +35%
    coverOffsetX: 0, // -30% .. +30%
    coverPos: "center", // "top" | "center" | "bottom"
    coverBgOverride: "same",
    // 10. Biçim & Kalite & Logo (Varsayılan: 9:16 Dikey ve Siyah Tema!)
    platformRatio: "9:16", // "9:16" | "4:5" | "1:1" | "16:9"
    resolution: 1080, // 720 | 1080
    bitrateMbps: 8,
    exportEngine: "auto", // "auto" | "webcodecs" | "mediarecorder"
    fileNameFormat: "surah_ayah_reciter",
    showSignature: true,
    logoPos: "top-right", // "top-right" | "top-left" | "bottom-center" | "floating" | "hidden"
    logoScale: 100,
    logoOpacity: 90,
    watermarkText: "Tilawah World",
    captionPlatform: "reels",
    uiTheme: "black", // "black" | "emerald" | "midnight"
    userPresets: []
  };

  const PERSISTED_KEYS = Object.keys(DEFAULT_SETTINGS);

  function loadSettings() {
    try {
      const raw = localStorage.getItem(SETTINGS_KEY);
      if (!raw) return { ...DEFAULT_SETTINGS };
      const parsed = JSON.parse(raw);
      const merged = { ...DEFAULT_SETTINGS };
      for (const k of PERSISTED_KEYS) {
        if (typeof parsed[k] !== "undefined" && parsed[k] !== null) {
          merged[k] = parsed[k];
        }
      }
      // If an old static photo ID was stored, fall back to animated forest stream video
      if (typeof merged.zeminId === "string" && merged.zeminId.startsWith("media_")) {
        merged.zeminId = "vid_forest_stream";
      }
      return merged;
    } catch (_) {
      return { ...DEFAULT_SETTINGS };
    }
  }

  function saveSettings(stateObj) {
    try {
      const payload = {};
      for (const k of PERSISTED_KEYS) {
        if (typeof stateObj[k] !== "undefined") {
          payload[k] = stateObj[k];
        }
      }
      localStorage.setItem(SETTINGS_KEY, JSON.stringify(payload));
    } catch (_) {}
  }

  function resetSettingsToDefault() {
    try {
      localStorage.removeItem(SETTINGS_KEY);
    } catch (_) {}
    return { ...DEFAULT_SETTINGS };
  }

  let dbInstance = null;

  function initDB() {
    if (dbInstance) return Promise.resolve(dbInstance);
    return new Promise((resolve, reject) => {
      if (!window.indexedDB) {
        resolve(null);
        return;
      }
      const req = indexedDB.open(DB_NAME, DB_VERSION);
      req.onupgradeneeded = (e) => {
        const db = e.target.result;
        if (!db.objectStoreNames.contains(STORE_GALLERY)) {
          db.createObjectStore(STORE_GALLERY, { keyPath: "id" });
        }
        if (!db.objectStoreNames.contains(STORE_VERSES)) {
          db.createObjectStore(STORE_VERSES, { keyPath: "key" });
        }
      };
      req.onsuccess = (e) => {
        dbInstance = e.target.result;
        resolve(dbInstance);
      };
      req.onerror = () => resolve(null);
    });
  }

  async function getAllGalleryItems() {
    const db = await initDB();
    if (!db) return [];
    return new Promise((resolve) => {
      try {
        const tx = db.transaction(STORE_GALLERY, "readonly");
        const req = tx.objectStore(STORE_GALLERY).getAll();
        req.onsuccess = () => resolve(req.result || []);
        req.onerror = () => resolve([]);
      } catch (_) {
        resolve([]);
      }
    });
  }

  async function saveGalleryItem(item) {
    const db = await initDB();
    if (!db) return false;
    return new Promise((resolve) => {
      try {
        const tx = db.transaction(STORE_GALLERY, "readwrite");
        tx.objectStore(STORE_GALLERY).put(item);
        tx.oncomplete = () => resolve(true);
        tx.onerror = () => resolve(false);
      } catch (_) {
        resolve(false);
      }
    });
  }

  async function deleteGalleryItem(id) {
    const db = await initDB();
    if (!db) return false;
    return new Promise((resolve) => {
      try {
        const tx = db.transaction(STORE_GALLERY, "readwrite");
        tx.objectStore(STORE_GALLERY).delete(id);
        tx.oncomplete = () => resolve(true);
        tx.onerror = () => resolve(false);
      } catch (_) {
        resolve(false);
      }
    });
  }

  async function clearAllGallery() {
    const db = await initDB();
    if (!db) return false;
    return new Promise((resolve) => {
      try {
        const tx = db.transaction(STORE_GALLERY, "readwrite");
        tx.objectStore(STORE_GALLERY).clear();
        tx.oncomplete = () => resolve(true);
        tx.onerror = () => resolve(false);
      } catch (_) {
        resolve(false);
      }
    });
  }

  async function cacheVersesToDB(surahNo, versesArray) {
    const db = await initDB();
    if (!db || !Array.isArray(versesArray)) return;
    try {
      const tx = db.transaction(STORE_VERSES, "readwrite");
      const store = tx.objectStore(STORE_VERSES);
      for (const v of versesArray) {
        store.put({
          key: `${surahNo}:${v.numberInSurah}`,
          surahNo,
          numberInSurah: v.numberInSurah,
          arabic: v.arabic,
          tr: v.tr,
          tr_yazir: v.tr_yazir || v.tr,
          tr_vakfi: v.tr_vakfi || v.tr,
          en: v.en,
          updatedAt: Date.now()
        });
      }
    } catch (_) {}
  }

  async function getCachedVersesRange(surahNo, startAyah, endAyah) {
    const db = await initDB();
    const seed = (window.TW_DATA && window.TW_DATA.OFFLINE_VERSE_SEED) || {};
    const results = [];

    for (let a = startAyah; a <= endAyah; a++) {
      const k = `${surahNo}:${a}`;
      let found = null;

      // Always prefer verified clean OFFLINE_VERSE_SEED first
      if (seed[k]) {
        found = {
          numberInSurah: a,
          arabic: seed[k].arabic,
          tr: seed[k].tr,
          tr_yazir: seed[k].tr_yazir || seed[k].tr,
          tr_vakfi: seed[k].tr_vakfi || seed[k].tr,
          en: seed[k].en
        };
      }

      if (!found && db) {
        found = await new Promise((resolve) => {
          try {
            const tx = db.transaction(STORE_VERSES, "readonly");
            const req = tx.objectStore(STORE_VERSES).get(k);
            req.onsuccess = () => resolve(req.result || null);
            req.onerror = () => resolve(null);
          } catch (_) {
            resolve(null);
          }
        });
      }

      if (!found) {
        return { ok: false, missingAyah: a, verses: [] };
      }
      results.push(found);
    }
    return { ok: true, verses: results };
  }

  async function getStorageStats() {
    const db = await initDB();
    let galleryCount = 0;
    let galleryBytes = 0;
    let cachedAyahCount = Object.keys((window.TW_DATA && window.TW_DATA.OFFLINE_VERSE_SEED) || {}).length;

    if (db) {
      const gItems = await getAllGalleryItems();
      galleryCount = gItems.length;
      for (const it of gItems) {
        if (it.blob && it.blob.size) galleryBytes += it.blob.size;
      }
      const dbVerseCount = await new Promise((resolve) => {
        try {
          const tx = db.transaction(STORE_VERSES, "readonly");
          const req = tx.objectStore(STORE_VERSES).count();
          req.onsuccess = () => resolve(req.result || 0);
          req.onerror = () => resolve(0);
        } catch (_) {
          resolve(0);
        }
      });
      cachedAyahCount = Math.max(cachedAyahCount, dbVerseCount);
    }

    return {
      galleryCount,
      galleryMB: (galleryBytes / (1024 * 1024)).toFixed(1),
      cachedAyahCount
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

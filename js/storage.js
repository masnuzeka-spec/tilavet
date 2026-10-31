"use strict";

window.TW_STORAGE = (() => {
  const SETTINGS_KEY = "tilawah_world_settings_v4";
  const LEGACY_V3_KEY = "tilawah_world_settings_v3";
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
    uiMode: "simple",
    pexelsApiKey: "",
    // 1. Stil
    stylePresetId: "stil_dere",
    // 2. Kesit & 3. Hâfız
    surahNo: 87,
    ayahStart: 2,
    ayahEnd: 10,
    reciterId: "MaherAlMuaiqly128kbps",
    bismillahMode: "separate",
    // 4. Zemin & Hareket
    zeminId: "vid_forest_stream",
    zeminCategory: "Tümü",
    recentZeminIds: ["vid_forest_stream", "vid_rain_window", "vid_mosque_dawn", "live_fire_hearth"],
    photoMotion: "pan", // "still" (Durgun) | "zoom_in" (Yaklaş) | "zoom_out" (Uzaklaş) | "pan" (Kaydır)
    // 5. Ortam & Ses
    reciterVol: 100,
    ambientType: "none",
    ambientVol: 20,
    bgVideoVol: 0,
    videoAudioMode: "muted",
    videoTrimStart: 0,
    videoTrimEnd: 0,
    gaplessTrimSec: 0.14,
    fadeOutEnd: "on",
    audioFailPolicy: "block",
    // 6. Metin (Font, Meal Yazısı, Renk Daireleri, Okunaklılık, Konum)
    arabicFont: "Amiri",
    arabicLetterSpacing: 0,
    mealStyle: "zarif", // "sade" | "kitap" | "klasik" | "italik" | "zarif" | "edebi"
    mealFont: "Cormorant Garamond",
    mealWeight: 600,
    mealItalic: true,
    arabicSize: 44,
    mealSize: 22,
    arabicColor: "#FFFDF7",
    arabicColorName: "Fildişi",
    mealColor: "#E8C978",
    mealColorName: "Zer",
    textReadability: "plain", // "shadow" (Gölge) | "outline" (Kontur) | "box" (Kutu) | "plain" (Yalın)
    textPosition: "center", // "top" (Üst) | "center" (Orta) | "bottom" (Alt)
    textShadow: 14,
    textBackdrop: "none",
    // 7. Görünüm (Gösterim, Meal Kaynağı, Geçiş & Kelime Kelime Vurgu, Köşe Yazısı)
    subtitleMode: "tr", // "tr" (Arapça ve meal) | "none" (Yalnız Arapça) | "meal_only" (Yalnız meal) | "blank" (Yazısız) | "en" | "both"
    mealEdition: "tr.diyanet", // "tr.diyanet" (Diyanet İşleri) | "tr.yazir" (Elmalılı Hamdi Yazır) | "tr.vakfi" (Diyanet Vakfı)
    transitionMode: "word_highlight", // "word_highlight" (Vurgulu) | "fade" (Belirerek) | "soft" (Yumuşak) | "slide" (Süzülme)
    cornerShowSurah: true,
    cornerShowAyahs: true,
    cornerShowReciter: true,
    // 8. Filtre (Parlaklık, Sıcaklık, Karartma, Bulanıklık, Sinema Şeridi)
    bgBrightnessOffset: 5, // -50 .. +50 (0 = %100 parlaklık)
    bgBrightness: 105,
    bgWarmth: 0, // -50 (Soğuk) .. +50 (Sıcak)
    bgDim: 50,
    lockBgDim: true,
    bgBlur: 0,
    cinemaBars: false,
    vignette: "on",
    visualEffect: "none",
    effectIntensity: 50,
    bgZoom: 100,
    bgPanX: 0,
    bgPanY: 0,
    kenBurns: "on",
    safeZoneVisible: false,
    // 9. Kapak
    coverAyahNo: 7, // Seçili kesitteki hangi ayet kapakta gösterilsin
    coverLargeSurah: true, // "Sûre adı büyük" toggle
    coverFirstFrame: "on", // "Videoyla birlikte kaydet"
    coverPreviewMode: "ayah",
    coverTemplateId: "minimal_center",
    coverTitle: "",
    coverSubtitle: "",
    coverPos: "center",
    coverScale: 100,
    coverBgOverride: "same",
    // 10. Biçim & İmza
    platformRatio: "16:9",
    resolution: 1080,
    bitrateMbps: 6,
    exportEngine: "auto",
    fileNameFormat: "surah_ayah",
    captionPlatform: "reels",
    showSignature: true,
    logoPos: "top-right",
    logoScale: 95,
    logoOpacity: 90,
    watermarkText: "Tilawah",
    // Favoriler & Ön Ayarlar
    favoriteAyahs: [...(window.TW_DATA ? window.TW_DATA.KNOWN_EXCERPTS : [])],
    userPresets: []
  };

  const PERSISTED_KEYS = Object.keys(DEFAULT_SETTINGS);

  function loadSettings() {
    let merged = { ...DEFAULT_SETTINGS };
    try {
      for (const key of [LEGACY_PREFS_KEY, LEGACY_V3_KEY, SETTINGS_KEY]) {
        const raw = localStorage.getItem(key);
        if (raw) {
          const parsed = JSON.parse(raw);
          Object.keys(parsed).forEach((k) => {
            if (k in merged && typeof parsed[k] !== "undefined") {
              merged[k] = parsed[k];
            }
          });
        }
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
      saveTimer = setTimeout(runSave, 200);
    }
  }

  function resetSettingsToDefault() {
    try {
      localStorage.removeItem(SETTINGS_KEY);
      localStorage.removeItem(LEGACY_V3_KEY);
      localStorage.removeItem(LEGACY_PREFS_KEY);
    } catch (_) {}
    return { ...DEFAULT_SETTINGS };
  }

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
          tr_yazir: v.tr_yazir || v.tr,
          tr_vakfi: v.tr_vakfi || v.tr,
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
          tr_yazir: seed[key].tr_yazir || seed[key].tr,
          tr_vakfi: seed[key].tr_vakfi || seed[key].tr,
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

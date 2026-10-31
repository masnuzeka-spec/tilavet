"use strict";

window.TW_STORAGE = (() => {
  const SETTINGS_KEY = "tilawah_world_settings_v5";
  const LEGACY_V4_KEY = "tilawah_world_settings_v4";
  const LEGACY_V3_KEY = "tilawah_world_settings_v3";
  const LEGACY_PREFS_KEY = "tilawah_world_preferences_v1";
  const DB_NAME = "TilawahWorldGalleryDB";
  const DB_VERSION = 2;
  const MEDIA_STORE = "user_media";
  const AYAH_STORE = "ayah_cache";

  const DEFAULT_SETTINGS = {
    // A. Genel (Varsayılan tema: Siyah & Altın, Varsayılan oran: 9:16!)
    uiLang: "tr",
    uiTheme: "black", // "black" (Siyah & Altın - Varsayılan) | "emerald" (Derin Zümrüt) | "midnight" (Gece Mavisi)
    autoSave: true,
    hapticEnabled: true,
    uiMode: "simple",
    pexelsApiKey: "",
    // 1. Stil
    stylePresetId: "stil_dere",
    // 2. Kesit & 3. Hâfız
    surahNo: 87,
    ayahStart: 1,
    ayahEnd: 5,
    reciterId: "MaherAlMuaiqly128kbps",
    bismillahMode: "separate", // "separate" | "first_only" | "strip"
    // 4. Zemin & Hareket & İnce Ayar
    zeminId: "vid_forest_stream",
    zeminCategory: "Tümü",
    recentZeminIds: ["vid_forest_stream", "vid_rain_window", "vid_mosque_dawn", "live_fire_hearth"],
    photoMotion: "pan", // "still" | "zoom_in" | "zoom_out" | "pan"
    bgZoom: 100,
    bgPanX: 0,
    bgPanY: 0,
    videoTrimStart: 0,
    videoTrimEnd: 0,
    // 5. Ortam & Ses & Zamanlama
    reciterVol: 100,
    ambientType: "none",
    ambientVol: 20,
    bgVideoVol: 0,
    videoAudioMode: "muted",
    gaplessTrimSec: 0.14,
    fadeOutEnd: "on",
    audioFailPolicy: "block",
    // 6. Metin (Font, Meal Yazısı, Renk Daireleri + Özel Renk, Okunaklılık, Konum, Boyut, Gölge, Harf Aralığı)
    arabicFont: "Amiri",
    arabicLetterSpacing: 0,
    mealStyle: "zarif",
    mealFont: "Cormorant Garamond",
    mealWeight: 600,
    mealItalic: true,
    arabicSize: 44,
    mealSize: 22,
    arabicColor: "#FFFDF7",
    arabicColorName: "Fildişi",
    mealColor: "#E8C978",
    mealColorName: "Zer",
    textReadability: "shadow", // "shadow" | "outline" | "box" | "plain"
    textPosition: "center", // "top" | "center" | "bottom"
    textShadow: 14,
    // 7. Görünüm (Gösterim, Meal Kaynağı, Vurgulu Geçiş, Video İçi Süre Şeridi, Video İçi Sûre Başlık Şeridi, Köşe Yazısı)
    subtitleMode: "tr", // "tr" | "none" | "meal_only" | "blank" | "both"
    mealEdition: "tr.diyanet", // "tr.diyanet" | "tr.yazir" | "tr.vakfi"
    transitionMode: "word_highlight", // "word_highlight" | "fade" | "soft" | "slide"
    inVideoProgressBar: "bottom", // "bottom" (Alt Kenarda İnce Altın Şerit) | "under_text" (Âyet Altı Çubuk) | "top" (Üst Kenar) | "off" (Kapalı)
    inVideoSurahHeader: "both", // "both" (Hem Ortada Sûre Şeridi Hem Sol Üst Köşe) | "center_banner" (Ortada Klasik Şerit) | "corner_only" (Sadece Sol Üst Köşe) | "off" (Gizle)
    cornerShowSurah: true,
    cornerShowAyahs: true,
    cornerShowReciter: true,
    // 8. Filtre (Parlaklık, Sıcaklık, Karartma + Kilit, Bulanıklık, Sinema Şeridi, Vignette, Parçacık + Yoğunluk)
    bgBrightnessOffset: 5,
    bgBrightness: 105,
    bgWarmth: 0,
    bgDim: 48,
    lockBgDim: true,
    bgBlur: 0,
    cinemaBars: false,
    vignette: "on",
    visualEffect: "none",
    effectIntensity: 50,
    safeZoneVisible: false,
    // 9. Kapak (Tam Birleşik: 9 Şablon + Kapağın Âyeti Daireleri + Sûre Adı Büyük + Özel Başlık/Alt Başlık + Boyut Ölçeği + Konum + Hassas X/Y + Kapak Zemini)
    coverTemplateId: "sebat_hat",
    coverAyahNo: 1,
    coverLargeSurah: true,
    coverFirstFrame: "on",
    coverPreviewMode: "ayah",
    coverTitle: "",
    coverSubtitle: "",
    coverPos: "center", // "upper" | "center" | "lower"
    coverOffsetY: 0, // -35 .. +35 (%)
    coverOffsetX: 0, // -30 .. +30 (%)
    coverScale: 100, // 60 .. 160 (%)
    coverBgOverride: "same", // "same" | "dark_gold" | "emerald" | "midnight" | "pure_black"
    // 10. Biçim & İmza & Çıktı (Varsayılan Biçim: 9:16!)
    platformRatio: "9:16",
    resolution: 1080,
    bitrateMbps: 6,
    exportEngine: "auto",
    fileNameFormat: "surah_ayah",
    captionPlatform: "reels",
    showSignature: true,
    logoPos: "top-right", // "top-right" | "top-left" | "bottom-center" | "floating" | "hidden"
    logoScale: 100,
    logoOpacity: 90,
    watermarkText: "Tilawah World",
    // Favoriler & Ön Ayarlar
    favoriteAyahs: [...(window.TW_DATA ? window.TW_DATA.KNOWN_EXCERPTS : [])],
    userPresets: []
  };

  const PERSISTED_KEYS = Object.keys(DEFAULT_SETTINGS);

  function loadSettings() {
    let merged = { ...DEFAULT_SETTINGS };
    try {
      for (const key of [LEGACY_PREFS_KEY, LEGACY_V3_KEY, LEGACY_V4_KEY, SETTINGS_KEY]) {
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
      // If migrating from older keys before v5, enforce user's requested v5 defaults (9:16 & black theme) unless v5 was already saved
      if (!localStorage.getItem(SETTINGS_KEY)) {
        merged.platformRatio = "9:16";
        merged.uiTheme = "black";
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
      localStorage.removeItem(LEGACY_V4_KEY);
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
      // Prefer verified clean seed if available, or IndexedDB entry
      if (seed[key]) {
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
      } else if (db) {
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
      cachedAyahCount: Math.max(seedCount, cachedAyahCount + seedCount)
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

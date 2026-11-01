"use strict";

window.TW_RECORDER = (() => {
  function detectRecorderCapabilities() {
    const candidates = [
      { mime: "video/mp4;codecs=avc1.42E01E,mp4a.40.2", ext: "mp4", cleanMime: "video/mp4", label: "MP4 (H.264 + AAC · Tam Uyumlu)" },
      { mime: "video/mp4;codecs=avc1", ext: "mp4", cleanMime: "video/mp4", label: "MP4 (H.264 · Tam Uyumlu)" },
      { mime: "video/mp4", ext: "mp4", cleanMime: "video/mp4", label: "MP4 (Standart · Tam Uyumlu)" },
      { mime: "video/webm;codecs=h264,opus", ext: "webm", cleanMime: "video/webm", label: "WebM (H.264 + Opus)" },
      { mime: "video/webm;codecs=vp9,opus", ext: "webm", cleanMime: "video/webm", label: "WebM (VP9 + Opus)" },
      { mime: "video/webm;codecs=vp8,opus", ext: "webm", cleanMime: "video/webm", label: "WebM (VP8 + Opus)" },
      { mime: "video/webm", ext: "webm", cleanMime: "video/webm", label: "WebM (Genel)" }
    ];

    const hasWebCodecs = typeof window.VideoEncoder !== "undefined" && typeof window.VideoFrame !== "undefined";
    let best = null;
    const supportedList = [];

    if (typeof window.MediaRecorder !== "undefined") {
      for (const c of candidates) {
        try {
          if (MediaRecorder.isTypeSupported(c.mime)) {
            supportedList.push(c);
            if (!best) best = c;
          }
        } catch (_) {}
      }
    }

    if (!best) {
      best = { mime: "", ext: "webm", cleanMime: "video/webm", label: "Tarayıcı Varsayılanı (WebM)" };
    }

    return {
      best,
      supportedList,
      hasWebCodecs,
      isNativeMp4: best.ext === "mp4"
    };
  }

  async function patchWebmDuration(blob, durationMs, cleanMime = "video/webm") {
    if (!blob) return blob;
    const targetType = cleanMime || (blob.type && blob.type.includes("mp4") ? "video/mp4" : "video/webm");
    if (!targetType.includes("webm")) {
      return new Blob([blob], { type: "video/mp4" });
    }
    try {
      const buf = await blob.arrayBuffer();
      const bytes = new Uint8Array(buf);
      const limit = Math.min(bytes.length - 12, 8192);
      for (let i = 0; i < limit; i++) {
        if (bytes[i] === 0x44 && bytes[i + 1] === 0x89) {
          const view = new DataView(buf);
          if (bytes[i + 2] === 0x88) {
            view.setFloat64(i + 3, durationMs, false);
            return new Blob([buf], { type: "video/webm" });
          } else if (bytes[i + 2] === 0x84) {
            view.setFloat32(i + 3, durationMs, false);
            return new Blob([buf], { type: "video/webm" });
          }
        }
      }
      return new Blob([buf], { type: "video/webm" });
    } catch (_) {
      return new Blob([blob], { type: "video/webm" });
    }
  }

  function sanitizeFilePart(str) {
    return String(str || "")
      .replace(/[âÂ]/g, (m) => (m === "Â" ? "A" : "a"))
      .replace(/[îÎ]/g, (m) => (m === "Î" ? "I" : "i"))
      .replace(/[ûÛ]/g, (m) => (m === "Û" ? "U" : "u"))
      .replace(/[ğĞ]/g, (m) => (m === "Ğ" ? "G" : "g"))
      .replace(/[üÜ]/g, (m) => (m === "Ü" ? "U" : "u"))
      .replace(/[şŞ]/g, (m) => (m === "Ş" ? "S" : "s"))
      .replace(/[ıİ]/g, (m) => (m === "İ" ? "I" : "i"))
      .replace(/[öÖ]/g, (m) => (m === "Ö" ? "O" : "o"))
      .replace(/[çÇ]/g, (m) => (m === "Ç" ? "C" : "c"))
      .replace(/[^a-zA-Z0-9_-]/g, "");
  }

  function formatExportFileName(state, surahsList, recitersList, ext) {
    const surahMeta = surahsList.find((s) => s[0] === state.surahNo) || surahsList[0];
    const cleanSurah = sanitizeFilePart(surahMeta[1]) || `Sure${state.surahNo}`;
    const range = `${state.ayahStart}-${state.ayahEnd}`;
    const dateStr = new Date().toISOString().slice(0, 10);

    if (state.fileNameFormat === "tilawah_date" || state.fileNameFormat === "date_surah") {
      return `Tilawah_${dateStr}_${cleanSurah}_${range}.${ext}`;
    }
    const rec = recitersList.find((r) => r.id === state.reciterId) || recitersList[0];
    const recShort = sanitizeFilePart(rec.name.split(" ")[0]) || "Tilavet";
    return `Tilawah_${cleanSurah}_${range}_${recShort}.${ext}`;
  }

  return {
    detectRecorderCapabilities,
    patchWebmDuration,
    formatExportFileName
  };
})();

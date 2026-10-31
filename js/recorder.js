"use strict";

window.TW_RECORDER = (() => {
  function detectRecorderCapabilities() {
    const candidates = [
      { mime: "video/mp4;codecs=avc1.42E01E,mp4a.40.2", ext: "mp4", label: "MP4 (H.264 + AAC · Tam Uyumlu)" },
      { mime: "video/mp4;codecs=avc1", ext: "mp4", label: "MP4 (H.264 · Tam Uyumlu)" },
      { mime: "video/mp4", ext: "mp4", label: "MP4 (Standart · Tam Uyumlu)" },
      { mime: "video/webm;codecs=h264,opus", ext: "webm", label: "WebM (H.264 + Opus)" },
      { mime: "video/webm;codecs=vp9,opus", ext: "webm", label: "WebM (VP9 + Opus)" },
      { mime: "video/webm;codecs=vp8,opus", ext: "webm", label: "WebM (VP8 + Opus)" },
      { mime: "video/webm", ext: "webm", label: "WebM (Genel)" }
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
      best = { mime: "", ext: "webm", label: "Tarayıcı Varsayılanı (WebM)" };
    }

    return {
      best,
      supportedList,
      hasWebCodecs,
      isNativeMp4: best.ext === "mp4"
    };
  }

  async function patchWebmDuration(blob, durationMs) {
    if (!blob || !blob.type.includes("webm")) return blob;
    try {
      const buf = await blob.arrayBuffer();
      const bytes = new Uint8Array(buf);
      const limit = Math.min(bytes.length - 12, 8192);
      for (let i = 0; i < limit; i++) {
        if (bytes[i] === 0x44 && bytes[i + 1] === 0x89) {
          const view = new DataView(buf);
          if (bytes[i + 2] === 0x88) {
            view.setFloat64(i + 3, durationMs, false);
            return new Blob([buf], { type: blob.type });
          } else if (bytes[i + 2] === 0x84) {
            view.setFloat32(i + 3, durationMs, false);
            return new Blob([buf], { type: blob.type });
          }
        }
      }
    } catch (_) {}
    return blob;
  }

  function formatExportFileName(state, surahsList, recitersList, ext) {
    const surahMeta = surahsList.find((s) => s[0] === state.surahNo) || surahsList[92];
    const cleanSurah = surahMeta[1].replace(/\s+/g, "");
    const range = `${state.ayahStart}-${state.ayahEnd}`;
    const dateStr = new Date().toISOString().slice(0, 10);

    if (state.fileNameFormat === "date_surah") {
      return `Tilawah_${dateStr}_${cleanSurah}_${range}.${ext}`;
    } else if (state.fileNameFormat === "reciter_surah") {
      const rec = recitersList.find((r) => r.id === state.reciterId) || recitersList[0];
      const recShort = rec.name.split(" ")[0].replace(/[^a-zA-Z0-9ğüşıöçĞÜŞİÖÇ]/g, "");
      return `Tilawah_${recShort}_${cleanSurah}_${range}.${ext}`;
    }
    return `TilawahWorld_${cleanSurah}_${range}.${ext}`;
  }

  return {
    detectRecorderCapabilities,
    patchWebmDuration,
    formatExportFileName
  };
})();

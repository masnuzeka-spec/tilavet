"use strict";

window.TW_AUDIO = (() => {
  let audioCtx = null;
  let mixDest = null;
  let masterGain = null;
  let reciterGain = null;
  let ambientGain = null;
  let bgVideoGain = null;

  let ambientSourceNode = null;
  let ambientAudioEl = null;
  const connectedNodes = new WeakMap();

  function ensureAudioGraph(state, activeBgVideo) {
    if (!audioCtx) {
      const AC = window.AudioContext || window.webkitAudioContext;
      audioCtx = new AC();
      mixDest = audioCtx.createMediaStreamDestination();

      masterGain = audioCtx.createGain();
      reciterGain = audioCtx.createGain();
      ambientGain = audioCtx.createGain();
      bgVideoGain = audioCtx.createGain();

      reciterGain.connect(masterGain);
      ambientGain.connect(masterGain);
      bgVideoGain.connect(masterGain);

      masterGain.connect(audioCtx.destination);
      masterGain.connect(mixDest);
    }

    if (audioCtx.state === "suspended") {
      audioCtx.resume().catch(() => {});
    }

    masterGain.gain.cancelScheduledValues(audioCtx.currentTime);
    masterGain.gain.setValueAtTime(1.0, audioCtx.currentTime);
    reciterGain.gain.setValueAtTime((state.reciterVol || 100) / 100, audioCtx.currentTime);
    ambientGain.gain.setValueAtTime((state.ambientVol || 0) / 100, audioCtx.currentTime);

    const bgVol = state.videoAudioMode === "unmuted" ? (state.bgVideoVol || 0) / 100 : 0;
    bgVideoGain.gain.setValueAtTime(bgVol, audioCtx.currentTime);

    // Connect Reciter Audio Elements
    (state.audioElements || []).forEach((aud) => {
      if (aud && !connectedNodes.has(aud)) {
        try {
          const src = audioCtx.createMediaElementSource(aud);
          src.connect(reciterGain);
          connectedNodes.set(aud, src);
        } catch (_) {}
      }
    });

    // Hata 7 Düzeltmesi: Zemin videosunun sesini Web Audio mikserine ve kayıt akışına (mixDest) bağla
    connectBgVideoToGraph(activeBgVideo, state);

    return { audioCtx, mixDest, masterGain };
  }

  function connectBgVideoToGraph(videoEl, state) {
    if (!audioCtx || !videoEl) return;
    if (!connectedNodes.has(videoEl)) {
      try {
        const vSrc = audioCtx.createMediaElementSource(videoEl);
        vSrc.connect(bgVideoGain);
        connectedNodes.set(videoEl, vSrc);
      } catch (_) {}
    }
    const bgVol = state.videoAudioMode === "unmuted" ? (state.bgVideoVol || 0) / 100 : 0;
    if (bgVideoGain) {
      bgVideoGain.gain.setValueAtTime(bgVol, audioCtx.currentTime);
    }
    videoEl.muted = (state.videoAudioMode === "muted" || bgVol <= 0);
    videoEl.volume = 1.0; // Gain node controls actual volume so both speaker and recording match
  }

  function updateVolumes(state, activeBgVideo) {
    if (!audioCtx) return;
    const now = audioCtx.currentTime;
    if (reciterGain) reciterGain.gain.setValueAtTime((state.reciterVol || 100) / 100, now);
    if (ambientGain) ambientGain.gain.setValueAtTime((state.ambientVol || 0) / 100, now);
    const bgVol = state.videoAudioMode === "unmuted" ? (state.bgVideoVol || 0) / 100 : 0;
    if (bgVideoGain) bgVideoGain.gain.setValueAtTime(bgVol, now);
    if (activeBgVideo) {
      activeBgVideo.muted = (state.videoAudioMode === "muted" || bgVol <= 0);
    }
  }

  function triggerSmoothFadeOut(durationSec = 0.85) {
    if (!audioCtx || !masterGain) return;
    const now = audioCtx.currentTime;
    masterGain.gain.cancelScheduledValues(now);
    masterGain.gain.setValueAtTime(masterGain.gain.value, now);
    masterGain.gain.linearRampToValueAtTime(0.0001, now + durationSec);
  }

  function resetMasterGain() {
    if (!audioCtx || !masterGain) return;
    const now = audioCtx.currentTime;
    masterGain.gain.cancelScheduledValues(now);
    masterGain.gain.setValueAtTime(1.0, now);
  }

  function startAmbientSound(state) {
    stopAmbientSound();
    if (!audioCtx || state.ambientType === "none" || state.ambientVol <= 0) return;

    // First try real ambient MP3 file in media/audio/, with instant synth fallback
    const fileMap = {
      rain: "media/audio/rain.mp3",
      wind: "media/audio/wind.mp3",
      ney: "media/audio/ney.mp3"
    };
    const fileSrc = fileMap[state.ambientType];

    // Always start lush procedural ambient layer immediately so there is zero gap, and layer/replace if file loads
    startProceduralAmbient(state.ambientType);

    if (fileSrc && !window.__TW_INLINE_CANVAS_MODE__) {
      try {
        const el = new Audio();
        el.crossOrigin = "anonymous";
        el.loop = true;
        el.src = fileSrc;
        el.oncanplay = () => {
          if (!ambientAudioEl) return;
          try {
            if (!connectedNodes.has(el)) {
              const node = audioCtx.createMediaElementSource(el);
              node.connect(ambientGain);
              connectedNodes.set(el, node);
            }
            stopProceduralAmbientOnly();
            el.play().catch(() => {});
          } catch (_) {}
        };
        ambientAudioEl = el;
      } catch (_) {}
    }
  }

  function startProceduralAmbient(type) {
    if (!audioCtx) return;
    const sampleRate = audioCtx.sampleRate;
    const bufferSize = sampleRate * 4;
    const buffer = audioCtx.createBuffer(1, bufferSize, sampleRate);
    const data = buffer.getChannelData(0);

    if (type === "ney") {
      // Warm harmonic contemplative drone (216Hz + 324Hz + 432Hz with gentle breathing LFO)
      for (let i = 0; i < bufferSize; i++) {
        const t = i / sampleRate;
        const env = 0.75 + 0.25 * Math.sin(2 * Math.PI * 0.25 * t);
        const w1 = Math.sin(2 * Math.PI * 216 * t) * 0.55;
        const w2 = Math.sin(2 * Math.PI * 324 * t) * 0.25;
        const w3 = Math.sin(2 * Math.PI * 432 * t) * 0.15;
        data[i] = (w1 + w2 + w3) * env * 0.28;
      }
    } else {
      // Filtered pink/brown noise for rain or night wind
      let b0 = 0, b1 = 0, b2 = 0, b3 = 0, b4 = 0, b5 = 0, b6 = 0;
      for (let i = 0; i < bufferSize; i++) {
        const white = Math.random() * 2 - 1;
        b0 = 0.99886 * b0 + white * 0.0555179;
        b1 = 0.99332 * b1 + white * 0.0750759;
        b2 = 0.96900 * b2 + white * 0.1538520;
        b3 = 0.86650 * b3 + white * 0.3104856;
        b4 = 0.55000 * b4 + white * 0.5329522;
        b5 = -0.7616 * b5 - white * 0.0168980;
        data[i] = (b0 + b1 + b2 + b3 + b4 + b5 + b6 + white * 0.5362) * 0.035;
        b6 = white * 0.115926;
      }
    }

    const src = audioCtx.createBufferSource();
    src.buffer = buffer;
    src.loop = true;

    const filter = audioCtx.createBiquadFilter();
    filter.type = type === "ney" ? "lowpass" : type === "rain" ? "bandpass" : "lowpass";
    filter.frequency.value = type === "rain" ? 980 : type === "wind" ? 380 : 520;
    filter.Q.value = type === "rain" ? 0.7 : 1.0;

    src.connect(filter);
    filter.connect(ambientGain);
    src.start();
    ambientSourceNode = src;
  }

  function stopProceduralAmbientOnly() {
    if (ambientSourceNode) {
      try {
        ambientSourceNode.stop();
        ambientSourceNode.disconnect();
      } catch (_) {}
      ambientSourceNode = null;
    }
  }

  function stopAmbientSound() {
    stopProceduralAmbientOnly();
    if (ambientAudioEl) {
      try {
        ambientAudioEl.pause();
        ambientAudioEl.currentTime = 0;
      } catch (_) {}
      ambientAudioEl = null;
    }
  }

  // Safari & Cross-Browser Offline Audio Cache Helper + Strict Real Duration Loader (Fixes v2-3: NO fake 6.0s!)
  async function loadSingleAyahAudio(surahNo, ayahNo, reciterId) {
    const padS = String(surahNo).padStart(3, "0");
    const padA = String(ayahNo).padStart(3, "0");
    const remoteUrl = `https://everyayah.com/data/${reciterId}/${padS}${padA}.mp3`;
    let playUrl = remoteUrl;
    let objectUrl = null;

    // Check Cache API first for Safari offline reliability, or fetch with CORS to cache blob
    if ("caches" in window) {
      try {
        const cache = await caches.open("tilawah-audio-7.0.0");
        let cachedRes = await cache.match(remoteUrl);
        if (!cachedRes) {
          const netRes = await fetch(remoteUrl, { mode: "cors" });
          if (netRes && netRes.ok) {
            await cache.put(remoteUrl, netRes.clone());
            cachedRes = netRes;
          }
        }
        if (cachedRes && cachedRes.ok) {
          const blob = await cachedRes.blob();
          if (blob && blob.size > 512) {
            objectUrl = URL.createObjectURL(blob);
            playUrl = objectUrl;
          }
        }
      } catch (_) {
        // Fallback to direct Audio element with crossOrigin
      }
    }

    return new Promise((resolve) => {
      const aud = new Audio();
      if (!objectUrl) aud.crossOrigin = "anonymous";
      aud.preload = "auto";
      aud.src = playUrl;

      let settled = false;
      const finish = (result) => {
        if (settled) return;
        settled = true;
        clearTimeout(timeoutId);
        resolve(result);
      };

      const timeoutId = setTimeout(() => {
        finish({
          ayahNo,
          ok: false,
          audio: aud,
          objectUrl,
          duration: 0,
          error: `${surahNo}:${ayahNo}. ayet ses bağlantısı zaman aşımına uğradı (9 sn).`
        });
      }, 9000);

      aud.onloadedmetadata = () => {
        const d = aud.duration;
        if (Number.isFinite(d) && d > 0.15) {
          finish({
            ayahNo,
            ok: true,
            audio: aud,
            objectUrl,
            duration: d,
            error: null
          });
        } else {
          finish({
            ayahNo,
            ok: false,
            audio: aud,
            objectUrl,
            duration: 0,
            error: `${surahNo}:${ayahNo}. ayet ses süresi geçersiz.`
          });
        }
      };

      aud.onerror = () => {
        finish({
          ayahNo,
          ok: false,
          audio: aud,
          objectUrl,
          duration: 0,
          error: `${surahNo}:${ayahNo}. ayet MP3 dosyası yüklenemedi (CORS veya çevrimdışı).`
        });
      };
    });
  }

  return {
    ensureAudioGraph,
    connectBgVideoToGraph,
    updateVolumes,
    triggerSmoothFadeOut,
    resetMasterGain,
    startAmbientSound,
    stopAmbientSound,
    loadSingleAyahAudio
  };
})();

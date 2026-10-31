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

    (state.audioElements || []).forEach((aud) => {
      if (aud && !connectedNodes.has(aud)) {
        try {
          const src = audioCtx.createMediaElementSource(aud);
          src.connect(reciterGain);
          connectedNodes.set(aud, src);
        } catch (_) {}
      }
    });

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
    videoEl.volume = 1.0;
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
    if (!audioCtx || !state.ambientType || state.ambientType === "none" || state.ambientVol <= 0) return;

    const fileMap = {
      rain: "media/audio/rain.mp3",
      forest_rain: "media/audio/rain.mp3",
      wind: "media/audio/wind.mp3",
      tree_wind: "media/audio/wind.mp3",
      pine_wind: "media/audio/wind.mp3",
      ney: "media/audio/ney.mp3"
    };
    const fileSrc = fileMap[state.ambientType];

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

  // Synthesizes all 10 Sebat ambient sound profiles (Kırda yağmur, Koruda yağmur, Dere, Bozkır/Ağaç/Çam rüzgârı, Ocak şömine çıtırtısı, Dalga, Gece, Ney)
  function startProceduralAmbient(type) {
    if (!audioCtx) return;
    const sampleRate = audioCtx.sampleRate;
    const bufferSize = sampleRate * 5;
    const buffer = audioCtx.createBuffer(1, bufferSize, sampleRate);
    const data = buffer.getChannelData(0);

    if (type === "ney" || type === "night") {
      const baseFreq = type === "night" ? 174 : 216;
      for (let i = 0; i < bufferSize; i++) {
        const t = i / sampleRate;
        const env = 0.72 + 0.28 * Math.sin(2 * Math.PI * 0.2 * t);
        const w1 = Math.sin(2 * Math.PI * baseFreq * t) * 0.5;
        const w2 = Math.sin(2 * Math.PI * (baseFreq * 1.5) * t) * 0.22;
        const softAir = (Math.random() * 2 - 1) * 0.02;
        data[i] = ((w1 + w2) * env + softAir) * 0.26;
      }
    } else if (type === "fireplace") {
      // Warm low hearth rumble + periodic wood crackle impulses
      let last = 0;
      for (let i = 0; i < bufferSize; i++) {
        const white = Math.random() * 2 - 1;
        last = (last + 0.03 * white) / 1.03;
        const crackle = Math.random() < 0.0018 ? (Math.random() * 0.9) : 0;
        data[i] = last * 0.35 + crackle * 0.45;
      }
    } else if (type === "waves") {
      // Rhythmic ocean surf (5s wave cycle)
      let b0 = 0, b1 = 0;
      for (let i = 0; i < bufferSize; i++) {
        const t = i / sampleRate;
        const swell = 0.25 + 0.75 * Math.pow(0.5 + 0.5 * Math.sin((2 * Math.PI * t) / 5.0), 1.6);
        const white = Math.random() * 2 - 1;
        b0 = 0.99 * b0 + white * 0.08;
        b1 = 0.96 * b1 + b0 * 0.12;
        data[i] = b1 * swell * 0.22;
      }
    } else if (type === "stream") {
      // Babbling brook water modulation
      let b0 = 0;
      for (let i = 0; i < bufferSize; i++) {
        const t = i / sampleRate;
        const ripple = 0.65 + 0.35 * Math.sin(2 * Math.PI * 3.2 * t) * Math.cos(2 * Math.PI * 1.7 * t);
        const white = Math.random() * 2 - 1;
        b0 = 0.94 * b0 + white * 0.14;
        data[i] = b0 * ripple * 0.22;
      }
    } else {
      // Rain & Wind varieties
      let b0 = 0, b1 = 0, b2 = 0, b3 = 0, b4 = 0, b5 = 0, b6 = 0;
      for (let i = 0; i < bufferSize; i++) {
        const t = i / sampleRate;
        const white = Math.random() * 2 - 1;
        b0 = 0.99886 * b0 + white * 0.0555179;
        b1 = 0.99332 * b1 + white * 0.0750759;
        b2 = 0.96900 * b2 + white * 0.1538520;
        b3 = 0.86650 * b3 + white * 0.3104856;
        b4 = 0.55000 * b4 + white * 0.5329522;
        b5 = -0.7616 * b5 - white * 0.0168980;
        const windMod = type.includes("wind") ? (0.65 + 0.35 * Math.sin(2 * Math.PI * 0.25 * t)) : 1.0;
        data[i] = (b0 + b1 + b2 + b3 + b4 + b5 + b6 + white * 0.5362) * 0.035 * windMod;
        b6 = white * 0.115926;
      }
    }

    const src = audioCtx.createBufferSource();
    src.buffer = buffer;
    src.loop = true;

    const filter = audioCtx.createBiquadFilter();
    const freqMap = {
      rain: 1050,
      forest_rain: 780,
      stream: 1250,
      wind: 360,
      tree_wind: 520,
      pine_wind: 310,
      fireplace: 680,
      waves: 480,
      night: 440,
      ney: 520
    };
    filter.type = (type === "rain" || type === "stream") ? "bandpass" : "lowpass";
    filter.frequency.value = freqMap[type] || 650;
    filter.Q.value = 0.7;

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

  async function loadSingleAyahAudio(surahNo, ayahNo, reciterId) {
    const padS = String(surahNo).padStart(3, "0");
    const padA = String(ayahNo).padStart(3, "0");
    const remoteUrl = `https://everyayah.com/data/${reciterId}/${padS}${padA}.mp3`;
    let playUrl = remoteUrl;
    let objectUrl = null;

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
      } catch (_) {}
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
          error: `${surahNo}:${ayahNo}. ayet MP3 dosyası yüklenemedi.`
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

"use strict";

window.TW_SCENES = (() => {
  const MAX_PARTICLES = 110;
  const particles = [];

  for (let i = 0; i < MAX_PARTICLES; i++) {
    particles.push({
      x: Math.random(),
      y: Math.random(),
      r: 1 + Math.random() * 2.6,
      vx: (Math.random() - 0.5) * 0.04,
      vy: 0.05 + Math.random() * 0.18,
      alpha: 0.2 + Math.random() * 0.75,
      phase: Math.random() * Math.PI * 2
    });
  }

  function stepParticles(dt, type, t) {
    for (let i = 0; i < particles.length; i++) {
      const p = particles[i];
      if (type === "rain") {
        p.y += dt * (0.85 + p.vy * 2.4);
        p.x -= dt * 0.09;
      } else if (type === "snow") {
        p.y += dt * (0.08 + p.vy * 0.35);
        p.x += Math.sin(t * 1.2 + p.phase) * dt * 0.04;
      } else if (type === "sparks") {
        p.y -= dt * (0.14 + p.vy * 0.55);
        p.x += Math.sin(t * 2.4 + p.phase) * dt * 0.06;
      } else if (type === "dust") {
        p.y -= dt * (0.025 + p.vy * 0.08);
        p.x += Math.cos(t * 0.7 + p.phase) * dt * 0.02;
      } else if (type === "stars") {
        p.x += p.vx * dt * 0.12;
      }

      if (p.y > 1.06) { p.y = -0.05; p.x = Math.random(); }
      if (p.y < -0.06) { p.y = 1.05; p.x = Math.random(); }
      if (p.x > 1.06) p.x = -0.04;
      if (p.x < -0.06) p.x = 1.04;
    }
  }

  // Clean, Pure Studio Backdrop (Zero geometric/cartoon shapes — used when no Galerim video is active)
  function drawProceduralScene(ctx, w, h, t, dt, item, activeStyle) {
    const palette = (activeStyle && activeStyle.palette) || (item && item.palette) || ["#07080A", "#10131A", "#E0B84C"];

    const bgGrad = ctx.createLinearGradient(0, 0, 0, h);
    bgGrad.addColorStop(0, palette[0] || "#07080A");
    bgGrad.addColorStop(0.5, palette[1] || "#10131A");
    bgGrad.addColorStop(1, palette[0] || "#07080A");
    ctx.fillStyle = bgGrad;
    ctx.fillRect(0, 0, w, h);

    // Subtle, calm studio ambient light in the center (no shapes or lines)
    const breathe = 0.92 + 0.08 * Math.sin(t * 0.6);
    const ambGlow = ctx.createRadialGradient(w * 0.5, h * 0.48, 10, w * 0.5, h * 0.48, Math.max(w, h) * 0.58 * breathe);
    ambGlow.addColorStop(0, (palette[2] || "#E0B84C") + "14");
    ambGlow.addColorStop(1, "transparent");
    ctx.fillStyle = ambGlow;
    ctx.fillRect(0, 0, w, h);
  }

  function drawVisualEffectOverlay(ctx, w, h, t, dt, state) {
    const eff = state.visualEffect;
    if (!eff || eff === "none") return;

    stepParticles(dt, eff, t);
    const count = Math.floor((state.effectIntensity / 100) * particles.length);
    const scale = Math.min(w, h) / 720;
    ctx.save();

    for (let i = 0; i < count; i++) {
      const p = particles[i];
      if (eff === "rain") {
        ctx.strokeStyle = `rgba(205, 230, 255, ${p.alpha * 0.58})`;
        ctx.lineWidth = 1.4 * scale;
        ctx.beginPath();
        ctx.moveTo(p.x * w, p.y * h);
        ctx.lineTo(p.x * w - 4 * scale, p.y * h + 24 * scale);
        ctx.stroke();
      } else if (eff === "snow") {
        ctx.fillStyle = `rgba(255, 255, 255, ${p.alpha * 0.82})`;
        ctx.beginPath();
        ctx.arc(p.x * w, p.y * h, p.r * 1.3 * scale, 0, Math.PI * 2);
        ctx.fill();
      } else if (eff === "dust") {
        ctx.fillStyle = `rgba(243, 215, 125, ${p.alpha * 0.68})`;
        ctx.beginPath();
        ctx.arc(p.x * w, p.y * h, p.r * scale, 0, Math.PI * 2);
        ctx.fill();
      } else if (eff === "sparks") {
        ctx.fillStyle = `rgba(251, 146, 60, ${p.alpha * 0.85})`;
        ctx.beginPath();
        ctx.arc(p.x * w, p.y * h, p.r * 1.15 * scale, 0, Math.PI * 2);
        ctx.fill();
      } else if (eff === "stars") {
        const twinkle = 0.25 + 0.75 * Math.abs(Math.sin(t * 1.8 + p.phase));
        ctx.fillStyle = `rgba(255, 250, 220, ${twinkle * 0.85})`;
        ctx.beginPath();
        ctx.arc(p.x * w, p.y * h, p.r * scale, 0, Math.PI * 2);
        ctx.fill();
      }
    }
    ctx.restore();
  }

  let supportsCanvasFilter = null;
  function checkCanvasFilterSupport(ctx) {
    if (supportsCanvasFilter !== null) return supportsCanvasFilter;
    try {
      supportsCanvasFilter = typeof ctx.filter !== "undefined" && !/iPad|iPhone|iPod/.test(navigator.userAgent);
    } catch (_) {
      supportsCanvasFilter = false;
    }
    return supportsCanvasFilter;
  }

  const blurFallbackCanvas = document.createElement("canvas");
  const blurFallbackCtx = blurFallbackCanvas.getContext("2d");

  // Full-bleed edge-clamped Galerim media renderer with Horizontal Mirror & Smooth Trim Loop Transition
  function drawBackgroundMediaWithFilters(ctx, mediaEl, isVideo, w, h, t, state) {
    const mw = isVideo ? (mediaEl.videoWidth || 0) : (mediaEl.naturalWidth || 0);
    const mh = isVideo ? (mediaEl.videoHeight || 0) : (mediaEl.naturalHeight || 0);
    if (mw <= 0 || mh <= 0) return false;
    if (isVideo && mediaEl.readyState < 2) return false;

    const scaleFactor = Math.min(w, h) / 720;
    let zoom = Math.max(1.0, (state.bgZoom || 100) / 100);
    let extraPanX = 0;
    const motion = state.photoMotion || "pan";
    const cycle = (t % 16) / 16;
    const smoothWave = 0.5 - 0.5 * Math.cos(cycle * Math.PI * 2);

    if (!isVideo) {
      if (motion === "zoom_in") {
        zoom *= (1.02 + 0.14 * smoothWave);
      } else if (motion === "zoom_out") {
        zoom *= (1.16 - 0.14 * smoothWave);
      } else if (motion === "pan") {
        zoom *= 1.12;
        extraPanX = Math.sin(t * 0.22) * (w * 0.045);
      }
    }

    const panXFrac = (state.bgPanX || 0) / 100;
    const panYFrac = (state.bgPanY || 0) / 100;
    const minZoomForPan = 1.0 + Math.abs(panXFrac) + Math.abs(panYFrac) + (extraPanX ? 0.09 : 0);
    const effectiveZoom = Math.max(zoom, minZoomForPan);

    const baseScale = Math.max(w / mw, h / mh) * effectiveZoom;
    const dw = Math.ceil(mw * baseScale);
    const dh = Math.ceil(mh * baseScale);

    let dx = (w - dw) / 2 + panXFrac * (dw - w) * 0.5 + extraPanX;
    let dy = (h - dh) / 2 + panYFrac * (dh - h) * 0.5;

    // Hard clamp: dx in [w - dw, 0] and dy in [h - dh, 0] -> zero black edge gaps in 9:16 or any ratio!
    dx = Math.min(0, Math.max(w - dw, dx));
    dy = Math.min(0, Math.max(h - dh, dy));

    const brightnessPct = Math.max(50, Math.min(150, 100 + (state.bgBrightnessOffset || 0)));
    const hasFilter = (state.bgBlur > 0 || brightnessPct !== 100);
    const nativeFilterOk = checkCanvasFilterSupport(ctx);

    ctx.save();
    if (state.bgMirror) {
      ctx.translate(w, 0);
      ctx.scale(-1, 1);
    }

    if (hasFilter && nativeFilterOk) {
      ctx.filter = `blur(${state.bgBlur * scaleFactor}px) brightness(${brightnessPct}%)`;
      ctx.drawImage(mediaEl, dx, dy, dw, dh);
    } else if (hasFilter && !nativeFilterOk) {
      if (state.bgBlur > 0) {
        const downRatio = Math.max(2, Math.min(14, 1 + state.bgBlur * 0.65));
        const sw = Math.max(32, Math.round(w / downRatio));
        const sh = Math.max(32, Math.round(h / downRatio));
        blurFallbackCanvas.width = sw;
        blurFallbackCanvas.height = sh;
        blurFallbackCtx.imageSmoothingEnabled = true;
        blurFallbackCtx.clearRect(0, 0, sw, sh);
        blurFallbackCtx.drawImage(mediaEl, dx / downRatio, dy / downRatio, dw / downRatio, dh / downRatio);
        ctx.imageSmoothingEnabled = true;
        ctx.drawImage(blurFallbackCanvas, 0, 0, sw, sh, 0, 0, w, h);
      } else {
        ctx.drawImage(mediaEl, dx, dy, dw, dh);
      }
      if (brightnessPct < 100) {
        ctx.fillStyle = `rgba(0, 0, 0, ${(100 - brightnessPct) / 100})`;
        ctx.fillRect(0, 0, w, h);
      } else if (brightnessPct > 100) {
        ctx.fillStyle = `rgba(255, 255, 255, ${Math.min(0.5, (brightnessPct - 100) / 100)})`;
        ctx.fillRect(0, 0, w, h);
      }
    } else {
      ctx.drawImage(mediaEl, dx, dy, dw, dh);
    }
    ctx.restore();

    // Smooth loop cross-dim when video wraps around trimEnd -> trimStart
    if (isVideo && state.videoSmoothLoop) {
      const dur = mediaEl.duration || 0;
      const tStart = Math.max(0, Number(state.videoTrimStart) || 0);
      const tEnd = (Number(state.videoTrimEnd) > tStart && dur > 0) ? Math.min(dur, Number(state.videoTrimEnd)) : dur;
      if (tEnd - tStart > 1.5) {
        const cur = mediaEl.currentTime || 0;
        const distToEnd = Math.max(0, tEnd - cur);
        const distFromStart = Math.max(0, cur - tStart);
        const edgeDist = Math.min(distToEnd, distFromStart);
        if (edgeDist < 0.32) {
          const fadeAlpha = ((0.32 - edgeDist) / 0.32) * 0.38;
          ctx.save();
          ctx.fillStyle = `rgba(5, 6, 8, ${fadeAlpha.toFixed(3)})`;
          ctx.fillRect(0, 0, w, h);
          ctx.restore();
        }
      }
    }

    return true;
  }

  function drawFilterWarmthAndCinemaBars(ctx, w, h, state) {
    const warmth = Number(state.bgWarmth) || 0;
    if (warmth !== 0) {
      ctx.save();
      const alpha = Math.min(0.28, Math.abs(warmth) / 180);
      if (warmth > 0) {
        ctx.fillStyle = `rgba(245, 158, 11, ${alpha})`;
      } else {
        ctx.fillStyle = `rgba(56, 189, 248, ${alpha})`;
      }
      ctx.fillRect(0, 0, w, h);
      ctx.restore();
    }
  }

  function drawCinematicVignette(ctx, w, h, enabled = true) {
    if (!enabled) return;
    ctx.save();
    const outerR = Math.hypot(w, h) * 0.58;
    const innerR = Math.min(w, h) * 0.32;
    const vg = ctx.createRadialGradient(w * 0.5, h * 0.5, innerR, w * 0.5, h * 0.5, outerR);
    vg.addColorStop(0, "transparent");
    vg.addColorStop(0.72, "rgba(4, 8, 6, 0.16)");
    vg.addColorStop(1, "rgba(2, 5, 4, 0.45)");
    ctx.fillStyle = vg;
    ctx.fillRect(0, 0, w, h);
    ctx.restore();
  }

  return {
    drawProceduralScene,
    drawVisualEffectOverlay,
    drawBackgroundMediaWithFilters,
    drawFilterWarmthAndCinemaBars,
    drawCinematicVignette
  };
})();

"use strict";

window.TW_SCENES = (() => {
  const particles = Array.from({ length: 140 }, (_, idx) => ({
    x: (idx * 0.6180339887) % 1,
    y: (idx * 0.3819660113) % 1,
    r: 1.0 + (idx % 7) * 0.42,
    vx: ((idx % 5) - 2) * 0.015,
    vy: 0.12 + (idx % 9) * 0.045,
    alpha: 0.25 + ((idx * 17) % 75) / 100,
    phase: (idx * 1.13) % (Math.PI * 2)
  }));

  const glassDrops = Array.from({ length: 36 }, (_, idx) => ({
    x: ((idx * 37) % 100) / 100,
    y: ((idx * 53) % 100) / 100,
    r: 2.2 + (idx % 4) * 1.3,
    speed: 0.03 + (idx % 5) * 0.018,
    wobble: idx * 0.7
  }));

  const blurFallbackCanvas = document.createElement("canvas");
  const blurFallbackCtx = blurFallbackCanvas.getContext("2d");

  let supportsCanvasFilter = null;
  function checkCanvasFilterSupport(ctx) {
    if (supportsCanvasFilter !== null) return supportsCanvasFilter;
    try {
      if (typeof ctx.filter === "undefined") {
        supportsCanvasFilter = false;
      } else {
        ctx.filter = "blur(1px)";
        supportsCanvasFilter = (ctx.filter === "blur(1px)");
        ctx.filter = "none";
      }
    } catch (_) {
      supportsCanvasFilter = false;
    }
    return supportsCanvasFilter;
  }

  function stepParticles(dt, eff, t) {
    const safeDt = Math.max(0.001, Math.min(0.05, dt || 0.016));
    for (let i = 0; i < particles.length; i++) {
      const p = particles[i];
      if (eff === "rain") {
        p.y = (p.y + p.vy * 3.8 * safeDt) % 1;
        p.x = (p.x - 0.06 * safeDt + 1) % 1;
      } else if (eff === "snow") {
        p.y = (p.y + p.vy * 0.75 * safeDt) % 1;
        p.x = (p.x + Math.sin(t + p.phase) * 0.05 * safeDt + 1) % 1;
      } else if (eff === "dust") {
        p.y = (p.y - p.vy * 0.35 * safeDt + 1) % 1;
        p.x = (p.x + Math.cos(t * 0.7 + p.phase) * 0.04 * safeDt + 1) % 1;
      } else if (eff === "sparks") {
        p.y = (p.y - p.vy * 1.15 * safeDt + 1) % 1;
        p.x = (p.x + Math.sin(t * 2 + p.phase) * 0.08 * safeDt + 1) % 1;
      }
    }
    for (let i = 0; i < glassDrops.length; i++) {
      const d = glassDrops[i];
      d.y = (d.y + d.speed * safeDt) % 1;
    }
  }

  function drawRainStreaksAndDrops(ctx, w, h, t, dt, withGlassDrops = true, density = 75) {
    stepParticles(dt, "rain", t);
    ctx.save();
    ctx.strokeStyle = "rgba(205, 230, 255, 0.42)";
    ctx.lineWidth = Math.max(1.2, w * 0.002);
    for (let i = 0; i < Math.min(density, particles.length); i++) {
      const p = particles[i];
      const rx = ((p.x * w - t * 38) % w + w) % w;
      const ry = ((p.y * h + t * (480 + (i % 5) * 90)) % h);
      const len = 24 + (i % 4) * 10;
      ctx.beginPath();
      ctx.moveTo(rx, ry);
      ctx.lineTo(rx - 4, ry + len);
      ctx.stroke();
    }
    if (withGlassDrops) {
      for (let i = 0; i < glassDrops.length; i++) {
        const d = glassDrops[i];
        const gx = (d.x + Math.sin(t * 1.4 + d.wobble) * 0.006) * w;
        const gy = ((d.y + t * d.speed) % 1) * h;
        const trailGrad = ctx.createLinearGradient(gx, gy - 28, gx, gy);
        trailGrad.addColorStop(0, "transparent");
        trailGrad.addColorStop(1, "rgba(220, 240, 255, 0.35)");
        ctx.strokeStyle = trailGrad;
        ctx.lineWidth = d.r * 0.9;
        ctx.beginPath();
        ctx.moveTo(gx, gy - 26);
        ctx.lineTo(gx, gy);
        ctx.stroke();
        ctx.fillStyle = "rgba(235, 248, 255, 0.68)";
        ctx.beginPath();
        ctx.arc(gx, gy, d.r, 0, Math.PI * 2);
        ctx.fill();
      }
    }
    ctx.restore();
  }

  function drawProceduralScene(ctx, w, h, t, dt, item) {
    const palette = (item && item.palette) || ["#0a111a", "#172536", "#d8b456"];
    const scene = (item && item.scene) || "rain_bokeh";

    const bgGrad = ctx.createLinearGradient(0, 0, 0, h);
    bgGrad.addColorStop(0, palette[0]);
    bgGrad.addColorStop(0.58, palette[1]);
    bgGrad.addColorStop(1, "#040706");
    ctx.fillStyle = bgGrad;
    ctx.fillRect(0, 0, w, h);

    ctx.save();

    switch (scene) {
      case "fire_hearth": {
        // Ocak Başı / Şömine: Warm flickering hearth glow at bottom + rising embers
        const flick = 0.85 + 0.15 * Math.sin(t * 7.5) * Math.cos(t * 4.2);
        const fg = ctx.createRadialGradient(w * 0.5, h * 0.88, 10, w * 0.5, h * 0.82, Math.max(w, h) * 0.55 * flick);
        fg.addColorStop(0, "rgba(251, 146, 60, 0.72)");
        fg.addColorStop(0.4, "rgba(234, 88, 12, 0.32)");
        fg.addColorStop(1, "transparent");
        ctx.fillStyle = fg;
        ctx.fillRect(0, 0, w, h);

        // Soft flames silhouette at bottom center
        for (let f = 0; f < 9; f++) {
          const fx = w * (0.32 + f * 0.045) + Math.sin(t * 5 + f) * 8;
          const fh = (45 + (f % 3) * 28 + Math.sin(t * 6.5 + f * 1.3) * 16) * (h / 1280);
          const flameG = ctx.createLinearGradient(fx, h * 0.9, fx, h * 0.9 - fh);
          flameG.addColorStop(0, "rgba(254, 240, 138, 0.75)");
          flameG.addColorStop(0.6, "rgba(249, 115, 22, 0.45)");
          flameG.addColorStop(1, "transparent");
          ctx.fillStyle = flameG;
          ctx.beginPath();
          ctx.ellipse(fx, h * 0.88 - fh * 0.3, 18 * (w / 720), fh * 0.65, 0, 0, Math.PI * 2);
          ctx.fill();
        }
        break;
      }

      case "winter_pines": {
        // Karlı Çamlar: Layered snow-covered pine silhouettes + gentle snowfall
        for (let row = 0; row < 3; row++) {
          const baseY = h * (0.64 + row * 0.12);
          ctx.fillStyle = row === 0 ? "#132638" : row === 1 ? "#0c1b29" : "#07111a";
          for (let p = 0; p < 7; p++) {
            const px = (p / 6) * w + (row % 2) * 35;
            const treeH = (160 + (p % 3) * 45) * (h / 1280);
            const treeW = 55 * (w / 720);
            ctx.beginPath();
            ctx.moveTo(px, baseY - treeH);
            ctx.lineTo(px - treeW, baseY);
            ctx.lineTo(px + treeW, baseY);
            ctx.closePath();
            ctx.fill();
          }
        }
        break;
      }

      case "above_clouds": {
        // Bulutların Üstü: Golden horizon + billowing cloud sea below
        const sunG = ctx.createRadialGradient(w * 0.5, h * 0.42, 10, w * 0.5, h * 0.42, w * 0.65);
        sunG.addColorStop(0, "rgba(253, 230, 138, 0.48)");
        sunG.addColorStop(1, "transparent");
        ctx.fillStyle = sunG;
        ctx.fillRect(0, 0, w, h);

        for (let c = 0; c < 14; c++) {
          const cx = (((c * 73) % 100) / 100) * w + Math.sin(t * 0.25 + c) * 24;
          const cy = h * (0.58 + (c % 4) * 0.08);
          const cr = (75 + (c % 3) * 35) * (w / 720);
          const cg = ctx.createRadialGradient(cx, cy, 5, cx, cy, cr);
          cg.addColorStop(0, "rgba(241, 245, 249, 0.24)");
          cg.addColorStop(1, "transparent");
          ctx.fillStyle = cg;
          ctx.beginPath();
          ctx.arc(cx, cy, cr, 0, Math.PI * 2);
          ctx.fill();
        }
        break;
      }

      case "stained_glass": {
        // Revzen Işığı: Colorful Ottoman stained glass light beams
        const colors = ["#f472b6", "#38bdf8", "#fbbf24", "#34d399"];
        for (let i = 0; i < 4; i++) {
          const gx = w * (0.2 + i * 0.2);
          const gy = h * 0.24 + Math.sin(t * 0.5 + i) * 15;
          const rg = ctx.createLinearGradient(gx, gy, gx + 60, h * 0.85);
          rg.addColorStop(0, colors[i] + "44");
          rg.addColorStop(1, "transparent");
          ctx.fillStyle = rg;
          ctx.beginPath();
          ctx.moveTo(gx - 22, gy);
          ctx.lineTo(gx + 22, gy);
          ctx.lineTo(gx + 95, h * 0.85);
          ctx.lineTo(gx - 35, h * 0.85);
          ctx.closePath();
          ctx.fill();
        }
        break;
      }

      case "water_ripples": {
        // Su Halkaları: Expanding concentric turquoise water rings
        ctx.strokeStyle = palette[2] + "38";
        ctx.lineWidth = 2;
        for (let r = 0; r < 7; r++) {
          const prog = (t * 0.35 + r * 0.14) % 1;
          const rad = prog * Math.min(w, h) * 0.48;
          ctx.globalAlpha = 1 - prog;
          ctx.beginPath();
          ctx.arc(w * 0.5, h * 0.5, rad, 0, Math.PI * 2);
          ctx.stroke();
        }
        ctx.globalAlpha = 1;
        break;
      }

      case "rahle_glow": {
        // Rahle & Seccade Huzuru: Warm golden reading light + subtle X-shaped rahle silhouette
        const rg = ctx.createRadialGradient(w * 0.5, h * 0.65, 10, w * 0.5, h * 0.65, w * 0.55);
        rg.addColorStop(0, "rgba(234, 179, 8, 0.36)");
        rg.addColorStop(1, "transparent");
        ctx.fillStyle = rg;
        ctx.fillRect(0, 0, w, h);

        ctx.strokeStyle = "rgba(216, 180, 86, 0.28)";
        ctx.lineWidth = 4 * (w / 720);
        ctx.beginPath();
        ctx.moveTo(w * 0.36, h * 0.82);
        ctx.lineTo(w * 0.64, h * 0.68);
        ctx.moveTo(w * 0.64, h * 0.82);
        ctx.lineTo(w * 0.36, h * 0.68);
        ctx.stroke();
        break;
      }

      case "cypress_dawn": {
        // Selvi & Şafak: Slender cypress silhouette against warm dawn horizon
        const dg = ctx.createLinearGradient(0, h * 0.35, 0, h * 0.85);
        dg.addColorStop(0, "transparent");
        dg.addColorStop(0.6, "rgba(245, 158, 11, 0.32)");
        dg.addColorStop(1, "#05080c");
        ctx.fillStyle = dg;
        ctx.fillRect(0, h * 0.35, w, h * 0.5);

        ctx.fillStyle = "#05080d";
        ctx.beginPath();
        ctx.moveTo(w * 0.24, h * 0.32);
        ctx.quadraticCurveTo(w * 0.20, h * 0.6, w * 0.22, h * 0.88);
        ctx.lineTo(w * 0.26, h * 0.88);
        ctx.quadraticCurveTo(w * 0.28, h * 0.6, w * 0.24, h * 0.32);
        ctx.fill();
        break;
      }

      case "rain_bokeh": {
        for (let i = 0; i < 22; i++) {
          const bx = (((i * 137.5) % 100) / 100) * w + Math.sin(t * 0.35 + i) * 20;
          const by = (0.18 + ((i * 61.3) % 70) / 100) * h + Math.cos(t * 0.25 + i) * 14;
          const br = (22 + (i % 6) * 18) * (w / 720);
          const col = i % 3 === 0 ? "#f59e0b" : i % 3 === 1 ? palette[2] : "#60a5fa";
          const g = ctx.createRadialGradient(bx, by, 2, bx, by, br);
          g.addColorStop(0, col + "44");
          g.addColorStop(0.6, col + "18");
          g.addColorStop(1, "transparent");
          ctx.fillStyle = g;
          ctx.beginPath();
          ctx.arc(bx, by, br, 0, Math.PI * 2);
          ctx.fill();
        }
        drawRainStreaksAndDrops(ctx, w, h, t, dt, true, 90);
        break;
      }

      case "rain_emerald": {
        for (let i = 0; i < 4; i++) {
          const my = h * (0.35 + i * 0.16) + Math.sin(t * 0.5 + i) * 24;
          const mg = ctx.createRadialGradient(w * (0.3 + 0.15 * i), my, 10, w * 0.5, my, w * 0.65);
          mg.addColorStop(0, palette[2] + "32");
          mg.addColorStop(1, "transparent");
          ctx.fillStyle = mg;
          ctx.fillRect(0, my - 140, w, 280);
        }
        drawRainStreaksAndDrops(ctx, w, h, t, dt, false, 80);
        break;
      }

      case "rain_amber": {
        for (let lamp = 0; lamp < 2; lamp++) {
          const lx = w * (0.25 + lamp * 0.5);
          const ly = h * 0.12;
          const cone = ctx.createRadialGradient(lx, ly, 4, lx, ly + h * 0.4, w * 0.55);
          cone.addColorStop(0, "#fbbf2466");
          cone.addColorStop(0.5, "#f59e0b22");
          cone.addColorStop(1, "transparent");
          ctx.fillStyle = cone;
          ctx.fillRect(0, 0, w, h);
        }
        drawRainStreaksAndDrops(ctx, w, h, t, dt, true, 70);
        break;
      }

      case "rain_blue": {
        drawRainStreaksAndDrops(ctx, w, h, t, dt, false, 110);
        break;
      }

      case "aurora": {
        for (let i = 0; i < 4; i++) {
          const yOff = h * (0.18 + i * 0.11) + Math.sin(t * 0.65 + i) * 32;
          const g = ctx.createLinearGradient(0, yOff - 110, w, yOff + 130);
          g.addColorStop(0, "transparent");
          g.addColorStop(0.35, palette[2] + "48");
          g.addColorStop(0.7, "#38bdf838");
          g.addColorStop(1, "transparent");
          ctx.fillStyle = g;
          ctx.beginPath();
          ctx.moveTo(0, yOff);
          ctx.bezierCurveTo(
            w * 0.3, yOff - 85 * Math.sin(t * 0.5 + i),
            w * 0.7, yOff + 85 * Math.cos(t * 0.42 + i),
            w, yOff
          );
          ctx.lineTo(w, yOff + 170);
          ctx.lineTo(0, yOff + 170);
          ctx.closePath();
          ctx.fill();
        }
        break;
      }

      case "deep_stars": {
        for (let i = 0; i < 95; i++) {
          const sx = ((i * 131.7) % 100) / 100 * w;
          const sy = (((i * 79.3) % 100) / 100 * h - t * (4 + (i % 4) * 3) + h * 10) % h;
          const r = 0.8 + (i % 4) * 0.65;
          const tw = 0.35 + 0.65 * Math.abs(Math.sin(t * 2.1 + i));
          ctx.fillStyle = `rgba(225, 240, 255, ${tw})`;
          ctx.beginPath();
          ctx.arc(sx, sy, r, 0, Math.PI * 2);
          ctx.fill();
        }
        break;
      }

      case "moon_sea": {
        const moonY = h * 0.22;
        ctx.fillStyle = "#f8fafc";
        ctx.beginPath();
        ctx.arc(w * 0.5, moonY, w * 0.065, 0, Math.PI * 2);
        ctx.fill();
        for (let i = 0; i < 8; i++) {
          const wy = h * 0.56 + i * (h * 0.055);
          ctx.fillStyle = palette[2] + "1a";
          ctx.beginPath();
          ctx.moveTo(0, wy);
          for (let x = 0; x <= w; x += 32) {
            ctx.lineTo(x, wy + Math.sin(x * 0.018 + t * 1.4 + i) * 9);
          }
          ctx.lineTo(w, h);
          ctx.lineTo(0, h);
          ctx.closePath();
          ctx.fill();
        }
        break;
      }

      case "nebula_dust": {
        for (let i = 0; i < 85; i++) {
          const angle = i * 0.35 + t * 0.06;
          const dist = ((i * 19) % 100) / 100 * (w * 0.58);
          const sx = w * 0.5 + Math.cos(angle) * dist;
          const sy = h * 0.48 + Math.sin(angle * 1.2) * (dist * 1.35);
          const tw = 0.3 + 0.7 * Math.abs(Math.sin(t * 1.7 + i));
          ctx.fillStyle = `rgba(243, 215, 125, ${tw * 0.85})`;
          ctx.beginPath();
          ctx.arc(sx, sy, 1 + (i % 3) * 0.8, 0, Math.PI * 2);
          ctx.fill();
        }
        break;
      }

      case "mist_flow": {
        for (let m = 0; m < 3; m++) {
          const baseH = h * (0.48 + m * 0.14);
          ctx.fillStyle = m === 0 ? palette[1] : m === 1 ? "#0c221b" : "#06120e";
          ctx.beginPath();
          ctx.moveTo(0, h);
          for (let x = 0; x <= w; x += 40) {
            const peak = Math.sin(x * 0.005 + m * 2.1) * 55 + Math.cos(x * 0.012 - m) * 28;
            ctx.lineTo(x, baseH + peak);
          }
          ctx.lineTo(w, h);
          ctx.closePath();
          ctx.fill();
        }
        break;
      }

      case "light_rays": {
        for (let r = 0; r < 6; r++) {
          const topX = w * (0.1 + r * 0.16) + Math.sin(t * 0.4 + r) * 22;
          const botX = topX + w * 0.28;
          const rg = ctx.createLinearGradient(topX, 0, botX, h * 0.85);
          rg.addColorStop(0, palette[2] + "40");
          rg.addColorStop(0.65, palette[2] + "14");
          rg.addColorStop(1, "transparent");
          ctx.fillStyle = rg;
          ctx.beginPath();
          ctx.moveTo(topX - 24, 0);
          ctx.lineTo(topX + 36, 0);
          ctx.lineTo(botX + 85, h * 0.9);
          ctx.lineTo(botX - 55, h * 0.9);
          ctx.closePath();
          ctx.fill();
        }
        break;
      }

      case "autumn_leaves": {
        for (let i = 0; i < 32; i++) {
          const lx = (((i * 71) % 100) / 100 * w + Math.sin(t * 0.9 + i) * 38 + w) % w;
          const ly = (((i * 53) % 100) / 100 * h + t * (32 + (i % 5) * 8)) % h;
          ctx.save();
          ctx.translate(lx, ly);
          ctx.rotate(t * 1.2 + i);
          ctx.fillStyle = i % 2 === 0 ? "rgba(251, 146, 60, 0.55)" : "rgba(234, 179, 8, 0.48)";
          ctx.beginPath();
          ctx.ellipse(0, 0, 7 * (w / 720), 3.5 * (w / 720), 0, 0, Math.PI * 2);
          ctx.fill();
          ctx.restore();
        }
        break;
      }

      case "emerald_valley":
      case "calm_waves":
      case "sunset_sky":
      case "horizon_glow":
      case "deep_ocean": {
        for (let i = 0; i < 7; i++) {
          const wy = h * 0.52 + i * (h * 0.068);
          ctx.fillStyle = palette[2] + "1c";
          ctx.beginPath();
          ctx.moveTo(0, wy);
          for (let x = 0; x <= w; x += 36) {
            ctx.lineTo(x, wy + Math.sin(x * 0.015 + t * 1.15 + i * 0.8) * 13);
          }
          ctx.lineTo(w, h);
          ctx.lineTo(0, h);
          ctx.closePath();
          ctx.fill();
        }
        break;
      }

      case "arch_glow":
      case "dome_rays":
      case "kandil_bokeh":
      case "medina_green": {
        const rad = ctx.createRadialGradient(w / 2, h * 0.34, 10, w / 2, h * 0.34, w * 0.65);
        rad.addColorStop(0, palette[2] + "55");
        rad.addColorStop(1, "transparent");
        ctx.fillStyle = rad;
        ctx.fillRect(0, 0, w, h);

        ctx.strokeStyle = palette[2] + "55";
        ctx.lineWidth = 3 * (w / 720);
        ctx.beginPath();
        ctx.moveTo(w * 0.15, h * 0.86);
        ctx.lineTo(w * 0.15, h * 0.38);
        ctx.quadraticCurveTo(w * 0.15, h * 0.15, w * 0.5, h * 0.09);
        ctx.quadraticCurveTo(w * 0.85, h * 0.15, w * 0.85, h * 0.38);
        ctx.lineTo(w * 0.85, h * 0.86);
        ctx.stroke();
        break;
      }

      case "islamic_geo":
      case "seljuk_tile": {
        ctx.translate(w / 2, h / 2);
        const radius = Math.min(w, h) * 0.36;
        ctx.rotate(t * 0.045);
        ctx.strokeStyle = palette[2] + "32";
        ctx.lineWidth = 2 * (w / 720);
        for (let i = 0; i < 12; i++) {
          ctx.save();
          ctx.rotate((i * Math.PI) / 6);
          ctx.strokeRect(-radius / 2, -radius / 2, radius, radius);
          ctx.restore();
        }
        break;
      }

      case "velvet_gold":
      case "silk_waves":
      default: {
        for (let wv = 0; wv < 8; wv++) {
          const baseY = h * (0.25 + wv * 0.075);
          ctx.strokeStyle = palette[2] + (wv % 2 === 0 ? "32" : "1c");
          ctx.lineWidth = (2.2 + (wv % 3)) * (w / 720);
          ctx.beginPath();
          ctx.moveTo(0, baseY + Math.sin(t * 0.6 + wv) * 30);
          ctx.bezierCurveTo(
            w * 0.33, baseY - Math.cos(t * 0.5 + wv * 0.7) * 65,
            w * 0.66, baseY + Math.sin(t * 0.45 + wv * 0.9) * 65,
            w, baseY - Math.sin(t * 0.55 + wv) * 30
          );
          ctx.stroke();
        }
        break;
      }
    }

    ctx.restore();
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

  // Supports Sebat's 4 Photo Motion modes: Durgun (still), Yaklaş (zoom_in), Uzaklaş (zoom_out), Kaydır (pan)
  function drawBackgroundMediaWithFilters(ctx, mediaEl, isVideo, w, h, t, state) {
    const scaleFactor = Math.min(w, h) / 720;
    const mw = isVideo ? (mediaEl.videoWidth || 720) : (mediaEl.naturalWidth || 720);
    const mh = isVideo ? (mediaEl.videoHeight || 1280) : (mediaEl.naturalHeight || 1280);

    let zoom = (state.bgZoom || 100) / 100;
    let extraPanX = 0;
    const motion = state.photoMotion || "pan";
    const cycle = (t % 16) / 16; // 16s smooth cycle
    const smoothWave = 0.5 - 0.5 * Math.cos(cycle * Math.PI * 2);

    if (!isVideo) {
      if (motion === "zoom_in") {
        zoom *= (1.0 + 0.14 * smoothWave);
      } else if (motion === "zoom_out") {
        zoom *= (1.16 - 0.14 * smoothWave);
      } else if (motion === "pan") {
        zoom *= 1.10;
        extraPanX = Math.sin(t * 0.22) * (w * 0.045);
      }
    }

    const baseScale = Math.max(w / mw, h / mh) * zoom;
    const dw = mw * baseScale;
    const dh = mh * baseScale;
    const dx = (w - dw) / 2 + ((state.bgPanX || 0) / 100) * w * 0.5 + extraPanX;
    const dy = (h - dh) / 2 + ((state.bgPanY || 0) / 100) * h * 0.5;

    const brightnessPct = Math.max(50, Math.min(150, 100 + (state.bgBrightnessOffset || 0)));
    const hasFilter = (state.bgBlur > 0 || brightnessPct !== 100);
    const nativeFilterOk = checkCanvasFilterSupport(ctx);

    ctx.save();
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
  }

  // Sebat Filter: Color Warmth (-50 cool blue .. +50 warm amber) & Cinema Letterbox Bars
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

    if (state.cinemaBars) {
      ctx.save();
      const barH = Math.round(h * 0.085);
      ctx.fillStyle = "#000000";
      ctx.fillRect(0, 0, w, barH);
      ctx.fillRect(0, h - barH, w, barH);
      ctx.restore();
    }
  }

  function drawCinematicVignette(ctx, w, h, enabled = true) {
    if (!enabled) return;
    ctx.save();
    const outerR = Math.hypot(w, h) * 0.56;
    const innerR = Math.min(w, h) * 0.28;
    const vg = ctx.createRadialGradient(w * 0.5, h * 0.5, innerR, w * 0.5, h * 0.5, outerR);
    vg.addColorStop(0, "transparent");
    vg.addColorStop(0.7, "rgba(4, 8, 6, 0.22)");
    vg.addColorStop(1, "rgba(2, 5, 4, 0.62)");
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

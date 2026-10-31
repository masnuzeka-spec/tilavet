"use strict";

window.TW_SCENES = (() => {
  // Pre-allocated particle pools updated via delta-time (dt) so 60Hz, 120Hz, and offline renders match 100%
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

  // Offscreen canvas for iOS Safari blur fallback when ctx.filter is unsupported
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

  function drawRainStreaksAndDrops(ctx, w, h, t, dt, colorHex = "#93c5fd", withGlassDrops = true, density = 75) {
    stepParticles(dt, "rain", t);
    ctx.save();
    // Falling rain streaks
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
    // Trickling drops on window glass ("Gece Camda Rahmet")
    if (withGlassDrops) {
      for (let i = 0; i < glassDrops.length; i++) {
        const d = glassDrops[i];
        const gx = (d.x + Math.sin(t * 1.4 + d.wobble) * 0.006) * w;
        const gy = ((d.y + t * d.speed) % 1) * h;
        // Trail
        const trailGrad = ctx.createLinearGradient(gx, gy - 28, gx, gy);
        trailGrad.addColorStop(0, "transparent");
        trailGrad.addColorStop(1, "rgba(220, 240, 255, 0.35)");
        ctx.strokeStyle = trailGrad;
        ctx.lineWidth = d.r * 0.9;
        ctx.beginPath();
        ctx.moveTo(gx, gy - 26);
        ctx.lineTo(gx, gy);
        ctx.stroke();
        // Droplet bead
        ctx.fillStyle = "rgba(235, 248, 255, 0.68)";
        ctx.beginPath();
        ctx.arc(gx, gy, d.r, 0, Math.PI * 2);
        ctx.fill();
      }
    }
    ctx.restore();
  }

  // All 24 Distinct Procedural Scenes
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
      case "rain_bokeh": {
        // 1. Gece Camda Rahmet: Warm distant street/city bokeh + falling rain + window droplets
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
        drawRainStreaksAndDrops(ctx, w, h, t, dt, palette[2], true, 90);
        break;
      }

      case "rain_emerald": {
        // 2. Zümrüt Yağmur Buharı: Emerald mist layers + rain + bottom water ripples
        for (let i = 0; i < 4; i++) {
          const my = h * (0.35 + i * 0.16) + Math.sin(t * 0.5 + i) * 24;
          const mg = ctx.createRadialGradient(w * (0.3 + 0.15 * i), my, 10, w * 0.5, my, w * 0.65);
          mg.addColorStop(0, palette[2] + "32");
          mg.addColorStop(1, "transparent");
          ctx.fillStyle = mg;
          ctx.fillRect(0, my - 140, w, 280);
        }
        drawRainStreaksAndDrops(ctx, w, h, t, dt, palette[2], false, 80);
        // Bottom ripples
        ctx.strokeStyle = palette[2] + "35";
        ctx.lineWidth = 1.5;
        for (let r = 0; r < 8; r++) {
          const prog = (t * 0.6 + r * 0.37) % 1;
          const rx = ((r * 129) % 80 + 10) / 100 * w;
          const ry = h * (0.78 + (r % 3) * 0.06);
          ctx.globalAlpha = 1 - prog;
          ctx.beginPath();
          ctx.ellipse(rx, ry, prog * 55, prog * 14, 0, 0, Math.PI * 2);
          ctx.stroke();
        }
        ctx.globalAlpha = 1;
        break;
      }

      case "rain_amber": {
        // 3. Kehribar Sokak Işıkları: Warm golden-amber streetlamp beams from top + wet reflections + rain
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
        drawRainStreaksAndDrops(ctx, w, h, t, dt, "#f59e0b", true, 70);
        break;
      }

      case "rain_blue": {
        // 4. Mavi Alacakaranlık: Deep twilight horizon glow + dense rain + soft cloud drift
        const hGlow = ctx.createLinearGradient(0, h * 0.45, 0, h * 0.85);
        hGlow.addColorStop(0, "transparent");
        hGlow.addColorStop(0.5, palette[2] + "38");
        hGlow.addColorStop(1, "transparent");
        ctx.fillStyle = hGlow;
        ctx.fillRect(0, h * 0.45, w, h * 0.4);
        drawRainStreaksAndDrops(ctx, w, h, t, dt, "#60a5fa", false, 110);
        break;
      }

      case "aurora": {
        // 5. Kuzey Işıkları: Starfield + waving multi-ribbon aurora borealis
        for (let s = 0; s < 55; s++) {
          const sx = ((s * 97.3) % 100) / 100 * w;
          const sy = ((s * 43.7) % 65) / 100 * h;
          const tw = 0.3 + 0.7 * Math.abs(Math.sin(t * 1.5 + s));
          ctx.fillStyle = `rgba(255,255,255,${tw * 0.7})`;
          ctx.fillRect(sx, sy, 2, 2);
        }
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
        // 6. Derin Uzay Yıldızları: Parallax starfield + periodic shooting star
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
        // Shooting star every 4 seconds
        const shootCycle = (t % 4.0);
        if (shootCycle < 0.85) {
          const p = shootCycle / 0.85;
          const mx = w * (0.82 - p * 0.55);
          const my = h * (0.14 + p * 0.32);
          const mg = ctx.createLinearGradient(mx, my, mx + 90, my - 52);
          mg.addColorStop(0, "rgba(255,255,255,0.95)");
          mg.addColorStop(1, "transparent");
          ctx.strokeStyle = mg;
          ctx.lineWidth = 2.2;
          ctx.beginPath();
          ctx.moveTo(mx, my);
          ctx.lineTo(mx + 90, my - 52);
          ctx.stroke();
        }
        break;
      }

      case "moon_sea": {
        // 7. Mehtap Yansıması: Crescent/full moon + silver reflection across ocean waves
        const moonY = h * 0.22;
        const mGlow = ctx.createRadialGradient(w * 0.5, moonY, 8, w * 0.5, moonY, w * 0.36);
        mGlow.addColorStop(0, "rgba(248, 250, 252, 0.45)");
        mGlow.addColorStop(1, "transparent");
        ctx.fillStyle = mGlow;
        ctx.fillRect(0, 0, w, h * 0.55);

        ctx.fillStyle = "#f8fafc";
        ctx.beginPath();
        ctx.arc(w * 0.5, moonY, w * 0.068, 0, Math.PI * 2);
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

          // Moon shimmer bar on wave
          const sw = (w * 0.14) * (1 + i * 0.18);
          const sx = w * 0.5 - sw / 2 + Math.sin(t * 2 + i) * 10;
          ctx.fillStyle = "rgba(248, 250, 252, 0.25)";
          ctx.fillRect(sx, wy - 2, sw, 4);
        }
        break;
      }

      case "nebula_dust": {
        // 8. Altın Samanyolu: Diagonal Milky Way nebula band + golden star clusters
        ctx.save();
        ctx.translate(w * 0.5, h * 0.5);
        ctx.rotate(-0.48);
        const neb = ctx.createLinearGradient(-w * 0.45, 0, w * 0.45, 0);
        neb.addColorStop(0, "transparent");
        neb.addColorStop(0.5, palette[2] + "42");
        neb.addColorStop(1, "transparent");
        ctx.fillStyle = neb;
        ctx.fillRect(-w, -h, w * 2, h * 2);
        ctx.restore();

        for (let i = 0; i < 85; i++) {
          const angle = i * 0.35 + t * 0.06;
          const dist = ((i * 19) % 100) / 100 * (w * 0.58);
          const sx = w * 0.5 + Math.cos(angle) * dist;
          const sy = h * 0.48 + Math.sin(angle * 1.2) * (dist * 1.35);
          const tw = 0.3 + 0.7 * Math.abs(Math.sin(t * 1.7 + i));
          ctx.fillStyle = i % 2 === 0 ? `rgba(243, 215, 125, ${tw * 0.85})` : `rgba(255, 255, 255, ${tw * 0.75})`;
          ctx.beginPath();
          ctx.arc(sx, sy, 1 + (i % 3) * 0.8, 0, Math.PI * 2);
          ctx.fill();
        }
        break;
      }

      case "mist_flow": {
        // 9. Dağ Yamacı Sis: 3 Mountain ridges + drifting volumetric fog layers
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

          // Drifting mist ribbon over each ridge
          const mistY = baseH + 15 + Math.sin(t * 0.45 + m) * 16;
          const fg = ctx.createLinearGradient(0, mistY - 55, 0, mistY + 65);
          fg.addColorStop(0, "transparent");
          fg.addColorStop(0.5, palette[2] + "2e");
          fg.addColorStop(1, "transparent");
          ctx.fillStyle = fg;
          ctx.fillRect(0, mistY - 55, w, 120);
        }
        break;
      }

      case "light_rays": {
        // 10. Orman Işık Huzmeleri: Diagonal sunbeams from upper canopy + floating golden pollen
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
        for (let i = 0; i < 40; i++) {
          const px = (((i * 83) % 100) / 100 * w + Math.sin(t * 0.6 + i) * 25 + w) % w;
          const py = (((i * 47) % 100) / 100 * h - t * 18 + h * 10) % h;
          ctx.fillStyle = palette[2] + "88";
          ctx.beginPath();
          ctx.arc(px, py, 1.5 + (i % 3), 0, Math.PI * 2);
          ctx.fill();
        }
        break;
      }

      case "autumn_leaves": {
        // 11. Sonbahar Tefekkürü: Warm amber sun glow + gently swaying falling autumn leaves
        const sunG = ctx.createRadialGradient(w * 0.75, h * 0.18, 10, w * 0.75, h * 0.18, w * 0.7);
        sunG.addColorStop(0, "#fb923c44");
        sunG.addColorStop(1, "transparent");
        ctx.fillStyle = sunG;
        ctx.fillRect(0, 0, w, h);

        for (let i = 0; i < 32; i++) {
          const lx = (((i * 71) % 100) / 100 * w + Math.sin(t * 0.9 + i) * 38 + w) % w;
          const ly = (((i * 53) % 100) / 100 * h + t * (32 + (i % 5) * 8)) % h;
          const rot = t * 1.2 + i;
          ctx.save();
          ctx.translate(lx, ly);
          ctx.rotate(rot);
          ctx.fillStyle = i % 2 === 0 ? "rgba(251, 146, 60, 0.55)" : "rgba(234, 179, 8, 0.48)";
          ctx.beginPath();
          ctx.ellipse(0, 0, 7 * (w / 720), 3.5 * (w / 720), 0, 0, Math.PI * 2);
          ctx.fill();
          ctx.restore();
        }
        break;
      }

      case "emerald_valley": {
        // 12. Zümrüt Vadi: Rolling green hills + golden dawn horizon + rising dew particles
        const hGlow = ctx.createRadialGradient(w * 0.5, h * 0.52, 10, w * 0.5, h * 0.52, w * 0.65);
        hGlow.addColorStop(0, palette[2] + "48");
        hGlow.addColorStop(1, "transparent");
        ctx.fillStyle = hGlow;
        ctx.fillRect(0, 0, w, h);

        for (let l = 0; l < 3; l++) {
          const hy = h * (0.56 + l * 0.12);
          ctx.fillStyle = l === 0 ? "#0f3325" : l === 1 ? "#092218" : "#05140e";
          ctx.beginPath();
          ctx.moveTo(0, h);
          ctx.quadraticCurveTo(w * (0.3 + l * 0.2), hy - 45, w, hy + 20);
          ctx.lineTo(w, h);
          ctx.closePath();
          ctx.fill();
        }
        break;
      }

      case "calm_waves": {
        // 13. Sakin Gece Dalgaları: Layered ocean waves with moonlit crests
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

      case "sunset_sky": {
        // 14. Gurup Vakti Kızıllığı: Setting crimson/gold sun + horizon reflection
        const sunY = h * 0.48 + Math.sin(t * 0.2) * 8;
        const sg = ctx.createRadialGradient(w * 0.5, sunY, 10, w * 0.5, sunY, w * 0.55);
        sg.addColorStop(0, "#fb923c77");
        sg.addColorStop(0.45, "#f9731633");
        sg.addColorStop(1, "transparent");
        ctx.fillStyle = sg;
        ctx.fillRect(0, 0, w, h);

        ctx.fillStyle = "rgba(253, 186, 116, 0.75)";
        ctx.beginPath();
        ctx.arc(w * 0.5, sunY, w * 0.095, 0, Math.PI * 2);
        ctx.fill();

        // Dark sea below horizon with warm reflection lines
        ctx.fillStyle = "rgba(12, 8, 16, 0.85)";
        ctx.fillRect(0, h * 0.54, w, h * 0.46);
        for (let i = 0; i < 12; i++) {
          const ry = h * 0.56 + i * (h * 0.032);
          const rw = (w * 0.28) * (1 - i * 0.05) + Math.sin(t * 2.2 + i) * 14;
          ctx.fillStyle = "rgba(251, 146, 60, 0.35)";
          ctx.fillRect(w * 0.5 - rw / 2, ry, rw, 3);
        }
        break;
      }

      case "horizon_glow": {
        // 15. Fecir Ufuk Çizgisi: Pre-dawn fajr golden-indigo band + morning star
        const hy = h * 0.62;
        const fg = ctx.createLinearGradient(0, hy - h * 0.25, 0, hy + h * 0.15);
        fg.addColorStop(0, "transparent");
        fg.addColorStop(0.6, palette[2] + "55");
        fg.addColorStop(1, "#05070b");
        ctx.fillStyle = fg;
        ctx.fillRect(0, hy - h * 0.25, w, h * 0.4);

        // Morning star (Zühre)
        const starAlpha = 0.6 + 0.4 * Math.sin(t * 2);
        ctx.fillStyle = `rgba(255, 250, 220, ${starAlpha})`;
        ctx.beginPath();
        ctx.arc(w * 0.64, h * 0.24, 3.5, 0, Math.PI * 2);
        ctx.fill();
        break;
      }

      case "deep_ocean": {
        // 16. Derin Okyanus Huzuru: Underwater caustic shafts + rising micro-bubbles
        for (let c = 0; c < 5; c++) {
          const cx = w * (0.15 + c * 0.18) + Math.sin(t * 0.5 + c) * 20;
          const cg = ctx.createLinearGradient(cx, 0, cx, h * 0.75);
          cg.addColorStop(0, "#2dd4bf38");
          cg.addColorStop(1, "transparent");
          ctx.fillStyle = cg;
          ctx.beginPath();
          ctx.moveTo(cx - 30, 0);
          ctx.lineTo(cx + 30, 0);
          ctx.lineTo(cx + 75, h * 0.75);
          ctx.lineTo(cx - 75, h * 0.75);
          ctx.closePath();
          ctx.fill();
        }
        for (let b = 0; b < 35; b++) {
          const bx = (((b * 67) % 100) / 100 * w + Math.sin(t + b) * 12 + w) % w;
          const by = (((b * 41) % 100) / 100 * h - t * (28 + (b % 4) * 10) + h * 10) % h;
          ctx.strokeStyle = "rgba(153, 246, 228, 0.45)";
          ctx.lineWidth = 1.2;
          ctx.beginPath();
          ctx.arc(bx, by, 2 + (b % 4), 0, Math.PI * 2);
          ctx.stroke();
        }
        break;
      }

      case "arch_glow": {
        // 17. Altın Mihrap Işığı: Pointed Islamic mihrab arch + swaying hanging kandil lamp
        const rad = ctx.createRadialGradient(w / 2, h * 0.34, 10, w / 2, h * 0.34, w * 0.65);
        rad.addColorStop(0, palette[2] + "58");
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

        // Swaying kandil chain & lamp at top center
        const swayX = w * 0.5 + Math.sin(t * 0.9) * 10;
        const lampY = h * 0.24;
        ctx.strokeStyle = palette[2] + "77";
        ctx.lineWidth = 1.5;
        ctx.beginPath();
        ctx.moveTo(w * 0.5, h * 0.09);
        ctx.lineTo(swayX, lampY);
        ctx.stroke();

        const kGlow = ctx.createRadialGradient(swayX, lampY, 2, swayX, lampY, 48 * (w / 720));
        kGlow.addColorStop(0, "#fef08a99");
        kGlow.addColorStop(1, "transparent");
        ctx.fillStyle = kGlow;
        ctx.beginPath();
        ctx.arc(swayX, lampY, 48 * (w / 720), 0, Math.PI * 2);
        ctx.fill();
        break;
      }

      case "dome_rays": {
        // 18. Kubbe Nur Huzmesi: Mosque dome oculus rings at top + radiating volumetric beams
        ctx.strokeStyle = palette[2] + "40";
        ctx.lineWidth = 2;
        for (let r = 1; r <= 3; r++) {
          ctx.beginPath();
          ctx.arc(w * 0.5, h * 0.12, w * 0.11 * r, 0, Math.PI);
          ctx.stroke();
        }
        for (let b = -2; b <= 2; b++) {
          const angle = b * 0.16 + Math.sin(t * 0.35 + b) * 0.03;
          const rg = ctx.createLinearGradient(w * 0.5, h * 0.12, w * 0.5 + Math.sin(angle) * h, h * 0.85);
          rg.addColorStop(0, palette[2] + "44");
          rg.addColorStop(1, "transparent");
          ctx.fillStyle = rg;
          ctx.beginPath();
          ctx.moveTo(w * 0.5 - 18, h * 0.12);
          ctx.lineTo(w * 0.5 + 18, h * 0.12);
          ctx.lineTo(w * 0.5 + Math.sin(angle) * h + 70, h * 0.88);
          ctx.lineTo(w * 0.5 + Math.sin(angle) * h - 70, h * 0.88);
          ctx.closePath();
          ctx.fill();
        }
        break;
      }

      case "kandil_bokeh": {
        // 19. Kandil Bokeh Parıltısı: 5 Hanging kandil silhouettes + warm flickering golden bokeh
        const positions = [0.2, 0.35, 0.5, 0.65, 0.8];
        const heights = [0.22, 0.16, 0.25, 0.17, 0.21];
        positions.forEach((px, idx) => {
          const kx = w * px + Math.sin(t * 0.8 + idx) * 6;
          const ky = h * heights[idx];
          ctx.strokeStyle = "rgba(245, 158, 11, 0.35)";
          ctx.beginPath();
          ctx.moveTo(w * px, 0);
          ctx.lineTo(kx, ky);
          ctx.stroke();

          const flk = 0.75 + 0.25 * Math.sin(t * 3.5 + idx * 2);
          const g = ctx.createRadialGradient(kx, ky, 2, kx, ky, 38 * (w / 720) * flk);
          g.addColorStop(0, "rgba(254, 240, 138, 0.85)");
          g.addColorStop(0.5, "rgba(245, 158, 11, 0.32)");
          g.addColorStop(1, "transparent");
          ctx.fillStyle = g;
          ctx.beginPath();
          ctx.arc(kx, ky, 38 * (w / 720), 0, Math.PI * 2);
          ctx.fill();
        });
        break;
      }

      case "medina_green": {
        // 20. Medine Yeşili Huzur: Twin Nabawi colonnade arches + golden brass railing accent
        ctx.strokeStyle = "#d8b45655";
        ctx.lineWidth = 2.5 * (w / 720);
        for (let a = 0; a < 2; a++) {
          const ax = w * (0.28 + a * 0.44);
          ctx.beginPath();
          ctx.moveTo(ax - w * 0.18, h * 0.82);
          ctx.lineTo(ax - w * 0.18, h * 0.34);
          ctx.quadraticCurveTo(ax, h * 0.18, ax + w * 0.18, h * 0.34);
          ctx.lineTo(ax + w * 0.18, h * 0.82);
          ctx.stroke();
        }
        const mGlow = ctx.createRadialGradient(w * 0.5, h * 0.38, 10, w * 0.5, h * 0.38, w * 0.6);
        mGlow.addColorStop(0, "#10b98133");
        mGlow.addColorStop(1, "transparent");
        ctx.fillStyle = mGlow;
        ctx.fillRect(0, 0, w, h);
        break;
      }

      case "islamic_geo": {
        // 21. İslâmî Geometrik Altın: Counter-rotating 12-pointed rosette (Şemse)
        ctx.translate(w / 2, h / 2);
        const radius = Math.min(w, h) * 0.36;
        ctx.save();
        ctx.rotate(t * 0.045);
        ctx.strokeStyle = palette[2] + "32";
        ctx.lineWidth = 2 * (w / 720);
        for (let i = 0; i < 12; i++) {
          ctx.save();
          ctx.rotate((i * Math.PI) / 6);
          ctx.strokeRect(-radius / 2, -radius / 2, radius, radius);
          ctx.restore();
        }
        ctx.restore();

        ctx.save();
        ctx.rotate(-t * 0.03);
        ctx.strokeStyle = palette[2] + "22";
        const r2 = radius * 0.62;
        for (let i = 0; i < 8; i++) {
          ctx.save();
          ctx.rotate((i * Math.PI) / 4);
          ctx.strokeRect(-r2 / 2, -r2 / 2, r2, r2);
          ctx.restore();
        }
        ctx.restore();
        break;
      }

      case "seljuk_tile": {
        // 22. Selçuklu Çini Deseni: Turquoise interlocking 8-pointed Seljuk stars grid
        const step = Math.round(Math.min(w, h) * 0.22);
        ctx.strokeStyle = palette[2] + "24";
        ctx.lineWidth = 1.6;
        for (let gx = step * 0.5; gx < w + step; gx += step) {
          for (let gy = step * 0.5; gy < h + step; gy += step) {
            ctx.save();
            ctx.translate(gx, gy);
            ctx.rotate(Math.sin(t * 0.3 + gx * 0.01 + gy * 0.01) * 0.08);
            const s = step * 0.34;
            ctx.strokeRect(-s, -s, s * 2, s * 2);
            ctx.rotate(Math.PI / 4);
            ctx.strokeRect(-s, -s, s * 2, s * 2);
            ctx.restore();
          }
        }
        break;
      }

      case "velvet_gold": {
        // 23. Kadife Gece & Altın Toz: Deep velvet lighting + rising golden dust motes
        for (let i = 0; i < 65; i++) {
          const px = (((i * 97) % 100) / 100 * w + Math.sin(t * 0.5 + i) * 20 + w) % w;
          const py = (((i * 61) % 100) / 100 * h - t * (22 + (i % 5) * 7) + h * 10) % h;
          const tw = 0.25 + 0.75 * Math.abs(Math.sin(t * 1.9 + i));
          ctx.fillStyle = `rgba(234, 179, 8, ${tw * 0.75})`;
          ctx.beginPath();
          ctx.arc(px, py, 1.2 + (i % 3) * 1.1, 0, Math.PI * 2);
          ctx.fill();
        }
        break;
      }

      case "silk_waves":
      default: {
        // 24. İpek Nur Dalgaları: Flowing multi-strand golden silk curves
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
    const scale = w / 720;
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

  // Draws media with cross-browser / iOS Safari fallback for blur and brightness
  function drawBackgroundMediaWithFilters(ctx, mediaEl, isVideo, w, h, t, state) {
    const scaleFactor = w / 720;
    const mw = isVideo ? (mediaEl.videoWidth || 720) : (mediaEl.naturalWidth || 720);
    const mh = isVideo ? (mediaEl.videoHeight || 1280) : (mediaEl.naturalHeight || 1280);
    let zoom = state.bgZoom / 100;
    if (!isVideo && state.kenBurns === "on") {
      zoom *= (1 + 0.075 * Math.sin(t * 0.24));
    }
    const baseScale = Math.max(w / mw, h / mh) * zoom;
    const dw = mw * baseScale;
    const dh = mh * baseScale;
    const dx = (w - dw) / 2 + (state.bgPanX / 100) * w * 0.5;
    const dy = (h - dh) / 2 + (state.bgPanY / 100) * h * 0.5;

    const hasFilter = (state.bgBlur > 0 || state.bgBrightness !== 100);
    const nativeFilterOk = checkCanvasFilterSupport(ctx);

    ctx.save();
    if (hasFilter && nativeFilterOk) {
      ctx.filter = `blur(${state.bgBlur * scaleFactor}px) brightness(${state.bgBrightness}%)`;
      ctx.drawImage(mediaEl, dx, dy, dw, dh);
    } else if (hasFilter && !nativeFilterOk) {
      // iOS Safari Fallback: Multi-scale downsampled blur + composite brightness
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
      if (state.bgBrightness < 100) {
        const darkAlpha = (100 - state.bgBrightness) / 100;
        ctx.fillStyle = `rgba(0, 0, 0, ${darkAlpha})`;
        ctx.fillRect(0, 0, w, h);
      } else if (state.bgBrightness > 100) {
        const lightAlpha = Math.min(0.55, (state.bgBrightness - 100) / 100);
        ctx.fillStyle = `rgba(255, 255, 255, ${lightAlpha})`;
        ctx.fillRect(0, 0, w, h);
      }
    } else {
      ctx.drawImage(mediaEl, dx, dy, dw, dh);
    }
    ctx.restore();
  }

  // Soft Cinematic Vignette around canvas edges
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
    drawCinematicVignette
  };
})();

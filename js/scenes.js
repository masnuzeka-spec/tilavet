"use strict";

window.TW_SCENES = (() => {
  const MAX_PARTICLES = 120;
  const particles = [];
  const rainStreaks = [];
  const glassDrops = [];

  for (let i = 0; i < MAX_PARTICLES; i++) {
    particles.push({
      x: Math.random(),
      y: Math.random(),
      r: 1 + Math.random() * 2.8,
      vx: (Math.random() - 0.5) * 0.04,
      vy: 0.05 + Math.random() * 0.18,
      alpha: 0.2 + Math.random() * 0.75,
      phase: Math.random() * Math.PI * 2
    });
  }

  for (let i = 0; i < 95; i++) {
    rainStreaks.push({
      x: Math.random(),
      y: Math.random(),
      len: 0.035 + Math.random() * 0.055,
      speed: 0.65 + Math.random() * 0.75,
      wind: -0.04 - Math.random() * 0.03,
      alpha: 0.18 + Math.random() * 0.42,
      thickness: 0.8 + Math.random() * 1.4
    });
  }

  for (let i = 0; i < 42; i++) {
    glassDrops.push({
      x: Math.random(),
      y: Math.random(),
      r: 2 + Math.random() * 4.5,
      vy: 0.015 + Math.random() * 0.045,
      wobble: Math.random() * Math.PI * 2,
      alpha: 0.28 + Math.random() * 0.48
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

  function drawRainStreaksAndDrops(ctx, w, h, t, dt, withGlassDrops = true, density = 85) {
    const scale = Math.min(w, h) / 720;
    ctx.save();
    ctx.lineCap = "round";

    const count = Math.min(rainStreaks.length, density);
    for (let i = 0; i < count; i++) {
      const r = rainStreaks[i];
      r.y += r.speed * dt;
      r.x += r.wind * dt;
      if (r.y > 1.08) { r.y = -0.08; r.x = Math.random(); }
      if (r.x < -0.08) r.x = 1.05;

      const x1 = r.x * w;
      const y1 = r.y * h;
      const x2 = x1 + r.wind * w * 0.14;
      const y2 = y1 + r.len * h;

      const grad = ctx.createLinearGradient(x1, y1, x2, y2);
      grad.addColorStop(0, "rgba(200, 225, 255, 0)");
      grad.addColorStop(0.5, `rgba(210, 232, 255, ${r.alpha})`);
      grad.addColorStop(1, "rgba(255, 255, 255, 0.05)");

      ctx.strokeStyle = grad;
      ctx.lineWidth = r.thickness * scale;
      ctx.beginPath();
      ctx.moveTo(x1, y1);
      ctx.lineTo(x2, y2);
      ctx.stroke();
    }

    if (withGlassDrops) {
      for (let i = 0; i < glassDrops.length; i++) {
        const d = glassDrops[i];
        d.y += d.vy * dt * (0.4 + 0.6 * Math.sin(t * 0.8 + d.wobble));
        d.x += Math.sin(t * 1.5 + d.wobble) * dt * 0.003;
        if (d.y > 1.04) { d.y = -0.03; d.x = Math.random(); }

        const cx = d.x * w;
        const cy = d.y * h;
        const rad = d.r * scale;

        ctx.fillStyle = `rgba(225, 240, 255, ${d.alpha * 0.55})`;
        ctx.beginPath();
        ctx.ellipse(cx, cy, rad * 0.78, rad * 1.18, 0, 0, Math.PI * 2);
        ctx.fill();

        ctx.fillStyle = `rgba(255, 255, 255, ${d.alpha * 0.85})`;
        ctx.beginPath();
        ctx.arc(cx - rad * 0.22, cy - rad * 0.3, rad * 0.26, 0, Math.PI * 2);
        ctx.fill();
      }
    }

    ctx.restore();
  }

  // Full-bleed (0..h) Procedural Scene Renderer — Zero black cutoffs at top or bottom
  function drawProceduralScene(ctx, w, h, t, dt, item) {
    const palette = (item && item.palette) || ["#0a111a", "#172536", "#d8b456"];
    const scene = (item && item.scene) || "rain_bokeh";

    // Full height gradient using the scene's own palette from top (0) to bottom (1)
    const bgGrad = ctx.createLinearGradient(0, 0, 0, h);
    bgGrad.addColorStop(0, palette[0]);
    bgGrad.addColorStop(0.52, palette[1]);
    bgGrad.addColorStop(1, palette[0]);
    ctx.fillStyle = bgGrad;
    ctx.fillRect(0, 0, w, h);

    // Subtle ambient accent glow across the full frame so bottom is never pitch black
    const ambGlow = ctx.createRadialGradient(w * 0.5, h * 0.65, 10, w * 0.5, h * 0.65, Math.max(w, h) * 0.65);
    ambGlow.addColorStop(0, (palette[2] || "#d8b456") + "22");
    ambGlow.addColorStop(1, "transparent");
    ctx.fillStyle = ambGlow;
    ctx.fillRect(0, 0, w, h);

    ctx.save();

    switch (scene) {
      case "fire_hearth": {
        const flick = 0.85 + 0.15 * Math.sin(t * 7.5) * Math.cos(t * 4.2);
        const fg = ctx.createRadialGradient(w * 0.5, h * 0.94, 10, w * 0.5, h * 0.85, Math.max(w, h) * 0.62 * flick);
        fg.addColorStop(0, "rgba(251, 146, 60, 0.76)");
        fg.addColorStop(0.45, "rgba(234, 88, 12, 0.34)");
        fg.addColorStop(1, "transparent");
        ctx.fillStyle = fg;
        ctx.fillRect(0, 0, w, h);

        for (let f = 0; f < 11; f++) {
          const fx = w * (0.25 + f * 0.05) + Math.sin(t * 5 + f) * 9;
          const fh = (65 + (f % 3) * 35 + Math.sin(t * 6.5 + f * 1.3) * 18) * (h / 1280);
          const flameG = ctx.createLinearGradient(fx, h, fx, h - fh);
          flameG.addColorStop(0, "rgba(254, 240, 138, 0.78)");
          flameG.addColorStop(0.6, "rgba(249, 115, 22, 0.45)");
          flameG.addColorStop(1, "transparent");
          ctx.fillStyle = flameG;
          ctx.beginPath();
          ctx.ellipse(fx, h - fh * 0.35, 22 * (w / 720), fh * 0.7, 0, 0, Math.PI * 2);
          ctx.fill();
        }
        break;
      }

      case "winter_pines": {
        for (let row = 0; row < 4; row++) {
          const baseY = h * (0.64 + row * 0.12);
          ctx.fillStyle = row === 0 ? "#183148" : row === 1 ? "#132638" : row === 2 ? "#0e1d2c" : "#0a1622";
          for (let p = 0; p < 8; p++) {
            const px = (p / 7) * w + (row % 2) * 32;
            const treeH = (180 + (p % 3) * 55) * (h / 1280);
            const treeW = 64 * (w / 720);
            ctx.beginPath();
            ctx.moveTo(px, baseY - treeH);
            ctx.lineTo(px - treeW, Math.min(h, baseY + 20));
            ctx.lineTo(px + treeW, Math.min(h, baseY + 20));
            ctx.closePath();
            ctx.fill();
          }
        }
        break;
      }

      case "above_clouds": {
        const sunG = ctx.createRadialGradient(w * 0.5, h * 0.42, 10, w * 0.5, h * 0.42, w * 0.7);
        sunG.addColorStop(0, "rgba(253, 230, 138, 0.5)");
        sunG.addColorStop(1, "transparent");
        ctx.fillStyle = sunG;
        ctx.fillRect(0, 0, w, h);

        for (let c = 0; c < 18; c++) {
          const cx = (((c * 73) % 100) / 100) * w + Math.sin(t * 0.25 + c) * 26;
          const cy = h * (0.55 + (c % 5) * 0.09);
          const cr = (85 + (c % 3) * 40) * (w / 720);
          const cg = ctx.createRadialGradient(cx, cy, 5, cx, cy, cr);
          cg.addColorStop(0, "rgba(241, 245, 249, 0.26)");
          cg.addColorStop(1, "transparent");
          ctx.fillStyle = cg;
          ctx.beginPath();
          ctx.arc(cx, cy, cr, 0, Math.PI * 2);
          ctx.fill();
        }
        break;
      }

      case "stained_glass": {
        const colors = ["#f472b6", "#38bdf8", "#fbbf24", "#34d399"];
        for (let i = 0; i < 4; i++) {
          const gx = w * (0.18 + i * 0.21);
          const gy = h * 0.08 + Math.sin(t * 0.5 + i) * 15;
          const rg = ctx.createLinearGradient(gx, gy, gx + 65, h);
          rg.addColorStop(0, colors[i] + "48");
          rg.addColorStop(0.7, colors[i] + "1c");
          rg.addColorStop(1, "transparent");
          ctx.fillStyle = rg;
          ctx.beginPath();
          ctx.moveTo(gx - 26, gy);
          ctx.lineTo(gx + 26, gy);
          ctx.lineTo(gx + 115, h);
          ctx.lineTo(gx - 45, h);
          ctx.closePath();
          ctx.fill();
        }
        break;
      }

      case "water_ripples": {
        ctx.strokeStyle = palette[2] + "38";
        ctx.lineWidth = 2;
        for (let r = 0; r < 8; r++) {
          const prog = (t * 0.35 + r * 0.125) % 1;
          const rad = prog * Math.max(w, h) * 0.52;
          ctx.globalAlpha = 1 - prog;
          ctx.beginPath();
          ctx.arc(w * 0.5, h * 0.5, rad, 0, Math.PI * 2);
          ctx.stroke();
        }
        ctx.globalAlpha = 1;
        break;
      }

      case "rahle_glow": {
        const rg = ctx.createRadialGradient(w * 0.5, h * 0.65, 10, w * 0.5, h * 0.65, Math.max(w, h) * 0.55);
        rg.addColorStop(0, "rgba(234, 179, 8, 0.38)");
        rg.addColorStop(1, "transparent");
        ctx.fillStyle = rg;
        ctx.fillRect(0, 0, w, h);

        ctx.strokeStyle = "rgba(216, 180, 86, 0.3)";
        ctx.lineWidth = 4 * (w / 720);
        ctx.beginPath();
        ctx.moveTo(w * 0.34, h * 0.86);
        ctx.lineTo(w * 0.66, h * 0.70);
        ctx.moveTo(w * 0.66, h * 0.86);
        ctx.lineTo(w * 0.34, h * 0.70);
        ctx.stroke();
        break;
      }

      case "cypress_dawn": {
        const dg = ctx.createLinearGradient(0, h * 0.3, 0, h);
        dg.addColorStop(0, "transparent");
        dg.addColorStop(0.55, "rgba(245, 158, 11, 0.32)");
        dg.addColorStop(1, palette[0]);
        ctx.fillStyle = dg;
        ctx.fillRect(0, h * 0.3, w, h * 0.7);

        ctx.fillStyle = "rgba(8, 13, 22, 0.65)";
        ctx.beginPath();
        ctx.moveTo(w * 0.24, h * 0.28);
        ctx.quadraticCurveTo(w * 0.19, h * 0.65, w * 0.21, h);
        ctx.lineTo(w * 0.27, h);
        ctx.quadraticCurveTo(w * 0.29, h * 0.65, w * 0.24, h * 0.28);
        ctx.fill();
        break;
      }

      case "rain_bokeh": {
        for (let i = 0; i < 24; i++) {
          const bx = (((i * 137.5) % 100) / 100) * w + Math.sin(t * 0.35 + i) * 20;
          const by = (0.08 + ((i * 61.3) % 86) / 100) * h + Math.cos(t * 0.25 + i) * 14;
          const br = (24 + (i % 6) * 18) * (w / 720);
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
        for (let i = 0; i < 5; i++) {
          const my = h * (0.22 + i * 0.17) + Math.sin(t * 0.5 + i) * 24;
          const mg = ctx.createRadialGradient(w * (0.3 + 0.12 * i), my, 10, w * 0.5, my, w * 0.7);
          mg.addColorStop(0, palette[2] + "32");
          mg.addColorStop(1, "transparent");
          ctx.fillStyle = mg;
          ctx.fillRect(0, 0, w, h);
        }
        drawRainStreaksAndDrops(ctx, w, h, t, dt, false, 80);
        break;
      }

      case "rain_amber": {
        for (let lamp = 0; lamp < 2; lamp++) {
          const lx = w * (0.25 + lamp * 0.5);
          const ly = h * 0.14;
          const cone = ctx.createRadialGradient(lx, ly, 4, lx, ly + h * 0.45, Math.max(w, h) * 0.55);
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
        for (let i = 0; i < 5; i++) {
          const yOff = h * (0.16 + i * 0.15) + Math.sin(t * 0.65 + i) * 32;
          const g = ctx.createLinearGradient(0, yOff - 120, w, yOff + 160);
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
          ctx.lineTo(w, yOff + 210);
          ctx.lineTo(0, yOff + 210);
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
        for (let i = 0; i < 9; i++) {
          const wy = h * 0.54 + i * (h * 0.055);
          ctx.fillStyle = palette[2] + "1c";
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
          const dist = ((i * 19) % 100) / 100 * (w * 0.62);
          const sx = w * 0.5 + Math.cos(angle) * dist;
          const sy = h * 0.5 + Math.sin(angle * 1.2) * (dist * 1.45);
          const tw = 0.3 + 0.7 * Math.abs(Math.sin(t * 1.7 + i));
          ctx.fillStyle = `rgba(243, 215, 125, ${tw * 0.85})`;
          ctx.beginPath();
          ctx.arc(sx, sy, 1 + (i % 3) * 0.8, 0, Math.PI * 2);
          ctx.fill();
        }
        break;
      }

      case "mist_flow": {
        for (let m = 0; m < 4; m++) {
          const baseH = h * (0.46 + m * 0.13);
          ctx.fillStyle = m === 0 ? palette[1] : m === 1 ? "#112b22" : m === 2 ? "#0d221b" : palette[0];
          ctx.beginPath();
          ctx.moveTo(0, h);
          for (let x = 0; x <= w; x += 40) {
            const peak = Math.sin(x * 0.005 + m * 2.1 + t * 0.25) * 48 + Math.cos(x * 0.012 - m) * 26;
            ctx.lineTo(x, baseH + peak);
          }
          ctx.lineTo(w, h);
          ctx.closePath();
          ctx.fill();
        }
        break;
      }

      case "light_rays": {
        // Full-height sunbeams from top (0) to bottom (h) + shimmering stream ripples in lower third
        for (let r = 0; r < 6; r++) {
          const topX = w * (0.08 + r * 0.16) + Math.sin(t * 0.4 + r) * 22;
          const botX = topX + w * 0.28;
          const rg = ctx.createLinearGradient(topX, 0, botX, h);
          rg.addColorStop(0, palette[2] + "44");
          rg.addColorStop(0.65, palette[2] + "1c");
          rg.addColorStop(1, palette[2] + "08");
          ctx.fillStyle = rg;
          ctx.beginPath();
          ctx.moveTo(topX - 28, 0);
          ctx.lineTo(topX + 42, 0);
          ctx.lineTo(botX + 95, h);
          ctx.lineTo(botX - 65, h);
          ctx.closePath();
          ctx.fill();
        }
        // Gentle water stream shimmer in bottom third (0.65h..1.0h)
        for (let wv = 0; wv < 6; wv++) {
          const wy = h * (0.68 + wv * 0.055);
          ctx.fillStyle = palette[2] + "18";
          ctx.beginPath();
          ctx.moveTo(0, wy);
          for (let x = 0; x <= w; x += 36) {
            ctx.lineTo(x, wy + Math.sin(x * 0.018 + t * 1.5 + wv) * 8);
          }
          ctx.lineTo(w, h);
          ctx.lineTo(0, h);
          ctx.closePath();
          ctx.fill();
        }
        break;
      }

      case "autumn_leaves": {
        for (let i = 0; i < 34; i++) {
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
        for (let i = 0; i < 8; i++) {
          const wy = h * 0.50 + i * (h * 0.065);
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
        const rad = ctx.createRadialGradient(w / 2, h * 0.36, 10, w / 2, h * 0.42, Math.max(w, h) * 0.65);
        rad.addColorStop(0, palette[2] + "55");
        rad.addColorStop(1, "transparent");
        ctx.fillStyle = rad;
        ctx.fillRect(0, 0, w, h);

        ctx.strokeStyle = palette[2] + "48";
        ctx.lineWidth = 3 * (w / 720);
        ctx.beginPath();
        ctx.moveTo(w * 0.14, h);
        ctx.lineTo(w * 0.14, h * 0.36);
        ctx.quadraticCurveTo(w * 0.14, h * 0.14, w * 0.5, h * 0.08);
        ctx.quadraticCurveTo(w * 0.86, h * 0.14, w * 0.86, h * 0.36);
        ctx.lineTo(w * 0.86, h);
        ctx.stroke();
        break;
      }

      case "islamic_geo":
      case "seljuk_tile": {
        ctx.translate(w / 2, h / 2);
        const radius = Math.min(w, h) * 0.42;
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
        for (let wv = 0; wv < 10; wv++) {
          const baseY = h * (0.14 + wv * 0.082);
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

  // Full-bleed edge-clamped media renderer: guarantees zero black bars at top/bottom/left/right in 9:16 and all ratios
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

    // Automatically boost zoom if user pans X or Y so edges can never pull inside the canvas
    const panXFrac = (state.bgPanX || 0) / 100;
    const panYFrac = (state.bgPanY || 0) / 100;
    const minZoomForPan = 1.0 + Math.abs(panXFrac) + Math.abs(panYFrac) + (extraPanX ? 0.09 : 0);
    const effectiveZoom = Math.max(zoom, minZoomForPan);

    const baseScale = Math.max(w / mw, h / mh) * effectiveZoom;
    const dw = Math.ceil(mw * baseScale);
    const dh = Math.ceil(mh * baseScale);

    let dx = (w - dw) / 2 + panXFrac * (dw - w) * 0.5 + extraPanX;
    let dy = (h - dh) / 2 + panYFrac * (dh - h) * 0.5;

    // Hard clamp: dx must be in [w - dw, 0] and dy must be in [h - dh, 0] -> zero black edge gaps!
    dx = Math.min(0, Math.max(w - dw, dx));
    dy = Math.min(0, Math.max(h - dh, dy));

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
    return true;
  }

  // Color Warmth (-50 cool blue .. +50 warm amber) — Cinema Letterbox Bars removed per user request
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

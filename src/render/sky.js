/**
 * sky.js — Cinema-Grade Atmosphere, Volumetric Clouds, and Cinematic Vignette
 * 
 * Features:
 * - Dynamic Day/Dusk/Night color transitions with lerp
 * - Volumetric procedural drifting cumulus clouds with soft radial falloff
 * - Tactical altitude combat grid for spatial awareness & depth
 * - Cinematic Screen Vignette & Supersonic Boost Streaks
 */

import { CONFIG } from '../config.js?v=2.3';
import { lerp } from '../utils/vector.js?v=2.3';
import { clamp } from '../utils/math.js?v=2.3';
import camera from '../camera.js?v=2.3';

// Procedural cloud cluster seeds
const CLOUDS = [];
for (let i = 0; i < 32; i++) {
    CLOUDS.push({
        x: (Math.random() - 0.5) * 7000,
        y: (Math.random() - 0.5) * 7000,
        radius: 80 + Math.random() * 120,
        puffs: Array.from({ length: 6 }, () => ({
            ox: (Math.random() - 0.5) * 80,
            oy: (Math.random() - 0.5) * 50,
            r: 50 + Math.random() * 50,
        })),
        alpha: 0.14 + Math.random() * 0.16,
        speed: 10 + Math.random() * 16,
    });
}

// Speed streak lines for supersonic boost
const STREAKS = [];
for (let i = 0; i < 48; i++) {
    STREAKS.push({
        x: Math.random() * 1280,
        y: Math.random() * 720,
        len: 90 + Math.random() * 160,
        alpha: Math.random() * 0.45,
    });
}

function getSkyRGB(timeAlive) {
    const t = clamp(timeAlive / CONFIG.skyLerpDuration, 0, 1);
    const day = CONFIG.skyColorDay;
    const dusk = CONFIG.skyColorDusk;
    const night = CONFIG.skyColorNight;

    if (t < 0.5) {
        const t2 = t * 2;
        return [
            lerp(day[0], dusk[0], t2),
            lerp(day[1], dusk[1], t2),
            lerp(day[2], dusk[2], t2),
        ];
    }
    const t2 = (t - 0.5) * 2;
    return [
        lerp(dusk[0], night[0], t2),
        lerp(dusk[1], night[1], t2),
        lerp(dusk[2], night[2], t2),
    ];
}

export function getSkyColor(timeAlive) {
    const [r, g, b] = getSkyRGB(timeAlive);
    return `rgb(${Math.round(r)},${Math.round(g)},${Math.round(b)})`;
}

/**
 * Draw sun/moon celestial disc.
 */
function drawCelestialBody(ctx, canvasW, canvasH, timeAlive) {
    const t = clamp(timeAlive / CONFIG.skyLerpDuration, 0, 1);

    const sunAlpha = clamp(1 - t / 0.6, 0, 1);
    const moonProgress = clamp((t - 0.35) / 0.65, 0, 1);
    const moonAlpha = clamp((t - 0.35) / 0.3, 0, 1);

    const arcTop = canvasH * (0.5 - CONFIG.celestialArcHeight / 2) * 0.3;
    const arcBottom = canvasH * 0.85;

    const drawBody = (progress, alpha, isSun) => {
        if (alpha <= 0.01) return;
        const heightT = isSun ? progress : 1 - progress;
        const x = lerp(canvasW * 0.18, canvasW * 0.82, progress);
        const y = lerp(arcTop, arcBottom, heightT);
        const glowColor = isSun ? '255,230,180' : '190,205,235';

        ctx.save();

        // Celestial outer glow halo
        const grad = ctx.createRadialGradient(x, y, 0, x, y, CONFIG.celestialGlowRadius);
        grad.addColorStop(0, `rgba(${glowColor},${alpha * 0.35})`);
        grad.addColorStop(1, `rgba(${glowColor},0)`);
        ctx.fillStyle = grad;
        ctx.beginPath();
        ctx.arc(x, y, CONFIG.celestialGlowRadius, 0, Math.PI * 2);
        ctx.fill();

        // Celestial core disc
        ctx.fillStyle = isSun ? `rgba(255,246,224,${alpha})` : `rgba(232,237,247,${alpha})`;
        ctx.beginPath();
        ctx.arc(x, y, CONFIG.celestialRadius, 0, Math.PI * 2);
        ctx.fill();

        ctx.restore();
    };

    drawBody(t / 0.65, sunAlpha, true);
    drawBody(moonProgress, moonAlpha, false);
}

/**
 * Draw tactical aerial grid across world coordinates.
 */
function drawAltitudeGrid(ctx, canvasW, canvasH) {
    const gridSize = 400;
    const offsetX = (-camera.x * camera.zoom) % gridSize;
    const offsetY = (-camera.y * camera.zoom) % gridSize;

    ctx.save();
    ctx.strokeStyle = 'rgba(255, 255, 255, 0.04)';
    ctx.lineWidth = 1;

    for (let x = offsetX - gridSize; x < canvasW + gridSize; x += gridSize) {
        ctx.beginPath();
        ctx.moveTo(x, 0);
        ctx.lineTo(x, canvasH);
        ctx.stroke();
    }

    for (let y = offsetY - gridSize; y < canvasH + gridSize; y += gridSize) {
        ctx.beginPath();
        ctx.moveTo(0, y);
        ctx.lineTo(canvasW, y);
        ctx.stroke();
    }

    // Altitude crosshair ticks
    ctx.fillStyle = 'rgba(96, 213, 255, 0.09)';
    for (let x = offsetX; x < canvasW; x += gridSize) {
        for (let y = offsetY; y < canvasH; y += gridSize) {
            ctx.fillRect(x - 4, y - 1, 8, 2);
            ctx.fillRect(x - 1, y - 4, 2, 8);
        }
    }
    ctx.restore();
}

/**
 * Draw procedurally drifting cumulus clouds with soft radial falloff and depth.
 */
function drawDriftingClouds(ctx, canvasW, canvasH, dt = 0.016) {
    ctx.save();
    for (const c of CLOUDS) {
        c.x += c.speed * dt;
        if (c.x > 3800) c.x = -3800;

        const screenX = (c.x - camera.x * 0.38) * camera.zoom + canvasW / 2;
        const screenY = (c.y - camera.y * 0.38) * camera.zoom + canvasH / 2;

        if (screenX < -220 || screenX > canvasW + 220 || screenY < -220 || screenY > canvasH + 220) {
            continue;
        }

        ctx.fillStyle = `rgba(255, 255, 255, ${c.alpha})`;
        for (const p of c.puffs) {
            ctx.beginPath();
            ctx.arc(screenX + p.ox * camera.zoom, screenY + p.oy * camera.zoom, p.r * camera.zoom, 0, Math.PI * 2);
            ctx.fill();
        }
    }
    ctx.restore();
}

/**
 * Draw supersonic boost streaks.
 */
function drawSpeedStreaks(ctx, canvasW, canvasH, heading) {
    ctx.save();
    ctx.strokeStyle = 'rgba(255, 255, 255, 0.3)';
    ctx.lineWidth = 1.8;

    const dx = Math.cos(heading);
    const dy = Math.sin(heading);

    for (const s of STREAKS) {
        ctx.beginPath();
        ctx.moveTo(s.x, s.y);
        ctx.lineTo(s.x - dx * s.len, s.y - dy * s.len);
        ctx.stroke();

        s.x -= dx * 20;
        s.y -= dy * 20;

        if (s.x < 0) s.x += canvasW;
        if (s.x > canvasW) s.x -= canvasW;
        if (s.y < 0) s.y += canvasH;
        if (s.y > canvasH) s.y -= canvasH;
    }
    ctx.restore();
}

/**
 * Draw subtle cinematic screen vignette.
 */
export function drawVignette(ctx, canvasW, canvasH) {
    ctx.save();
    const rx = canvasW / 2;
    const ry = canvasH / 2;
    const grad = ctx.createRadialGradient(rx, ry, rx * 0.6, rx, ry, rx * 1.1);
    grad.addColorStop(0, 'rgba(0, 0, 0, 0)');
    grad.addColorStop(0.75, 'rgba(10, 15, 30, 0.25)');
    grad.addColorStop(1, 'rgba(5, 8, 20, 0.55)');
    ctx.fillStyle = grad;
    ctx.fillRect(0, 0, canvasW, canvasH);
    ctx.restore();
}

export function drawSky(ctx, canvasW, canvasH, timeAlive, isBoosting = false, heading = 0) {
    const [r, g, b] = getSkyRGB(timeAlive);
    const hL = CONFIG.skyHorizonLighten;
    const [hr, hg, hb] = [
        Math.min(255, r + hL),
        Math.min(255, g + hL),
        Math.min(255, b + hL),
    ];

    const grad = ctx.createLinearGradient(0, 0, 0, canvasH);
    grad.addColorStop(0, `rgb(${Math.round(r)},${Math.round(g)},${Math.round(b)})`);
    grad.addColorStop(0.72, `rgb(${Math.round(hr)},${Math.round(hg)},${Math.round(hb)})`);
    grad.addColorStop(1, `rgb(${Math.round(hr * 0.92)},${Math.round(hg * 0.92)},${Math.round(hb * 0.92)})`);

    ctx.fillStyle = grad;
    ctx.fillRect(0, 0, canvasW, canvasH);

    drawCelestialBody(ctx, canvasW, canvasH, timeAlive);
    drawAltitudeGrid(ctx, canvasW, canvasH);
    drawDriftingClouds(ctx, canvasW, canvasH);

    if (isBoosting) {
        drawSpeedStreaks(ctx, canvasW, canvasH, heading);
    }
}

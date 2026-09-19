/**
 * sky.js — Day/night sky color lerp + sun/moon
 *
 * CG Concept: Linear Interpolation (lerp)
 * The sky color smoothly transitions from day → dusk → night
 * over CONFIG.skyLerpDuration seconds. This serves as both a
 * visual signal of survival time and a demonstration of lerp
 * applied to RGB color channels. A vertical gradient (zenith →
 * horizon) adds depth, and a sun/moon disc arcs across the sky
 * and crossfades to reinforce the same time-of-day parameter.
 */

import { CONFIG } from '../config.js';
import { lerp } from '../utils/vector.js';
import { clamp } from '../utils/math.js';

/**
 * Compute the current sky zenith color based on survival time.
 * CG Concept: Linear interpolation — blending between three
 * color stops (day → dusk → night) using the player's survival
 * time as the interpolation parameter.
 *
 * @param {number} timeAlive - seconds survived
 * @returns {[number, number, number]} RGB triple
 */
function getSkyRGB(timeAlive) {
    const t = clamp(timeAlive / CONFIG.skyLerpDuration, 0, 1);
    const day = CONFIG.skyColorDay;
    const dusk = CONFIG.skyColorDusk;
    const night = CONFIG.skyColorNight;

    if (t < 0.5) {
        // Day → Dusk (first half of cycle)
        const t2 = t * 2; // normalize to [0, 1]
        return [
            lerp(day[0], dusk[0], t2),
            lerp(day[1], dusk[1], t2),
            lerp(day[2], dusk[2], t2),
        ];
    }
    // Dusk → Night (second half of cycle)
    const t2 = (t - 0.5) * 2; // normalize to [0, 1]
    return [
        lerp(dusk[0], night[0], t2),
        lerp(dusk[1], night[1], t2),
        lerp(dusk[2], night[2], t2),
    ];
}

/**
 * Compute the current sky color based on survival time.
 * @param {number} timeAlive - seconds survived
 * @returns {string} CSS color string
 */
export function getSkyColor(timeAlive) {
    const [r, g, b] = getSkyRGB(timeAlive);
    return `rgb(${Math.round(r)},${Math.round(g)},${Math.round(b)})`;
}

/**
 * Draw the sun (day) or moon (night), crossfading and arcing across
 * the sky as a function of survival time — the same lerp parameter
 * driving the sky color, applied to position and opacity.
 * CG Concept: Linear interpolation applied to position + alpha.
 *
 * @param {CanvasRenderingContext2D} ctx
 * @param {number} canvasW
 * @param {number} canvasH
 * @param {number} timeAlive
 */
function drawCelestialBody(ctx, canvasW, canvasH, timeAlive) {
    const t = clamp(timeAlive / CONFIG.skyLerpDuration, 0, 1);

    // Sun: bright early, fades out by the dusk/night transition.
    const sunAlpha = clamp(1 - t / 0.6, 0, 1);
    // Moon: rises starting mid-cycle, fully visible by night.
    const moonProgress = clamp((t - 0.35) / 0.65, 0, 1);
    const moonAlpha = clamp((t - 0.35) / 0.3, 0, 1);

    const arcTop = canvasH * (0.5 - CONFIG.celestialArcHeight / 2) * 0.3;
    const arcBottom = canvasH * 0.85;

    const drawBody = (progress, alpha, isSun) => {
        if (alpha <= 0.01) return;
        // Sun descends toward the horizon as it sets; moon rises away from it.
        const heightT = isSun ? progress : 1 - progress;
        const x = lerp(canvasW * 0.18, canvasW * 0.82, progress);
        const y = lerp(arcTop, arcBottom, heightT);
        const glowColor = isSun ? '255,230,180' : '190,205,235';
        const coreColor = isSun ? '#fff6e0' : '#e8edf7';

        ctx.save();
        // Outer glow
        const grad = ctx.createRadialGradient(x, y, 0, x, y, CONFIG.celestialGlowRadius);
        grad.addColorStop(0, `rgba(${glowColor},${alpha * 0.35})`);
        grad.addColorStop(1, `rgba(${glowColor},0)`);
        ctx.fillStyle = grad;
        ctx.beginPath();
        ctx.arc(x, y, CONFIG.celestialGlowRadius, 0, Math.PI * 2);
        ctx.fill();

        // Core disc
        ctx.globalAlpha = alpha;
        ctx.fillStyle = coreColor;
        ctx.beginPath();
        ctx.arc(x, y, CONFIG.celestialRadius, 0, Math.PI * 2);
        ctx.fill();

        // Moon craters for a bit of surface detail
        if (!isSun) {
            ctx.fillStyle = 'rgba(150,160,190,0.5)';
            ctx.beginPath();
            ctx.arc(x - CONFIG.celestialRadius * 0.3, y - CONFIG.celestialRadius * 0.2, CONFIG.celestialRadius * 0.22, 0, Math.PI * 2);
            ctx.fill();
            ctx.beginPath();
            ctx.arc(x + CONFIG.celestialRadius * 0.25, y + CONFIG.celestialRadius * 0.3, CONFIG.celestialRadius * 0.15, 0, Math.PI * 2);
            ctx.fill();
        }
        ctx.restore();
    };

    drawBody(t, sunAlpha, true);
    drawBody(moonProgress, moonAlpha, false);
}

/**
 * Draw the sky background — a vertical gradient from zenith to a
 * lightened horizon band, plus the sun/moon. Called before any
 * entity rendering so it acts as the base layer.
 * CG Concept: Linear interpolation — the horizon color is the
 * zenith color lerped toward white, and the gradient itself
 * interpolates between the two across the canvas height.
 *
 * @param {CanvasRenderingContext2D} ctx
 * @param {number} canvasW
 * @param {number} canvasH
 * @param {number} timeAlive
 */
export function drawSky(ctx, canvasW, canvasH, timeAlive) {
    const [r, g, b] = getSkyRGB(timeAlive);
    const lighten = CONFIG.skyHorizonLighten;
    const horizon = [
        lerp(r, 255, lighten / 255),
        lerp(g, 255, lighten / 255),
        lerp(b, 255, lighten / 255),
    ];

    const grad = ctx.createLinearGradient(0, 0, 0, canvasH);
    grad.addColorStop(0, `rgb(${Math.round(r)},${Math.round(g)},${Math.round(b)})`);
    grad.addColorStop(1, `rgb(${Math.round(horizon[0])},${Math.round(horizon[1])},${Math.round(horizon[2])})`);
    ctx.fillStyle = grad;
    ctx.fillRect(0, 0, canvasW, canvasH);

    drawCelestialBody(ctx, canvasW, canvasH, timeAlive);
}

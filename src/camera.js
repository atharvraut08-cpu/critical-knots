/**
 * camera.js — Camera system: follow, lookahead lead, dynamic speed zoom, and shake
 * 
 * Features:
 * - Dynamic Speed Zoom: Smoothly zooms out during boost/supersonic flight for vertigo & visibility
 * - Directional Lookahead Lead: Camera gently leads the player's flight vector
 * - Zero-allocation worldToScreen buffer support
 * - Affine perturbation screen shake
 */

import { lerp } from './utils/vector.js?v=2.3';
import { clamp, randRange } from './utils/math.js?v=2.3';
import { CONFIG } from './config.js?v=2.3';

const camera = {
    x: 0,
    y: 0,
    zoom: 1.0,
    leadX: 0,
    leadY: 0,
    shakeX: 0,
    shakeY: 0,
    shakeMagnitude: 0,
};

/**
 * Update camera position to smoothly follow a target entity with lookahead lead and speed zoom.
 * 
 * @param {number} dt - delta time in seconds
 * @param {{ x: number, y: number, speed: number, heading: number, boosting: boolean }} target
 */
export function updateCamera(dt, target) {
    // ── 1. Dynamic Speed Zoom (FOV expansion during boost) ─
    const targetZoom = target.boosting ? 0.92 : 1.0;
    camera.zoom = lerp(camera.zoom, targetZoom, clamp(2.5 * dt, 0, 1));

    // ── 2. Directional Lookahead Lead ───────────────────────
    const targetLeadX = Math.cos(target.heading) * (target.speed * 0.3);
    const targetLeadY = Math.sin(target.heading) * (target.speed * 0.3);
    camera.leadX = lerp(camera.leadX, targetLeadX, clamp(2.8 * dt, 0, 1));
    camera.leadY = lerp(camera.leadY, targetLeadY, clamp(2.8 * dt, 0, 1));

    // ── 3. Smooth Lerp Position Follow ──────────────────────
    const t = clamp(CONFIG.cameraFollowSpeed * dt, 0, 1);
    camera.x = lerp(camera.x, target.x + camera.leadX, t);
    camera.y = lerp(camera.y, target.y + camera.leadY, t);

    // ── 4. Screen Shake Perturbation ────────────────────────
    if (camera.shakeMagnitude > 0.1) {
        camera.shakeX = randRange(-camera.shakeMagnitude, camera.shakeMagnitude);
        camera.shakeY = randRange(-camera.shakeMagnitude, camera.shakeMagnitude);
        camera.shakeMagnitude *= Math.exp(-CONFIG.shakeDecayRate * dt);
    } else {
        camera.shakeX = 0;
        camera.shakeY = 0;
        camera.shakeMagnitude = 0;
    }
}

/**
 * Convert world-space coordinates to screen-space coordinates with dynamic zoom and shake.
 * 
 * @param {number} worldX
 * @param {number} worldY
 * @param {number} canvasW
 * @param {number} canvasH
 * @param {{ x: number, y: number }} [out] - optional reusable point buffer to avoid allocation
 * @returns {{ x: number, y: number }}
 */
export function worldToScreen(worldX, worldY, canvasW, canvasH, out = null) {
    const z = camera.zoom;
    const sx = (worldX - camera.x) * z + canvasW / 2 + camera.shakeX;
    const sy = (worldY - camera.y) * z + canvasH / 2 + camera.shakeY;

    if (out) {
        out.x = sx;
        out.y = sy;
        return out;
    }
    return { x: sx, y: sy };
}

/**
 * Check if a world-space position is visible (within cull distance).
 * 
 * @param {number} worldX
 * @param {number} worldY
 * @param {number} canvasW
 * @param {number} canvasH
 * @returns {boolean}
 */
export function isVisible(worldX, worldY, canvasW, canvasH) {
    const maxDim = (Math.max(canvasW, canvasH) / camera.zoom) * CONFIG.cameraCullFactor;
    const dx = worldX - camera.x;
    const dy = worldY - camera.y;
    return (dx * dx + dy * dy) < (maxDim * maxDim);
}

/**
 * Trigger screen shake with given magnitude.
 * @param {number} mag - initial shake magnitude
 */
export function applyShake(mag) {
    camera.shakeMagnitude = Math.min(
        camera.shakeMagnitude + mag,
        CONFIG.shakeMaxMagnitude
    );
}

/**
 * Reset camera to given position with no shake or lead lag.
 */
export function resetCamera(x, y) {
    camera.x = x;
    camera.y = y;
    camera.zoom = 1.0;
    camera.leadX = 0;
    camera.leadY = 0;
    camera.shakeX = 0;
    camera.shakeY = 0;
    camera.shakeMagnitude = 0;
}

export default camera;

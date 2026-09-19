/**
 * camera.js — Camera system: follow, viewport transform, shake
 * 
 * CG Concept: Camera / Viewport Transform (world → screen space)
 * The camera smoothly follows the player via lerp, and all rendering
 * uses worldToScreen() to convert world coordinates to screen pixels.
 * Screen shake is implemented as a random affine perturbation, damped over time.
 */

import { lerp } from './utils/vector.js';
import { clamp, randRange } from './utils/math.js';
import { CONFIG } from './config.js';

const camera = {
    x: 0,
    y: 0,
    shakeX: 0,
    shakeY: 0,
    shakeMagnitude: 0,
};

/**
 * Update camera position to smoothly follow a target entity.
 * CG Concept: Linear interpolation (lerp) — camera smoothing
 * The camera never snaps; it approaches the target asymptotically
 * via lerp, creating a smooth follow lag behind sharp turns.
 * 
 * @param {number} dt - delta time in seconds
 * @param {{ x: number, y: number }} target - entity to follow (player)
 */
export function updateCamera(dt, target) {
    // Lerp follow: camera approaches target position smoothly
    const t = clamp(CONFIG.cameraFollowSpeed * dt, 0, 1);
    camera.x = lerp(camera.x, target.x, t);
    camera.y = lerp(camera.y, target.y, t);

    // Screen shake as matrix perturbation: random offset, damped over time
    // CG Concept: Screen shake as affine perturbation
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
 * Convert world-space coordinates to screen-space coordinates.
 * CG Concept: Camera / viewport transform — world → screen space
 * Entities store world (x, y) only; screen coordinates are computed
 * transiently here and never stored on the entity.
 * 
 * @param {number} worldX
 * @param {number} worldY
 * @param {number} canvasW - canvas width
 * @param {number} canvasH - canvas height
 * @returns {{ x: number, y: number }}
 */
export function worldToScreen(worldX, worldY, canvasW, canvasH) {
    return {
        x: (worldX - camera.x) + canvasW / 2 + camera.shakeX,
        y: (worldY - camera.y) + canvasH / 2 + camera.shakeY,
    };
}

/**
 * Check if a world-space position is visible (within cull distance).
 * Entities beyond this distance are skipped in render(), not deleted.
 * 
 * @param {number} worldX
 * @param {number} worldY
 * @param {number} canvasW
 * @param {number} canvasH
 * @returns {boolean}
 */
export function isVisible(worldX, worldY, canvasW, canvasH) {
    const maxDim = Math.max(canvasW, canvasH) * CONFIG.cameraCullFactor;
    const dx = worldX - camera.x;
    const dy = worldY - camera.y;
    return (dx * dx + dy * dy) < (maxDim * maxDim);
}

/**
 * Trigger screen shake with given magnitude.
 * CG Concept: Screen shake as random affine perturbation, damped over time
 * @param {number} mag - initial shake magnitude
 */
export function applyShake(mag) {
    camera.shakeMagnitude = Math.min(
        camera.shakeMagnitude + mag,
        CONFIG.shakeMaxMagnitude
    );
}

/**
 * Reset camera to given position with no shake.
 */
export function resetCamera(x, y) {
    camera.x = x;
    camera.y = y;
    camera.shakeX = 0;
    camera.shakeY = 0;
    camera.shakeMagnitude = 0;
}

export default camera;

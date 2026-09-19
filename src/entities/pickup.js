/**
 * pickup.js — Fuel canister pickup entity
 * 
 * Collectible fuel canisters that refill the player's fuel gauge.
 * Pulsing animation for visibility.
 */

import { CONFIG } from '../config.js';

/**
 * Create a fuel canister pickup.
 * @param {number} x - world X
 * @param {number} y - world Y
 * @returns {object} pickup entity
 */
export function createPickup(x, y) {
    return {
        x,
        y,
        radius: CONFIG.pickupRadius,
        amount: CONFIG.fuelCanisterRefill,
        alive: true,
        age: 0,
    };
}

/**
 * Update pickup animation timer.
 * @param {object} pickup
 * @param {number} dt
 */
export function updatePickup(pickup, dt) {
    if (!pickup.alive) return;
    pickup.age += dt;
}

/**
 * Draw a fuel canister pickup with pulsing glow.
 * @param {object} pickup
 * @param {CanvasRenderingContext2D} ctx
 * @param {{ x: number, y: number }} screenPos
 */
export function drawPickup(pickup, ctx, screenPos) {
    if (!pickup.alive) return;

    ctx.save();
    ctx.translate(screenPos.x, screenPos.y);

    // Pulsing scale animation for visibility
    const pulse = 1 + Math.sin(pickup.age * 4) * 0.12;
    ctx.scale(pulse, pulse);

    const r = pickup.radius;

    // Outer glow
    ctx.beginPath();
    ctx.arc(0, 0, r * 1.5, 0, Math.PI * 2);
    ctx.fillStyle = 'rgba(0, 255, 140, 0.12)';
    ctx.fill();

    // Canister body
    ctx.beginPath();
    ctx.roundRect(-r * 0.6, -r * 0.8, r * 1.2, r * 1.6, 3);
    ctx.fillStyle = '#22cc77';
    ctx.fill();
    ctx.strokeStyle = '#44ffaa';
    ctx.lineWidth = 1.5;
    ctx.stroke();

    // Fuel symbol (F)
    ctx.fillStyle = '#ffffff';
    ctx.font = `bold ${r * 0.8}px monospace`;
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.fillText('F', 0, 0);

    // Cap
    ctx.beginPath();
    ctx.roundRect(-r * 0.3, -r * 1.0, r * 0.6, r * 0.3, 2);
    ctx.fillStyle = '#33dd88';
    ctx.fill();

    ctx.restore();
}

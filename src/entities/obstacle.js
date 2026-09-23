/**
 * obstacle.js — Environmental obstacle entity with OffscreenCanvas Pre-rendering
 * 
 * Stratified Mesa / Craggy Plateau Formations:
 * High-detail rock plateaus with sheer cliff drop-offs, elevation shadows,
 * strata striations, and sunlight rim facets.
 * 
 * Performance Optimization:
 * - Pre-rendered onto an OffscreenCanvas upon generation
 * - drawObstacle() is a single hardware-accelerated drawImage() blit
 * - Eliminates 100% of per-frame gradient allocations and vertex recalculations
 */

import { CONFIG } from '../config.js?v=2.3';
import { randInt } from '../utils/math.js?v=2.3';

/**
 * Create an environmental cliff/mesa obstacle entity.
 * @param {number} x - world X
 * @param {number} y - world Y
 * @param {'cliff'} [type='cliff'] - obstacle type
 * @param {number} [size=70] - base radius/scale
 * @returns {object} obstacle entity
 */
export function createObstacle(x, y, type = 'cliff', size = 70) {
    const obs = {
        x, y,
        type: 'cliff',
        shape: 'circle',
        radius: size,
        visualRadius: size,
        alive: true,
        vertices: generatePlateauVertices(size),
        innerVertices: generatePlateauVertices(size * 0.72),
        canvas: null,
        canvasOffset: 0,
    };

    prerenderObstacle(obs);
    return obs;
}

/**
 * Generate vertices for stratified mesa/cliff plateaus.
 */
function generatePlateauVertices(radius) {
    const verts = [];
    const count = randInt(8, 12);
    for (let i = 0; i < count; i++) {
        const angle = (i / count) * Math.PI * 2;
        const r = radius * (0.84 + Math.random() * 0.28);
        verts.push({ x: Math.cos(angle) * r, y: Math.sin(angle) * r });
    }
    return verts;
}

/**
 * Pre-render obstacle onto an isolated OffscreenCanvas for 60+ FPS zero-overhead rendering.
 */
function prerenderObstacle(obs) {
    const r = obs.radius;
    const shadowOffset = CONFIG.altitudeShadowOffset;
    const padding = shadowOffset + 30;
    const size = Math.ceil((r + padding) * 2);
    const center = size / 2;

    const offscreen = typeof OffscreenCanvas !== 'undefined'
        ? new OffscreenCanvas(size, size)
        : document.createElement('canvas');

    offscreen.width = size;
    offscreen.height = size;

    const oCtx = offscreen.getContext('2d');
    if (!oCtx) return;

    // ── 1. Soft Altitude Drop Shadow ────────────────────────
    oCtx.fillStyle = 'rgba(5, 8, 18, 0.45)';
    oCtx.beginPath();
    oCtx.moveTo(center + obs.vertices[0].x + shadowOffset, center + obs.vertices[0].y + shadowOffset);
    for (let i = 1; i < obs.vertices.length; i++) {
        oCtx.lineTo(center + obs.vertices[i].x + shadowOffset, center + obs.vertices[i].y + shadowOffset);
    }
    oCtx.closePath();
    oCtx.fill();

    // ── 2. Outer Stratified Cliff Wall ──────────────────────
    oCtx.beginPath();
    oCtx.moveTo(center + obs.vertices[0].x, center + obs.vertices[0].y);
    for (let i = 1; i < obs.vertices.length; i++) {
        oCtx.lineTo(center + obs.vertices[i].x, center + obs.vertices[i].y);
    }
    oCtx.closePath();

    const wallGrad = oCtx.createLinearGradient(center - r, center - r, center + r, center + r);
    wallGrad.addColorStop(0, '#5f6d7e');
    wallGrad.addColorStop(0.4, '#424d5b');
    wallGrad.addColorStop(1, '#232a34');
    oCtx.fillStyle = wallGrad;
    oCtx.fill();

    oCtx.strokeStyle = 'rgba(148, 163, 184, 0.6)';
    oCtx.lineWidth = 2;
    oCtx.stroke();

    // ── 3. Geological Strata Lines (Rock Facets) ────────────
    oCtx.strokeStyle = 'rgba(15, 23, 42, 0.5)';
    oCtx.lineWidth = 1.5;
    for (let i = 0; i < obs.vertices.length; i++) {
        const v = obs.vertices[i];
        const iv = obs.innerVertices[i % obs.innerVertices.length];
        oCtx.beginPath();
        oCtx.moveTo(center + v.x, center + v.y);
        oCtx.lineTo(center + iv.x, center + iv.y);
        oCtx.stroke();
    }

    // ── 4. Inner Plateau Mesa Top Surface ───────────────────
    oCtx.beginPath();
    oCtx.moveTo(center + obs.innerVertices[0].x, center + obs.innerVertices[0].y);
    for (let i = 1; i < obs.innerVertices.length; i++) {
        oCtx.lineTo(center + obs.innerVertices[i].x, center + obs.innerVertices[i].y);
    }
    oCtx.closePath();

    const topGrad = oCtx.createLinearGradient(center - r * 0.7, center - r * 0.7, center + r * 0.7, center + r * 0.7);
    topGrad.addColorStop(0, '#8594a6');
    topGrad.addColorStop(0.5, '#627082');
    topGrad.addColorStop(1, '#3b4552');
    oCtx.fillStyle = topGrad;
    oCtx.fill();

    // Sunlit plateau rim highlight
    oCtx.strokeStyle = 'rgba(255, 255, 255, 0.5)';
    oCtx.lineWidth = 1.5;
    oCtx.stroke();

    obs.canvas = offscreen;
    obs.canvasOffset = center;
}

/**
 * Draw an environmental cliff obstacle with zero per-frame allocation.
 * 
 * @param {object} obs
 * @param {CanvasRenderingContext2D} ctx
 * @param {{ x: number, y: number }} screenPos
 */
export function drawObstacle(obs, ctx, screenPos) {
    if (!obs.alive || !obs.canvas) return;
    ctx.drawImage(obs.canvas, screenPos.x - obs.canvasOffset, screenPos.y - obs.canvasOffset);
}

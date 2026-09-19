/**
 * parallax.js — Multi-layer parallax background
 * 
 * CG Concept: Parallax Scrolling
 * Multiple background layers move at different speeds relative to
 * the camera, creating a depth illusion without 3D rendering.
 * Each layer has a layerFactor < 1 — smaller values appear more
 * distant and move slower, simulating depth through differential motion.
 * 
 * Layers are tiled procedurally with seeded pseudo-random placement,
 * wrapped modulo tileSize, so the background repeats seamlessly.
 */

import { CONFIG } from '../config.js';

// Pre-generated layer data (filled once at init)
const layers = [];

/**
 * Initialize parallax layers with pseudo-random element placement.
 * Call once at game start. Elements are placed within a tile that
 * repeats modulo tileSize for seamless wrapping.
 */
export function initParallax() {
    layers.length = 0;
    for (const layerDef of CONFIG.parallaxLayers) {
        const elements = [];
        const tileSize = CONFIG.parallaxTileSize;
        for (let i = 0; i < layerDef.count; i++) {
            elements.push({
                // Position within the repeating tile [0, tileSize)
                tx: Math.random() * tileSize,
                ty: Math.random() * tileSize,
                size: layerDef.sizeMin + Math.random() * (layerDef.sizeMax - layerDef.sizeMin),
                // Per-element phase offset so twinkling elements don't flash in unison
                phase: Math.random() * Math.PI * 2,
            });
        }
        layers.push({
            factor: layerDef.factor,
            color: layerDef.color,
            twinkle: !!layerDef.twinkle,
            elements,
        });
    }
}

/**
 * Draw parallax background layers.
 * CG Concept: Parallax scrolling — each layer offsets by
 * -camera * layerFactor, where layerFactor < 1 for distant layers.
 * This creates the illusion of depth through differential motion speeds.
 * 
 * @param {CanvasRenderingContext2D} ctx
 * @param {object} camera - { x, y }
 * @param {number} canvasW
 * @param {number} canvasH
 */
export function drawParallax(ctx, camera, canvasW, canvasH) {
    const tileSize = CONFIG.parallaxTileSize;
    const now = Date.now() / 1000;

    for (const layer of layers) {
        // Compute which tile region is visible
        // CG Concept: Parallax scrolling — layerFactor determines perceived depth
        const startTileX = Math.floor((camera.x * layer.factor - canvasW / 2) / tileSize);
        const startTileY = Math.floor((camera.y * layer.factor - canvasH / 2) / tileSize);
        const endTileX = startTileX + 2;
        const endTileY = startTileY + 2;

        ctx.fillStyle = layer.color;

        // Render visible tiles
        for (let tx = startTileX; tx <= endTileX; tx++) {
            for (let ty = startTileY; ty <= endTileY; ty++) {
                for (const elem of layer.elements) {
                    const worldX = tx * tileSize + elem.tx;
                    const worldY = ty * tileSize + elem.ty;

                    // Screen position with parallax offset
                    const sx = worldX - camera.x * layer.factor + canvasW / 2;
                    const sy = worldY - camera.y * layer.factor + canvasH / 2;

                    // Skip off-screen
                    if (sx < -10 || sx > canvasW + 10 ||
                        sy < -10 || sy > canvasH + 10) continue;

                    // Twinkle: per-star phase-offset sine wave modulates opacity
                    // so stars don't all flash in unison.
                    ctx.globalAlpha = layer.twinkle
                        ? 0.5 + 0.5 * Math.sin(now * CONFIG.starTwinkleSpeed + elem.phase)
                        : 1;

                    ctx.beginPath();
                    ctx.arc(sx, sy, elem.size, 0, Math.PI * 2);
                    ctx.fill();
                }
            }
        }
    }
    ctx.globalAlpha = 1;
}

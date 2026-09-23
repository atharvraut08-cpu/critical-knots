/**
 * parallax.js — Multi-layer parallax background with clean atmospheric stars
 * 
 * CG Concept: Parallax Scrolling
 * Multiple background layers move at different speeds relative to
 * the camera, creating a depth illusion without 3D rendering.
 * Each layer has a layerFactor < 1 — smaller values appear more
 * distant and move slower, simulating depth through differential motion.
 */

import { CONFIG } from '../config.js';

// Pre-generated layer data (filled once at init)
const layers = [];

/**
 * Initialize parallax layers with pseudo-random element placement.
 */
export function initParallax() {
    layers.length = 0;
    for (const layerDef of CONFIG.parallaxLayers) {
        // Completely exclude cloud layers to eliminate blinking/flashing artifacts
        if (layerDef.isCloud) continue;

        const elements = [];
        const tileSize = CONFIG.parallaxTileSize;

        for (let i = 0; i < layerDef.count; i++) {
            const size = layerDef.sizeMin + Math.random() * (layerDef.sizeMax - layerDef.sizeMin);

            elements.push({
                tx: Math.random() * tileSize,
                ty: Math.random() * tileSize,
                size,
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
 * CG Concept: Parallax scrolling — layerFactor determines perceived depth
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
        const startTileX = Math.floor((camera.x * layer.factor - canvasW / 2) / tileSize);
        const startTileY = Math.floor((camera.y * layer.factor - canvasH / 2) / tileSize);
        const endTileX = startTileX + 2;
        const endTileY = startTileY + 2;

        ctx.fillStyle = layer.color;

        for (let tx = startTileX; tx <= endTileX; tx++) {
            for (let ty = startTileY; ty <= endTileY; ty++) {
                for (const elem of layer.elements) {
                    const worldX = tx * tileSize + elem.tx;
                    const worldY = ty * tileSize + elem.ty;

                    const sx = worldX - camera.x * layer.factor + canvasW / 2;
                    const sy = worldY - camera.y * layer.factor + canvasH / 2;

                    const bound = elem.size * 2;
                    if (sx < -bound || sx > canvasW + bound || sy < -bound || sy > canvasH + bound) continue;

                    ctx.globalAlpha = layer.twinkle
                        ? 0.4 + 0.6 * Math.sin(now * CONFIG.starTwinkleSpeed + elem.phase)
                        : 1;

                    ctx.beginPath();
                    ctx.arc(sx, sy, elem.size, 0, Math.PI * 2);
                    ctx.fill();
                }
            }
        }
    }
    // Guarantee clean globalAlpha reset for downstream render passes
    ctx.globalAlpha = 1;
}

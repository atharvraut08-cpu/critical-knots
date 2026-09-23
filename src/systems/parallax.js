/**
 * parallax.js — Multi-layer parallax background with atmospheric clouds and stars
 * 
 * CG Concept: Parallax Scrolling
 * Multiple background layers move at different speeds relative to
 * the camera, creating a depth illusion without 3D rendering.
 * Each layer has a layerFactor < 1 — smaller values appear more
 * distant and move slower, simulating depth through differential motion.
 * 
 * High-altitude clouds feature soft volumetric puff clusters with
 * sunlight illumination, seamlessly wrapped modulo tileSize.
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
        const elements = [];
        const tileSize = CONFIG.parallaxTileSize;

        for (let i = 0; i < layerDef.count; i++) {
            const size = layerDef.sizeMin + Math.random() * (layerDef.sizeMax - layerDef.sizeMin);

            // If this is a cloud layer, generate a cluster of soft sub-puffs
            const puffs = [];
            if (layerDef.isCloud) {
                const puffCount = 3 + Math.floor(Math.random() * 3);
                for (let p = 0; p < puffCount; p++) {
                    puffs.push({
                        ox: (Math.random() - 0.5) * size * 0.9,
                        oy: (Math.random() - 0.5) * size * 0.5,
                        r: size * (0.45 + Math.random() * 0.4),
                    });
                }
            }

            elements.push({
                tx: Math.random() * tileSize,
                ty: Math.random() * tileSize,
                size,
                phase: Math.random() * Math.PI * 2,
                puffs,
            });
        }

        layers.push({
            factor: layerDef.factor,
            color: layerDef.color,
            twinkle: !!layerDef.twinkle,
            isCloud: !!layerDef.isCloud,
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

                    const bound = elem.size * 1.6;
                    if (sx < -bound || sx > canvasW + bound || sy < -bound || sy > canvasH + bound) continue;

                    if (layer.isCloud) {
                        // Soft volumetric cloud puffs
                        ctx.save();
                        ctx.fillStyle = layer.color;

                        for (const puff of elem.puffs) {
                            ctx.beginPath();
                            ctx.arc(sx + puff.ox, sy + puff.oy, puff.r, 0, Math.PI * 2);
                            ctx.fill();
                        }
                        ctx.restore();
                    } else {
                        // Twinkling stars
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
    }
    ctx.globalAlpha = 1;
}

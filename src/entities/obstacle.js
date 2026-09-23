/**
 * obstacle.js — Believable top-down environmental obstacles
 * 
 * Replaces floating space rocks with grounded topographical structures:
 * 1. Mountain Massifs: Top-down mountain ridges with faceted sunlit/shadow slopes,
 *    radiating crags, snow-capped peaks, and elevation shadows.
 * 2. Communications & Radar Towers: Tall steel lattice antenna masts with guy-wire
 *    stays, concrete anchor footings, and blinking red aviation hazard beacons.
 * 3. Mesa / Cliff Formations: Stratified rock plateaus with sheer drop-offs.
 * 
 * CG Concepts:
 * - Affine transformations (drawing multi-facet geometries)
 * - Topographic contouring & elevation shading
 */

import { CONFIG } from '../config.js';
import { randRange, randInt } from '../utils/math.js';

/**
 * Create an environmental obstacle entity.
 * @param {number} x - world X
 * @param {number} y - world Y
 * @param {'mountain'|'tower'|'cliff'} type - obstacle type
 * @param {number} size - base radius/scale
 * @returns {object} obstacle entity
 */
export function createObstacle(x, y, type, size) {
    if (type === 'tower') {
        return {
            x, y,
            type: 'tower',
            shape: 'circle',
            radius: Math.max(22, size * 0.45), // core lethal mast collision
            visualRadius: size * 1.2,
            alive: true,
            beaconPhase: Math.random() * Math.PI * 2,
            guyWireCount: 4,
            guyRadius: size * 1.2,
        };
    }

    if (type === 'cliff') {
        return {
            x, y,
            type: 'cliff',
            shape: 'circle',
            radius: size,
            visualRadius: size,
            alive: true,
            vertices: generatePlateauVertices(size),
            innerVertices: generatePlateauVertices(size * 0.72),
        };
    }

    // Default: Mountain massif
    return {
        x, y,
        type: 'mountain',
        shape: 'circle',
        radius: size,
        visualRadius: size * 1.15,
        alive: true,
        // Pre-generate mountain ridges for deterministic rendering
        ridges: generateMountainRidges(size),
    };
}

/**
 * Generate radiating ridge lines and crag contours for a mountain massif.
 */
function generateMountainRidges(radius) {
    const ridgeCount = randInt(5, 7);
    const crags = [];
    for (let i = 0; i < ridgeCount; i++) {
        const baseAngle = (i / ridgeCount) * Math.PI * 2 + randRange(-0.2, 0.2);
        const r = radius * (0.8 + Math.random() * 0.35);
        crags.push({
            angle: baseAngle,
            x: Math.cos(baseAngle) * r,
            y: Math.sin(baseAngle) * r,
            midX: Math.cos(baseAngle) * (r * 0.55) + randRange(-8, 8),
            midY: Math.sin(baseAngle) * (r * 0.55) + randRange(-8, 8),
        });
    }
    return crags;
}

/**
 * Generate vertices for stratified mesa/cliff plateaus.
 */
function generatePlateauVertices(radius) {
    const verts = [];
    const count = randInt(7, 10);
    for (let i = 0; i < count; i++) {
        const angle = (i / count) * Math.PI * 2;
        const r = radius * (0.82 + Math.random() * 0.25);
        verts.push({ x: Math.cos(angle) * r, y: Math.sin(angle) * r });
    }
    return verts;
}

/**
 * Draw an environmental obstacle with lighting, shadows, and architectural details.
 * 
 * @param {object} obs
 * @param {CanvasRenderingContext2D} ctx
 * @param {{ x: number, y: number }} screenPos
 */
export function drawObstacle(obs, ctx, screenPos) {
    if (!obs.alive) return;

    ctx.save();
    ctx.translate(screenPos.x, screenPos.y);

    const r = obs.radius;
    const shadowOffset = CONFIG.altitudeShadowOffset;

    if (obs.type === 'tower') {
        // ── Tower: Communications / Radar Mast ──────────────
        // 1. Ground Guy Wires & Anchor Pads
        ctx.strokeStyle = 'rgba(120, 140, 160, 0.4)';
        ctx.lineWidth = 1;
        for (let i = 0; i < obs.guyWireCount; i++) {
            const angle = (i / obs.guyWireCount) * Math.PI * 2;
            const ax = Math.cos(angle) * obs.guyRadius;
            const ay = Math.sin(angle) * obs.guyRadius;

            // Anchor pad
            ctx.fillStyle = '#444d58';
            ctx.beginPath();
            ctx.arc(ax, ay, 4, 0, Math.PI * 2);
            ctx.fill();

            // Wire from anchor to central mast
            ctx.beginPath();
            ctx.moveTo(ax, ay);
            ctx.lineTo(0, 0);
            ctx.stroke();
        }

        // 2. Tower Structure Shadow
        ctx.fillStyle = 'rgba(10, 15, 25, 0.35)';
        ctx.beginPath();
        ctx.arc(shadowOffset * 0.8, shadowOffset * 0.8, r * 0.9, 0, Math.PI * 2);
        ctx.fill();

        // 3. Central Concrete Base & Hazard Steel Ring
        ctx.fillStyle = '#2f3844';
        ctx.beginPath();
        ctx.arc(0, 0, r, 0, Math.PI * 2);
        ctx.fill();

        // Red/white aviation hazard stripes on rim
        ctx.strokeStyle = '#dd3333';
        ctx.lineWidth = 3;
        ctx.stroke();

        ctx.strokeStyle = '#f0f0f0';
        ctx.lineWidth = 2;
        ctx.setLineDash([6, 6]);
        ctx.stroke();
        ctx.setLineDash([]);

        // 4. Steel Lattice Cross-Trussing
        ctx.strokeStyle = '#a0b0c0';
        ctx.lineWidth = 1.5;
        ctx.strokeRect(-r * 0.45, -r * 0.45, r * 0.9, r * 0.9);
        ctx.beginPath();
        ctx.moveTo(-r * 0.45, -r * 0.45);
        ctx.lineTo(r * 0.45, r * 0.45);
        ctx.moveTo(r * 0.45, -r * 0.45);
        ctx.lineTo(-r * 0.45, r * 0.45);
        ctx.stroke();

        // 5. Central Radar Dish / Antenna Spire
        ctx.fillStyle = '#1e242d';
        ctx.beginPath();
        ctx.arc(0, 0, r * 0.35, 0, Math.PI * 2);
        ctx.fill();

        // 6. Blinking Red Aviation Hazard Beacons (synchronized pulse)
        const flash = Math.sin(Date.now() / 220 + obs.beaconPhase) > 0.1;
        if (flash) {
            ctx.fillStyle = '#ff2233';
            ctx.shadowColor = '#ff2233';
            ctx.shadowBlur = 12;

            // Center beacon
            ctx.beginPath();
            ctx.arc(0, 0, 4, 0, Math.PI * 2);
            ctx.fill();

            // 3 perimeter corner beacons
            for (let i = 0; i < 3; i++) {
                const a = (i / 3) * Math.PI * 2;
                ctx.beginPath();
                ctx.arc(Math.cos(a) * (r * 0.7), Math.sin(a) * (r * 0.7), 2.5, 0, Math.PI * 2);
                ctx.fill();
            }
            ctx.shadowBlur = 0;
        }

    } else if (obs.type === 'cliff') {
        // ── Cliff / Mesa Formation ──────────────────────────
        // 1. Terrain drop shadow cast by high plateau
        ctx.fillStyle = 'rgba(8, 12, 22, 0.4)';
        ctx.beginPath();
        ctx.moveTo(obs.vertices[0].x + shadowOffset, obs.vertices[0].y + shadowOffset);
        for (let i = 1; i < obs.vertices.length; i++) {
            ctx.lineTo(obs.vertices[i].x + shadowOffset, obs.vertices[i].y + shadowOffset);
        }
        ctx.closePath();
        ctx.fill();

        // 2. Base Stratified Rock Wall (Outer rim)
        ctx.beginPath();
        ctx.moveTo(obs.vertices[0].x, obs.vertices[0].y);
        for (let i = 1; i < obs.vertices.length; i++) {
            ctx.lineTo(obs.vertices[i].x, obs.vertices[i].y);
        }
        ctx.closePath();

        const wallGrad = ctx.createLinearGradient(-r, -r, r, r);
        wallGrad.addColorStop(0, '#5f6977');
        wallGrad.addColorStop(0.5, '#47505d');
        wallGrad.addColorStop(1, '#2c333e');
        ctx.fillStyle = wallGrad;
        ctx.fill();
        ctx.strokeStyle = '#788698';
        ctx.lineWidth = 2;
        ctx.stroke();

        // 3. Top Plateau Surface (Inner polygon)
        ctx.beginPath();
        ctx.moveTo(obs.innerVertices[0].x, obs.innerVertices[0].y);
        for (let i = 1; i < obs.innerVertices.length; i++) {
            ctx.lineTo(obs.innerVertices[i].x, obs.innerVertices[i].y);
        }
        ctx.closePath();

        const plateauGrad = ctx.createLinearGradient(-r * 0.5, -r * 0.5, r * 0.5, r * 0.5);
        plateauGrad.addColorStop(0, '#8694a5');
        plateauGrad.addColorStop(1, '#5f6c7c');
        ctx.fillStyle = plateauGrad;
        ctx.fill();
        ctx.strokeStyle = '#9eb0c4';
        ctx.lineWidth = 1;
        ctx.stroke();

    } else {
        // ── Mountain Massif ─────────────────────────────────
        // 1. Elevation shadow cast onto ground
        ctx.fillStyle = 'rgba(10, 16, 28, 0.38)';
        ctx.beginPath();
        ctx.moveTo(obs.ridges[0].x + shadowOffset, obs.ridges[0].y + shadowOffset);
        for (let i = 1; i < obs.ridges.length; i++) {
            ctx.lineTo(obs.ridges[i].x + shadowOffset, obs.ridges[i].y + shadowOffset);
        }
        ctx.closePath();
        ctx.fill();

        // 2. Base mountain silhouette
        ctx.beginPath();
        ctx.moveTo(obs.ridges[0].x, obs.ridges[0].y);
        for (let i = 1; i < obs.ridges.length; i++) {
            ctx.lineTo(obs.ridges[i].x, obs.ridges[i].y);
        }
        ctx.closePath();
        ctx.fillStyle = '#394350';
        ctx.fill();

        // 3. Faceted Mountain Faces (Sunlit vs Shadow side)
        // Light coming from top-left (NW), casting shadow to bottom-right (SE)
        for (let i = 0; i < obs.ridges.length; i++) {
            const nextI = (i + 1) % obs.ridges.length;
            const c1 = obs.ridges[i];
            const c2 = obs.ridges[nextI];

            const midAngle = (c1.angle + c2.angle) / 2;
            const isSunlit = Math.cos(midAngle + Math.PI * 0.75) > 0;

            ctx.beginPath();
            ctx.moveTo(0, 0); // Peak
            ctx.lineTo(c1.x, c1.y);
            ctx.lineTo(c2.x, c2.y);
            ctx.closePath();

            if (isSunlit) {
                // Sunlit warm granite slope
                const grad = ctx.createLinearGradient(0, 0, (c1.x + c2.x) / 2, (c1.y + c2.y) / 2);
                grad.addColorStop(0, '#78879b');
                grad.addColorStop(1, '#5b697a');
                ctx.fillStyle = grad;
            } else {
                // Shaded cool basalt slope
                const grad = ctx.createLinearGradient(0, 0, (c1.x + c2.x) / 2, (c1.y + c2.y) / 2);
                grad.addColorStop(0, '#3a4452');
                grad.addColorStop(1, '#252d37');
                ctx.fillStyle = grad;
            }
            ctx.fill();

            // Ridge lines
            ctx.strokeStyle = isSunlit ? 'rgba(160, 180, 205, 0.4)' : 'rgba(20, 26, 34, 0.6)';
            ctx.lineWidth = 1;
            ctx.beginPath();
            ctx.moveTo(0, 0);
            ctx.lineTo(c1.x, c1.y);
            ctx.stroke();
        }

        // 4. Glacial Snow Cap on highest central peak
        ctx.beginPath();
        ctx.moveTo(0, -r * 0.28);
        for (let i = 0; i < obs.ridges.length; i++) {
            const a = obs.ridges[i].angle;
            const sr = r * (0.2 + Math.sin(i * 2.3) * 0.08);
            ctx.lineTo(Math.cos(a) * sr, Math.sin(a) * sr);
        }
        ctx.closePath();
        ctx.fillStyle = 'rgba(235, 245, 255, 0.85)';
        ctx.fill();
        ctx.strokeStyle = '#ffffff';
        ctx.lineWidth = 1;
        ctx.stroke();
    }

    ctx.restore();
}

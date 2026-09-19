/**
 * vector.js — Core vector math utilities
 * 
 * CG Concept: Vector Math
 * Every function here implements fundamental 2D vector operations used
 * throughout the game for steering, homing pursuit, proximity checks,
 * and interpolation. These are pure functions with no side effects.
 */

// Vector math: add two 2D vectors component-wise
export const add = (a, b) => ({ x: a.x + b.x, y: a.y + b.y });

// Vector math: subtract vector b from vector a
export const sub = (a, b) => ({ x: a.x - b.x, y: a.y - b.y });

// Vector math: scale a vector by a scalar factor
export const scale = (v, s) => ({ x: v.x * s, y: v.y * s });

// Vector math: compute the magnitude (length) of a 2D vector using Euclidean norm
export const magnitude = (v) => Math.hypot(v.x, v.y);

// Vector math: normalize a vector to unit length (direction only, magnitude = 1)
// Returns a zero-safe unit vector — if magnitude is 0, avoids division by zero
export const normalize = (v) => {
    const m = magnitude(v) || 1;
    return { x: v.x / m, y: v.y / m };
};

// Vector math: dot product of two 2D vectors — measures alignment between directions
export const dot = (a, b) => a.x * b.x + a.y * b.y;

// Linear interpolation: blend between scalar values a and b by factor t ∈ [0,1]
// CG Concept: Linear Interpolation (lerp) — the single most reused primitive
export const lerp = (a, b, t) => a + (b - a) * t;

// Linear interpolation for angles: handles the ±π wraparound correctly
// CG Concept: Angular interpolation — naive lerp breaks at the ±π boundary,
// so we normalize the angular difference into [-π, π] before interpolating
export const lerpAngle = (a, b, t) => {
    let diff = b - a;
    // Wrap difference into [-PI, PI] to take the shortest angular path
    while (diff > Math.PI) diff -= 2 * Math.PI;
    while (diff < -Math.PI) diff += 2 * Math.PI;
    return a + diff * t;
};

// Euclidean distance: compute the straight-line distance between two points
// CG Concept: Euclidean distance — used for all proximity/collision checks
export const distance = (a, b) => Math.hypot(a.x - b.x, a.y - b.y);

// Compute the heading angle from point a toward point b
export const angleTo = (a, b) => Math.atan2(b.y - a.y, b.x - a.x);

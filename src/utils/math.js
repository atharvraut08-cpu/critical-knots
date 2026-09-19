/**
 * math.js — General-purpose math utilities (non-vector)
 * 
 * Stateless helper functions for clamping, random ranges, and
 * other math operations used across the codebase.
 */

// Clamp a value between min and max bounds
export const clamp = (val, min, max) => Math.max(min, Math.min(max, val));

// Generate a random float in [min, max)
export const randRange = (min, max) => Math.random() * (max - min) + min;

// Generate a random integer in [min, max] (inclusive)
export const randInt = (min, max) => Math.floor(Math.random() * (max - min + 1)) + min;

// Pick a random element from an array
export const randPick = (arr) => arr[Math.floor(Math.random() * arr.length)];

// Compute the shortest angular difference between two angles (result in [-PI, PI])
export const angleDiff = (a, b) => {
    let diff = b - a;
    while (diff > Math.PI) diff -= 2 * Math.PI;
    while (diff < -Math.PI) diff += 2 * Math.PI;
    return diff;
};

// Deadzone: returns 0 if |val| < threshold, otherwise returns val
export const deadzone = (val, threshold) => Math.abs(val) < threshold ? 0 : val;

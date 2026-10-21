/**
 * input.js — Keyboard listeners → input state map
 * 
 * Maps keyboard events to a clean input state object.
 * Supports arrow keys, WASD, double-tap strafe/dash, card navigation, and mouse interaction.
 * Handles debounced single-press actions.
 */

import { CONFIG } from './config.js';

const keys = {
    left: false,
    right: false,
    boost: false,
    fire: false,         // continuous / held action (C key)
    lock: false,         // continuous / held action (X key) for missile lock
    flare: false,        // single-press action (Q key)
    restart: false,      // single-press action (Space or R)
    pause: false,        // single-press action (P key)
    start: false,        // single-press action (Space or Enter to start)
    dogfight: false,     // single-press action (D key or 2 to start Dogfight Mode)
    quitToMenu: false,   // single-press action (Escape key)
    
    // Double-tap lateral dash / strafe roll actions
    dashLeft: false,     // triggered on double-tap A or ArrowLeft
    dashRight: false,    // triggered on double-tap D or ArrowRight

    // Title screen card selection controls
    selectPrev: false,   // Left Arrow or A
    selectNext: false,   // Right Arrow or D
    selectCard1: false,  // '1' key
    selectCard2: false,  // '2' key
    selectCard3: false,  // '3' key
    confirm: false,      // Enter or Space
    spawnDrone: false,   // 'T' key for flight school practice target
    spawnMissile: false, // 'Y' key for flight school missile evasion practice
};

// Track which action keys have been consumed this frame
const consumed = {
    flare: false,
    restart: false,
    pause: false,
    start: false,
    dogfight: false,
    quitToMenu: false,
    dashLeft: false,
    dashRight: false,
    selectPrev: false,
    selectNext: false,
    selectCard1: false,
    selectCard2: false,
    selectCard3: false,
    confirm: false,
    spawnDrone: false,
    spawnMissile: false,
};

// Double-tap timing trackers
let lastLeftTapTime = 0;
let lastRightTapTime = 0;
const DOUBLE_TAP_THRESHOLD = 280; // ms

// Mouse interaction state (scaled to virtual canvas 1280x720)
export const mouse = {
    x: -1,
    y: -1,
    isDown: false,
    clicked: false,
};

/**
 * Initialize keyboard listeners on the window.
 * Call once during game bootstrap.
 */
export function initInput(canvas = null) {
    window.addEventListener('keydown', (e) => {
        const now = performance.now();

        switch (e.code) {
            case 'ArrowLeft':
            case 'KeyA':
                keys.left = true;
                if (!consumed.selectPrev) keys.selectPrev = true;
                if (now - lastLeftTapTime < DOUBLE_TAP_THRESHOLD) {
                    if (!consumed.dashLeft) keys.dashLeft = true;
                    lastLeftTapTime = 0;
                } else {
                    lastLeftTapTime = now;
                }
                break;

            case 'ArrowRight':
            case 'KeyD':
                keys.right = true;
                if (!consumed.selectNext) keys.selectNext = true;
                if (!consumed.dogfight && e.code === 'KeyD') keys.dogfight = true;
                if (now - lastRightTapTime < DOUBLE_TAP_THRESHOLD) {
                    if (!consumed.dashRight) keys.dashRight = true;
                    lastRightTapTime = 0;
                } else {
                    lastRightTapTime = now;
                }
                break;

            case 'Digit1':
            case 'Numpad1':
                if (!consumed.selectCard1) keys.selectCard1 = true;
                break;

            case 'Digit2':
            case 'Numpad2':
                if (!consumed.selectCard2) keys.selectCard2 = true;
                if (!consumed.dogfight) keys.dogfight = true;
                break;

            case 'Digit3':
            case 'Numpad3':
                // Flight School mode is locked / coming soon — ignore key input
                keys.selectCard3 = false;
                break;

            case 'ShiftLeft':
            case 'ShiftRight':
                keys.boost = true;
                break;

            case 'KeyC':
                keys.fire = true;
                break;

            case 'KeyX':
                keys.lock = true;
                break;

            case 'KeyQ':
                if (!consumed.flare) keys.flare = true;
                break;

            case 'Space':
            case 'Enter':
                e.preventDefault();
                if (!consumed.start) keys.start = true;
                if (!consumed.restart) keys.restart = true;
                if (!consumed.confirm) keys.confirm = true;
                break;

            case 'KeyR':
                if (!consumed.restart) keys.restart = true;
                break;

            case 'KeyP':
                if (!consumed.pause) keys.pause = true;
                break;

            case 'KeyT':
                if (!consumed.spawnDrone) keys.spawnDrone = true;
                break;

            case 'KeyY':
                if (!consumed.spawnMissile) keys.spawnMissile = true;
                break;

            case 'Escape':
                if (!consumed.quitToMenu) keys.quitToMenu = true;
                break;
        }
    });

    window.addEventListener('keyup', (e) => {
        switch (e.code) {
            case 'ArrowLeft':
            case 'KeyA':
                keys.left = false;
                consumed.dashLeft = false;
                consumed.selectPrev = false;
                break;

            case 'ArrowRight':
            case 'KeyD':
                keys.right = false;
                consumed.dashRight = false;
                consumed.selectNext = false;
                consumed.dogfight = false;
                break;

            case 'Digit1':
            case 'Numpad1':
                consumed.selectCard1 = false;
                break;

            case 'Digit2':
            case 'Numpad2':
                consumed.selectCard2 = false;
                consumed.dogfight = false;
                break;

            case 'Digit3':
            case 'Numpad3':
                consumed.selectCard3 = false;
                break;

            case 'ShiftLeft':
            case 'ShiftRight':
                keys.boost = false;
                break;

            case 'KeyC':
                keys.fire = false;
                break;

            case 'KeyX':
                keys.lock = false;
                break;

            case 'KeyQ':
                consumed.flare = false;
                break;

            case 'Space':
            case 'Enter':
                consumed.start = false;
                consumed.restart = false;
                consumed.confirm = false;
                break;

            case 'KeyR':
                consumed.restart = false;
                break;

            case 'KeyP':
                consumed.pause = false;
                break;

            case 'KeyT':
                consumed.spawnDrone = false;
                break;

            case 'KeyY':
                consumed.spawnMissile = false;
                break;

            case 'Escape':
                consumed.quitToMenu = false;
                break;
        }
    });

    if (canvas) {
        initMouse(canvas);
    }
}

/**
 * Initialize mouse events for card selection and canvas interaction.
 * @param {HTMLCanvasElement} canvas
 */
export function initMouse(canvas) {
    canvas.addEventListener('mousemove', (e) => {
        const rect = canvas.getBoundingClientRect();
        if (rect.width > 0 && rect.height > 0) {
            mouse.x = ((e.clientX - rect.left) / rect.width) * (CONFIG.canvasWidth || 1280);
            mouse.y = ((e.clientY - rect.top) / rect.height) * (CONFIG.canvasHeight || 720);
        }
    });

    canvas.addEventListener('mousedown', (e) => {
        const rect = canvas.getBoundingClientRect();
        if (rect.width > 0 && rect.height > 0) {
            mouse.x = ((e.clientX - rect.left) / rect.width) * (CONFIG.canvasWidth || 1280);
            mouse.y = ((e.clientY - rect.top) / rect.height) * (CONFIG.canvasHeight || 720);
        }
        mouse.isDown = true;
        mouse.clicked = true;
    });

    window.addEventListener('mouseup', () => {
        mouse.isDown = false;
    });
}

/**
 * Consume mouse click event (returns {x, y} once, then resets).
 */
export function consumeMouseClick() {
    if (mouse.clicked) {
        mouse.clicked = false;
        return { x: mouse.x, y: mouse.y };
    }
    return null;
}

/**
 * Consume a single-press action key (returns true once, then resets).
 * Use this for actions that should only fire once per press.
 */
export function consumeAction(action) {
    if (keys[action]) {
        keys[action] = false;
        consumed[action] = true;
        return true;
    }
    return false;
}

/**
 * Force an action key into the "already consumed" state without firing it.
 */
export function suppressAction(action) {
    keys[action] = false;
    consumed[action] = true;
}

export default keys;


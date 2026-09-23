/**
 * input.js — Keyboard & Mouse listeners → input state map
 * 
 * Supports both arrow keys, WASD, and mouse buttons.
 * Handles debounced actions (restart, flare, emp, missile, pause, scoreboard).
 */

const keys = {
    left: false,
    right: false,
    boost: false,
    fire: false,        // continuous / held action (C key or Left Mouse Button)
    missile: false,     // single-press action (F key, Space, or Right Mouse Button)
    flare: false,       // single-press action (Q key)
    emp: false,         // single-press action (E key)
    restart: false,     // single-press action (Space or R)
    pause: false,       // single-press action (P key)
    start: false,       // single-press action (Space or Enter to start)
    scoreboard: false,  // held action (Tab key)
};

// Track which action keys have been consumed this frame
const consumed = {
    flare: false,
    emp: false,
    missile: false,
    restart: false,
    pause: false,
    start: false,
};

/**
 * Initialize keyboard & mouse listeners on the window.
 * Call once during game bootstrap.
 */
export function initInput() {
    window.addEventListener('keydown', (e) => {
        switch (e.code) {
            case 'ArrowLeft':
            case 'KeyA':
                keys.left = true;
                break;
            case 'ArrowRight':
            case 'KeyD':
                keys.right = true;
                break;
            case 'ShiftLeft':
            case 'ShiftRight':
                keys.boost = true;
                break;
            case 'KeyC':
                keys.fire = true;
                break;
            case 'KeyF':
                if (!consumed.missile) keys.missile = true;
                break;
            case 'KeyQ':
                if (!consumed.flare) keys.flare = true;
                break;
            case 'Space':
                e.preventDefault();
                if (!consumed.missile) keys.missile = true;
                if (!consumed.start) keys.start = true;
                if (!consumed.restart) keys.restart = true;
                break;
            case 'KeyE':
                if (!consumed.emp) keys.emp = true;
                break;
            case 'KeyR':
                if (!consumed.restart) keys.restart = true;
                break;
            case 'KeyP':
                if (!consumed.pause) keys.pause = true;
                break;
            case 'Tab':
                e.preventDefault();
                keys.scoreboard = true;
                break;
        }
    });

    window.addEventListener('keyup', (e) => {
        switch (e.code) {
            case 'ArrowLeft':
            case 'KeyA':
                keys.left = false;
                break;
            case 'ArrowRight':
            case 'KeyD':
                keys.right = false;
                break;
            case 'ShiftLeft':
            case 'ShiftRight':
                keys.boost = false;
                break;
            case 'KeyC':
                keys.fire = false;
                break;
            case 'KeyF':
                consumed.missile = false;
                break;
            case 'KeyQ':
                consumed.flare = false;
                break;
            case 'Space':
                consumed.missile = false;
                consumed.start = false;
                consumed.restart = false;
                break;
            case 'KeyE':
                consumed.emp = false;
                break;
            case 'KeyR':
                consumed.restart = false;
                break;
            case 'KeyP':
                consumed.pause = false;
                break;
            case 'Tab':
                keys.scoreboard = false;
                break;
        }
    });

    // Mouse Controls
    window.addEventListener('mousedown', (e) => {
        if (e.button === 0) { // Left click: fire machine guns
            keys.fire = true;
        } else if (e.button === 2) { // Right click: fire wing missile
            e.preventDefault();
            if (!consumed.missile) keys.missile = true;
        }
    });

    window.addEventListener('mouseup', (e) => {
        if (e.button === 0) {
            keys.fire = false;
        } else if (e.button === 2) {
            consumed.missile = false;
        }
    });

    window.addEventListener('contextmenu', (e) => e.preventDefault());
}

/**
 * Check and consume a single-press action.
 * Returns true once per keypress, then false until the key is released and pressed again.
 * 
 * @param {'flare' | 'emp' | 'missile' | 'restart' | 'pause' | 'start'} action
 * @returns {boolean}
 */
export function consumeAction(action) {
    if (keys[action]) {
        keys[action] = false;
        consumed[action] = true;
        return true;
    }
    return false;
}

export default keys;

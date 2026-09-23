/**
 * input.js — Keyboard listeners → input state map
 * 
 * Maps keyboard events to a clean input state object.
 * Supports both arrow keys and WASD.
 * Handles debounced actions (restart, flare, emp, pause).
 */

const keys = {
    left: false,
    right: false,
    boost: false,
    fire: false,     // continuous / held action (C key)
    flare: false,    // single-press action (Q key)
    emp: false,      // single-press action (E key)
    restart: false,  // single-press action (Space or R)
    pause: false,    // single-press action (P key)
    start: false,    // single-press action (Space to start)
    mode1: false,    // single-press action (1 key for Survival Mode)
    mode2: false,    // single-press action (2 key for Free Flight)
};

// Track which action keys have been consumed this frame
const consumed = {
    flare: false,
    emp: false,
    restart: false,
    pause: false,
    start: false,
    mode1: false,
    mode2: false,
};

/**
 * Initialize keyboard listeners on the window.
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
            case 'KeyQ':
                if (!consumed.flare) keys.flare = true;
                break;
            case 'Space':
                e.preventDefault();
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
            case 'Digit1':
            case 'Numpad1':
                if (!consumed.mode1) keys.mode1 = true;
                break;
            case 'Digit2':
            case 'Numpad2':
                if (!consumed.mode2) keys.mode2 = true;
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
            case 'KeyQ':
                consumed.flare = false;
                break;
            case 'Space':
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
            case 'Digit1':
            case 'Numpad1':
                consumed.mode1 = false;
                break;
            case 'Digit2':
            case 'Numpad2':
                consumed.mode2 = false;
                break;
        }
    });
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
 * Space is shared by 'start' and 'flare' (title-screen start vs. in-game
 * flare drop) — if the player is still holding Space when 'start' fires,
 * the still-armed 'flare' key would otherwise auto-consume on the first
 * gameplay frame (and OS key-repeat would keep re-arming it while held).
 * Call this on the sibling action right after consuming 'start' so a held
 * key requires a fresh press before it can trigger anything else.
 */
export function suppressAction(action) {
    keys[action] = false;
    consumed[action] = true;
}

export default keys;

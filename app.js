// Register Service Worker for Offline PWA Capabilities
if ("serviceWorker" in navigator) {
    window.addEventListener("load", () => {
        navigator.serviceWorker.register("./sw.js")
            .then(reg => {
                console.log("[PWA] ServiceWorker registered:", reg.scope);
                reg.update();
            })
            .catch(err => console.warn("[PWA] ServiceWorker registration failed:", err));
    });
}

function formatError(err) {
    if (!err) return "Unknown error";
    let parts = [];
    let cur = err;
    let depth = 0;
    while (cur && depth < 5) {
        let msg = cur.message || String(cur);
        if (!parts.includes(msg)) parts.push(msg);
        cur = cur.cause;
        depth++;
    }
    return parts.join(" ➔ ");
}

// On-screen diagnostic logger for mobile browsers
function showError(msg) {
    console.error("[App Error]", msg);
    const errBox = document.getElementById("error-log");
    if (errBox) {
        errBox.style.display = "block";
        errBox.innerText = "[შეცდომა / Error]: " + msg;
    }
}

window.addEventListener("error", (e) => {
    const file = e.filename ? e.filename.split('/').pop() : "unknown";
    showError((e.message || "Script error") + " (" + file + ":" + (e.lineno || 0) + ")");
});

window.addEventListener("unhandledrejection", (e) => {
    const reason = e.reason ? (e.reason.message || String(e.reason)) : "Unknown rejection";
    showError("Unhandled Rejection: " + reason);
});

// Global audio unlock state
let audioUnlocked = false;
function unlockGlobalAudio() {
    if (audioUnlocked) return;
    try {
        const AudioCtx = window.AudioContext || window.webkitAudioContext;
        if (AudioCtx) {
            const ctx = new AudioCtx();
            ctx.resume().then(() => {
                console.log("[Audio] System audio context unlocked successfully");
                audioUnlocked = true;
            }).catch(e => console.warn("[Audio] Context resume failed:", e));
        }
    } catch (err) {
        console.warn("[Audio] Audio unlock error:", err);
    }
}

let player = null;
let currentRenderer = "webgl";

function updateRendererBtn() {
    const rendererBtn = document.getElementById("renderer-btn");
    if (rendererBtn) {
        rendererBtn.innerText = currentRenderer === "webgl" ? "🎨 WebGL" : "🎨 Canvas";
    }
}

window.addEventListener("DOMContentLoaded", () => {
    // Attempt orientation lock to landscape if supported
    if (screen.orientation && screen.orientation.lock) {
        screen.orientation.lock("landscape").catch(() => {});
    }

    const ruffle = window.RufflePlayer && window.RufflePlayer.newest ? window.RufflePlayer.newest() : null;
    if (!ruffle) {
        showError("Ruffle engine could not be loaded. Please refresh or check connection.");
        return;
    }

    player = ruffle.createPlayer();
    window._gamePlayer = player;
    const container = document.getElementById("player-container");
    container.appendChild(player);

    player.style.width = "100%";
    player.style.height = "100%";

    // Auto-fallback panic handler
    if (typeof player.panic === "function") {
        const originalPanic = player.panic.bind(player);
        player.panic = function(err) {
            console.warn("Ruffle panic intercepted:", err);
            const errStr = String(err && (err.message || err));
            showError("Ruffle Panic: " + errStr);
            if (typeof player.reloadWithCanvasRenderer === "function") {
                console.log("Switching to Canvas renderer fallback...");
                currentRenderer = "canvas";
                updateRendererBtn();
                player.reloadWithCanvasRenderer().catch((fbErr) => {
                    originalPanic(err);
                });
                return;
            }
            originalPanic(err);
        };
    }

    const statusText = document.getElementById("status-text");
    if (statusText) statusText.innerText = "იტვირთება...";

    // Load SWF game
    player.load({
        url: "game.swf",
        autoplay: "auto",
        backgroundColor: "#000000"
    }).then(() => {
        console.log("Dwarven RPG loaded successfully");
        if (statusText) statusText.innerText = "თამაში მზადაა!";
    }).catch((err) => {
        const msg = formatError(err);
        showError("SWF Load Error: " + msg);
        if (typeof player.reloadWithCanvasRenderer === "function") {
            currentRenderer = "canvas";
            updateRendererBtn();
            player.reloadWithCanvasRenderer().catch(() => {});
        }
    });

    // Start / Audio Unlock Button
    const startOverlay = document.getElementById("start-overlay");
    const startBtn = document.getElementById("start-game-btn");

    function startGame() {
        unlockGlobalAudio();
        if (player) {
            try {
                if (typeof player.play === "function") player.play();
                if (player.instance) {
                    if (typeof player.instance.play === "function") player.instance.play();
                    if (typeof player.instance.audio_context === "function") {
                        const actx = player.instance.audio_context();
                        if (actx && actx.state === "suspended") {
                            actx.resume();
                        }
                    }
                }
            } catch (e) {
                console.warn("Start play trigger warning:", e);
            }
        }
        if (startOverlay) {
            startOverlay.classList.add("fade-out");
            setTimeout(() => {
                startOverlay.style.display = "none";
            }, 350);
        }
    }

    if (startBtn) {
        startBtn.addEventListener("click", startGame);
        startBtn.addEventListener("touchend", (e) => {
            e.preventDefault();
            startGame();
        });
    }

    // Mobile Fullscreen Toggle Button
    const fsBtn = document.getElementById("fullscreen-btn");
    if (fsBtn) {
        fsBtn.addEventListener("click", () => {
            if (!document.fullscreenElement && !document.webkitFullscreenElement) {
                const el = document.documentElement;
                if (el.requestFullscreen) {
                    el.requestFullscreen().catch(() => {});
                } else if (el.webkitRequestFullscreen) {
                    el.webkitRequestFullscreen();
                }
            } else {
                if (document.exitFullscreen) {
                    document.exitFullscreen().catch(() => {});
                } else if (document.webkitExitFullscreen) {
                    document.webkitExitFullscreen();
                }
            }
        });
    }

    // Toggle Renderer button (WebGL <-> Canvas)
    const rendererBtn = document.getElementById("renderer-btn");
    if (rendererBtn) {
        updateRendererBtn();
        rendererBtn.addEventListener("click", () => {
            if (!player) return;
            if (currentRenderer === "webgl" && typeof player.reloadWithCanvasRenderer === "function") {
                currentRenderer = "canvas";
                updateRendererBtn();
                player.reloadWithCanvasRenderer().catch(err => showError("Canvas switch: " + err));
            } else {
                location.reload();
            }
        });
    }

    // Dismiss Rotate Prompt
    const dismissBtn = document.getElementById("dismiss-rotate-btn");
    if (dismissBtn) {
        dismissBtn.addEventListener("click", () => {
            const hint = document.getElementById("rotate-hint");
            if (hint) hint.classList.add("hidden");
        });
    }

    // Initialize Virtual D-Pad
    setupVirtualDpad();

    // Fallback audio unlock on any early user tap
    window.addEventListener("touchstart", unlockGlobalAudio, { once: true });
    window.addEventListener("click", unlockGlobalAudio, { once: true });
});

// ==========================================
// Virtual D-Pad Controller for Mobile Play
// ==========================================
const DIRECTION_KEYS = {
    up: { key: "ArrowUp", code: "ArrowUp", keyCode: 38 },
    down: { key: "ArrowDown", code: "ArrowDown", keyCode: 40 },
    left: { key: "ArrowLeft", code: "ArrowLeft", keyCode: 37 },
    right: { key: "ArrowRight", code: "ArrowRight", keyCode: 39 }
};

const activeDirections = new Set();
let repeatTimer = null;

function sendDirectionKeyEvent(type, dir) {
    const config = DIRECTION_KEYS[dir];
    if (!config) return;

    const ev = new KeyboardEvent(type, {
        key: config.key,
        code: config.code,
        keyCode: config.keyCode,
        which: config.keyCode,
        bubbles: true,
        cancelable: true,
        composed: true
    });

    try {
        Object.defineProperty(ev, "keyCode", { get: () => config.keyCode });
        Object.defineProperty(ev, "which", { get: () => config.keyCode });
    } catch (e) {}

    window.dispatchEvent(ev);
    document.dispatchEvent(ev);

    const player = window._gamePlayer;
    if (player) {
        player.dispatchEvent(ev);
        if (player.shadowRoot) {
            const canvas = player.shadowRoot.querySelector("canvas");
            if (canvas) canvas.dispatchEvent(ev);
            const container = player.shadowRoot.querySelector("#container");
            if (container) container.dispatchEvent(ev);
        }
    }
}

function updateDpadVisuals() {
    document.querySelectorAll(".dpad-btn").forEach(btn => {
        const dir = btn.getAttribute("data-dir");
        if (activeDirections.has(dir)) {
            btn.classList.add("pressed");
        } else {
            btn.classList.remove("pressed");
        }
    });
}

function activateDirection(dir) {
    if (!DIRECTION_KEYS[dir]) return;
    if (!activeDirections.has(dir)) {
        activeDirections.add(dir);
        updateDpadVisuals();
        sendDirectionKeyEvent("keydown", dir);
    }
    if (!repeatTimer) {
        repeatTimer = setInterval(() => {
            for (const d of activeDirections) {
                sendDirectionKeyEvent("keydown", d);
            }
        }, 50);
    }
}

function deactivateDirection(dir) {
    if (activeDirections.has(dir)) {
        activeDirections.delete(dir);
        updateDpadVisuals();
        sendDirectionKeyEvent("keyup", dir);
    }
    if (activeDirections.size === 0 && repeatTimer) {
        clearInterval(repeatTimer);
        repeatTimer = null;
    }
}

function deactivateAllDirections() {
    for (const d of Array.from(activeDirections)) {
        sendDirectionKeyEvent("keyup", d);
    }
    activeDirections.clear();
    updateDpadVisuals();
    if (repeatTimer) {
        clearInterval(repeatTimer);
        repeatTimer = null;
    }
}

function setupVirtualDpad() {
    const dpad = document.getElementById("virtual-dpad");
    if (!dpad) return;

    function handleDpadTouch(e) {
        e.preventDefault();
        e.stopPropagation();

        if (e.type === "touchend" || e.type === "touchcancel") {
            if (e.touches.length === 0) {
                deactivateAllDirections();
            }
            return;
        }

        const rect = dpad.getBoundingClientRect();
        const centerX = rect.left + rect.width / 2;
        const centerY = rect.top + rect.height / 2;

        let activeTouch = null;
        for (let i = 0; i < e.touches.length; i++) {
            const t = e.touches[i];
            const dx = t.clientX - centerX;
            const dy = t.clientY - centerY;
            if (Math.hypot(dx, dy) < rect.width) {
                activeTouch = t;
                break;
            }
        }

        if (!activeTouch) {
            deactivateAllDirections();
            return;
        }

        const dx = activeTouch.clientX - centerX;
        const dy = activeTouch.clientY - centerY;
        const dist = Math.hypot(dx, dy);

        // Dead zone in center
        if (dist < 14) {
            deactivateAllDirections();
            return;
        }

        const angle = Math.atan2(dy, dx) * (180 / Math.PI); // -180 to 180

        let newDir = null;
        if (angle >= -135 && angle < -45) {
            newDir = "up";
        } else if (angle >= -45 && angle < 45) {
            newDir = "right";
        } else if (angle >= 45 && angle < 135) {
            newDir = "down";
        } else {
            newDir = "left";
        }

        for (const d of Array.from(activeDirections)) {
            if (d !== newDir) {
                deactivateDirection(d);
            }
        }

        if (newDir) {
            activateDirection(newDir);
        }
    }

    dpad.addEventListener("touchstart", handleDpadTouch, { passive: false });
    dpad.addEventListener("touchmove", handleDpadTouch, { passive: false });
    dpad.addEventListener("touchend", handleDpadTouch, { passive: false });
    dpad.addEventListener("touchcancel", handleDpadTouch, { passive: false });

    // Mouse click support
    let isMouseDown = false;
    dpad.addEventListener("mousedown", (e) => {
        isMouseDown = true;
        const btn = e.target.closest(".dpad-btn");
        if (btn) activateDirection(btn.getAttribute("data-dir"));
    });
    window.addEventListener("mouseup", () => {
        if (isMouseDown) {
            isMouseDown = false;
            deactivateAllDirections();
        }
    });

    // Toggle button in UI bar
    const toggleBtn = document.getElementById("dpad-toggle-btn");
    if (toggleBtn) {
        toggleBtn.addEventListener("click", () => {
            if (dpad.style.display === "none") {
                dpad.style.display = "block";
                toggleBtn.classList.add("active");
            } else {
                dpad.style.display = "none";
                toggleBtn.classList.remove("active");
            }
        });
    }

    // WASD keyboard support on desktop
    window.addEventListener("keydown", (e) => {
        const wasd = { KeyW: "up", KeyA: "left", KeyS: "down", KeyD: "right" };
        if (wasd[e.code] && !e.repeat) {
            activateDirection(wasd[e.code]);
        }
    });
    window.addEventListener("keyup", (e) => {
        const wasd = { KeyW: "up", KeyA: "left", KeyS: "down", KeyD: "right" };
        if (wasd[e.code]) {
            deactivateDirection(wasd[e.code]);
        }
    });
}

// Resume game loop and audio when returning from background
function ensureGameResumed() {
    const p = window._gamePlayer;
    if (!p) return;
    try {
        if (typeof p.play === "function") p.play();
        if (p.instance) {
            if (typeof p.instance.restart_animation_loop === "function") {
                p.instance.restart_animation_loop();
            }
            if (typeof p.instance.play === "function") {
                p.instance.play();
            }
            if (typeof p.instance.audio_context === "function") {
                const actx = p.instance.audio_context();
                if (actx && actx.state === "suspended") {
                    actx.resume();
                }
            }
        }
    } catch (e) {
        console.warn("Resume attempt:", e);
    }
}

window.addEventListener("focus", ensureGameResumed);
window.addEventListener("pageshow", ensureGameResumed);
document.addEventListener("visibilitychange", () => {
    if (!document.hidden) {
        ensureGameResumed();
    }
});

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

    // Fallback audio unlock on any early user tap
    window.addEventListener("touchstart", unlockGlobalAudio, { once: true });
    window.addEventListener("click", unlockGlobalAudio, { once: true });
});

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

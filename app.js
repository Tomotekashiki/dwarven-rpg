// Register Service Worker for Offline PWA Capabilities
if ("serviceWorker" in navigator) {
    window.addEventListener("load", () => {
        navigator.serviceWorker.register("./sw.js")
            .then(reg => console.log("[PWA] ServiceWorker registered:", reg.scope))
            .catch(err => console.warn("[PWA] ServiceWorker registration failed:", err));
    });
}

window.RufflePlayer = window.RufflePlayer || {};
window.RufflePlayer.config = {
    autoplay: "on",
    unmuteOverlay: "hidden",
    letterbox: "on",
    quality: "high",
    scale: "showAll",
    forceScale: true,
    splashScreen: false,
    openUrlMode: "confirm",
    allowScriptAccess: true,
    preferredRenderer: "webgl",
    backgroundExecutionMode: "mainThread"
};

window.addEventListener("error", (e) => {
    console.error("[Runtime Error]", e.message, e.filename, e.lineno);
});

window.addEventListener("unhandledrejection", (e) => {
    console.error("[Unhandled Promise Rejection]", e.reason);
});

window.addEventListener("DOMContentLoaded", () => {
    // Attempt orientation lock to landscape if supported
    if (screen.orientation && screen.orientation.lock) {
        screen.orientation.lock("landscape").catch(() => {});
    }

    const ruffle = window.RufflePlayer.newest();
    if (!ruffle) {
        console.error("Ruffle engine failed to initialize.");
        return;
    }
    
    const player = ruffle.createPlayer();
    window._gamePlayer = player;
    const container = document.getElementById("player-container");
    container.appendChild(player);

    player.style.width = "100%";
    player.style.height = "100%";

    // Auto-fallback to Canvas if mobile GPU / WebGL runs out of memory
    if (typeof player.panic === "function") {
        const originalPanic = player.panic.bind(player);
        player.panic = function(err) {
            console.warn("Ruffle panic intercepted:", err);
            const errStr = String(err && (err.message || err));
            if (errStr.includes("Out of Memory") || errStr.includes("wgpu") || errStr.includes("buffer")) {
                console.log("Memory/GPU error detected. Automatically falling back to Canvas renderer...");
                if (typeof player.reloadWithCanvasRenderer === "function") {
                    player.reloadWithCanvasRenderer().catch((fallbackErr) => {
                        console.error("Canvas fallback failed:", fallbackErr);
                        originalPanic(err);
                    });
                    return;
                }
            }
            originalPanic(err);
        };
    }

    player.load({
        url: "game.swf",
        parameters: {},
        autoplay: "auto",
        backgroundColor: "#000000",
        preferredRenderer: "webgl"
    }).then(() => {
        console.log("Dwarven RPG Mobile PWA loaded successfully!");
    }).catch((err) => {
        console.error("Failed to load SWF:", err);
    });

    // Mobile Fullscreen Toggle Button
    const fsBtn = document.getElementById("fullscreen-btn");
    if (fsBtn) {
        fsBtn.addEventListener("click", () => {
            if (!document.fullscreenElement) {
                const el = document.documentElement;
                if (el.requestFullscreen) {
                    el.requestFullscreen();
                } else if (el.webkitRequestFullscreen) {
                    el.webkitRequestFullscreen();
                }
            } else {
                if (document.exitFullscreen) {
                    document.exitFullscreen();
                } else if (document.webkitExitFullscreen) {
                    document.webkitExitFullscreen();
                }
            }
        });
    }

    // Dismiss Rotate Prompt
    const dismissBtn = document.getElementById("dismiss-rotate-btn");
    if (dismissBtn) {
        dismissBtn.addEventListener("click", () => {
            const hint = document.getElementById("rotate-hint");
            if (hint) hint.style.display = "none";
        });
    }

    // Audio Unlock for Mobile Browsers (iOS Safari / Android Chrome require touch gesture)
    function unlockAudio() {
        if (window._gamePlayer && window._gamePlayer.instance) {
            try {
                if (typeof window._gamePlayer.instance.audio_context === "function") {
                    const actx = window._gamePlayer.instance.audio_context();
                    if (actx && actx.state === "suspended") {
                        actx.resume();
                    }
                }
            } catch (e) {}
        }
    }
    window.addEventListener("touchstart", unlockAudio, { once: true });
    window.addEventListener("click", unlockAudio, { once: true });
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

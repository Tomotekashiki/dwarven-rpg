const http = require("http");
const fs = require("fs");
const path = require("path");
const os = require("os");

const PORT = 8080;
const BASE_DIR = __dirname;

const MIME_TYPES = {
    ".html": "text/html; charset=UTF-8",
    ".js": "application/javascript; charset=UTF-8",
    ".css": "text/css; charset=UTF-8",
    ".json": "application/json; charset=UTF-8",
    ".png": "image/png",
    ".jpg": "image/jpeg",
    ".ico": "image/x-icon",
    ".svg": "image/svg+xml",
    ".wasm": "application/wasm",
    ".swf": "application/x-shockwave-flash"
};

function getLocalIp() {
    const interfaces = os.networkInterfaces();
    for (const name of Object.keys(interfaces)) {
        for (const iface of interfaces[name]) {
            if (iface.family === "IPv4" && !iface.internal) {
                return iface.address;
            }
        }
    }
    return "127.0.0.1";
}

const server = http.createServer((req, res) => {
    try {
        let reqPath = decodeURI(req.url.split("?")[0]);
        if (reqPath === "/" || reqPath === "") reqPath = "/index.html";
        const filePath = path.normalize(path.join(BASE_DIR, reqPath));

        if (!filePath.startsWith(BASE_DIR)) {
            res.writeHead(403);
            res.end("Forbidden");
            return;
        }

        fs.readFile(filePath, (err, data) => {
            if (err) {
                res.writeHead(404);
                res.end("Not Found: " + reqPath);
                return;
            }
            const ext = path.extname(filePath).toLowerCase();
            const contentType = MIME_TYPES[ext] || "application/octet-stream";
            res.writeHead(200, {
                "Content-Type": contentType,
                "Access-Control-Allow-Origin": "*",
                "Cache-Control": ext === ".html" || ext === ".js" ? "no-cache" : "max-age=86400"
            });
            res.end(data);
        });
    } catch (e) {
        res.writeHead(500);
        res.end("Server Error: " + e.message);
    }
});

server.listen(PORT, "0.0.0.0", () => {
    const localIp = getLocalIp();
    console.log("==================================================");
    console.log("  🎮 Dwarven RPG Mobile PWA Server is Running!   ");
    console.log("==================================================");
    console.log(`  🖥️  Mac / Local:    http://localhost:${PORT}`);
    console.log(`  📱 Mobile (Wi-Fi): http://${localIp}:${PORT}`);
    console.log("==================================================");
    console.log("  როგორ დავაყენოთ ტელეფონში:");
    console.log(`  1. ტელეფონით (იგივე Wi-Fi-ზე) გახსენით: http://${localIp}:${PORT}`);
    console.log("  2. iPhone (Safari): დააჭირეთ 'Share' ➔ 'Add to Home Screen'");
    console.log("  3. Android (Chrome): დააჭირეთ 3 წერტილს ➔ 'Install App'");
    console.log("==================================================");
});

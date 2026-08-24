// Start server and test tiktok-data endpoint
const { spawn } = require("child_process");
const http = require("http");
const path = require("path");

const serverDir = path.join(__dirname);
const server = spawn("node", ["server.js"], {
    cwd: serverDir,
    stdio: ["pipe", "pipe", "pipe"]
});

let output = "";

server.stdout.on("data", (data) => {
    output += data.toString();
    process.stdout.write("[SERVER] " + data.toString());
});

server.stderr.on("data", (data) => {
    output += data.toString();
    process.stderr.write("[SERVER-ERR] " + data.toString());
});

server.on("error", (err) => {
    console.error("Failed to start server:", err);
    process.exit(1);
});

server.on("close", (code) => {
    console.log("Server exited with code:", code);
    console.log("Full output:", output);
    process.exit(1);
});

// Wait for server to start, then test
setTimeout(async () => {
    console.log("\n=== Testing /tiktok-data ===");
    try {
        const data = await new Promise((resolve, reject) => {
            const req = http.get("http://localhost:3000/tiktok-data", (r) => {
                let d = "";
                r.on("data", (c) => d += c);
                r.on("end", () => resolve(d));
            });
            req.on("error", reject);
            req.setTimeout(30000, () => {
                req.destroy();
                reject(new Error("Timeout"));
            });
        });
        console.log("Response:", data);
    } catch (e) {
        console.log("Test error:", e.message);
    }
    
    // Kill server
    server.kill();
    process.exit(0);
}, 8000);

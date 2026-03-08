const { createServer: createHttpsServer } = require("https");
const { createServer: createHttpServer } = require("http");
const { parse } = require("url");
const next = require("next");
const fs = require("fs");
const path = require("path");
const express = require("express");
const { ExpressPeerServer } = require("peer");

const dev = process.env.NODE_ENV !== "production";
const hostname = "0.0.0.0";
const port = parseInt(process.env.PORT || "3000", 10);

const app = next({ dev, hostname, port });
const handle = app.getRequestHandler();

// Determine if we should use HTTPS (local dev) or HTTP (cloud/production)
const certDir = path.join(__dirname, "certificates");
let httpsOptions = null;
let useHttps = false;

try {
    httpsOptions = {
        key: fs.readFileSync(path.join(certDir, "localhost-key.pem")),
        cert: fs.readFileSync(path.join(certDir, "localhost.pem")),
    };
    useHttps = true;
} catch {
    console.log("No local certificates found — running in HTTP mode (cloud deployment).");
}

app.prepare().then(() => {
    const expressApp = express();

    // Create server based on mode
    const server = useHttps
        ? createHttpsServer(httpsOptions, expressApp)
        : createHttpServer(expressApp);

    // Mount PeerJS signaling server at /peerjs
    const peerServer = ExpressPeerServer(server, {
        debug: true,
        path: "/",
        allow_discovery: true,
    });

    peerServer.on("connection", (client) => {
        console.log("Peer connected:", client.getId());
    });

    peerServer.on("disconnect", (client) => {
        console.log("Peer disconnected:", client.getId());
    });

    expressApp.use("/peerjs", peerServer);

    // Everything else goes to Next.js
    expressApp.all("*", (req, res) => {
        const parsedUrl = parse(req.url, true);
        handle(req, res, parsedUrl);
    });

    server.listen(port, hostname, () => {
        const ip = getLocalIP();
        const protocol = useHttps ? "https" : "http";
        console.log(`\n  RobotView ready (${useHttps ? "HTTPS/local" : "HTTP/cloud"}):`);
        console.log(`  - Local:    ${protocol}://localhost:${port}`);
        console.log(`  - Network:  ${protocol}://${ip}:${port}`);
        console.log(`  - PeerJS:   ${protocol}://${ip}:${port}/peerjs`);
        console.log(`\n  Broadcaster: ${protocol}://${ip}:${port}/robot-broadcaster`);
        console.log(`  Dashboard:   ${protocol}://${ip}:${port}/dashboard\n`);
    });
});

function getLocalIP() {
    const os = require("os");
    const interfaces = os.networkInterfaces();
    for (const nets of Object.values(interfaces)) {
        if (!nets) continue;
        for (const net of nets) {
            if (!net.internal && net.family === "IPv4") {
                return net.address;
            }
        }
    }
    return "0.0.0.0";
}

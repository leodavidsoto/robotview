// Shared PeerJS + WebRTC configuration
// Used by: dashboard, robot-broadcaster, stream viewer

export function getPeerConfig() {
    if (typeof window === "undefined") return {};

    const isLocalhost =
        window.location.hostname === "localhost" ||
        window.location.hostname === "127.0.0.1" ||
        window.location.hostname.startsWith("192.168.");

    const isSecure = window.location.protocol === "https:";

    // ICE servers (STUN + free TURN for international connections)
    const iceConfig = {
        iceServers: [
            { urls: "stun:stun.l.google.com:19302" },
            { urls: "stun:stun1.l.google.com:19302" },
            { urls: "stun:stun2.l.google.com:19302" },
            { urls: "stun:stun3.l.google.com:19302" },
            { urls: "stun:stun4.l.google.com:19302" },
            // Free TURN servers (OpenRelay by Metered — for international connections)
            {
                urls: "turn:openrelay.metered.ca:80",
                username: "openrelayproject",
                credential: "openrelayproject",
            },
            {
                urls: "turn:openrelay.metered.ca:443",
                username: "openrelayproject",
                credential: "openrelayproject",
            },
            {
                urls: "turn:openrelay.metered.ca:443?transport=tcp",
                username: "openrelayproject",
                credential: "openrelayproject",
            },
        ],
    };

    if (isLocalhost) {
        // Local development: use our own PeerJS server
        return {
            host: window.location.hostname,
            port: Number(window.location.port) || (isSecure ? 443 : 80),
            path: "/peerjs",
            secure: isSecure,
            debug: 1,
            config: iceConfig,
        };
    } else {
        // Cloud deployment (Vercel, etc.): use free PeerJS Cloud
        return {
            host: "0.peerjs.com",
            port: 443,
            secure: true,
            debug: 1,
            config: iceConfig,
        };
    }
}

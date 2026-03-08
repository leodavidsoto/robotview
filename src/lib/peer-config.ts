// Shared PeerJS + WebRTC configuration
// Used by: dashboard, robot-broadcaster, stream viewer

export function getPeerConfig() {
    const isSecure = typeof window !== "undefined" && window.location.protocol === "https:";

    return {
        host: typeof window !== "undefined" ? window.location.hostname : "localhost",
        port: typeof window !== "undefined" ? (Number(window.location.port) || (isSecure ? 443 : 80)) : 3000,
        path: "/peerjs",
        secure: isSecure,
        debug: 1,
        config: {
            iceServers: [
                // STUN servers (free, helps with NAT traversal)
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
        },
    };
}

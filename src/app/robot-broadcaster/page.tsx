"use client";

import { useEffect, useRef, useState } from "react";
import Peer, { MediaConnection } from "peerjs";
import styles from "./broadcaster.module.css";
import Link from "next/link";
import { getPeerConfig } from "@/lib/peer-config";

export default function RobotBroadcasterPage() {
    const [peerId, setPeerId] = useState("");
    const [status, setStatus] = useState<"Initializing" | "Broadcasting" | "Error">("Initializing");
    const [activeConnections, setActiveConnections] = useState<number>(0);
    const [lastCommand, setLastCommand] = useState<string>("");
    const [commandLog, setCommandLog] = useState<{ time: string, cmd: string }[]>([]);
    const [registered, setRegistered] = useState(false);

    const [videoDevices, setVideoDevices] = useState<MediaDeviceInfo[]>([]);
    const [selectedDeviceId, setSelectedDeviceId] = useState<string>("");

    const videoRef = useRef<HTMLVideoElement>(null);
    const peerInstance = useRef<Peer | null>(null);
    const localStream = useRef<MediaStream | null>(null);

    // Initialize PeerJS on mount with dynamic ID
    useEffect(() => {
        const urlParams = typeof window !== 'undefined' ? new URLSearchParams(window.location.search) : new URLSearchParams();
        const urlId = urlParams.get('id');
        const randomStr = Math.random().toString(36).substring(2, 6);
        const fixedId = urlId || `robot-cam-${randomStr}`;
        initPeerJS(fixedId);

        return () => {
            stopStream();
            if (peerInstance.current) {
                peerInstance.current.destroy();
            }
        };
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, []);

    // Enumerate camera devices
    useEffect(() => {
        const getDevices = async () => {
            try {
                if (!navigator.mediaDevices || !navigator.mediaDevices.getUserMedia) {
                    console.error("mediaDevices not available. Ensure you are using HTTPS or localhost.");
                    return;
                }

                await navigator.mediaDevices.getUserMedia({ audio: true, video: true });
                const devices = await navigator.mediaDevices.enumerateDevices();
                const videoInputs = devices.filter(d => d.kind === "videoinput");
                setVideoDevices(videoInputs);

                const backCamera = videoInputs.find(d =>
                    d.label.toLowerCase().includes("back") ||
                    d.label.toLowerCase().includes("environment") ||
                    d.label.toLowerCase().includes("trasera")
                );

                if (backCamera) {
                    setSelectedDeviceId(backCamera.deviceId);
                } else if (videoInputs.length > 0) {
                    setSelectedDeviceId(videoInputs[0].deviceId);
                }
            } catch (err) {
                console.error("Failed to enumerate devices:", err);
            }
        };

        getDevices();
    }, []);

    // Start stream when device changes
    useEffect(() => {
        if (!selectedDeviceId) return;
        startStream(selectedDeviceId);
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [selectedDeviceId]);

    // Re-register broadcaster ID every 30s to keep it alive
    useEffect(() => {
        if (!peerId) return;

        // Derive a friendly device label from userAgent
        const ua = navigator.userAgent;
        let deviceLabel = "Dispositivo";
        if (/iPad/i.test(ua)) deviceLabel = "iPad";
        else if (/iPhone/i.test(ua)) deviceLabel = "iPhone";
        else if (/Android/i.test(ua) && /Mobile/i.test(ua)) deviceLabel = "Android Phone";
        else if (/Android/i.test(ua)) deviceLabel = "Android Tablet";
        else if (/Macintosh/i.test(ua)) deviceLabel = "Mac";
        else if (/Windows/i.test(ua)) deviceLabel = "PC Windows";

        const register = () => {
            fetch("/api/broadcaster", {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({ id: peerId, label: deviceLabel }),
            })
                .then(() => setRegistered(true))
                .catch(() => setRegistered(false));
        };

        register();
        const interval = setInterval(register, 30000);

        // Deregister on unmount
        return () => {
            clearInterval(interval);
            fetch("/api/broadcaster", {
                method: "DELETE",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({ id: peerId }),
            }).catch(() => { });
        };
    }, [peerId]);

    const stopStream = () => {
        if (localStream.current) {
            localStream.current.getTracks().forEach(t => t.stop());
            localStream.current = null;
        }
    };

    const startStream = async (deviceId: string) => {
        stopStream();

        try {
            const stream = await navigator.mediaDevices.getUserMedia({
                video: { deviceId: { exact: deviceId } },
                audio: true
            });

            localStream.current = stream;
            if (videoRef.current) {
                videoRef.current.srcObject = stream;
                videoRef.current.muted = true;
            }
        } catch (err) {
            console.error("Failed to get local stream", err);
            setStatus("Error");
        }
    };

    const initPeerJS = (id: string) => {
        const peer = new Peer(id, getPeerConfig());

        peer.on("open", (actualId) => {
            setPeerId(actualId);
            setStatus("Broadcasting");
            console.log("Broadcaster ready with ID:", actualId);
        });

        peer.on("error", (err) => {
            console.error("Peer error:", err);
            setStatus("Error");
        });

        peer.on("call", (call: MediaConnection) => {
            console.log("Incoming call from:", call.peer);
            if (localStream.current) {
                call.answer(localStream.current);
            } else {
                const ctx = new AudioContext();
                const dest = ctx.createMediaStreamDestination();
                call.answer(dest.stream);
            }
        });

        peer.on("connection", (conn) => {
            console.log("New data connection from:", conn.peer);
            setActiveConnections(prev => prev + 1);

            conn.on("data", (data: unknown) => {
                const msg = data as { type?: string; payload?: string };
                if (msg && msg.type === "COMMAND") {
                    handleCommand(msg.payload || "");
                }
            });

            conn.on("close", () => {
                setActiveConnections(prev => Math.max(0, prev - 1));
            });
        });

        peerInstance.current = peer;
    };

    const handleCommand = (cmd: string) => {
        setLastCommand(cmd);
        const time = new Date().toLocaleTimeString();
        setCommandLog(prev => [{ time, cmd }, ...prev].slice(0, 10));

        // TODO: Send command to Arduino/Raspberry Pi via Serial or WebSockets
        console.log("Robot command:", cmd);
    };

    return (
        <div className={styles.container}>
            <header className={styles.header}>
                <div className={styles.brand}>
                    <span className={styles.pulseIcon}>&#x1F534;</span> Robot Broadcaster
                </div>
                <Link href="/" className="btn-secondary" style={{ padding: "8px 16px" }}>Inicio</Link>
            </header>

            <div className={styles.dashboard}>
                {/* Stream Preview Panel */}
                <div className={`glass-panel ${styles.panel}`}>
                    <div className={styles.titleRow}>
                        <h2 className={styles.panelTitle}>Vista de Camara</h2>
                        {videoDevices.length > 0 && (
                            <select
                                className={styles.cameraSelect}
                                value={selectedDeviceId}
                                onChange={(e) => setSelectedDeviceId(e.target.value)}
                            >
                                {videoDevices.map(device => (
                                    <option key={device.deviceId} value={device.deviceId}>
                                        {device.label || `Camara ${device.deviceId.substring(0, 5)}...`}
                                    </option>
                                ))}
                            </select>
                        )}
                    </div>

                    <div className={styles.videoWrapper}>
                        <video
                            ref={videoRef}
                            autoPlay
                            playsInline
                            muted
                            className={styles.videoPreview}
                        />

                        <div className={styles.hudOverlay}>
                            <div className={styles.hudElement}>SIG: {status}</div>
                            <div className={styles.hudElement}>ID: {peerId || "..."}</div>
                            <div className={styles.hudElement}>REG: {registered ? "OK" : "..."}</div>
                        </div>

                        <div className={styles.crosshair}>+</div>
                    </div>
                </div>

                {/* Telemetry Panel */}
                <div className={`glass-panel ${styles.panel} ${styles.telemetryPanel}`}>
                    <h2 className={styles.panelTitle}>Telemetria y Control</h2>

                    <div className={styles.statGrid}>
                        <div className={styles.statBox}>
                            <div className={styles.statLabel}>Estado</div>
                            <div className={`${styles.statValue} ${status === "Broadcasting" ? styles.textGreen : styles.textRed}`}>
                                {status}
                            </div>
                        </div>

                        <div className={styles.statBox}>
                            <div className={styles.statLabel}>Viewers</div>
                            <div className={styles.statValue}>{activeConnections}</div>
                        </div>
                    </div>

                    {peerId && (
                        <div className={styles.commandCenter} style={{ marginBottom: '1rem' }}>
                            <div className={styles.statLabel}>Peer ID (para conexion manual)</div>
                            <div className={styles.bigCommand} style={{ fontSize: '1rem', wordBreak: 'break-all' }}>
                                {peerId}
                            </div>
                        </div>
                    )}

                    <div className={styles.commandCenter}>
                        <div className={styles.statLabel}>Ultimo Comando Recibido</div>
                        <div className={styles.bigCommand}>
                            {lastCommand || "ESPERANDO..."}
                        </div>
                    </div>

                    <div className={styles.logSection}>
                        <div className={styles.statLabel}>Registro de Eventos</div>
                        <div className={styles.logBox}>
                            {commandLog.length === 0 && <span className={styles.logEmpty}>Sin actividad reciente</span>}
                            {commandLog.map((log, i) => (
                                <div key={i} className={styles.logEntry}>
                                    <span className={styles.logTime}>[{log.time}]</span>
                                    <span className={styles.logCommand}>CMD: {log.cmd}</span>
                                </div>
                            ))}
                        </div>
                    </div>
                </div>
            </div>
        </div>
    );
}

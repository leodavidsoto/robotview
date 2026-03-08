"use client";

import { useEffect, useRef, useState, useCallback } from "react";
import Peer, { DataConnection } from "peerjs";
import styles from "./dashboard.module.css";
import Link from "next/link";
import { getPeerConfig } from "@/lib/peer-config";

interface BroadcasterInfo {
    id: string;
    label: string;
    lastUpdated: number;
}

export default function DashboardPage() {
    const [peerId, setPeerId] = useState("");
    const [targetId, setTargetId] = useState("");
    const [manualId, setManualId] = useState("");
    const [connectionStatus, setConnectionStatus] = useState<"Disconnected" | "Connecting" | "Connected">("Disconnected");
    const [broadcasters, setBroadcasters] = useState<BroadcasterInfo[]>([]);

    const videoRef = useRef<HTMLVideoElement>(null);
    const peerInstance = useRef<Peer | null>(null);
    const dataConnection = useRef<DataConnection | null>(null);
    const connectionStatusRef = useRef<"Disconnected" | "Connecting" | "Connected">("Disconnected");
    const retryCount = useRef(0);
    const maxRetries = 5;
    const callSucceededRef = useRef(false);
    const currentCallRef = useRef<ReturnType<Peer["call"]> | null>(null);

    // Keep ref in sync with state
    useEffect(() => {
        connectionStatusRef.current = connectionStatus;
    }, [connectionStatus]);

    // Poll active broadcasters every 5s
    useEffect(() => {
        const fetchBroadcasters = () => {
            fetch("/api/broadcaster")
                .then(res => res.json())
                .then(data => {
                    if (data.broadcasters) {
                        setBroadcasters(data.broadcasters);
                    }
                })
                .catch(() => { });
        };

        fetchBroadcasters();
        const interval = setInterval(fetchBroadcasters, 5000);
        return () => clearInterval(interval);
    }, []);

    const sendCommand = useCallback((cmd: string) => {
        if (dataConnection.current && dataConnection.current.open) {
            dataConnection.current.send({ type: "COMMAND", payload: cmd });
            console.log("Sent command:", cmd);
        }
    }, []);

    const connectDataChannel = useCallback((targetPeerId: string) => {
        if (!peerInstance.current) return;

        console.log("Initiating data connection...");
        const conn = peerInstance.current.connect(targetPeerId);

        if (!conn) {
            console.error("Failed to create data connection.");
            return;
        }

        conn.on("open", () => {
            setConnectionStatus("Connected");
            dataConnection.current = conn;
            retryCount.current = 0;
            console.log("Data connection established!");
        });

        conn.on("close", () => {
            console.log("Data connection closed");
            setConnectionStatus("Disconnected");
            dataConnection.current = null;
        });

        conn.on("error", (err) => {
            console.error("Data connection error:", err);
        });
    }, []);

    const handleConnectionFailure = useCallback(() => {
        if (retryCount.current < maxRetries) {
            retryCount.current++;
            console.log(`Retrying connection... attempt ${retryCount.current}/${maxRetries}`);
            setTimeout(() => {
                connectToRobotRef.current?.();
            }, 3000);
        } else {
            console.log("Max retries reached.");
            setConnectionStatus("Disconnected");
            retryCount.current = 0;
        }
    }, []);

    const disconnectFromRobot = useCallback(() => {
        if (currentCallRef.current) {
            currentCallRef.current.close();
            currentCallRef.current = null;
        }
        if (dataConnection.current) {
            dataConnection.current.close();
            dataConnection.current = null;
        }
        if (videoRef.current) {
            videoRef.current.srcObject = null;
        }
        setConnectionStatus("Disconnected");
        setTargetId("");
        retryCount.current = 0;
        callSucceededRef.current = false;
        console.log("Disconnected from robot.");
    }, []);

    const connectToRobot = useCallback(() => {
        if (!peerInstance.current || !targetId) return;

        setConnectionStatus("Connecting");
        console.log(`Connecting to broadcaster: ${targetId}`);

        const ctx = new AudioContext();
        const dest = ctx.createMediaStreamDestination();

        // Create a dummy video track so the WebRTC offer includes an m=video line.
        const canvas = document.createElement("canvas");
        canvas.width = 1;
        canvas.height = 1;
        const canvasStream = canvas.captureStream(1);

        const combinedStream = new MediaStream([
            ...dest.stream.getAudioTracks(),
            ...canvasStream.getVideoTracks()
        ]);

        callSucceededRef.current = false;
        const actualCall = peerInstance.current.call(targetId, combinedStream);

        if (!actualCall) {
            console.error("Failed to create call object.");
            handleConnectionFailure();
            return;
        }

        currentCallRef.current = actualCall;

        actualCall.on("stream", (remoteStream) => {
            console.log("Receiving remote video stream!", remoteStream.getTracks());
            callSucceededRef.current = true;
            if (videoRef.current) {
                videoRef.current.srcObject = remoteStream;
                videoRef.current.play().catch(e => console.error("Error playing video:", e));
            }
            connectDataChannel(targetId);
        });

        actualCall.on("error", (err) => {
            console.error("Call error:", err);
            handleConnectionFailure();
        });

        actualCall.on("close", () => {
            console.log("Call closed");
            setConnectionStatus("Disconnected");
        });

        if (actualCall.peerConnection) {
            actualCall.peerConnection.addEventListener('iceconnectionstatechange', () => {
                console.log("ICE Connection State:", actualCall.peerConnection.iceConnectionState);
            });
        }

        setTimeout(() => {
            if (!callSucceededRef.current) {
                console.warn("Call timed out after 5 seconds");
                if (actualCall) actualCall.close();
                handleConnectionFailure();
            }
        }, 5000);
    }, [targetId, connectDataChannel, handleConnectionFailure]);

    // Store latest connectToRobot in a ref for retry access
    const connectToRobotRef = useRef(connectToRobot);
    useEffect(() => {
        connectToRobotRef.current = connectToRobot;
    }, [connectToRobot]);

    // Initialize PeerJS once on mount
    useEffect(() => {
        const peer = new Peer(getPeerConfig());

        peer.on("open", (id) => {
            console.log("Dashboard peer open with ID:", id);
            setPeerId(id);
        });

        peer.on("error", (err) => {
            console.error("PeerJS error:", err);
            setConnectionStatus("Disconnected");
        });

        peerInstance.current = peer;

        const handleKeyDown = (e: KeyboardEvent) => {
            if (connectionStatusRef.current !== "Connected") return;

            let command = null;
            switch (e.key) {
                case "ArrowUp":
                case "w":
                    command = "FORWARD";
                    break;
                case "ArrowDown":
                case "s":
                    command = "BACKWARD";
                    break;
                case "ArrowLeft":
                case "a":
                    command = "LEFT";
                    break;
                case "ArrowRight":
                case "d":
                    command = "RIGHT";
                    break;
            }

            if (command) {
                sendCommand(command);
            }
        };

        window.addEventListener("keydown", handleKeyDown);

        return () => {
            window.removeEventListener("keydown", handleKeyDown);
            peer.destroy();
        };
    }, [sendCommand]);

    // Auto-connect when targetId changes and we're disconnected
    useEffect(() => {
        if (peerId && targetId && connectionStatus === "Disconnected") {
            connectToRobot();
        }
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [peerId, targetId]);

    const handleSelectBroadcaster = (id: string) => {
        if (connectionStatus === "Connected" || connectionStatus === "Connecting") {
            disconnectFromRobot();
        }
        setTimeout(() => setTargetId(id), 100);
    };

    const handleManualConnect = () => {
        if (!manualId.trim()) return;
        handleSelectBroadcaster(manualId.trim());
    };

    const getDeviceIcon = (label: string) => {
        if (/iphone/i.test(label)) return "📱";
        if (/ipad/i.test(label)) return "📱";
        if (/android.*phone/i.test(label)) return "📱";
        if (/android.*tablet/i.test(label)) return "📱";
        if (/mac/i.test(label)) return "💻";
        if (/windows/i.test(label)) return "🖥️";
        return "📡";
    };

    return (
        <div className={styles.container}>
            <header className={styles.header}>
                <div className={styles.brand}>RobotView <span className={styles.vipBadge}>LIVE</span></div>
                <div className={styles.statusPanel}>
                    <span className={`${styles.statusDot} ${styles[connectionStatus]}`}></span>
                    {connectionStatus}
                    {connectionStatus !== "Disconnected" && targetId && (
                        <span className={styles.connectedTo}>→ {targetId}</span>
                    )}
                </div>
                <Link href="/" className={styles.logoutBtn}>Inicio</Link>
            </header>

            <main className={styles.mainContent}>
                <div className={`glass-panel ${styles.videoContainer}`}>
                    <video
                        ref={videoRef}
                        autoPlay
                        playsInline
                        className={styles.videoPlayer}
                        muted
                    />

                    {connectionStatus !== "Connected" && (
                        <div className={styles.overlay}>
                            <h2 className={styles.overlayTitle}>
                                {connectionStatus === "Connecting"
                                    ? "Conectando al robot..."
                                    : "Selecciona un dispositivo"}
                            </h2>

                            {connectionStatus === "Disconnected" && (
                                <div className={styles.deviceSelector}>
                                    {broadcasters.length > 0 ? (
                                        <div className={styles.deviceGrid}>
                                            {broadcasters.map((b) => (
                                                <button
                                                    key={b.id}
                                                    className={styles.deviceCard}
                                                    onClick={() => handleSelectBroadcaster(b.id)}
                                                >
                                                    <span className={styles.deviceIcon}>{getDeviceIcon(b.label)}</span>
                                                    <span className={styles.deviceLabel}>{b.label}</span>
                                                    <span className={styles.deviceId}>{b.id}</span>
                                                    <span className={styles.deviceLive}>● EN VIVO</span>
                                                </button>
                                            ))}
                                        </div>
                                    ) : (
                                        <p className={styles.noDevices}>
                                            No hay dispositivos transmitiendo.<br />
                                            <span className={styles.noDevicesHint}>Abre /robot-broadcaster en un celular o tablet.</span>
                                        </p>
                                    )}

                                    <div className={styles.manualSection}>
                                        <span className={styles.manualLabel}>o conectar manualmente:</span>
                                        <div className={styles.connectForm}>
                                            <input
                                                type="text"
                                                value={manualId}
                                                onChange={(e) => setManualId(e.target.value)}
                                                placeholder="ID del broadcaster"
                                                className={styles.idInput}
                                                onKeyDown={(e) => e.key === "Enter" && handleManualConnect()}
                                            />
                                            <button onClick={handleManualConnect} className="btn-primary" disabled={!manualId.trim()}>
                                                Conectar
                                            </button>
                                        </div>
                                    </div>
                                </div>
                            )}
                        </div>
                    )}

                    {connectionStatus === "Connected" && (
                        <div className={styles.controlsOverlay}>
                            <button onClick={disconnectFromRobot} className={styles.disconnectBtn}>
                                ✕ Desconectar
                            </button>
                            <div className={styles.dpad}>
                                <button onPointerDown={() => sendCommand("FORWARD")} className={`${styles.dpadBtn} ${styles.up}`}>&#9650;</button>
                                <div className={styles.dpadRow}>
                                    <button onPointerDown={() => sendCommand("LEFT")} className={`${styles.dpadBtn} ${styles.left}`}>&#9664;</button>
                                    <button onPointerDown={() => sendCommand("BACKWARD")} className={`${styles.dpadBtn} ${styles.down}`}>&#9660;</button>
                                    <button onPointerDown={() => sendCommand("RIGHT")} className={`${styles.dpadBtn} ${styles.right}`}>&#9654;</button>
                                </div>
                            </div>
                            <p className={styles.controlsHint}>Usa WASD o las flechas del teclado</p>
                        </div>
                    )}
                </div>
            </main>
        </div>
    );
}

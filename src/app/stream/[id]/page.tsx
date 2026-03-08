"use client";

import { useEffect, useRef, useState, useCallback } from "react";
import { useParams } from "next/navigation";
import Peer, { DataConnection } from "peerjs";
import styles from "./stream.module.css";
import Link from "next/link";
import { getPeerConfig } from "@/lib/peer-config";

interface PackageInfo {
    id: string;
    name: string;
    minutes: number;
    price: number;
    currency: string;
}

interface QueueViewer {
    viewerName: string;
    packageName: string;
    position: number;
    isActive: boolean;
}

interface ViewerStatus {
    position: number;
    isActive: boolean;
    remainingMinutes: number;
    estimatedWaitMinutes: number;
}

export default function StreamPage() {
    const params = useParams();
    const broadcasterId = decodeURIComponent(params.id as string);

    const [viewerName] = useState(() => `viewer-${Math.random().toString(36).substring(2, 8)}`);
    const [peerId, setPeerId] = useState("");
    const [connectionStatus, setConnectionStatus] = useState<"idle" | "queued" | "connecting" | "watching">("idle");
    const [packages, setPackages] = useState<PackageInfo[]>([]);
    const [selectedPackage, setSelectedPackage] = useState<PackageInfo | null>(null);
    const [queue, setQueue] = useState<QueueViewer[]>([]);
    const [myStatus, setMyStatus] = useState<ViewerStatus | null>(null);
    const [remainingSeconds, setRemainingSeconds] = useState(0);

    const videoRef = useRef<HTMLVideoElement>(null);
    const peerInstance = useRef<Peer | null>(null);
    const dataConnection = useRef<DataConnection | null>(null);
    const currentCallRef = useRef<ReturnType<Peer["call"]> | null>(null);
    const pollIntervalRef = useRef<NodeJS.Timeout | null>(null);
    const timerIntervalRef = useRef<NodeJS.Timeout | null>(null);

    // Fetch packages on mount
    useEffect(() => {
        fetch("/api/packages")
            .then(res => res.json())
            .then(data => setPackages(data.packages || []))
            .catch(() => { });
    }, []);

    // Initialize PeerJS
    useEffect(() => {
        const peer = new Peer(getPeerConfig());

        peer.on("open", (id) => {
            setPeerId(id);
            console.log("Viewer peer open:", id);
        });

        peer.on("error", (err) => {
            console.error("PeerJS error:", err);
        });

        peerInstance.current = peer;

        return () => {
            peer.destroy();
            if (pollIntervalRef.current) clearInterval(pollIntervalRef.current);
            if (timerIntervalRef.current) clearInterval(timerIntervalRef.current);
        };
    }, []);

    // Poll queue status
    const pollQueue = useCallback(() => {
        fetch(`/api/queue?broadcasterId=${encodeURIComponent(broadcasterId)}&viewerName=${encodeURIComponent(viewerName)}`)
            .then(res => res.json())
            .then(data => {
                setQueue(data.queue || []);
                if (data.viewer) {
                    setMyStatus(data.viewer);

                    // If it's my turn and I'm not yet watching, connect!
                    if (data.viewer.isActive && connectionStatus === "queued") {
                        connectVideo();
                    }

                    // Update timer
                    if (data.viewer.isActive) {
                        setRemainingSeconds(Math.round(data.viewer.remainingMinutes * 60));
                    }
                }
            })
            .catch(() => { });
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [broadcasterId, viewerName, connectionStatus]);

    // Start polling when queued
    useEffect(() => {
        if (connectionStatus === "queued" || connectionStatus === "watching") {
            pollQueue();
            pollIntervalRef.current = setInterval(pollQueue, 3000);
            return () => {
                if (pollIntervalRef.current) clearInterval(pollIntervalRef.current);
            };
        }
    }, [connectionStatus, pollQueue]);

    // Countdown timer when watching
    useEffect(() => {
        if (connectionStatus === "watching" && remainingSeconds > 0) {
            timerIntervalRef.current = setInterval(() => {
                setRemainingSeconds(prev => {
                    if (prev <= 1) {
                        disconnectVideo();
                        return 0;
                    }
                    return prev - 1;
                });
            }, 1000);
            return () => {
                if (timerIntervalRef.current) clearInterval(timerIntervalRef.current);
            };
        }
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [connectionStatus, remainingSeconds > 0]);

    const connectVideo = useCallback(() => {
        if (!peerInstance.current || !broadcasterId) return;

        setConnectionStatus("connecting");
        console.log("Connecting video to:", broadcasterId);

        // Increment viewer count
        fetch("/api/broadcaster", {
            method: "PATCH",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ id: broadcasterId, viewerDelta: 1 }),
        }).catch(() => { });

        const canvas = document.createElement("canvas");
        canvas.width = 1;
        canvas.height = 1;
        const canvasStream = canvas.captureStream(1);

        const ctx = new AudioContext();
        const dest = ctx.createMediaStreamDestination();
        const combinedStream = new MediaStream([
            ...dest.stream.getAudioTracks(),
            ...canvasStream.getVideoTracks(),
        ]);

        const call = peerInstance.current.call(broadcasterId, combinedStream);
        if (!call) {
            console.error("Failed to create call.");
            return;
        }

        currentCallRef.current = call;

        call.on("stream", (remoteStream) => {
            console.log("Got remote stream!", remoteStream.getTracks());
            if (videoRef.current) {
                videoRef.current.srcObject = remoteStream;
                videoRef.current.play().catch(e => console.error("Play error:", e));
            }
            setConnectionStatus("watching");
        });

        call.on("error", (err) => {
            console.error("Call error:", err);
        });

        call.on("close", () => {
            console.log("Call closed");
        });

        // Data channel for commands
        const conn = peerInstance.current.connect(broadcasterId);
        if (conn) {
            conn.on("open", () => {
                dataConnection.current = conn;
            });
        }
    }, [broadcasterId]);

    const disconnectVideo = useCallback(() => {
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

        // Decrement viewer count
        fetch("/api/broadcaster", {
            method: "PATCH",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ id: broadcasterId, viewerDelta: -1 }),
        }).catch(() => { });

        // Leave queue
        fetch("/api/queue", {
            method: "DELETE",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ broadcasterId, viewerName }),
        }).catch(() => { });

        setConnectionStatus("idle");
        setMyStatus(null);
        setRemainingSeconds(0);
        setSelectedPackage(null);
    }, [broadcasterId, viewerName]);

    // Cleanup on unmount
    useEffect(() => {
        return () => {
            // eslint-disable-next-line react-hooks/exhaustive-deps
            if (connectionStatus !== "idle") {
                fetch("/api/queue", {
                    method: "DELETE",
                    headers: { "Content-Type": "application/json" },
                    body: JSON.stringify({ broadcasterId, viewerName }),
                }).catch(() => { });

                fetch("/api/broadcaster", {
                    method: "PATCH",
                    headers: { "Content-Type": "application/json" },
                    body: JSON.stringify({ id: broadcasterId, viewerDelta: -1 }),
                }).catch(() => { });
            }
        };
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, []);

    const joinQueue = () => {
        if (!selectedPackage) return;

        fetch("/api/queue", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({
                broadcasterId,
                viewerName,
                packageMinutes: selectedPackage.minutes,
                packageName: selectedPackage.name,
            }),
        })
            .then(res => res.json())
            .then(data => {
                if (data.ok) {
                    setConnectionStatus("queued");
                }
            })
            .catch(err => console.error("Join queue error:", err));
    };

    const formatTime = (seconds: number) => {
        const m = Math.floor(seconds / 60);
        const s = seconds % 60;
        return `${m}:${s.toString().padStart(2, "0")}`;
    };

    const formatPrice = (price: number) => {
        return `$${price.toLocaleString("es-CL")}`;
    };

    return (
        <div className={styles.container}>
            {/* Top Bar */}
            <header className={styles.topBar}>
                <Link href="/" className={styles.backBtn}>← Volver</Link>
                <div className={styles.streamTitle}>
                    <span className={styles.streamLive}>● LIVE</span>
                    <span>{broadcasterId}</span>
                </div>
                <div className={styles.viewerCount}>👁 {queue.length} en cola</div>
            </header>

            <div className={styles.content}>
                {/* Video Area */}
                <div className={styles.videoArea}>
                    <div className={styles.videoWrapper}>
                        <video
                            ref={videoRef}
                            autoPlay
                            playsInline
                            muted
                            className={styles.videoPlayer}
                        />

                        {connectionStatus !== "watching" && (
                            <div className={styles.videoOverlay}>
                                {connectionStatus === "idle" && (
                                    <div className={styles.overlayContent}>
                                        <div className={styles.overlayIcon}>📡</div>
                                        <h2>Stream en Vivo</h2>
                                        <p className={styles.overlayHint}>Selecciona un paquete para unirte</p>
                                    </div>
                                )}
                                {connectionStatus === "queued" && myStatus && (
                                    <div className={styles.overlayContent}>
                                        <div className={styles.queuePosition}>
                                            <span className={styles.queueNumber}>{myStatus.position + 1}</span>
                                            <span className={styles.queueLabel}>en la cola</span>
                                        </div>
                                        <p className={styles.overlayHint}>
                                            Espera estimada: ~{Math.ceil(myStatus.estimatedWaitMinutes)} min
                                        </p>
                                        <button onClick={disconnectVideo} className={styles.leaveBtn}>
                                            Salir de la cola
                                        </button>
                                    </div>
                                )}
                                {connectionStatus === "connecting" && (
                                    <div className={styles.overlayContent}>
                                        <div className={styles.spinner}></div>
                                        <p>Conectando...</p>
                                    </div>
                                )}
                            </div>
                        )}

                        {/* Timer overlay when watching */}
                        {connectionStatus === "watching" && (
                            <div className={styles.timerOverlay}>
                                <span className={`${styles.timer} ${remainingSeconds < 60 ? styles.timerWarning : ""}`}>
                                    ⏱ {formatTime(remainingSeconds)}
                                </span>
                            </div>
                        )}
                    </div>
                </div>

                {/* Sidebar */}
                <aside className={styles.sidebar}>
                    {/* Package Selector */}
                    {connectionStatus === "idle" && (
                        <div className={`${styles.sidePanel} glass-panel`}>
                            <h3 className={styles.sidePanelTitle}>🎟️ Paquetes</h3>
                            <div className={styles.packageList}>
                                {packages.map(pkg => (
                                    <button
                                        key={pkg.id}
                                        className={`${styles.packageCard} ${selectedPackage?.id === pkg.id ? styles.packageSelected : ""}`}
                                        onClick={() => setSelectedPackage(pkg)}
                                    >
                                        <div className={styles.packageHeader}>
                                            <span className={styles.packageName}>{pkg.name}</span>
                                            <span className={styles.packagePrice}>{formatPrice(pkg.price)}</span>
                                        </div>
                                        <span className={styles.packageTime}>{pkg.minutes} minutos</span>
                                    </button>
                                ))}
                            </div>
                            <button
                                className={styles.joinBtn}
                                disabled={!selectedPackage || !peerId}
                                onClick={joinQueue}
                            >
                                {selectedPackage
                                    ? `Unirse — ${selectedPackage.name} (${selectedPackage.minutes} min)`
                                    : "Selecciona un paquete"}
                            </button>
                        </div>
                    )}

                    {/* Queue Status */}
                    {(connectionStatus === "queued" || connectionStatus === "watching") && (
                        <div className={`${styles.sidePanel} glass-panel`}>
                            <h3 className={styles.sidePanelTitle}>📋 Cola de Espera</h3>
                            <div className={styles.queueList}>
                                {queue.length === 0 && (
                                    <p className={styles.queueEmpty}>Cola vacía</p>
                                )}
                                {queue.map((q, i) => (
                                    <div
                                        key={i}
                                        className={`${styles.queueItem} ${q.viewerName === viewerName ? styles.queueItemMe : ""} ${q.isActive ? styles.queueItemActive : ""}`}
                                    >
                                        <span className={styles.queueItemPos}>#{q.position + 1}</span>
                                        <span className={styles.queueItemName}>
                                            {q.viewerName === viewerName ? "Tú" : q.viewerName}
                                        </span>
                                        <span className={styles.queueItemPkg}>{q.packageName}</span>
                                        {q.isActive && <span className={styles.queueItemLive}>▶ Viendo</span>}
                                    </div>
                                ))}
                            </div>
                        </div>
                    )}

                    {/* Session Info when watching */}
                    {connectionStatus === "watching" && (
                        <div className={`${styles.sidePanel} glass-panel`}>
                            <h3 className={styles.sidePanelTitle}>⏱️ Tu Sesión</h3>
                            <div className={styles.sessionInfo}>
                                <div className={styles.sessionTimer}>
                                    <span className={styles.sessionTimeLabel}>Tiempo restante</span>
                                    <span className={`${styles.sessionTimeValue} ${remainingSeconds < 60 ? styles.timerWarning : ""}`}>
                                        {formatTime(remainingSeconds)}
                                    </span>
                                </div>
                                <div className={styles.sessionPkg}>
                                    Paquete: <strong>{selectedPackage?.name}</strong>
                                </div>
                                <button onClick={disconnectVideo} className={styles.endSessionBtn}>
                                    ✕ Terminar sesión
                                </button>
                            </div>
                        </div>
                    )}

                    {/* Disconnect when watching */}
                    {connectionStatus === "watching" && (
                        <div className={`${styles.sidePanel} glass-panel`}>
                            <h3 className={styles.sidePanelTitle}>🎮 Controles</h3>
                            <p className={styles.controlsNote}>Los controles de movimiento están disponibles en el Dashboard (admin).</p>
                        </div>
                    )}
                </aside>
            </div>
        </div>
    );
}

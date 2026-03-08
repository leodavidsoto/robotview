"use client";

import { useEffect, useRef, useState, useCallback } from "react";
import styles from "./connect.module.css";
import Link from "next/link";

interface NetworkAddress {
    name: string;
    address: string;
    type: string;
}

// QR Code generator using external API (no npm deps needed)
function generateQR(canvas: HTMLCanvasElement, text: string) {
    const size = 256;
    canvas.width = size;
    canvas.height = size;
    const ctx = canvas.getContext("2d");
    if (!ctx) return;

    const img = new Image();
    img.crossOrigin = "anonymous";
    img.onload = () => {
        ctx.fillStyle = "#ffffff";
        ctx.fillRect(0, 0, size, size);
        ctx.drawImage(img, 0, 0, size, size);
    };
    img.onerror = () => {
        ctx.fillStyle = "#ffffff";
        ctx.fillRect(0, 0, size, size);
        ctx.fillStyle = "#000000";
        ctx.font = "14px monospace";
        ctx.textAlign = "center";
        const lines = text.match(/.{1,30}/g) || [text];
        lines.forEach((line, i) => {
            ctx.fillText(line, size / 2, size / 2 - ((lines.length - 1) * 10) + i * 20);
        });
    };
    img.src = `https://api.qrserver.com/v1/create-qr-code/?size=${size}x${size}&data=${encodeURIComponent(text)}`;
}

// Friendly label for interface types
function getTypeLabel(type: string): string {
    switch (type) {
        case "usb-tethering": return "📱 USB Tethering";
        case "usb-ethernet": return "🔌 USB / Thunderbolt";
        case "wifi": return "📶 WiFi / Ethernet";
        case "vm": return "💻 Máquina Virtual";
        default: return "🌐 Red";
    }
}

export default function ConnectPage() {
    const [addresses, setAddresses] = useState<NetworkAddress[]>([]);
    const [preferredIp, setPreferredIp] = useState<string | null>(null);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState<string | null>(null);
    const [copied, setCopied] = useState(false);
    const [connectionMethod, setConnectionMethod] = useState<"hotspot" | "usb">("hotspot");
    const qrCanvasRef = useRef<HTMLCanvasElement>(null);

    const broadcasterUrl = preferredIp ? `https://${preferredIp}:3000/robot-broadcaster` : null;

    const hasUsbConnection = addresses.some(a => a.type === "usb-tethering" || a.type === "usb-ethernet");
    const hasOnlyVmAndWifi = addresses.every(a => a.type === "vm" || a.type === "wifi");

    const fetchNetworkInfo = useCallback(async () => {
        setLoading(true);
        setError(null);
        try {
            const res = await fetch("/api/network-info");
            const data = await res.json();
            setAddresses(data.addresses || []);
            setPreferredIp(data.preferred || null);
        } catch {
            setError("No se pudo detectar la red.");
        } finally {
            setLoading(false);
        }
    }, []);

    useEffect(() => {
        fetchNetworkInfo();
    }, [fetchNetworkInfo]);

    // Generate QR when URL changes
    useEffect(() => {
        if (broadcasterUrl && qrCanvasRef.current) {
            generateQR(qrCanvasRef.current, broadcasterUrl);
        }
    }, [broadcasterUrl]);

    const copyUrl = () => {
        if (broadcasterUrl) {
            navigator.clipboard.writeText(broadcasterUrl);
            setCopied(true);
            setTimeout(() => setCopied(false), 2000);
        }
    };

    return (
        <div className={styles.container}>
            <header className={styles.header}>
                <div className={styles.brand}>
                    <span className={styles.brandIcon}>📱</span> Conectar Celular
                </div>
                <Link href="/" className="btn-secondary" style={{ padding: "8px 16px" }}>Inicio</Link>
            </header>

            <div className={styles.content}>
                {/* Connection method selector */}
                <div className={`glass-panel ${styles.methodCard}`}>
                    <h2 className={styles.stepsTitle}>¿Cómo vas a conectar?</h2>
                    <div className={styles.methodButtons}>
                        <button
                            className={`${styles.methodBtn} ${connectionMethod === "hotspot" ? styles.methodActive : ""}`}
                            onClick={() => setConnectionMethod("hotspot")}
                        >
                            <span className={styles.methodIcon}>📡</span>
                            <span className={styles.methodLabel}>Hotspot del Celular</span>
                            <span className={styles.methodDesc}>El celular crea WiFi, la Mac se conecta</span>
                        </button>
                        <button
                            className={`${styles.methodBtn} ${connectionMethod === "usb" ? styles.methodActive : ""}`}
                            onClick={() => setConnectionMethod("usb")}
                        >
                            <span className={styles.methodIcon}>🔌</span>
                            <span className={styles.methodLabel}>Cable USB</span>
                            <span className={styles.methodDesc}>Conecta el celular por cable USB</span>
                        </button>
                    </div>
                </div>

                {/* Steps Card */}
                <div className={`glass-panel ${styles.stepsCard}`}>
                    <h2 className={styles.stepsTitle}>📋 Pasos</h2>
                    <ol className={styles.steps}>
                        {connectionMethod === "hotspot" ? (
                            <>
                                <li className={styles.step}>
                                    <span className={styles.stepNumber}>1</span>
                                    <span className={styles.stepText}>
                                        En tu celular, ve a <strong>Ajustes → Punto de Acceso / Hotspot</strong> y actívalo.
                                    </span>
                                </li>
                                <li className={styles.step}>
                                    <span className={styles.stepNumber}>2</span>
                                    <span className={styles.stepText}>
                                        En esta Mac, <strong>conéctate al WiFi del celular</strong> (aparece con el nombre de tu teléfono).
                                    </span>
                                </li>
                                <li className={styles.step}>
                                    <span className={styles.stepNumber}>3</span>
                                    <span className={styles.stepText}>
                                        Haz click en <strong>&quot;Actualizar&quot;</strong> abajo. La IP cambiará a la del hotspot.
                                    </span>
                                </li>
                                <li className={styles.step}>
                                    <span className={styles.stepNumber}>4</span>
                                    <span className={styles.stepText}>
                                        <strong>Escanea el código QR</strong> con la cámara del celular para abrir el broadcaster.
                                    </span>
                                </li>
                            </>
                        ) : (
                            <>
                                <li className={styles.step}>
                                    <span className={styles.stepNumber}>1</span>
                                    <span className={styles.stepText}>
                                        <strong>Conecta tu celular por USB</strong> a esta computadora.
                                    </span>
                                </li>
                                <li className={styles.step}>
                                    <span className={styles.stepNumber}>2</span>
                                    <span className={styles.stepText}>
                                        En tu celular: <strong>Ajustes → Compartir Internet → USB</strong> (iPhone) o <strong>Ajustes → Conexiones → Anclaje USB</strong> (Android).
                                    </span>
                                </li>
                                <li className={styles.step}>
                                    <span className={styles.stepNumber}>3</span>
                                    <span className={styles.stepText}>
                                        Haz click en <strong>&quot;Actualizar&quot;</strong> abajo. Debería aparecer una nueva interfaz USB.
                                    </span>
                                </li>
                                <li className={styles.step}>
                                    <span className={styles.stepNumber}>4</span>
                                    <span className={styles.stepText}>
                                        Abre el <strong>navegador del celular</strong> y escribe la URL mostrada abajo, o escanea el QR.
                                    </span>
                                </li>
                            </>
                        )}
                    </ol>
                </div>

                {/* Warning if no direct connection detected */}
                {!loading && hasOnlyVmAndWifi && !hasUsbConnection && (
                    <div className={`glass-panel ${styles.warningCard}`}>
                        <span className={styles.warningIcon}>⚠️</span>
                        <div>
                            <strong>No se detecta conexión directa con el celular</strong>
                            <p className={styles.warningText}>
                                {connectionMethod === "hotspot"
                                    ? "Asegúrate de que la Mac esté conectada al WiFi/Hotspot de tu celular, no al WiFi normal."
                                    : "Conecta el celular por USB y activa 'Compartir Internet' o 'Anclaje USB'. Luego presiona Actualizar."}
                            </p>
                        </div>
                    </div>
                )}

                {/* QR Card */}
                <div className={`glass-panel ${styles.mainCard}`}>
                    <h1 className={styles.title}>Conecta sin WiFi</h1>
                    <p className={styles.subtitle}>
                        Escanea este QR desde tu celular o escribe la URL en el navegador.
                    </p>

                    {loading ? (
                        <div className={styles.loading}>
                            <div className={styles.spinner}></div>
                            <p>Detectando red...</p>
                        </div>
                    ) : error ? (
                        <p className={styles.errorText}>{error}</p>
                    ) : broadcasterUrl ? (
                        <div className={styles.qrSection}>
                            <div className={styles.qrWrapper}>
                                <canvas ref={qrCanvasRef} width={256} height={256} />
                            </div>
                            <div className={styles.urlDisplay} title="Click para copiar" onClick={copyUrl}>
                                <span className={styles.linkIcon}>{copied ? "✅" : "🔗"}</span>
                                {broadcasterUrl}
                            </div>
                        </div>
                    ) : (
                        <p className={styles.errorText}>No se encontró ninguna interfaz de red activa.</p>
                    )}
                </div>

                {/* Network Status Card */}
                <div className={`glass-panel ${styles.statusSection}`}>
                    <div className={styles.statusHeader}>
                        <h2 className={styles.statusTitle}>🌐 Interfaces de Red</h2>
                        <button onClick={fetchNetworkInfo} className={styles.refreshBtn}>
                            ↻ Actualizar
                        </button>
                    </div>

                    {loading ? (
                        <div className={styles.loading}>
                            <div className={styles.spinner}></div>
                        </div>
                    ) : addresses.length > 0 ? (
                        <div className={styles.interfaceList}>
                            {addresses.map((addr, i) => (
                                <div
                                    key={i}
                                    className={`${styles.interfaceItem} ${addr.address === preferredIp ? styles.preferred : ""} ${addr.type === "vm" ? styles.dimmed : ""}`}
                                    onClick={() => {
                                        setPreferredIp(addr.address);
                                    }}
                                    style={{ cursor: "pointer" }}
                                >
                                    <div className={styles.interfaceInfo}>
                                        <span className={styles.interfaceType}>{getTypeLabel(addr.type)}</span>
                                        <span className={styles.interfaceName}>
                                            {addr.name}
                                            {addr.address === preferredIp && (
                                                <span className={styles.preferredBadge}>ACTIVA</span>
                                            )}
                                        </span>
                                    </div>
                                    <span className={styles.interfaceIp}>{addr.address}</span>
                                </div>
                            ))}
                        </div>
                    ) : (
                        <p className={styles.errorText}>No se detectaron interfaces activas.</p>
                    )}
                </div>
            </div>
        </div>
    );
}

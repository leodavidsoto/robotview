"use client";

import { useEffect, useRef, useState } from "react";
import styles from "./connect.module.css";
import Link from "next/link";

export default function ConnectPage() {
    const [broadcasterUrl, setBroadcasterUrl] = useState<string>("");
    const [copied, setCopied] = useState(false);
    const [qrLoaded, setQrLoaded] = useState(false);
    const [qrError, setQrError] = useState(false);
    const qrImgRef = useRef<HTMLImageElement>(null);

    // Build the broadcaster URL from current browser location
    useEffect(() => {
        const origin = window.location.origin;
        setBroadcasterUrl(`${origin}/robot-broadcaster`);
    }, []);

    const qrImageSrc = broadcasterUrl
        ? `https://api.qrserver.com/v1/create-qr-code/?size=256x256&data=${encodeURIComponent(broadcasterUrl)}`
        : "";

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
                    <span className={styles.brandIcon}>📱</span> Conectar Dispositivo
                </div>
                <Link href="/" className="btn-secondary" style={{ padding: "8px 16px" }}>← Inicio</Link>
            </header>

            <div className={styles.content}>
                {/* Steps Card */}
                <div className={`glass-panel ${styles.stepsCard}`}>
                    <h2 className={styles.stepsTitle}>📋 Cómo conectarse</h2>
                    <ol className={styles.steps}>
                        <li className={styles.step}>
                            <span className={styles.stepNumber}>1</span>
                            <span className={styles.stepText}>
                                <strong>Escanea el código QR</strong> con la cámara de tu celular, o copia la URL de abajo.
                            </span>
                        </li>
                        <li className={styles.step}>
                            <span className={styles.stepNumber}>2</span>
                            <span className={styles.stepText}>
                                Se abrirá la página de <strong>broadcaster</strong> en tu celular. Permite el acceso a la cámara.
                            </span>
                        </li>
                        <li className={styles.step}>
                            <span className={styles.stepNumber}>3</span>
                            <span className={styles.stepText}>
                                Tu stream aparecerá automáticamente en la <strong>página principal</strong>. ¡Cualquier persona puede verlo!
                            </span>
                        </li>
                    </ol>
                </div>

                {/* QR Card */}
                <div className={`glass-panel ${styles.mainCard}`}>
                    <h1 className={styles.title}>Escanea para Transmitir</h1>
                    <p className={styles.subtitle}>
                        Abre este enlace en tu celular o tablet para empezar a transmitir desde su cámara.
                    </p>

                    {broadcasterUrl ? (
                        <div className={styles.qrSection}>
                            <div className={styles.qrWrapper}>
                                {!qrLoaded && !qrError && (
                                    <div className={styles.qrPlaceholder}>
                                        <div className={styles.spinner}></div>
                                        <span>Generando QR...</span>
                                    </div>
                                )}
                                {qrError && (
                                    <div className={styles.qrPlaceholder}>
                                        <span style={{ fontSize: "2rem" }}>📱</span>
                                        <span>Copia la URL de abajo</span>
                                    </div>
                                )}
                                {/* eslint-disable-next-line @next/next/no-img-element */}
                                <img
                                    ref={qrImgRef}
                                    src={qrImageSrc}
                                    alt="QR Code para broadcaster"
                                    width={256}
                                    height={256}
                                    style={{
                                        display: qrLoaded && !qrError ? "block" : "none",
                                        borderRadius: "8px",
                                    }}
                                    onLoad={() => setQrLoaded(true)}
                                    onError={() => setQrError(true)}
                                />
                            </div>
                            <div
                                className={styles.urlDisplay}
                                title="Click para copiar"
                                onClick={copyUrl}
                            >
                                <span className={styles.linkIcon}>{copied ? "✅" : "🔗"}</span>
                                {broadcasterUrl}
                            </div>
                        </div>
                    ) : (
                        <div className={styles.loading}>
                            <div className={styles.spinner}></div>
                            <p>Cargando...</p>
                        </div>
                    )}
                </div>

                {/* Info Card */}
                <div className={`glass-panel ${styles.statusSection}`}>
                    <h2 className={styles.statusTitle}>💡 Información</h2>
                    <div className={styles.infoList}>
                        <div className={styles.infoItem}>
                            <span className={styles.infoIcon}>🌐</span>
                            <span className={styles.infoText}>
                                Cualquier persona del mundo puede abrir la URL del broadcaster en su celular para transmitir.
                            </span>
                        </div>
                        <div className={styles.infoItem}>
                            <span className={styles.infoIcon}>🔒</span>
                            <span className={styles.infoText}>
                                Las conexiones de video son peer-to-peer, cifradas de extremo a extremo con WebRTC.
                            </span>
                        </div>
                        <div className={styles.infoItem}>
                            <span className={styles.infoIcon}>📡</span>
                            <span className={styles.infoText}>
                                Los servidores TURN gratuitos garantizan la conexión incluso entre distintos países y redes.
                            </span>
                        </div>
                    </div>
                </div>
            </div>
        </div>
    );
}

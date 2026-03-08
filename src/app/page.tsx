"use client";

import { useEffect, useState, useCallback } from "react";
import styles from "./page.module.css";
import Link from "next/link";

interface BroadcasterInfo {
  id: string;
  label: string;
  title: string;
  viewers: number;
  lastUpdated: number;
}

export default function Home() {
  const [broadcasters, setBroadcasters] = useState<BroadcasterInfo[]>([]);
  const [loading, setLoading] = useState(true);

  const fetchBroadcasters = useCallback(() => {
    fetch("/api/broadcaster")
      .then(res => res.json())
      .then(data => {
        setBroadcasters(data.broadcasters || []);
        setLoading(false);
      })
      .catch(() => setLoading(false));
  }, []);

  useEffect(() => {
    fetchBroadcasters();
    const interval = setInterval(fetchBroadcasters, 5000);
    return () => clearInterval(interval);
  }, [fetchBroadcasters]);

  const getDeviceIcon = (label: string) => {
    if (/iphone/i.test(label)) return "📱";
    if (/ipad/i.test(label)) return "📱";
    if (/android/i.test(label)) return "📱";
    if (/mac/i.test(label)) return "💻";
    if (/windows/i.test(label)) return "🖥️";
    return "📡";
  };

  return (
    <div className={styles.page}>
      {/* Top Navbar */}
      <nav className={styles.navbar}>
        <div className={styles.navLeft}>
          <Link href="/" className={styles.logo}>
            <span className={styles.logoIcon}>🔴</span>
            RobotView
          </Link>
          <div className={styles.navTabs}>
            <button className={`${styles.navTab} ${styles.navTabActive}`}>🔥 En Vivo</button>
            <button className={styles.navTab}>⭐ Populares</button>
          </div>
        </div>
        <div className={styles.navRight}>
          <Link href="/robot-broadcaster" className={styles.broadcastBtn}>
            📡 Transmitir
          </Link>
          <Link href="/dashboard" className={styles.adminBtn}>
            🎛️ Dashboard
          </Link>
        </div>
      </nav>

      {/* Hero Banner */}
      <div className={styles.heroBanner}>
        <div className={styles.heroContent}>
          <h1 className={styles.heroTitle}>Experiencias en vivo. <span className={styles.heroHighlight}>Control total.</span></h1>
          <p className={styles.heroSub}>Conectate a transmisiones en tiempo real. Elige tu stream, selecciona un paquete y disfruta.</p>
        </div>
      </div>

      {/* Live Count Bar */}
      <div className={styles.liveBar}>
        <span className={styles.liveIndicator}>
          <span className={styles.liveDot}></span>
          {broadcasters.length} stream{broadcasters.length !== 1 ? "s" : ""} en vivo
        </span>
        <Link href="/connect" className={styles.connectLink}>📱 Conectar dispositivo</Link>
      </div>

      {/* Stream Grid */}
      <main className={styles.gridSection}>
        {loading ? (
          <div className={styles.loadingState}>
            <div className={styles.spinner}></div>
            <p>Cargando streams...</p>
          </div>
        ) : broadcasters.length > 0 ? (
          <div className={styles.streamGrid}>
            {broadcasters.map((b) => (
              <Link
                key={b.id}
                href={`/stream/${encodeURIComponent(b.id)}`}
                className={styles.streamCard}
              >
                <div className={styles.cardThumb}>
                  <div className={styles.thumbPlaceholder}>
                    <span className={styles.thumbIcon}>{getDeviceIcon(b.label)}</span>
                  </div>
                  <div className={styles.cardBadges}>
                    <span className={styles.liveBadge}>● LIVE</span>
                    <span className={styles.viewerBadge}>👁 {b.viewers}</span>
                  </div>
                </div>
                <div className={styles.cardInfo}>
                  <span className={styles.cardTitle}>{b.title}</span>
                  <span className={styles.cardLabel}>{b.label}</span>
                </div>
              </Link>
            ))}
          </div>
        ) : (
          <div className={styles.emptyState}>
            <div className={styles.emptyIcon}>📡</div>
            <h2 className={styles.emptyTitle}>No hay streams en vivo</h2>
            <p className={styles.emptyDesc}>
              Abre <strong>/robot-broadcaster</strong> en un celular o tablet para empezar a transmitir.
            </p>
            <div className={styles.emptyActions}>
              <Link href="/robot-broadcaster" className="btn-primary">Abrir Broadcaster</Link>
              <Link href="/connect" className="btn-secondary">Conectar Celular</Link>
            </div>
          </div>
        )}
      </main>

      {/* Footer */}
      <footer className={styles.footer}>
        <span>RobotView © 2026</span>
        <div className={styles.footerLinks}>
          <Link href="/dashboard">Dashboard</Link>
          <Link href="/connect">Conectar</Link>
          <Link href="/robot-broadcaster">Transmitir</Link>
        </div>
      </footer>
    </div>
  );
}

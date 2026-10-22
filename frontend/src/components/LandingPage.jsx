// AeroRoute — Cinematic Landing Page (Drone Fully Visible Above, Hero Positioned Down)
import React from 'react';
import { Navigation, ArrowRight, MapPin, Shield, Radio, Cpu } from 'lucide-react';

export default function LandingPage({ onLaunchDashboard, onOpenPredictions, onOpenMissions, weather }) {
  return (
    <div style={{
      height: '100vh',
      maxHeight: '100vh',
      marginTop: '-60px',
      paddingTop: '75px',
      paddingBottom: '24px',
      paddingLeft: '24px',
      paddingRight: '24px',
      overflow: 'hidden',
      position: 'relative',
      display: 'flex',
      flexDirection: 'column',
      justifyContent: 'space-between',
      alignItems: 'center',
      boxSizing: 'border-box',
    }}>
      {/* Cinematic Drone Background: Positioned slightly higher so drone body is clearly visible */}
      <div style={{
        position: 'absolute',
        inset: 0,
        backgroundImage: 'url("/mumbai-drone-bg.jpg")',
        backgroundSize: 'cover',
        backgroundPosition: 'center 22%',
        filter: 'brightness(0.9) contrast(1.05)',
        zIndex: 0,
      }} />

      {/* Atmospheric Dark Gradient Vignette: Clear in upper sky, darker at bottom for text readability */}
      <div style={{
        position: 'absolute',
        inset: 0,
        background: 'linear-gradient(180deg, rgba(2, 4, 8, 0.3) 0%, rgba(2, 4, 8, 0.1) 30%, rgba(2, 4, 8, 0.7) 65%, rgba(2, 4, 8, 0.96) 100%)',
        zIndex: 1,
      }} />

      {/* Top Section: Status Pill + Weather Badge */}
      <div style={{ position: 'relative', zIndex: 10, display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 8 }}>
        <div style={{
          display: 'inline-flex',
          alignItems: 'center',
          gap: 8,
          padding: '5px 16px',
          borderRadius: 24,
          background: 'rgba(5, 12, 24, 0.65)',
          border: '1px solid rgba(0, 212, 255, 0.3)',
          backdropFilter: 'blur(10px)',
          boxShadow: '0 0 15px rgba(0, 212, 255, 0.15)',
        }}>
          <div className="pulse-dot" />
          <span style={{
            fontSize: 11,
            fontWeight: 800,
            color: 'var(--brand-primary)',
            letterSpacing: '1.2px',
            textTransform: 'uppercase'
          }}>
            Mumbai Airspace • Autonomous Mission Control
          </span>
        </div>

        {/* Weather Badge — shown when data is available */}
        {weather && (
          <div style={{
            display: 'inline-flex',
            alignItems: 'center',
            gap: 10,
            padding: '5px 14px',
            borderRadius: 24,
            background: 'rgba(5, 12, 24, 0.65)',
            border: '1px solid rgba(0, 212, 255, 0.2)',
            backdropFilter: 'blur(10px)',
            fontSize: 11,
            color: 'var(--text-secondary)',
          }}>
            <span style={{ width: 6, height: 6, borderRadius: '50%', background: '#06ffa5', boxShadow: '0 0 6px #06ffa5', flexShrink: 0 }} />
            <strong style={{ color: 'var(--brand-primary)', fontWeight: 700 }}>Live Weather:</strong>
            <span>{weather.condition || 'Clear Sky'} • {weather.temperature_c}°C</span>
            <span style={{ borderLeft: '1px solid rgba(255,255,255,0.1)', paddingLeft: 10, fontFamily: 'JetBrains Mono, monospace', fontSize: 10.5, color: 'var(--text-primary)' }}>
              Wind {weather.wind_speed_ms} m/s | Gust {weather.wind_gust_ms} m/s
            </span>
          </div>
        )}
      </div>

      {/* Flexible Spacer to leave the drone completely visible in the middle */}
      <div style={{ flex: 1, minHeight: '260px' }} />

      {/* Bottom Section: Hero Text, CTA Button, and Floating Badges */}
      <div style={{
        position: 'relative',
        zIndex: 10,
        textAlign: 'center',
        maxWidth: 860,
        display: 'flex',
        flexDirection: 'column',
        alignItems: 'center',
        marginBottom: 0,
      }}>
        {/* Sleek Hero Title positioned in the lower area */}
        <h1 style={{
          fontSize: 'clamp(28px, 3.6vw, 48px)',
          fontWeight: 900,
          lineHeight: 1.15,
          letterSpacing: '-1px',
          marginBottom: 20,
          textShadow: '0 4px 24px rgba(0, 0, 0, 0.9)',
        }}>
          Autonomous Drone Fleet &{' '}
          <span style={{
            background: 'linear-gradient(135deg, #00d4ff 0%, #06ffa5 50%, #b275ff 100%)',
            WebkitBackgroundClip: 'text',
            WebkitTextFillColor: 'transparent',
          }}>
            Dynamic Route Optimization
          </span>
        </h1>

        {/* Crisp Subtitle */}
        <p style={{
          fontSize: 'clamp(13px, 1.1vw, 15px)',
          color: '#d4e6f9',
          maxWidth: 580,
          lineHeight: 1.45,
          marginBottom: 20,
          fontWeight: 400,
          textShadow: '0 2px 12px rgba(0, 0, 0, 0.9)',
        }}>
          {/* AI & Soft Computing mission control for autonomous delivery systems across Mumbai. */}
        </p>

        {/* CTA Buttons */}
        <div style={{ display: 'flex', gap: 16, marginBottom: 50, flexWrap: 'wrap', justifyContent: 'center' }}>
          <button
            className="btn btn-primary"
            onClick={onLaunchDashboard}
            style={{
              padding: '12px 28px',
              fontSize: 14,
              fontWeight: 800,
              borderRadius: 10,
              letterSpacing: '0.6px',
              boxShadow: '0 0 35px rgba(0, 212, 255, 0.6)',
              border: '1px solid rgba(255, 255, 255, 0.3)',
            }}
            id="launch-mission-control-btn"
          >
            <Navigation size={16} />
            Enter Mission Dispatch
            <ArrowRight size={16} />
          </button>

          {(onOpenMissions || onOpenPredictions) && (
            <button
              className="btn btn-ghost"
              onClick={onOpenMissions || onOpenPredictions}
              style={{
                padding: '12px 24px',
                fontSize: 14,
                fontWeight: 700,
                borderRadius: 10,
                letterSpacing: '0.6px',
                background: 'rgba(6, 255, 165, 0.12)',
                borderColor: 'rgba(6, 255, 165, 0.4)',
                color: 'var(--brand-accent)',
                backdropFilter: 'blur(8px)',
              }}
              id="landing-missions-btn"
            >
              <Radio size={16} />
              Live Fleet Map
            </button>
          )}
        </div>

        {/* Minimalist Bottom Floating Badges */}
        <div style={{
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          gap: 12,
          flexWrap: 'wrap',
          width: '100%',
        }}>
          {/* <div style={{
            display: 'flex',
            alignItems: 'center',
            gap: 6,
            padding: '6px 14px',
            borderRadius: 20,
            background: 'rgba(5, 12, 24, 0.8)',
            border: '1px solid rgba(0, 212, 255, 0.25)',
            backdropFilter: 'blur(10px)',
          }}>
          </div> */}

          {/* <div style={{
            display: 'flex',
            alignItems: 'center',
            gap: 6,
            padding: '6px 14px',
            borderRadius: 20,
            background: 'rgba(5, 12, 24, 0.8)',
            border: '1px solid rgba(255, 61, 87, 0.3)',
            backdropFilter: 'blur(10px)',
          }}>
          </div> */}

          {/* <div style={{
            display: 'flex',
            alignItems: 'center',
            gap: 6,
            padding: '6px 14px',
            borderRadius: 20,
            background: 'rgba(5, 12, 24, 0.8)',
            border: '1px solid rgba(6, 255, 165, 0.3)',
            backdropFilter: 'blur(10px)',
          }}>
          </div> */}
        </div>
      </div>

    </div>
  );
}

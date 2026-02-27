import React, { useId } from "react";
import styles from "./AiInsightsIcon.module.css";

interface AiInsightsIconProps {
  size?: number;
  showLabel?: boolean;
  className?: string;
  label?: string;
}

export function AiInsightsIcon({
  size = 18,
  showLabel = false,
  className = "",
  label = "AI Insights",
}: AiInsightsIconProps) {
  const id = useId();

  // Unique IDs for defs
  const nucGradId = `nucGrad-${id}`;
  const partGradId = `partGrad-${id}`;
  const partGlowId = `partGlow-${id}`;
  const nucGlowId = `nucGlow-${id}`;
  const orbit1Id = `o1-${id}`;
  const orbit2Id = `o2-${id}`;
  const orbit3Id = `o3-${id}`;

  /*
    Three orbital ellipses, each with the same semi-axes (rx=5.8, ry=1.8)
    but rotated to different angles, giving the classic atom / 量子 look.

    Orbit angles:  10° | 70° | −50°  (evenly spread ~60° apart)
    Major-axis endpoints (used as animateMotion path start/end):
      Orbit 1 (10°):  R=(14.71, 10.01)  L=(3.29, 7.99)
      Orbit 2 (70°):  R=(10.98, 14.45)  L=(7.02, 3.55)
      Orbit 3(−50°):  R=(12.73, 4.56)   L=(5.27, 13.44)
  */

  const iconContent = (
    <div className={styles.aiIcon} style={{ width: size, height: size }}>
      {/* Ambient glow halo */}
      <div className={styles.aiIconGlow} />

      <svg
        className={styles.aiIconSvg}
        viewBox="0 0 18 18"
        fill="none"
        xmlns="http://www.w3.org/2000/svg"
      >
        <defs>
          {/* ── Nucleus gradient ── */}
          <radialGradient id={nucGradId} cx="38%" cy="32%" r="65%">
            <stop offset="0%" stopColor="#ede9fe" />
            <stop offset="40%" stopColor="#8b5cf6" />
            <stop offset="100%" stopColor="#3b0764" />
          </radialGradient>

          {/* ── Particle gradient ── */}
          <radialGradient id={partGradId} cx="35%" cy="30%" r="60%">
            <stop offset="0%" stopColor="#f5f0ff" />
            <stop offset="100%" stopColor="#a78bfa" />
          </radialGradient>

          {/* ── Particle soft glow ── */}
          <filter
            id={partGlowId}
            x="-120%"
            y="-120%"
            width="340%"
            height="340%"
          >
            <feGaussianBlur stdDeviation="0.55" result="blur" />
            <feMerge>
              <feMergeNode in="blur" />
              <feMergeNode in="SourceGraphic" />
            </feMerge>
          </filter>

          {/* ── Nucleus glow ── */}
          <filter id={nucGlowId} x="-60%" y="-60%" width="220%" height="220%">
            <feGaussianBlur stdDeviation="1.1" result="blur" />
            <feMerge>
              <feMergeNode in="blur" />
              <feMergeNode in="SourceGraphic" />
            </feMerge>
          </filter>

          {/*
            ── Orbit paths for animateMotion ──
            Each path is two SVG arcs forming a complete rotated ellipse.
            Syntax: M x0 y0  A rx ry x-rotation large-arc sweep  x1 y1
                               A rx ry x-rotation large-arc sweep  x0 y0
            sweep=1 → clockwise in screen coords (y-down)
          */}
          <path
            id={orbit1Id}
            d="M 14.71 10.01
               A 5.8 1.8 10 0 1 3.29 7.99
               A 5.8 1.8 10 0 1 14.71 10.01"
          />
          <path
            id={orbit2Id}
            d="M 10.98 14.45
               A 5.8 1.8 70 0 1 7.02 3.55
               A 5.8 1.8 70 0 1 10.98 14.45"
          />
          <path
            id={orbit3Id}
            d="M 12.73 4.56
               A 5.8 1.8 -50 0 1 5.27 13.44
               A 5.8 1.8 -50 0 1 12.73 4.56"
          />
        </defs>

        {/* ── Orbital rings (static visual tracks) ── */}
        <g transform="rotate(10, 9, 9)">
          <ellipse
            cx="9"
            cy="9"
            rx="5.8"
            ry="1.8"
            stroke="rgba(167,139,250,0.22)"
            strokeWidth="0.42"
            fill="none"
            strokeDasharray="0.9 1.4"
          />
        </g>
        <g transform="rotate(70, 9, 9)">
          <ellipse
            cx="9"
            cy="9"
            rx="5.8"
            ry="1.8"
            stroke="rgba(167,139,250,0.18)"
            strokeWidth="0.42"
            fill="none"
            strokeDasharray="0.9 1.4"
          />
        </g>
        <g transform="rotate(-50, 9, 9)">
          <ellipse
            cx="9"
            cy="9"
            rx="5.8"
            ry="1.8"
            stroke="rgba(167,139,250,0.15)"
            strokeWidth="0.42"
            fill="none"
            strokeDasharray="0.9 1.4"
          />
        </g>

        {/* ── Orbiting particles ── */}
        {/* Particle 1 — orbit 1, starts at 0% phase */}
        <circle
          r="0.95"
          fill={`url(#${partGradId})`}
          filter={`url(#${partGlowId})`}
        >
          <animateMotion dur="3.2s" repeatCount="indefinite" begin="0s">
            <mpath href={`#${orbit1Id}`} />
          </animateMotion>
        </circle>

        {/* Particle 2 — orbit 2, phase-shifted by starting mid-loop */}
        <circle
          r="0.82"
          fill={`url(#${partGradId})`}
          filter={`url(#${partGlowId})`}
          opacity="0.88"
        >
          <animateMotion dur="4.6s" repeatCount="indefinite" begin="-1.8s">
            <mpath href={`#${orbit2Id}`} />
          </animateMotion>
        </circle>

        {/* Particle 3 — orbit 3, different phase + reverse feel via begin */}
        <circle
          r="0.72"
          fill={`url(#${partGradId})`}
          filter={`url(#${partGlowId})`}
          opacity="0.75"
        >
          <animateMotion dur="3.9s" repeatCount="indefinite" begin="-2.6s">
            <mpath href={`#${orbit3Id}`} />
          </animateMotion>
        </circle>

        {/* ── Nucleus ── */}
        <g filter={`url(#${nucGlowId})`} className={styles.nucleusPulse}>
          {/* Outer halo ring */}
          <circle
            cx="9"
            cy="9"
            r="2.6"
            stroke="rgba(167,139,250,0.25)"
            strokeWidth="0.35"
            fill="none"
          />
          {/* Core body */}
          <circle cx="9" cy="9" r="2.1" fill={`url(#${nucGradId})`} />
          {/* Mid bright layer */}
          <circle cx="9" cy="9" r="1.05" fill="#c4b5fd" opacity="0.65" />
          {/* Hot-white centre */}
          <circle cx="9" cy="9" r="0.48" fill="white" opacity="0.92" />
        </g>
      </svg>
    </div>
  );

  if (showLabel) {
    return (
      <div className={`${styles.aiHeaderWrapper} ${className}`}>
        {iconContent}
        <span className={styles.aiLabel}>{label}</span>
      </div>
    );
  }

  return (
    <div className={className} style={{ display: "inline-flex" }}>
      {iconContent}
    </div>
  );
}

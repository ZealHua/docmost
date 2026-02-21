import React, { useId } from 'react';
import styles from './AiInsightsIcon.module.css';

interface AiInsightsIconProps {
  size?: number;
  showLabel?: boolean;
  className?: string;
  label?: string;
}

export function AiInsightsIcon({
  size = 18,
  showLabel = false,
  className = '',
  label = 'AI Insights',
}: AiInsightsIconProps) {
  const id = useId();
  const starGradId = `starGrad-${id}`;
  const dotGradId = `dotGrad-${id}`;
  const accentGradId = `accentGrad-${id}`;
  const glowFilterId = `glow-${id}`;

  const iconContent = (
    <div className={styles.aiIcon} style={{ width: size, height: size }}>
      <div className={styles.aiIconGlow} />
      <svg
        className={styles.aiIconSvg}
        viewBox="0 0 18 18"
        fill="none"
        xmlns="http://www.w3.org/2000/svg"
      >
        <defs>
          <linearGradient id={starGradId} x1="0" y1="0" x2="18" y2="18" gradientUnits="userSpaceOnUse">
            <stop offset="0%" stopColor="#c4b5fd" />
            <stop offset="50%" stopColor="#8b5cf6" />
            <stop offset="100%" stopColor="#6d28d9" />
          </linearGradient>
          <radialGradient id={dotGradId} cx="50%" cy="50%" r="50%">
            <stop offset="0%" stopColor="#e9d5ff" />
            <stop offset="100%" stopColor="#a78bfa" />
          </radialGradient>
          <radialGradient id={accentGradId} cx="50%" cy="50%" r="50%">
            <stop offset="0%" stopColor="#fff" stopOpacity="0.9" />
            <stop offset="100%" stopColor="#c4b5fd" stopOpacity="0.6" />
          </radialGradient>
          <filter id={glowFilterId} x="-50%" y="-50%" width="200%" height="200%">
            <feGaussianBlur stdDeviation="0.8" result="blur" />
            <feMerge>
              <feMergeNode in="blur" />
              <feMergeNode in="SourceGraphic" />
            </feMerge>
          </filter>
        </defs>

        <g className={styles.aiStarCenter} filter={`url(#${glowFilterId})`}>
          <ellipse className={styles.aiStarArm} cx="9" cy="9" rx="1.5" ry="5" fill={`url(#${starGradId})`} />
          <ellipse className={styles.aiStarArm} cx="9" cy="9" rx="5" ry="1.5" fill={`url(#${starGradId})`} />
          <ellipse
            className={styles.aiStarArm}
            cx="9" cy="9" rx="3.2" ry="0.9"
            transform="rotate(45 9 9)"
            fill={`url(#${starGradId})`}
          />
          <ellipse
            className={styles.aiStarArm}
            cx="9" cy="9" rx="3.2" ry="0.9"
            transform="rotate(-45 9 9)"
            fill={`url(#${starGradId})`}
          />
          <circle cx="9" cy="9" r="1.8" fill={`url(#${starGradId})`} />
          <circle cx="9" cy="9" r="0.9" fill="#e9d5ff" />
        </g>

        <g className={styles.aiOrbit1}>
          <circle cx="9" cy="2.2" r="1.1" fill={`url(#${dotGradId})`} opacity="0.9" />
        </g>

        <g className={styles.aiOrbit2}>
          <circle cx="9" cy="2.2" r="0.75" fill={`url(#${dotGradId})`} opacity="0.65" />
        </g>

        <g className={styles.aiSparkleAccent}>
          <ellipse cx="15.5" cy="2.5" rx="0.9" ry="2.2" fill={`url(#${accentGradId})`} />
          <ellipse cx="15.5" cy="2.5" rx="2.2" ry="0.9" fill={`url(#${accentGradId})`} />
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
    <div className={className} style={{ display: 'inline-flex' }}>
      {iconContent}
    </div>
  );
}

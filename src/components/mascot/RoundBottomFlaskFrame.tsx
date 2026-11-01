import React from 'react';
import type { MascotState } from '../../types';

interface RoundBottomFlaskFrameProps {
  className?: string;
  isHovered?: boolean;
  state?: MascotState;
}

/**
 * RoundBottomFlaskFrame
 * 
 * High-precision vector laboratory round-bottom flask (圓底燒瓶) container frame.
 * Faithfully reflects the concept design:
 * - Top lip & flared mouth rim
 * - Cylindrical laboratory neck
 * - Organic spherical flask body
 * - Specular borosilicate glass reflections (upper-left arc, rim refraction, lip gleam)
 * - Subtle celestial liquid glow
 * - 100% pointer-events-none to prevent interfering with mascot dragging & interaction
 */
export const RoundBottomFlaskFrame: React.FC<RoundBottomFlaskFrameProps> = ({
  className = '',
  isHovered = false,
  state = 'idle',
}) => {
  return (
    <div
      className={`absolute inset-0 pointer-events-none select-none transition-transform duration-300 ${
        isHovered ? 'scale-[1.02]' : 'scale-100'
      } ${className}`}
      aria-hidden="true"
    >
      <svg
        viewBox="0 0 100 120"
        className="w-full h-full drop-shadow-md overflow-visible"
        preserveAspectRatio="xMidYMid meet"
      >
        <defs>
          {/* Outer Glass Soft Gradient Fill with Refined Laboratory Frosted Diffusion */}
          <linearGradient id="flaskGlassFill" x1="20%" y1="0%" x2="80%" y2="100%">
            <stop offset="0%" stopColor="#ffffff" stopOpacity="0.94" />
            <stop offset="35%" stopColor="#f8faff" stopOpacity="0.82" />
            <stop offset="70%" stopColor="#f1f4ff" stopOpacity="0.75" />
            <stop offset="100%" stopColor="#e5ebff" stopOpacity="0.88" />
          </linearGradient>

          {/* Internal Celestial Glow based on Mascot State */}
          <radialGradient id="celestialGlow" cx="50%" cy="80%" r="55%">
            <stop
              offset="0%"
              stopColor={
                state === 'thinking'
                  ? '#fef08a'
                  : state === 'excited'
                  ? '#fde047'
                  : '#c7d2fe'
              }
              stopOpacity={state === 'excited' ? '0.35' : '0.22'}
            />
            <stop offset="60%" stopColor="#e0e7ff" stopOpacity="0.08" />
            <stop offset="100%" stopColor="#ffffff" stopOpacity="0" />
          </radialGradient>

          {/* Glass Rim Stroke Gradient */}
          <linearGradient id="flaskRimStroke" x1="15%" y1="10%" x2="85%" y2="90%">
            <stop offset="0%" stopColor="#ffffff" stopOpacity="0.9" />
            <stop offset="30%" stopColor="#94a3b8" stopOpacity="0.4" />
            <stop offset="70%" stopColor="#6366f1" stopOpacity="0.3" />
            <stop offset="100%" stopColor="#a5b4fc" stopOpacity="0.55" />
          </linearGradient>

          {/* Specular Left Highlight */}
          <linearGradient id="specularGleam" x1="0%" y1="0%" x2="100%" y2="100%">
            <stop offset="0%" stopColor="#ffffff" stopOpacity="0.95" />
            <stop offset="70%" stopColor="#ffffff" stopOpacity="0.4" />
            <stop offset="100%" stopColor="#ffffff" stopOpacity="0" />
          </linearGradient>
        </defs>

        {/* ─── 1. Flask Body Backdrop Fill ──────────────────────────── */}
        {/*
          Flask Path:
          Neck top at y=6, x=36 to 64 (width 28)
          Neck straight down to y=22
          Smooth flare into circle of radius 46 centered at (50, 72)
          Arc meets circle at (15.13, 42) and (84.87, 42)
          Arc around bottom to complete sphere
        */}
        <path
          d="
            M 36 6
            L 36 22
            C 36 30, 24 36, 15.13 42
            A 46 46 0 1 0 84.87 42
            C 76 36, 64 30, 64 22
            L 64 6
            Z
          "
          fill="url(#flaskGlassFill)"
          stroke="url(#flaskRimStroke)"
          strokeWidth="1.2"
          className="backdrop-blur-[3px]"
        />

        {/* ─── 2. Internal Celestial Liquid / Atmospheric Glow ─────── */}
        <path
          d="
            M 36 6
            L 36 22
            C 36 30, 24 36, 15.13 42
            A 46 46 0 1 0 84.87 42
            C 76 36, 64 30, 64 22
            L 64 6
            Z
          "
          fill="url(#celestialGlow)"
        />

        {/* ─── 3. Scientific Laboratory Graduation Ticks ───────────── */}
        <g stroke="#94a3b8" strokeOpacity="0.35" strokeWidth="0.9" strokeLinecap="round">
          <line x1="83" y1="62" x2="87" y2="62" />
          <line x1="82" y1="74" x2="87" y2="74" />
          <line x1="80" y1="86" x2="86" y2="86" />
        </g>

        {/* ─── 4. Specular Glass Highlights (Laboratory Grade) ─────── */}
        {/* Upper-Left Bulb Curved Reflection Arc */}
        <path
          d="M 23 38 C 16 46, 8 60, 8 74 C 8 83, 11 91, 15 97"
          fill="none"
          stroke="url(#specularGleam)"
          strokeWidth="2.2"
          strokeLinecap="round"
          opacity="0.85"
        />

        {/* Neck Vertical Highlight Line */}
        <line
          x1="39"
          y1="9"
          x2="39"
          y2="23"
          stroke="#ffffff"
          strokeWidth="1.5"
          strokeLinecap="round"
          opacity="0.75"
        />

        {/* Lower-Right Soft Refractive Rim Light */}
        <path
          d="M 83 88 C 88 80, 92 70, 92 56"
          fill="none"
          stroke="#c7d2fe"
          strokeWidth="1.6"
          strokeLinecap="round"
          opacity="0.6"
        />

        {/* ─── 5. Top Mouth Flared Lip Rim (Thickened Ring) ───────── */}
        {/* Outer Flared Lip */}
        <rect
          x="32"
          y="3"
          width="36"
          height="6"
          rx="3"
          ry="3"
          fill="url(#flaskGlassFill)"
          stroke="url(#flaskRimStroke)"
          strokeWidth="1.2"
        />
        {/* Lip Inner Glass Highlight */}
        <ellipse
          cx="50"
          cy="4.5"
          rx="15"
          ry="1.8"
          fill="none"
          stroke="#ffffff"
          strokeWidth="0.9"
          opacity="0.85"
        />
      </svg>
    </div>
  );
};

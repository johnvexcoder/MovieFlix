interface MovieFlixLogoProps {
  className?: string;
  size?: number;
}

export function MovieFlixLogo({ className = "h-8 w-8", size = 48 }: MovieFlixLogoProps) {
  return (
    <svg
      viewBox="0 0 240 240"
      width={size}
      height={size}
      fill="none"
      xmlns="http://www.w3.org/2000/svg"
      className={`select-none drop-shadow-[0_2px_12px_rgba(229,9,20,0.6)] ${className}`}
    >
      <defs>
        <linearGradient id="mPillarLeft" x1="0%" y1="0%" x2="100%" y2="100%">
          <stop offset="0%" stopColor="#b20710" />
          <stop offset="40%" stopColor="#e50914" />
          <stop offset="100%" stopColor="#800208" />
        </linearGradient>
        <linearGradient id="mPillarRight" x1="0%" y1="0%" x2="100%" y2="100%">
          <stop offset="0%" stopColor="#800208" />
          <stop offset="60%" stopColor="#e50914" />
          <stop offset="100%" stopColor="#ff3b47" />
        </linearGradient>
        <linearGradient id="mSlashDown" x1="0%" y1="0%" x2="100%" y2="100%">
          <stop offset="0%" stopColor="#ff4d5a" />
          <stop offset="35%" stopColor="#e50914" />
          <stop offset="100%" stopColor="#7a0006" />
        </linearGradient>
        <linearGradient id="mSlashUp" x1="0%" y1="0%" x2="100%" y2="100%">
          <stop offset="0%" stopColor="#ff5964" />
          <stop offset="50%" stopColor="#e50914" />
          <stop offset="100%" stopColor="#6e0005" />
        </linearGradient>
        <filter id="mDropShadow" x="-20%" y="-20%" width="140%" height="140%">
          <feDropShadow dx="-3" dy="4" stdDeviation="5" floodColor="#000000" floodOpacity="0.85" />
        </filter>
      </defs>

      {/* Left Vertical Pillar */}
      <path
        d="M 32 216 L 32 24 C 32 20, 36 16, 42 16 L 70 16 C 76 16, 80 20, 80 24 L 80 216 C 80 220, 76 224, 70 224 L 42 224 C 36 224, 32 220, 32 216 Z"
        fill="url(#mPillarLeft)"
      />

      {/* Right Vertical Pillar */}
      <path
        d="M 160 216 L 160 24 C 160 20, 164 16, 170 16 L 198 16 C 204 16, 208 20, 208 24 L 208 216 C 208 220, 204 224, 198 224 L 170 224 C 164 224, 160 220, 160 216 Z"
        fill="url(#mPillarRight)"
      />

      {/* Left Diagonal (Valley Down) */}
      <path
        d="M 40 18 L 78 18 L 132 168 L 94 168 Z"
        fill="url(#mSlashDown)"
        filter="url(#mDropShadow)"
      />

      {/* Right Diagonal (Valley Up) */}
      <path
        d="M 108 168 L 146 168 L 200 18 L 162 18 Z"
        fill="url(#mSlashUp)"
        filter="url(#mDropShadow)"
      />
    </svg>
  );
}

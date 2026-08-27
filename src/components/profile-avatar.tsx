import { AVATAR_BY_ID } from "@/lib/avatars";

interface ProfileAvatarProps {
  avatarUrl: string | null | undefined;
  name: string;
  className?: string;
  emojiClassName?: string;
  showGlow?: boolean;
}

export function ProfileAvatar({
  avatarUrl,
  name,
  className = "",
  emojiClassName = "text-4xl",
  showGlow = false,
}: ProfileAvatarProps) {
  const option = avatarUrl ? AVATAR_BY_ID[avatarUrl] : null;

  const glowStyle = showGlow
    ? "ring-2 ring-red-500/80 shadow-[0_0_25px_rgba(229,9,20,0.5)]"
    : "";

  if (option) {
    return (
      <div
        className={`relative flex items-center justify-center overflow-hidden transition-all duration-300 ${glowStyle} ${className}`}
        style={{
          backgroundImage: `linear-gradient(135deg, ${option.from}, ${option.to})`,
        }}
        role="img"
        aria-label={option.label}
      >
        {/* Subtle inner top-light sheen */}
        <div className="pointer-events-none absolute inset-0 bg-gradient-to-b from-white/20 via-transparent to-black/20" />
        <span className={`relative z-10 select-none drop-shadow-xl transition-transform duration-300 ${emojiClassName}`}>
          {option.emoji}
        </span>
      </div>
    );
  }

  if (avatarUrl && avatarUrl.startsWith("data:")) {
    return (
      <div className={`relative overflow-hidden ${glowStyle} ${className}`}>
        <img
          src={avatarUrl}
          alt={name}
          className="h-full w-full object-cover"
        />
        <div className="pointer-events-none absolute inset-0 bg-gradient-to-b from-white/10 to-black/20" />
      </div>
    );
  }

  // Fallback initial monogram with vibrant gradient
  return (
    <div
      className={`relative flex items-center justify-center overflow-hidden bg-gradient-to-br from-[#e50914] via-[#b20710] to-[#590207] ${glowStyle} ${className}`}
      role="img"
      aria-label={name}
    >
      <div className="pointer-events-none absolute inset-0 bg-gradient-to-b from-white/25 via-transparent to-black/30" />
      <span className="relative z-10 font-black text-white select-none drop-shadow-[0_2px_10px_rgba(0,0,0,0.7)] text-3xl md:text-4xl">
        {(name || "A").charAt(0).toUpperCase()}
      </span>
    </div>
  );
}

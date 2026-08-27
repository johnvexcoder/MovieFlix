export const AVATAR_CATEGORIES = [
  "trending",
  "movies",
  "music",
  "animals",
  "people",
  "fantasy",
] as const;

export type AvatarCategory = (typeof AVATAR_CATEGORIES)[number];

export interface AvatarOption {
  id: string;
  emoji: string;
  from: string;
  to: string;
  label: string;
  category: AvatarCategory;
}

export const AVATAR_CATEGORY_LABELS: Record<AvatarCategory, string> = {
  trending: "Trending",
  movies: "Movies & TV",
  music: "Music & K-Pop",
  animals: "Animals",
  people: "People",
  fantasy: "Fantasy",
};

export const AVATAR_OPTIONS: AvatarOption[] = [
  // Trending
  { id: "fire", emoji: "🔥", from: "#dc2626", to: "#7f1d1d", label: "On Fire", category: "trending" },
  { id: "star", emoji: "⭐", from: "#f59e0b", to: "#92400e", label: "Star Power", category: "trending" },
  { id: "gem", emoji: "💎", from: "#0ea5e9", to: "#164e63", label: "Diamond", category: "trending" },
  { id: "crown", emoji: "👑", from: "#fbbf24", to: "#78350f", label: "The Boss", category: "trending" },
  { id: "rocket", emoji: "🚀", from: "#3b82f6", to: "#1e3a8a", label: "Blast Off", category: "trending" },
  { id: "bolt", emoji: "⚡", from: "#facc15", to: "#713f12", label: "Lightning", category: "trending" },
  { id: "cool", emoji: "😎", from: "#14b8a6", to: "#134e4a", label: "Too Cool", category: "trending" },
  { id: "starstruck", emoji: "🤩", from: "#a855f7", to: "#4c1d95", label: "Shining", category: "trending" },

  // Movies & TV
  { id: "director", emoji: "🎬", from: "#e50914", to: "#7f1d1d", label: "The Director", category: "movies" },
  { id: "popcorn", emoji: "🍿", from: "#f59e0b", to: "#7c2d12", label: "Movie Night", category: "movies" },
  { id: "camera", emoji: "🎥", from: "#475569", to: "#0f172a", label: "Cameraman", category: "movies" },
  { id: "tv", emoji: "📺", from: "#1d4ed8", to: "#0f172a", label: "Box Set Binge", category: "movies" },
  { id: "detective", emoji: "🕵️", from: "#6b7280", to: "#111827", label: "The Detective", category: "movies" },
  { id: "cowboy", emoji: "🤠", from: "#b45309", to: "#451a03", label: "The Cowboy", category: "movies" },
  { id: "zombie", emoji: "🧟", from: "#22c55e", to: "#14532d", label: "Horror Night", category: "movies" },
  { id: "robot", emoji: "🤖", from: "#64748b", to: "#0f172a", label: "Robots", category: "movies" },
  { id: "ufo", emoji: "🛸", from: "#8b5cf6", to: "#312e81", label: "Out of This World", category: "movies" },
  { id: "skull", emoji: "💀", from: "#374151", to: "#0f172a", label: "Thrill Seeker", category: "movies" },
  { id: "archer", emoji: "🏹", from: "#16a34a", to: "#14532d", label: "The Archer", category: "movies" },

  // Music & K-Pop
  { id: "mic", emoji: "🎤", from: "#ec4899", to: "#831843", label: "K-Pop Star", category: "music" },
  { id: "guitar", emoji: "🎸", from: "#f97316", to: "#7c2d12", label: "Guitar Hero", category: "music" },
  { id: "headphones", emoji: "🎧", from: "#8b5cf6", to: "#4c1d95", label: "DJ Vibe", category: "music" },
  { id: "piano", emoji: "🎹", from: "#64748b", to: "#1e293b", label: "Pianist", category: "music" },
  { id: "drum", emoji: "🥁", from: "#dc2626", to: "#450a0a", label: "Drummer", category: "music" },
  { id: "purple-heart", emoji: "💜", from: "#a855f7", to: "#581c87", label: "Ultimate Fan", category: "music" },
  { id: "note", emoji: "🎵", from: "#14b8a6", to: "#134e4a", label: "Music Lover", category: "music" },
  { id: "dancer", emoji: "🕺", from: "#fbbf24", to: "#92400e", label: "Rising Star", category: "music" },
  { id: "trumpet", emoji: "🎺", from: "#f59e0b", to: "#78350f", label: "Sax & City", category: "music" },

  // Animals
  { id: "whale", emoji: "🐳", from: "#0ea5e9", to: "#0c4a6e", label: "The Whale", category: "animals" },
  { id: "penguin", emoji: "🐧", from: "#334155", to: "#0f172a", label: "The Penguin", category: "animals" },
  { id: "shark", emoji: "🦈", from: "#64748b", to: "#1e3a8a", label: "The Shark", category: "animals" },
  { id: "lion", emoji: "🦁", from: "#f59e0b", to: "#92400e", label: "The Lion", category: "animals" },
  { id: "tiger", emoji: "🐯", from: "#f97316", to: "#7c2d12", label: "The Tiger", category: "animals" },
  { id: "bear", emoji: "🐻", from: "#a16207", to: "#422006", label: "The Bear", category: "animals" },
  { id: "panda", emoji: "🐼", from: "#475569", to: "#111827", label: "The Panda", category: "animals" },
  { id: "fox", emoji: "🦊", from: "#ea580c", to: "#7c2d12", label: "The Fox", category: "animals" },
  { id: "dog", emoji: "🐶", from: "#94a3b8", to: "#57534e", label: "The Dog", category: "animals" },
  { id: "cat", emoji: "🐱", from: "#c084fc", to: "#581c87", label: "The Cat", category: "animals" },
  { id: "bunny", emoji: "🐰", from: "#f9a8d4", to: "#9d174d", label: "The Bunny", category: "animals" },
  { id: "owl", emoji: "🦉", from: "#0d9488", to: "#134e4a", label: "The Owl", category: "animals" },
  { id: "elephant", emoji: "🐘", from: "#78716c", to: "#292524", label: "The Elephant", category: "animals" },
  { id: "monkey", emoji: "🐵", from: "#d97706", to: "#713f12", label: "The Monkey", category: "animals" },
  { id: "koala", emoji: "🐨", from: "#a8a29e", to: "#44403c", label: "The Koala", category: "animals" },
  { id: "unicorn", emoji: "🦄", from: "#c4b5fd", to: "#6d28d9", label: "The Unicorn", category: "animals" },
  { id: "wolf", emoji: "🐺", from: "#64748b", to: "#1e3a8a", label: "The Wolf", category: "animals" },
  { id: "eagle", emoji: "🦅", from: "#475569", to: "#111827", label: "The Eagle", category: "animals" },
  { id: "octopus", emoji: "🐙", from: "#a855f7", to: "#581c87", label: "The Octopus", category: "animals" },
  { id: "dolphin", emoji: "🐬", from: "#22d3ee", to: "#164e63", label: "The Dolphin", category: "animals" },

  // People
  { id: "girl", emoji: "👧", from: "#f472b6", to: "#831843", label: "Sweetheart", category: "people" },
  { id: "boy", emoji: "👦", from: "#60a5fa", to: "#1e3a8a", label: "Adventurer", category: "people" },
  { id: "man", emoji: "👨", from: "#94a3b8", to: "#334155", label: "The Man", category: "people" },
  { id: "woman", emoji: "👩", from: "#fb7185", to: "#881337", label: "The Woman", category: "people" },
  { id: "grandma", emoji: "👵", from: "#c084fc", to: "#6b21a8", label: "Grandma", category: "people" },
  { id: "grandpa", emoji: "👴", from: "#d6a354", to: "#713f12", label: "Grandpa", category: "people" },
  { id: "bearded", emoji: "🧔", from: "#2dd4bf", to: "#134e4a", label: "The Viking", category: "people" },
  { id: "baby", emoji: "👶", from: "#fcd34d", to: "#a16207", label: "The Baby", category: "people" },
  { id: "blonde", emoji: "👱", from: "#fde68a", to: "#a16207", label: "Golden", category: "people" },

  // Fantasy
  { id: "wizard", emoji: "🧙", from: "#6366f1", to: "#312e81", label: "The Wizard", category: "fantasy" },
  { id: "elf", emoji: "🧝", from: "#34d399", to: "#065f46", label: "The Elf", category: "fantasy" },
  { id: "vampire", emoji: "🧛", from: "#be123c", to: "#4c0519", label: "The Vampire", category: "fantasy" },
  { id: "hero", emoji: "🦸", from: "#e50914", to: "#1e3a8a", label: "The Hero", category: "fantasy" },
  { id: "dragon", emoji: "🐉", from: "#22c55e", to: "#14532d", label: "The Dragon", category: "fantasy" },
  { id: "castle", emoji: "🏰", from: "#94a3b8", to: "#0f172a", label: "Kingdom", category: "fantasy" },
  { id: "crystal", emoji: "🔮", from: "#a855f7", to: "#4c1d95", label: "The Oracle", category: "fantasy" },
  { id: "swords", emoji: "⚔️", from: "#94a3b8", to: "#1e293b", label: "The Duelist", category: "fantasy" },
  { id: "dagger", emoji: "🗡️", from: "#64748b", to: "#0f172a", label: "The Assassin", category: "fantasy" },
];

export const AVATAR_BY_ID: Record<string, AvatarOption> = AVATAR_OPTIONS.reduce(
  (acc, option) => {
    acc[option.id] = option;
    return acc;
  },
  {} as Record<string, AvatarOption>
);

export function isKnownAvatar(value: string | null | undefined): boolean {
  return !!value && !!AVATAR_BY_ID[value];
}
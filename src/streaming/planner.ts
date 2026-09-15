export interface SourceVideo {
  width: number;
  height: number;
  durationSeconds: number;
  hasAudio: boolean;
}

export interface Rendition {
  height: number;
  width: number;
  videoBitrateKbps: number;
  audioBitrateKbps: number;
}

const LADDER = [
  { height: 240, videoBitrateKbps: 400, audioBitrateKbps: 64 },
  { height: 360, videoBitrateKbps: 800, audioBitrateKbps: 96 },
  { height: 480, videoBitrateKbps: 1400, audioBitrateKbps: 128 },
  { height: 720, videoBitrateKbps: 2800, audioBitrateKbps: 128 },
  { height: 1080, videoBitrateKbps: 5500, audioBitrateKbps: 192 },
];

/** Never upscale; keep aspect ratio and make H.264 dimensions even. */
export function planRenditions(source: SourceVideo): Rendition[] {
  if (!Number.isFinite(source.width) || !Number.isFinite(source.height) ||
      source.width < 2 || source.height < 2 || source.durationSeconds <= 0) {
    throw new Error("Invalid source video dimensions or duration");
  }
  const eligible = LADDER.filter((entry) => entry.height <= source.height);
  if (eligible.length === 0) {
    const height = Math.floor(source.height / 2) * 2;
    const width = Math.max(2, Math.floor(source.width / 2) * 2);
    return [{ height, width, videoBitrateKbps: 300, audioBitrateKbps: source.hasAudio ? 64 : 0 }];
  }
  return eligible.map((entry) => ({
    height: entry.height,
    width: Math.max(2, Math.floor((source.width * entry.height / source.height) / 2) * 2),
    videoBitrateKbps: entry.videoBitrateKbps,
    audioBitrateKbps: source.hasAudio ? entry.audioBitrateKbps : 0,
  }));
}

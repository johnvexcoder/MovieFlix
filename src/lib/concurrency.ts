// Peak and time-weighted average concurrent streams over a window, computed via
// a sweep-line over session lifetimes. playback_sessions has no continuous
// heartbeat in the legacy schema, so concurrency is derived from the
// creation/expiry/revocation windows (and last_seen when provided).

export interface SessionWindow {
  createdAt: string;
  expiresAt: string;
  revokedAt: string | null;
  lastSeenAt?: string | null;
}

export function sessionEndMs(s: SessionWindow, nowMs: number): number {
  const hardEnd = s.revokedAt
    ? Math.min(Date.parse(s.revokedAt), Date.parse(s.expiresAt))
    : Date.parse(s.expiresAt);
  return Math.min(hardEnd, nowMs);
}

export function concurrencyStats(
  sessions: SessionWindow[],
  windowStart: number,
  windowEnd: number
): { peak: number; average: number } {
  if (windowEnd <= windowStart) return { peak: 0, average: 0 };

  const events: Array<[number, number]> = [];
  for (const s of sessions) {
    const startMs = Math.max(Date.parse(s.createdAt), windowStart);
    const endMs = sessionEndMs(s, windowEnd);
    if (Number.isFinite(startMs) && Number.isFinite(endMs) && endMs > startMs) {
      events.push([startMs, 1]);
      events.push([endMs, -1]);
    }
  }

  events.sort((a, b) => a[0] - b[0] || a[1] - b[1]);

  let peak = 0;
  let running = 0;
  let area = 0;
  let prevTime = windowStart;
  for (const [time, delta] of events) {
    area += running * (time - prevTime);
    prevTime = time;
    running += delta;
    if (running > peak) peak = running;
  }
  area += running * (windowEnd - prevTime);

  const duration = windowEnd - windowStart;
  return { peak, average: duration > 0 ? area / duration : 0 };
}
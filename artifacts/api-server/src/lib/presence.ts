const ONLINE_WINDOW_MS = 60_000;

const lastBeat = new Map<string, number>();

export function markOnline(userId: string) {
  lastBeat.set(userId, Date.now());
}

export function getOnlineUserIds(): string[] {
  const cutoff = Date.now() - ONLINE_WINDOW_MS;
  const ids: string[] = [];
  for (const [id, ts] of lastBeat) {
    if (ts >= cutoff) ids.push(id);
    else lastBeat.delete(id);
  }
  return ids;
}

export function isUserOnline(userId: string): boolean {
  const ts = lastBeat.get(userId);
  if (!ts) return false;
  return ts >= Date.now() - ONLINE_WINDOW_MS;
}

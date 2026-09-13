let offsetMs = 0;

export function syncServerClock(serverIso: string): void {
  const server = new Date(serverIso).getTime();
  if (Number.isFinite(server)) {
    offsetMs = server - Date.now();
  }
}

export function serverNow(): number {
  return Date.now() + offsetMs;
}

export function serverOffsetMs(): number {
  return offsetMs;
}

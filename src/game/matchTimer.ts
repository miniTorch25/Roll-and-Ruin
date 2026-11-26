export function getRemainingMatchTime(deadlineAt: number, now: number): number {
  return Math.max(0, deadlineAt - now);
}

export function formatMatchTime(remainingMs: number): string {
  const totalSeconds = Math.ceil(Math.max(0, remainingMs) / 1000);
  const minutes = Math.floor(totalSeconds / 60);
  const seconds = totalSeconds % 60;
  return `${String(minutes).padStart(2, "0")}:${String(seconds).padStart(2, "0")}`;
}

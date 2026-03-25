export function parseIntervalToSeconds(intervalStr: string): number {
  // e.g., "30-45 sec", "60 sec", "1 min"
  const match = intervalStr.match(/(\d+)(?:-(\d+))?\s*(sec|min)/i);
  if (!match) return 45; // default fallback

  const min = parseInt(match[1], 10);
  const max = match[2] ? parseInt(match[2], 10) : min;
  
  // Average the range for a good estimate
  let avg = (min + max) / 2;
  
  if (match[3].toLowerCase() === 'min') {
    avg *= 60;
  }
  
  return Math.round(avg);
}

export function formatSeconds(totalSeconds: number): string {
  const m = Math.floor(totalSeconds / 60);
  const s = Math.floor(totalSeconds % 60);
  return `${m}:${s.toString().padStart(2, '0')}`;
}

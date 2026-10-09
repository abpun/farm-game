const SEC_PER_MIN = 60;
const SEC_PER_HOUR = 3600;

export function formatDuration(totalSeconds: number): string {
  const seconds = Math.max(0, Math.round(totalSeconds));
  if (seconds < SEC_PER_MIN) return `${seconds}s`;
  if (seconds < SEC_PER_HOUR) {
    const rest = seconds % SEC_PER_MIN;
    return `${Math.floor(seconds / SEC_PER_MIN)}m${rest ? ` ${rest}s` : ''}`;
  }
  const minutes = Math.floor((seconds % SEC_PER_HOUR) / SEC_PER_MIN);
  return `${Math.floor(seconds / SEC_PER_HOUR)}h${minutes ? ` ${minutes}m` : ''}`;
}

export const formatMoney = (amount: number): string => amount.toLocaleString('en-US');

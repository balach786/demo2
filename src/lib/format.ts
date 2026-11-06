export const PKR = 'PKR';

export function formatPKR(value: number, opts: { decimals?: boolean; compact?: boolean } = {}): string {
  const { decimals = false, compact = false } = opts;
  if (compact) return PKR + ' ' + compactNumber(value);
  const rounded = decimals ? value : Math.round(value);
  return (
    PKR +
    ' ' +
    rounded.toLocaleString('en-PK', {
      minimumFractionDigits: decimals ? 2 : 0,
      maximumFractionDigits: decimals ? 2 : 0,
    })
  );
}

export function compactNumber(value: number): string {
  const abs = Math.abs(value);
  const sign = value < 0 ? '-' : '';
  if (abs >= 10_000_000) return sign + (abs / 10_000_000).toFixed(2).replace(/\.00$/, '') + ' Cr';
  if (abs >= 100_000) return sign + (abs / 100_000).toFixed(2).replace(/\.00$/, '') + ' L';
  if (abs >= 1_000) return sign + (abs / 1_000).toFixed(1).replace(/\.0$/, '') + 'K';
  return sign + abs.toFixed(0);
}

/** Compact PKR label used inside charts: "1.2 Cr", "850K". */
export function formatCompactPKR(value: number): string {
  return 'Rs. ' + compactNumber(value);
}

export function formatNumber(value: number): string {
  return Math.round(value).toLocaleString('en-PK');
}

const MONTHS = [
  'Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun',
  'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec',
];

export function parseISO(d: string): Date {
  const [y, m, day] = d.split('-').map(Number);
  return new Date(y, (m ?? 1) - 1, day ?? 1);
}

export function toISO(d: Date): string {
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, '0');
  const day = String(d.getDate()).padStart(2, '0');
  return `${y}-${m}-${day}`;
}

export function formatDate(iso: string): string {
  const d = parseISO(iso);
  return `${String(d.getDate()).padStart(2, '0')} ${MONTHS[d.getMonth()]} ${d.getFullYear()}`;
}

export function formatShortDate(iso: string): string {
  const d = parseISO(iso);
  return `${String(d.getDate()).padStart(2, '0')} ${MONTHS[d.getMonth()]}`;
}

export function monthLabel(iso: string): string {
  const d = parseISO(iso);
  return `${MONTHS[d.getMonth()]} ${String(d.getFullYear()).slice(2)}`;
}

export function monthKey(iso: string): string {
  return iso.slice(0, 7);
}

export function addDays(iso: string, days: number): string {
  const d = parseISO(iso);
  d.setDate(d.getDate() + days);
  return toISO(d);
}

export function startOfMonth(iso: string): string {
  return iso.slice(0, 7) + '-01';
}

export function endOfMonth(iso: string): string {
  const d = parseISO(iso);
  const last = new Date(d.getFullYear(), d.getMonth() + 1, 0).getDate();
  return `${iso.slice(0, 7)}-${String(last).padStart(2, '0')}`;
}

export function daysBetween(a: string, b: string): number {
  return Math.round((parseISO(b).getTime() - parseISO(a).getTime()) / 86_400_000);
}

export function inRange(iso: string, start: string, end: string): boolean {
  return iso >= start && iso <= end;
}

export function formatDateTime(isoTimestamp: string): string {
  const d = new Date(isoTimestamp);
  if (Number.isNaN(d.getTime())) return isoTimestamp;
  const time = d.toLocaleTimeString('en-PK', { hour: '2-digit', minute: '2-digit' });
  return `${String(d.getDate()).padStart(2, '0')} ${MONTHS[d.getMonth()]} ${d.getFullYear()}, ${time}`;
}

export function formatRelative(isoTimestamp: string, nowISO: string): string {
  const then = new Date(isoTimestamp).getTime();
  const now = new Date(nowISO + 'T23:59:00').getTime();
  const mins = Math.round((now - then) / 60000);
  if (mins < 1) return 'just now';
  if (mins < 60) return `${mins} min ago`;
  const hours = Math.round(mins / 60);
  if (hours < 24) return `${hours} hr ago`;
  const days = Math.round(hours / 24);
  if (days < 30) return `${days} day${days === 1 ? '' : 's'} ago`;
  const months = Math.round(days / 30);
  return `${months} month${months === 1 ? '' : 's'} ago`;
}

export function initials(name: string): string {
  return name
    .replace(/[^A-Za-z0-9 ]/g, '')
    .split(/\s+/)
    .filter(Boolean)
    .slice(0, 2)
    .map((w) => w[0]!.toUpperCase())
    .join('');
}

export function titleCase(s: string): string {
  return s.replace(/\b\w/g, (c) => c.toUpperCase());
}

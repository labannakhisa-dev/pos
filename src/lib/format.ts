export function formatKsh(amount: number | null | undefined): string {
  const value = Number(amount ?? 0);
  return 'KSh ' + value.toLocaleString('en-KE', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
}

export function formatNumber(value: number | null | undefined, decimals = 0): string {
  return Number(value ?? 0).toLocaleString('en-KE', { minimumFractionDigits: decimals, maximumFractionDigits: decimals });
}

export function formatDateTime(iso: string | null | undefined): string {
  if (!iso) return '—';
  const d = new Date(iso);
  return d.toLocaleString('en-KE', { year: 'numeric', month: 'short', day: '2-digit', hour: '2-digit', minute: '2-digit' });
}

export function formatDate(iso: string | null | undefined): string {
  if (!iso) return '—';
  const d = new Date(iso);
  return d.toLocaleDateString('en-KE', { year: 'numeric', month: 'short', day: '2-digit' });
}

export function formatTime(iso: string | null | undefined): string {
  if (!iso) return '—';
  const d = new Date(iso);
  return d.toLocaleTimeString('en-KE', { hour: '2-digit', minute: '2-digit' });
}

export function formatTimeAgo(iso: string | null | undefined): string {
  if (!iso) return '—';
  const diff = Date.now() - new Date(iso).getTime();
  const mins = Math.floor(diff / 60000);
  if (mins < 1) return 'just now';
  if (mins < 60) return `${mins}m ago`;
  const hours = Math.floor(mins / 60);
  if (hours < 24) return `${hours}h ago`;
  const days = Math.floor(hours / 24);
  return `${days}d ago`;
}

export function normalizePhone(input: string): string | null {
  let phone = input.replace(/\s+/g, '').replace(/[^0-9+]/g, '');
  if (phone.startsWith('+254')) phone = phone.slice(4);
  else if (phone.startsWith('254')) phone = phone.slice(3);
  else if (phone.startsWith('07') || phone.startsWith('01')) phone = '254' + phone.slice(1);
  else if (phone.startsWith('7') || phone.startsWith('1')) phone = '254' + phone;
  if (/^254[17]\d{8}$/.test(phone)) return phone;
  return null;
}

export function maskPhone(phone: string | null | undefined): string {
  if (!phone) return '—';
  if (phone.length < 7) return phone;
  return phone.slice(0, 6) + '***' + phone.slice(-3);
}

export async function getScanResult(appointmentKey: string) {
  const url = new URL('/api/receptionist/scanner', window.location.origin);
  url.searchParams.set('appointmentKey', appointmentKey);

  const response = await fetch(url, { cache: 'no-store' });
  if (!response.ok) throw new Error('Failed to fetch scan result');
  return response.json();
}

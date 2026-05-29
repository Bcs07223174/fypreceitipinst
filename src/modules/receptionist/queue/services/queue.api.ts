export async function getReceptionistQueue(clinicId: string, date?: string) {
  const url = new URL('/api/receptionist/queue', window.location.origin);
  if (clinicId) url.searchParams.set('clinicId', clinicId);
  if (date) url.searchParams.set('date', date);

  const response = await fetch(url, { cache: 'no-store' });
  if (!response.ok) throw new Error('Failed to fetch queue data');
  return response.json();
}

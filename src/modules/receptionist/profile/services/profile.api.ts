export async function getReceptionistProfile() {
  const response = await fetch('/api/receptionist/profile', { cache: 'no-store' });
  if (!response.ok) throw new Error('Failed to fetch profile');
  return response.json();
}

export async function updateReceptionistProfile(payload: unknown) {
  const response = await fetch('/api/receptionist/profile', {
    method: 'PATCH',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(payload),
  });

  if (!response.ok) throw new Error('Failed to update profile');
  return response.json();
}

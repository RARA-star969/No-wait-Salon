const getBaseUrl = () => typeof window !== 'undefined' ? '' : 'http://127.0.0.1:3000';

function authHeaders() {
  const token = typeof localStorage !== 'undefined' ? localStorage.getItem('no_wait_salon_staff_token') : null;
  return token ? { Authorization: \`Bearer \${token}\` } : {};
}

async function request(path: string, options: RequestInit = {}) {
  const res = await fetch(\`\${getBaseUrl()}\${path}\`, {
    ...options,
    headers: { 'Content-Type': 'application/json', ...authHeaders(), ...options.headers }
  });
  const data = await res.json().catch(() => ({}));
  if (!res.ok) throw new Error(data.error || 'Request failed');
  return data;
}

export const gymStaffService = {
  getOverview: (gymId: string) => request(\`/api/gym/\${encodeURIComponent(gymId)}/overview\`),
  checkIn: (gymId: string) => request(\`/api/gym/\${encodeURIComponent(gymId)}/checkin\`, { method: 'POST' }),
  checkOut: (gymId: string) => request(\`/api/gym/\${encodeURIComponent(gymId)}/checkout\`, { method: 'POST' }),
  updateTrainerStatus: (gymId: string, trainerId: string, status: string) => 
    request(\`/api/gym/\${encodeURIComponent(gymId)}/trainer-status\`, { 
      method: 'POST', 
      body: JSON.stringify({ trainerId, status }) 
    }),
  updateSettings: (gymId: string, maxCapacity: number) => 
    request(\`/api/gym/\${encodeURIComponent(gymId)}/settings\`, { 
      method: 'POST', 
      body: JSON.stringify({ maxCapacity }) 
    }),
};

import { setSession } from './storage';

const API_BASE = (import.meta.env.VITE_API_URL || 'https://alumni-mentor-project-sigma.vercel.app/api').replace(/\/$/, '');
const TOKEN_KEY = 'mc_api_token';

export const getToken = () => localStorage.getItem(TOKEN_KEY);
export const setToken = (token) =>
  token ? localStorage.setItem(TOKEN_KEY, token) : localStorage.removeItem(TOKEN_KEY);
export const clearToken = () => localStorage.removeItem(TOKEN_KEY);

export async function apiRequest(path, options = {}) {
  const headers = new Headers(options.headers || {});
  if (options.body !== undefined && !headers.has('Content-Type'))
    headers.set('Content-Type', 'application/json');
  const token = getToken();
  if (token) headers.set('Authorization', `Bearer ${token}`);
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), options.timeoutMs || 10000);
  let response;
  try {
    response = await fetch(`${API_BASE}${path}`, {
      ...options,
      headers,
      signal: controller.signal,
    });
  } catch (error) {
    if (error?.name === 'AbortError')
      throw new Error('Backend request timed out. Make sure the backend is running.');
    throw error;
  } finally {
    clearTimeout(timeout);
  }
  let data = null;
  try {
    data = await response.json();
  } catch {
    data = null;
  }
  if (!response.ok) {
    if (response.status === 401) {
      clearToken();
      setSession(null);
      if (typeof window !== 'undefined') {
        window.dispatchEvent(new Event('mc:auth-expired'));
      }
    }
    throw new Error(data?.message || `Request failed (${response.status}).`);
  }
  return data;
}

export const apiGet = (path) => apiRequest(path);
export const apiPost = (path, body) =>
  apiRequest(path, { method: 'POST', body: JSON.stringify(body) });
export const apiPatch = (path, body) =>
  apiRequest(path, { method: 'PATCH', body: JSON.stringify(body) });
export const apiDelete = (path) => apiRequest(path, { method: 'DELETE' });

const idOf = (value) => value?._id || value?.id || value;
const mapUser = (u) => (u ? { ...u, id: idOf(u) } : u);
const mapRequest = (r) =>
  r ? { ...r, id: idOf(r), studentId: idOf(r.studentId), mentorId: idOf(r.mentorId) } : r;
const mapMeeting = (m) =>
  m
    ? {
        ...m,
        id: idOf(m),
        mentorId: idOf(m.mentorId),
        studentId: idOf(m.studentId),
        status: m.status || 'scheduled',
      }
    : m;
const mapGoal = (g) => {
  if (!g) return g;
  const studentId = idOf(g.studentId);
  const createdBy = idOf(g.createdBy);
  return {
    ...g,
    id: idOf(g),
    studentId,
    createdBy,
    mentorId: createdBy && createdBy !== studentId ? createdBy : undefined,
  };
};
const mapFeedback = (f) =>
  f
    ? {
        ...f,
        id: idOf(f),
        fromUserId: idOf(f.fromUserId),
        toUserId: idOf(f.toUserId),
        requestId: idOf(f.requestId),
      }
    : f;
const mapNotification = (n) => (n ? { ...n, id: idOf(n), userId: idOf(n.userId) } : n);
const mapAudit = (a) =>
  a ? { ...a, id: idOf(a), userId: idOf(a.userId), timestamp: a.timestamp || a.createdAt } : a;

export const normalizeUser = mapUser;
export const normalizeRequest = mapRequest;
export const normalizeMeeting = mapMeeting;
export const normalizeGoal = mapGoal;
export const normalizeFeedback = mapFeedback;
export const normalizeNotification = mapNotification;
export const normalizeAudit = mapAudit;

export async function refetchMeetings() {
  try {
    const data = await apiGet('/meetings');
    return (data.meetings || []).map(mapMeeting);
  } catch (e) {
    console.warn('Failed to refetch meetings:', e.message);
    return [];
  }
}

export async function refetchGoals() {
  try {
    const data = await apiGet('/goals');
    return (data.goals || []).map(mapGoal);
  } catch (e) {
    console.warn('Failed to refetch goals:', e.message);
    return [];
  }
}

export async function refetchFeedback() {
  try {
    const data = await apiGet('/feedback');
    return (data.feedback || []).map(mapFeedback);
  } catch (e) {
    console.warn('Failed to refetch feedback:', e.message);
    return [];
  }
}

export async function refetchNotifications() {
  try {
    const data = await apiGet('/notifications');
    return (data.notifications || []).map(mapNotification);
  } catch (e) {
    console.warn('Failed to refetch notifications:', e.message);
    return [];
  }
}

export async function refetchRequests() {
  try {
    const data = await apiGet('/mentorship-requests');
    const items = (data.requests || []).map(mapRequest);
    localStorage.setItem('mc_requests', JSON.stringify(items));
    return items;
  } catch (e) {
    console.warn('Failed to refetch requests:', e.message);
    return [];
  }
}

export async function refetchUsers() {
  try {
    const data = await apiGet('/users');
    return (data.users || []).map(mapUser);
  } catch (e) {
    console.warn('Failed to refetch users:', e.message);
    return [];
  }
}

export async function refetchAudit() {
  try {
    const data = await apiGet('/audit-logs');
    return (data.audit || []).map(mapAudit);
  } catch (e) {
    console.warn('Failed to refetch audit logs:', e.message);
    return [];
  }
}

export async function refreshCurrentUserCache() {
  const result = await apiGet('/auth/me');
  return mapUser(result.user);
}

// Server-side Ranked Matches with factor breakdowns
export async function fetchRankedMatches(studentId) {
  return apiGet(`/matches/${studentId}`);
}

// AI Advisory Endpoints
export async function explainMatchWithAi(payload) {
  return apiPost('/ai/explain-match', payload);
}

export async function suggestGoalsWithAi(payload) {
  return apiPost('/ai/suggest-goals', payload);
}

export async function summarizeRequestWithAi(payload) {
  return apiPost('/ai/summarize-request', payload);
}

export async function summarizeFeedbackWithAi() {
  return apiPost('/ai/summarize-feedback', {});
}

export async function fetchAiStatus() {
  return apiGet('/ai/status');
}

// Admin Server Analytics & Verification
export async function fetchAdminAnalytics() {
  return apiGet('/admin/analytics');
}

export async function verifyAuditLedger() {
  return apiGet('/audit-logs/verify');
}

export async function fetchSystemMetrics() {
  return apiGet('/metrics');
}

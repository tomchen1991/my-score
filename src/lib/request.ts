import { showToast } from './toast';

interface RequestConfig {
  params?: Record<string, string | number | boolean>;
}

async function fetchWithAuth<T>(url: string, options: RequestInit): Promise<{ data: T }> {
  const headers: Record<string, string> = {
    'Content-Type': 'application/json',
    ...(options.headers as Record<string, string> || {}),
  };

  const authString = localStorage.getItem('auth');
  if (authString) {
    try {
      const auth = JSON.parse(authString);
      if (auth && auth.token) {
        headers['Authorization'] = `Bearer ${auth.token}`;
      }
    } catch (e) {
      console.error('Failed to parse auth from localStorage', e);
      localStorage.removeItem('auth');
    }
  }

  const response = await fetch(url, {
    ...options,
    headers,
  });

  if (response.status === 401) {
    if (url === '/api/user/login') {
      const errorData = await response.json().catch(() => ({}));
      return Promise.reject(errorData);
    }

    localStorage.removeItem('auth');
    showToast('登录已过期，请重新登录');
    setTimeout(() => {
      window.location.href = '/';
    }, 1500);
    return new Promise(() => {});
  }

  if (!response.ok) {
    const errorData = await response.json().catch(() => ({}));
    return Promise.reject(errorData);
  }

  const data = await response.json() as T;
  return { data };
}

const request = {
  get<T>(url: string, config?: RequestConfig): Promise<{ data: T }> {
    let fullUrl = `/api${url}`;
    if (config?.params) {
      const query = new URLSearchParams(
        Object.entries(config.params).map(([k, v]) => [k, String(v)])
      ).toString();
      if (query) {
        fullUrl += `?${query}`;
      }
    }
    return fetchWithAuth<T>(fullUrl, { method: 'GET' });
  },

  post<T>(url: string, body?: unknown): Promise<{ data: T }> {
    return fetchWithAuth<T>(`/api${url}`, {
      method: 'POST',
      body: body ? JSON.stringify(body) : undefined,
    });
  },

  put<T>(url: string, body?: unknown): Promise<{ data: T }> {
    return fetchWithAuth<T>(`/api${url}`, {
      method: 'PUT',
      body: body ? JSON.stringify(body) : undefined,
    });
  },

  delete<T>(url: string): Promise<{ data: T }> {
    return fetchWithAuth<T>(`/api${url}`, { method: 'DELETE' });
  },
};

export default request;

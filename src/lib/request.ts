import { showToast } from './toast';

interface RequestConfig {
  params?: Record<string, string | number | boolean>;
  activity?: boolean;
}

async function fetchWithAuth<T>(url: string, options: RequestInit): Promise<{ data: T }> {
  const headers: Record<string, string> = {
    'Content-Type': 'application/json',
    ...(options.headers as Record<string, string> || {}),
  };

  const response = await fetch(url, {
    ...options,
    headers,
    credentials: 'same-origin',
  });

  if (response.status === 401 && url !== '/api/auth/verify') {
    window.dispatchEvent(new Event('session-expired'));
    showToast('登录已过期，请重新登录');
  }

  if (!response.ok) {
    const errorData = await response.json<{ message?: string }>().catch(() => null);
    throw new Error(errorData?.message || `请求失败 (${response.status})`);
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
    return fetchWithAuth<T>(fullUrl, {
      method: 'GET',
      headers: config?.activity ? { 'X-Score-Activity': '1' } : undefined,
    });
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

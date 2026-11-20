import axios, { type AxiosRequestConfig } from 'axios';

interface ApiResponse<T> {
  code: number;
  message?: string | null;
  data?: T | null;
}

const http = axios.create({
  baseURL: '/api',
  withCredentials: true,
  timeout: 10000,
});

function unwrap<T>(envelope: ApiResponse<T>): T {
  if (!envelope || typeof envelope.code !== 'number') {
    throw new Error('后端响应格式不正确');
  }
  if (envelope.code !== 0) {
    throw new Error(envelope.message || '请求失败');
  }
  if (envelope.data === undefined || envelope.data === null) {
    throw new Error('后端响应缺少 data');
  }
  return envelope.data;
}

function rethrow(error: unknown): never {
  if (axios.isAxiosError<ApiResponse<unknown>>(error) && error.response?.data) {
    const payload = error.response.data;
    throw new Error(payload.message || `请求失败（HTTP ${error.response.status}）`);
  }
  throw error;
}

export async function apiGet<T>(url: string, config?: AxiosRequestConfig): Promise<T> {
  try {
    const { data } = await http.get<ApiResponse<T>>(url, config);
    return unwrap(data);
  } catch (error) {
    return rethrow(error);
  }
}

export async function apiPost<T>(url: string, body?: unknown, config?: AxiosRequestConfig): Promise<T> {
  try {
    const { data } = await http.post<ApiResponse<T>>(url, body ?? {}, config);
    return unwrap(data);
  } catch (error) {
    return rethrow(error);
  }
}

export async function apiPostVoid(url: string, body?: unknown, config?: AxiosRequestConfig): Promise<void> {
  try {
    const { data } = await http.post<ApiResponse<unknown>>(url, body ?? {}, config);
    if (data && typeof data.code === 'number' && data.code !== 0) {
      throw new Error(data.message || '请求失败');
    }
  } catch (error) {
    return rethrow(error);
  }
}

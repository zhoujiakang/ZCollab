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

export async function apiGet<T>(url: string, config?: AxiosRequestConfig): Promise<T> {
  try {
    const { data: envelope } = await http.get<ApiResponse<T>>(url, config);

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
  } catch (error) {
    if (axios.isAxiosError<ApiResponse<unknown>>(error) && error.response?.data) {
      const payload = error.response.data;
      throw new Error(payload.message || `请求失败（HTTP ${error.response.status}）`);
    }
    throw error;
  }
}

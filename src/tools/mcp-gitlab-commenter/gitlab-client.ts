import axios, { AxiosInstance, AxiosRequestConfig } from 'axios';

export class GitLabClient {
  private client: AxiosInstance;

  constructor(baseURL: string, token: string) {
    const sanitizedToken = token.replace(/[\r\n]/g, '').trim();
    const normalizedURL = baseURL.replace(/\/$/, '');

    this.client = axios.create({
      baseURL: normalizedURL,
      headers: {
        'PRIVATE-TOKEN': sanitizedToken,
        'Content-Type': 'application/json',
      },
      timeout: 30000,
    });
  }

  async get<T>(path: string, config?: AxiosRequestConfig): Promise<T> {
    const response = await this.client.get<T>(path, config);
    return response.data;
  }

  async post<T>(path: string, data?: Record<string, unknown>): Promise<T> {
    const response = await this.client.post<T>(path, data);
    return response.data;
  }

  async delete(path: string): Promise<void> {
    await this.client.delete(path);
  }

  handleError(error: unknown): Error {
    if (axios.isAxiosError(error)) {
      const status = error.response?.status;
      const message = error.response?.data?.message || error.response?.data?.error || error.message;
      return new Error(`GitLab API error ${status}: ${message}`);
    }
    return error instanceof Error ? error : new Error(String(error));
  }

  async sleep(ms: number): Promise<void> {
    return new Promise((resolve) => setTimeout(resolve, ms));
  }
}

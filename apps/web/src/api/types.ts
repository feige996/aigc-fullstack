export interface ApiClient {
  request(path: string, init?: RequestInit): Promise<Response>
  requestJson<T>(path: string, init?: RequestInit, actionName?: string): Promise<T>
}

export interface ApiClient {
  buildQuery(params: Record<string, string | number | undefined> | object): string
  request(path: string, init?: RequestInit): Promise<Response>
  requestJson<T>(path: string, init?: RequestInit, actionName?: string): Promise<T>
}

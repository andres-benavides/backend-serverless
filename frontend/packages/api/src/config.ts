import { ApiClient } from './client';

declare global {
  interface Window {
    __AMM_API_BASE_URL__?: string;
  }
}

export const DEFAULT_API_BASE_URL =
  'https://5oxai8sky9.execute-api.us-east-1.amazonaws.com/dev';

export const apiBaseUrl = (): string =>
  (typeof window !== 'undefined' && window.__AMM_API_BASE_URL__) ||
  DEFAULT_API_BASE_URL;

export const createApiClient = (): ApiClient => new ApiClient(apiBaseUrl());

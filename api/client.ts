import axios, { AxiosInstance } from 'axios';

const trimTrailingSlashes = (value: string) => value.replace(/\/+$/, '');

export const getNormalizedServerRoot = (rawUrl: string) => trimTrailingSlashes(rawUrl.trim());

export const getApiRoot = (rawUrl: string) => {
  const normalized = getNormalizedServerRoot(rawUrl);
  if (!normalized.length) {
    return '';
  }
  if (/\/api\/scans$/i.test(normalized)) {
    return normalized.replace(/\/scans$/i, '');
  }
  if (/\/api$/i.test(normalized)) {
    return normalized;
  }
  return `${normalized}/api`;
};

export const buildScansUrl = (rawUrl: string) => {
  const apiRoot = getApiRoot(rawUrl);
  if (!apiRoot.length) {
    return '';
  }
  return `${apiRoot.replace(/\/+$/, '')}/scans`;
};

export const createApiClient = (baseUrl: string, apiKey?: string): AxiosInstance | null => {
  const apiRoot = getApiRoot(baseUrl);
  if (!apiRoot.length) {
    return null;
  }
  const headers: Record<string, string> = {};
  const trimmedApiKey = (apiKey ?? '').trim();
  if (trimmedApiKey.length) {
    headers['x-api-access'] = trimmedApiKey;
  }

  return axios.create({
    baseURL: apiRoot,
    headers: Object.keys(headers).length ? headers : undefined,
  });
};

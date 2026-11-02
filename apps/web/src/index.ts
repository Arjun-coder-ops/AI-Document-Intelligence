export interface WebAppConfig {
  apiUrl: string;
  version: string;
}

export function getAppConfig(): WebAppConfig {
  return {
    apiUrl: (typeof process !== 'undefined' && process.env?.['VITE_API_URL']) || '/api',
    version: '0.1.0',
  };
}

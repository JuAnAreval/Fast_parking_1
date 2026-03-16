const fromEnv = String(import.meta.env.VITE_API_BASE_URL || '').trim();

const getRuntimeHost = () => {
  if (typeof window === 'undefined') return '127.0.0.1';
  const host = window.location.hostname || '127.0.0.1';
  // En Windows, localhost puede resolver a ::1 y apuntar a otro servicio.
  return host === 'localhost' ? '127.0.0.1' : host;
};

const getRuntimeProtocol = () => {
  if (typeof window === 'undefined') return 'http:';
  return window.location.protocol || 'http:';
};

const fallbackBase = `${getRuntimeProtocol()}//${getRuntimeHost()}:3000/api`;

export const API_BASE_URL = (fromEnv || fallbackBase).replace(/\/+$/, '');


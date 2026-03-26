export const API_ENVIRONMENTS = {
  local: 'local',
  production: 'production',
};

// Cambia solo esta linea para alternar entre localhost y produccion.
export const API_ENVIRONMENT = API_ENVIRONMENTS.production; 

const API_TARGETS = {
  [API_ENVIRONMENTS.local]: {
    protocol: 'http:',
    host: '127.0.0.1',
    port: 3000,
    basePath: '/api',
  },
  [API_ENVIRONMENTS.production]: {
    protocol: 'https:',
    host: 'backend-production-70858.up.railway.app',
    basePath: '/api',
  },
};

const activeTarget = API_TARGETS[API_ENVIRONMENT];
const portSuffix = activeTarget.port ? `:${activeTarget.port}` : '';

export const API_BASE_URL =
  `${activeTarget.protocol}//${activeTarget.host}${portSuffix}${activeTarget.basePath}`.replace(
    /\/+$/,
    '',
  );

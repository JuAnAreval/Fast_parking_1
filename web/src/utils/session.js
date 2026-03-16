const TOKEN_KEY = "token";
const PARQUEADERO_KEY = "parqueadero";
const USUARIO_KEY = "usuario";

const safeParseJson = (value) => {
  if (!value) return null;
  try {
    return JSON.parse(value);
  } catch {
    return null;
  }
};

export const getToken = () => localStorage.getItem(TOKEN_KEY);

export const getParqueaderoSession = () =>
  safeParseJson(localStorage.getItem(PARQUEADERO_KEY));

export const getUsuarioSession = () =>
  safeParseJson(localStorage.getItem(USUARIO_KEY));

export const setParqueaderoSession = ({ token, parqueadero }) => {
  if (token) {
    localStorage.setItem(TOKEN_KEY, token);
  }
  if (parqueadero) {
    localStorage.setItem(PARQUEADERO_KEY, JSON.stringify(parqueadero));
  }
};

export const setUsuarioSession = ({ token, usuario }) => {
  if (token) {
    localStorage.setItem(TOKEN_KEY, token);
  }
  if (usuario) {
    localStorage.setItem(USUARIO_KEY, JSON.stringify(usuario));
  }
};

export const clearSession = () => {
  localStorage.removeItem(TOKEN_KEY);
  localStorage.removeItem(PARQUEADERO_KEY);
  localStorage.removeItem(USUARIO_KEY);
};

export const isParqueaderoAuthenticated = () =>
  Boolean(getToken() && getParqueaderoSession()?.id);


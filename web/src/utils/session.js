const SESSION_ACTOR_KEY = "fast_parking_session_actor";
const TOKEN_KEYS = {
  parqueadero: "fast_parking_token_parqueadero",
  admin: "fast_parking_token_admin",
  usuario: "fast_parking_token_usuario",
};
const DATA_KEYS = {
  parqueadero: "fast_parking_parqueadero",
  admin: "fast_parking_admin",
  usuario: "fast_parking_usuario",
};

const safeParseJson = (value) => {
  if (!value) return null;
  try {
    return JSON.parse(value);
  } catch {
    return null;
  }
};

const setSessionActor = (actor) => {
  if (actor) {
    localStorage.setItem(SESSION_ACTOR_KEY, actor);
    return;
  }
  localStorage.removeItem(SESSION_ACTOR_KEY);
};

export const getSessionActor = () => localStorage.getItem(SESSION_ACTOR_KEY);

export const getToken = (actor = getSessionActor()) => {
  if (!actor || !TOKEN_KEYS[actor]) return null;
  return localStorage.getItem(TOKEN_KEYS[actor]);
};

export const getParqueaderoSession = () =>
  safeParseJson(localStorage.getItem(DATA_KEYS.parqueadero));

export const getAdminSession = () =>
  safeParseJson(localStorage.getItem(DATA_KEYS.admin));

export const getUsuarioSession = () =>
  safeParseJson(localStorage.getItem(DATA_KEYS.usuario));

export const setParqueaderoSession = ({ token, parqueadero }) => {
  clearSession();
  if (token) {
    localStorage.setItem(TOKEN_KEYS.parqueadero, token);
  }
  if (parqueadero) {
    localStorage.setItem(DATA_KEYS.parqueadero, JSON.stringify(parqueadero));
  }
  setSessionActor("parqueadero");
};

export const setAdminSession = ({ token, admin }) => {
  clearSession();
  if (token) {
    localStorage.setItem(TOKEN_KEYS.admin, token);
  }
  if (admin) {
    localStorage.setItem(DATA_KEYS.admin, JSON.stringify(admin));
  }
  setSessionActor("admin");
};

export const setUsuarioSession = ({ token, usuario }) => {
  clearSession();
  if (token) {
    localStorage.setItem(TOKEN_KEYS.usuario, token);
  }
  if (usuario) {
    localStorage.setItem(DATA_KEYS.usuario, JSON.stringify(usuario));
  }
  setSessionActor("usuario");
};

export const clearSession = () => {
  Object.values(TOKEN_KEYS).forEach((key) => localStorage.removeItem(key));
  Object.values(DATA_KEYS).forEach((key) => localStorage.removeItem(key));
  localStorage.removeItem(SESSION_ACTOR_KEY);
};

export const isParqueaderoAuthenticated = () =>
  getSessionActor() === "parqueadero" && Boolean(getToken("parqueadero") && getParqueaderoSession()?.id);

export const isAdminAuthenticated = () =>
  getSessionActor() === "admin" && Boolean(getToken("admin") && getAdminSession()?.id);

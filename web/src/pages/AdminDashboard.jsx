import React, { useCallback, useEffect, useMemo, useState } from "react";
import api from "../services/api";
import "./admin.css";

function UsuarioRow({ usuario, onSave, saving }) {
  const [rol, setRol] = useState(usuario.rol || "user");
  const [verificado, setVerificado] = useState(Boolean(usuario.email_verificado));

  useEffect(() => {
    setRol(usuario.rol || "user");
    setVerificado(Boolean(usuario.email_verificado));
  }, [usuario]);

  return (
    <tr>
      <td>{usuario.nombre}</td>
      <td>{usuario.email}</td>
      <td>{usuario.telefono || "--"}</td>
      <td>
        <select
          className="admin-select"
          value={rol}
          onChange={(e) => setRol(e.target.value)}
        >
          <option value="user">user</option>
          <option value="admin">admin</option>
        </select>
      </td>
      <td>
        <label className="admin-checkbox">
          <input
            type="checkbox"
            checked={verificado}
            onChange={(e) => setVerificado(e.target.checked)}
          />
          <span>{verificado ? "Verificado" : "Pendiente"}</span>
        </label>
      </td>
      <td>{new Date(usuario.creado_en).toLocaleString()}</td>
      <td>
        <button
          type="button"
          className="admin-action-btn"
          onClick={() => onSave(usuario.id, { rol, email_verificado: verificado })}
          disabled={saving}
        >
          {saving ? "Guardando..." : "Guardar"}
        </button>
      </td>
    </tr>
  );
}

export default function AdminDashboard() {
  const [usuarios, setUsuarios] = useState([]);
  const [loading, setLoading] = useState(true);
  const [savingId, setSavingId] = useState(null);
  const [search, setSearch] = useState("");
  const [mensaje, setMensaje] = useState(null);

  const loadUsuarios = useCallback(async () => {
    setLoading(true);
    try {
      const res = await api.get("/admin/usuarios");
      setUsuarios(Array.isArray(res.data) ? res.data : []);
    } catch (err) {
      setMensaje({
        type: "error",
        text: err.response?.data?.message || "No se pudieron cargar los usuarios.",
      });
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    loadUsuarios();
  }, [loadUsuarios]);

  const usuariosFiltrados = useMemo(() => {
    const term = search.trim().toLowerCase();
    if (!term) return usuarios;
    return usuarios.filter((usuario) =>
      [usuario.nombre, usuario.email, usuario.telefono, usuario.rol]
        .filter(Boolean)
        .some((value) => String(value).toLowerCase().includes(term)),
    );
  }, [search, usuarios]);

  const handleSave = async (id, payload) => {
    setSavingId(id);
    setMensaje(null);
    try {
      await api.put(`/admin/usuarios/${id}`, payload);
      setMensaje({ type: "success", text: "Usuario actualizado." });
      await loadUsuarios();
    } catch (err) {
      setMensaje({
        type: "error",
        text: err.response?.data?.message || "No se pudo actualizar el usuario.",
      });
    } finally {
      setSavingId(null);
    }
  };

  return (
    <section className="admin-page">
      <div className="admin-page-header">
        <div>
          <p className="admin-kicker">Panel administrador</p>
          <h1>Gestion de usuarios</h1>
          <p>Controla roles y verificacion por correo de las cuentas del sistema.</p>
        </div>
        <input
          className="admin-search"
          type="search"
          placeholder="Buscar por nombre, correo o rol"
          value={search}
          onChange={(e) => setSearch(e.target.value)}
        />
      </div>

      {mensaje && <div className={`alert alert-${mensaje.type}`}>{mensaje.text}</div>}

      <div className="admin-summary-grid">
        <article className="admin-summary-card">
          <strong>{usuarios.length}</strong>
          <span>Usuarios totales</span>
        </article>
        <article className="admin-summary-card">
          <strong>{usuarios.filter((item) => item.rol === "admin").length}</strong>
          <span>Admins</span>
        </article>
        <article className="admin-summary-card">
          <strong>{usuarios.filter((item) => item.email_verificado).length}</strong>
          <span>Correos verificados</span>
        </article>
      </div>

      <div className="admin-table-wrap">
        {loading ? (
          <div className="admin-empty">Cargando usuarios...</div>
        ) : usuariosFiltrados.length === 0 ? (
          <div className="admin-empty">No hay usuarios para mostrar.</div>
        ) : (
          <table className="admin-table">
            <thead>
              <tr>
                <th>Nombre</th>
                <th>Correo</th>
                <th>Telefono</th>
                <th>Rol</th>
                <th>Estado</th>
                <th>Creado</th>
                <th>Accion</th>
              </tr>
            </thead>
            <tbody>
              {usuariosFiltrados.map((usuario) => (
                <UsuarioRow
                  key={usuario.id}
                  usuario={usuario}
                  onSave={handleSave}
                  saving={savingId === usuario.id}
                />
              ))}
            </tbody>
          </table>
        )}
      </div>
    </section>
  );
}

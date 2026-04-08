import React, { useCallback, useEffect, useMemo, useState } from "react";
import api from "../services/api";
import "./admin.css";

const emptyUserForm = {
  nombre: "",
  email: "",
  telefono: "",
  password: "",
  rol: "user",
  email_verificado: true,
};

function AdminCreateUserForm({ onCreate, creating }) {
  const [form, setForm] = useState(emptyUserForm);

  const setField = (field, value) => {
    setForm((current) => ({ ...current, [field]: value }));
  };

  const handleSubmit = async (event) => {
    event.preventDefault();
    const ok = await onCreate(form);
    if (ok) setForm(emptyUserForm);
  };

  return (
    <form className="admin-create-card" onSubmit={handleSubmit}>
      <div>
        <p className="admin-kicker">Creacion directa</p>
        <h2>Registrar usuario</h2>
        <p>Se crea desde admin sin enviar correo de verificacion.</p>
      </div>
      <div className="admin-form-grid">
        <input
          className="admin-input"
          placeholder="Nombre"
          value={form.nombre}
          onChange={(e) => setField("nombre", e.target.value)}
          required
        />
        <input
          className="admin-input"
          placeholder="Correo"
          type="email"
          value={form.email}
          onChange={(e) => setField("email", e.target.value)}
          required
        />
        <input
          className="admin-input"
          placeholder="Telefono"
          value={form.telefono}
          onChange={(e) => setField("telefono", e.target.value)}
        />
        <input
          className="admin-input"
          placeholder="Contrasena"
          type="password"
          value={form.password}
          onChange={(e) => setField("password", e.target.value)}
          required
        />
        <select
          className="admin-select"
          value={form.rol}
          onChange={(e) => setField("rol", e.target.value)}
        >
          <option value="user">user</option>
          <option value="admin">admin</option>
        </select>
        <label className="admin-checkbox">
          <input
            type="checkbox"
            checked={form.email_verificado}
            onChange={(e) => setField("email_verificado", e.target.checked)}
          />
          <span>Crear como verificado</span>
        </label>
      </div>
      <button className="admin-action-btn admin-create-submit" type="submit" disabled={creating}>
        {creating ? "Creando..." : "Crear usuario"}
      </button>
    </form>
  );
}

function UsuarioRow({ usuario, onSave, onDelete, saving }) {
  const [isEditing, setIsEditing] = useState(false);
  const [form, setForm] = useState({
    nombre: usuario.nombre || "",
    email: usuario.email || "",
    telefono: usuario.telefono || "",
    rol: usuario.rol || "user",
    email_verificado: Boolean(usuario.email_verificado),
  });

  useEffect(() => {
    setForm({
      nombre: usuario.nombre || "",
      email: usuario.email || "",
      telefono: usuario.telefono || "",
      rol: usuario.rol || "user",
      email_verificado: Boolean(usuario.email_verificado),
    });
    setIsEditing(false);
  }, [usuario]);

  const setField = (field, value) => {
    setForm((current) => ({ ...current, [field]: value }));
  };

  const handleSave = async () => {
    const ok = await onSave(usuario.id, form);
    if (ok) setIsEditing(false);
  };

  return (
    <tr>
      <td>
        {isEditing ? (
          <input
            className="admin-input"
            value={form.nombre}
            onChange={(e) => setField("nombre", e.target.value)}
          />
        ) : (
          usuario.nombre
        )}
      </td>
      <td>
        {isEditing ? (
          <input
            className="admin-input"
            type="email"
            value={form.email}
            onChange={(e) => setField("email", e.target.value)}
          />
        ) : (
          usuario.email
        )}
      </td>
      <td>
        {isEditing ? (
          <input
            className="admin-input"
            value={form.telefono}
            onChange={(e) => setField("telefono", e.target.value)}
          />
        ) : (
          usuario.telefono || "--"
        )}
      </td>
      <td>
        {isEditing ? (
          <select
            className="admin-select"
            value={form.rol}
            onChange={(e) => setField("rol", e.target.value)}
          >
            <option value="user">user</option>
            <option value="admin">admin</option>
          </select>
        ) : (
          <span className="admin-pill">{usuario.rol || "user"}</span>
        )}
      </td>
      <td>
        {isEditing ? (
          <label className="admin-checkbox">
            <input
              type="checkbox"
              checked={form.email_verificado}
              onChange={(e) => setField("email_verificado", e.target.checked)}
            />
            <span>{form.email_verificado ? "Verificado" : "Pendiente"}</span>
          </label>
        ) : (
          <span className={`admin-pill ${usuario.email_verificado ? "admin-pill-ok" : "admin-pill-warn"}`}>
            {usuario.email_verificado ? "Verificado" : "Pendiente"}
          </span>
        )}
      </td>
      <td>{new Date(usuario.creado_en).toLocaleString()}</td>
      <td>
        <div className="admin-actions">
          {isEditing ? (
            <>
              <button
                type="button"
                className="admin-action-btn"
                onClick={handleSave}
                disabled={saving}
              >
                {saving ? "Guardando..." : "Guardar"}
              </button>
              <button
                type="button"
                className="admin-secondary-btn"
                onClick={() => setIsEditing(false)}
                disabled={saving}
              >
                Cancelar
              </button>
            </>
          ) : (
            <>
              <button
                type="button"
                className="admin-secondary-btn"
                onClick={() => setIsEditing(true)}
                disabled={saving}
              >
                Editar
              </button>
              <button
                type="button"
                className="admin-danger-btn"
                onClick={() => onDelete(usuario)}
                disabled={saving}
              >
                {saving ? "Procesando..." : "Eliminar"}
              </button>
            </>
          )}
        </div>
      </td>
    </tr>
  );
}

export default function AdminDashboard() {
  const [usuarios, setUsuarios] = useState([]);
  const [loading, setLoading] = useState(true);
  const [savingId, setSavingId] = useState(null);
  const [creating, setCreating] = useState(false);
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
      return true;
    } catch (err) {
      setMensaje({
        type: "error",
        text: err.response?.data?.message || "No se pudo actualizar el usuario.",
      });
      return false;
    } finally {
      setSavingId(null);
    }
  };

  const handleCreate = async (payload) => {
    setCreating(true);
    setMensaje(null);
    try {
      await api.post("/admin/usuarios", payload);
      setMensaje({ type: "success", text: "Usuario creado sin enviar correo." });
      await loadUsuarios();
      return true;
    } catch (err) {
      setMensaje({
        type: "error",
        text: err.response?.data?.message || "No se pudo crear el usuario.",
      });
      return false;
    } finally {
      setCreating(false);
    }
  };

  const handleDelete = async (usuario) => {
    const confirmed = window.confirm(`Eliminar el usuario ${usuario.email}? Esta accion no se puede deshacer.`);
    if (!confirmed) return;

    setSavingId(usuario.id);
    setMensaje(null);
    try {
      await api.delete(`/admin/usuarios/${usuario.id}`);
      setMensaje({ type: "success", text: "Usuario eliminado." });
      await loadUsuarios();
    } catch (err) {
      setMensaje({
        type: "error",
        text: err.response?.data?.message || "No se pudo eliminar el usuario.",
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
          <p>Edita usuarios, cambia roles, verifica correos o elimina cuentas del sistema.</p>
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

      <AdminCreateUserForm onCreate={handleCreate} creating={creating} />

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
                <th>Acciones</th>
              </tr>
            </thead>
            <tbody>
              {usuariosFiltrados.map((usuario) => (
                <UsuarioRow
                  key={usuario.id}
                  usuario={usuario}
                  onSave={handleSave}
                  onDelete={handleDelete}
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

import React, { useCallback, useEffect, useMemo, useState } from "react";
import api from "../services/api";
import "./admin.css";

function ParqueaderoRow({ parqueadero, onSave, onDelete, saving }) {
  const [isEditing, setIsEditing] = useState(false);
  const [form, setForm] = useState({
    nombre: parqueadero.nombre || "",
    email: parqueadero.email || "",
    direccion: parqueadero.direccion || "",
    cupos: Number(parqueadero.cupos || 0),
    disponible: Boolean(parqueadero.disponible),
    email_verificado: Boolean(parqueadero.email_verificado),
  });

  useEffect(() => {
    setForm({
      nombre: parqueadero.nombre || "",
      email: parqueadero.email || "",
      direccion: parqueadero.direccion || "",
      cupos: Number(parqueadero.cupos || 0),
      disponible: Boolean(parqueadero.disponible),
      email_verificado: Boolean(parqueadero.email_verificado),
    });
    setIsEditing(false);
  }, [parqueadero]);

  const setField = (field, value) => {
    setForm((current) => ({ ...current, [field]: value }));
  };

  const handleSave = async () => {
    const ok = await onSave(parqueadero.id, form);
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
          parqueadero.nombre
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
          parqueadero.email
        )}
      </td>
      <td>
        {isEditing ? (
          <input
            className="admin-input"
            value={form.direccion}
            onChange={(e) => setField("direccion", e.target.value)}
          />
        ) : (
          parqueadero.direccion
        )}
      </td>
      <td>
        {isEditing ? (
          <input
            className="admin-input admin-input-small"
            type="number"
            min="1"
            value={form.cupos}
            onChange={(e) => setField("cupos", e.target.value)}
          />
        ) : (
          Number(parqueadero.cupos || 0)
        )}
      </td>
      <td>
        {isEditing ? (
          <label className="admin-checkbox">
            <input
              type="checkbox"
              checked={form.disponible}
              onChange={(e) => setField("disponible", e.target.checked)}
            />
            <span>{form.disponible ? "Disponible" : "No disponible"}</span>
          </label>
        ) : (
          <span className={`admin-pill ${parqueadero.disponible ? "admin-pill-ok" : "admin-pill-warn"}`}>
            {parqueadero.disponible ? "Disponible" : "No disponible"}
          </span>
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
          <span className={`admin-pill ${parqueadero.email_verificado ? "admin-pill-ok" : "admin-pill-warn"}`}>
            {parqueadero.email_verificado ? "Verificado" : "Pendiente"}
          </span>
        )}
      </td>
      <td>{new Date(parqueadero.creado_en).toLocaleString()}</td>
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
                onClick={() => onDelete(parqueadero)}
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

export default function AdminParqueaderos() {
  const [parqueaderos, setParqueaderos] = useState([]);
  const [loading, setLoading] = useState(true);
  const [savingId, setSavingId] = useState(null);
  const [search, setSearch] = useState("");
  const [mensaje, setMensaje] = useState(null);

  const loadParqueaderos = useCallback(async () => {
    setLoading(true);
    try {
      const res = await api.get("/admin/parqueaderos");
      setParqueaderos(Array.isArray(res.data) ? res.data : []);
    } catch (err) {
      setMensaje({
        type: "error",
        text: err.response?.data?.message || "No se pudieron cargar los parqueaderos.",
      });
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    loadParqueaderos();
  }, [loadParqueaderos]);

  const parqueaderosFiltrados = useMemo(() => {
    const term = search.trim().toLowerCase();
    if (!term) return parqueaderos;
    return parqueaderos.filter((parqueadero) =>
      [parqueadero.nombre, parqueadero.email, parqueadero.direccion]
        .filter(Boolean)
        .some((value) => String(value).toLowerCase().includes(term)),
    );
  }, [parqueaderos, search]);

  const handleSave = async (id, payload) => {
    setSavingId(id);
    setMensaje(null);
    try {
      await api.put(`/admin/parqueaderos/${id}`, payload);
      setMensaje({ type: "success", text: "Parqueadero actualizado." });
      await loadParqueaderos();
      return true;
    } catch (err) {
      setMensaje({
        type: "error",
        text: err.response?.data?.message || "No se pudo actualizar el parqueadero.",
      });
      return false;
    } finally {
      setSavingId(null);
    }
  };

  const handleDelete = async (parqueadero) => {
    const confirmed = window.confirm(`Eliminar el parqueadero ${parqueadero.nombre}? Esta accion no se puede deshacer.`);
    if (!confirmed) return;

    setSavingId(parqueadero.id);
    setMensaje(null);
    try {
      await api.delete(`/admin/parqueaderos/${parqueadero.id}`);
      setMensaje({ type: "success", text: "Parqueadero eliminado." });
      await loadParqueaderos();
    } catch (err) {
      setMensaje({
        type: "error",
        text: err.response?.data?.message || "No se pudo eliminar el parqueadero.",
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
          <h1>Gestion de parqueaderos</h1>
          <p>Edita parqueaderos, verifica cuentas o elimina registros del sistema.</p>
        </div>
        <input
          className="admin-search"
          type="search"
          placeholder="Buscar por nombre, correo o direccion"
          value={search}
          onChange={(e) => setSearch(e.target.value)}
        />
      </div>

      {mensaje && <div className={`alert alert-${mensaje.type}`}>{mensaje.text}</div>}

      <div className="admin-summary-grid">
        <article className="admin-summary-card">
          <strong>{parqueaderos.length}</strong>
          <span>Parqueaderos totales</span>
        </article>
        <article className="admin-summary-card">
          <strong>{parqueaderos.filter((item) => item.email_verificado).length}</strong>
          <span>Verificados</span>
        </article>
        <article className="admin-summary-card">
          <strong>{parqueaderos.filter((item) => item.disponible).length}</strong>
          <span>Disponibles</span>
        </article>
      </div>

      <div className="admin-table-wrap">
        {loading ? (
          <div className="admin-empty">Cargando parqueaderos...</div>
        ) : parqueaderosFiltrados.length === 0 ? (
          <div className="admin-empty">No hay parqueaderos para mostrar.</div>
        ) : (
          <table className="admin-table">
            <thead>
              <tr>
                <th>Nombre</th>
                <th>Correo</th>
                <th>Direccion</th>
                <th>Cupos</th>
                <th>Disponibilidad</th>
                <th>Estado</th>
                <th>Creado</th>
                <th>Acciones</th>
              </tr>
            </thead>
            <tbody>
              {parqueaderosFiltrados.map((parqueadero) => (
                <ParqueaderoRow
                  key={parqueadero.id}
                  parqueadero={parqueadero}
                  onSave={handleSave}
                  onDelete={handleDelete}
                  saving={savingId === parqueadero.id}
                />
              ))}
            </tbody>
          </table>
        )}
      </div>
    </section>
  );
}

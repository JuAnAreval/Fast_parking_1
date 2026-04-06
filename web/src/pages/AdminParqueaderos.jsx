import React, { useCallback, useEffect, useMemo, useState } from "react";
import api from "../services/api";
import "./admin.css";

function ParqueaderoRow({ parqueadero, onSave, saving }) {
  const [verificado, setVerificado] = useState(Boolean(parqueadero.email_verificado));

  useEffect(() => {
    setVerificado(Boolean(parqueadero.email_verificado));
  }, [parqueadero]);

  return (
    <tr>
      <td>{parqueadero.nombre}</td>
      <td>{parqueadero.email}</td>
      <td>{parqueadero.direccion}</td>
      <td>{Number(parqueadero.cupos || 0)}</td>
      <td>{parqueadero.disponible ? "Disponible" : "No disponible"}</td>
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
      <td>{new Date(parqueadero.creado_en).toLocaleString()}</td>
      <td>
        <button
          type="button"
          className="admin-action-btn"
          onClick={() => onSave(parqueadero.id, { email_verificado: verificado })}
          disabled={saving}
        >
          {saving ? "Guardando..." : "Guardar"}
        </button>
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
    } catch (err) {
      setMensaje({
        type: "error",
        text: err.response?.data?.message || "No se pudo actualizar el parqueadero.",
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
          <p>Aprueba el acceso al panel verificando las cuentas de parqueadero.</p>
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
                <th>Accion</th>
              </tr>
            </thead>
            <tbody>
              {parqueaderosFiltrados.map((parqueadero) => (
                <ParqueaderoRow
                  key={parqueadero.id}
                  parqueadero={parqueadero}
                  onSave={handleSave}
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

import React, { useCallback, useEffect, useMemo, useState } from "react";
import {
  FaCalendarAlt,
  FaCar,
  FaClock,
  FaComment,
  FaIdCard,
  FaKey,
  FaPalette,
  FaPlus,
  FaTimes,
} from "react-icons/fa";
import { useNavigate } from "react-router-dom";
import api from "../services/api";
import { getParqueaderoSession, getUsuarioSession } from "../utils/session";
import { showToast } from "../utils/toast";
import "./reservas.css";

const toCurrency = (value) => {
  const n = Number(value || 0);
  return `$${n.toLocaleString("es-CO", { minimumFractionDigits: 0, maximumFractionDigits: 2 })}`;
};

const emptyForm = {
  parqueadero_id: "",
  vehiculo_id: "",
  fecha_reserva: "",
  hora_inicio: "",
  hora_fin: "",
  observaciones: "",
};

const emptyVehiculoForm = {
  tipo: "carro",
  placa: "",
  color: "",
};

const formatVehiculoLabel = (vehiculo) => {
  const tipo = String(vehiculo?.tipo || "N/A").toUpperCase();
  const placa = String(vehiculo?.placa || "SIN-PLACA").toUpperCase();
  const color = String(vehiculo?.color || "SIN-COLOR");
  return `${placa} - ${color} (${tipo})`;
};

export default function Reservas() {
  const navigate = useNavigate();
  const [reservas, setReservas] = useState([]);
  const [parqueaderos, setParqueaderos] = useState([]);
  const [vehiculos, setVehiculos] = useState([]);
  const [loading, setLoading] = useState(true);
  const [showForm, setShowForm] = useState(false);
  const [showVehiculoForm, setShowVehiculoForm] = useState(false);
  const [saving, setSaving] = useState(false);
  const [savingVehiculo, setSavingVehiculo] = useState(false);
  const [formData, setFormData] = useState(emptyForm);
  const [vehiculoForm, setVehiculoForm] = useState(emptyVehiculoForm);

  const usuario = useMemo(() => getUsuarioSession(), []);
  const parqueaderoSession = useMemo(() => getParqueaderoSession(), []);
  const usuarioId = usuario?.id;

  const loadData = useCallback(async () => {
    if (!usuarioId) {
      if (parqueaderoSession?.id) {
        navigate("/reservas-parqueadero");
      } else {
        navigate("/");
      }
      return;
    }

    try {
      setLoading(true);
      const [reservasRes, parqueaderosRes, vehiculosRes] = await Promise.all([
        api.get(`/reservas/usuario/${usuarioId}`),
        api.get("/parqueaderos"),
        api.get("/vehiculos/mios"),
      ]);

      const reservasData = Array.isArray(reservasRes.data) ? reservasRes.data : [];
      const parqueaderosData = Array.isArray(parqueaderosRes.data) ? parqueaderosRes.data : [];
      const vehiculosData = Array.isArray(vehiculosRes.data) ? vehiculosRes.data : [];

      setReservas(reservasData);
      setParqueaderos(parqueaderosData);
      setVehiculos(vehiculosData);

      if (vehiculosData.length > 0) {
        setFormData((prev) => {
          if (prev.vehiculo_id) return prev;
          return { ...prev, vehiculo_id: String(vehiculosData[0].id) };
        });
      }
    } catch {
      showToast("Error al cargar reservas.", "error");
    } finally {
      setLoading(false);
    }
  }, [navigate, parqueaderoSession?.id, usuarioId]);

  useEffect(() => {
    loadData();
  }, [loadData]);

  const onSubmit = async (event) => {
    event.preventDefault();
    if (!usuarioId) return;

    const selectedVehiculo = vehiculos.find(
      (vehiculo) => String(vehiculo.id) === String(formData.vehiculo_id),
    );
    if (!selectedVehiculo) {
      showToast("Debes seleccionar un vehiculo registrado.", "error");
      return;
    }

    try {
      setSaving(true);
      await api.post("/reservas", {
        ...formData,
        usuario_id: usuarioId,
        vehiculo_id: Number(formData.vehiculo_id),
        tipo_vehiculo: selectedVehiculo.tipo,
      });
      setFormData(emptyForm);
      setShowForm(false);
      showToast("Reserva creada correctamente.", "success");
      loadData();
    } catch (err) {
      const mensaje = err?.response?.data?.mensaje || "Error al crear reserva.";
      showToast(mensaje, "error");
    } finally {
      setSaving(false);
    }
  };

  const onRegistrarVehiculo = async () => {
    const placa = vehiculoForm.placa.trim().toUpperCase().replace(/\s+/g, "");
    const color = vehiculoForm.color.trim();
    if (!placa || !color) {
      showToast("Debes ingresar placa y color del vehiculo.", "error");
      return;
    }

    try {
      setSavingVehiculo(true);
      const response = await api.post("/vehiculos", {
        tipo: vehiculoForm.tipo,
        placa,
        color,
      });
      const vehiculoCreado = response?.data?.vehiculo;

      showToast("Vehiculo registrado correctamente.", "success");
      setVehiculoForm(emptyVehiculoForm);
      setShowVehiculoForm(false);
      await loadData();
      if (vehiculoCreado?.id) {
        setFormData((prev) => ({ ...prev, vehiculo_id: String(vehiculoCreado.id) }));
      }
    } catch (err) {
      const mensaje = err?.response?.data?.mensaje || "No se pudo registrar el vehiculo.";
      showToast(mensaje, "error");
    } finally {
      setSavingVehiculo(false);
    }
  };

  const onCancelarReserva = async (id) => {
    try {
      await api.put(`/reservas/${id}/cancelar`);
      showToast("Reserva cancelada.", "success");
      loadData();
    } catch {
      showToast("Error al cancelar reserva.", "error");
    }
  };

  const onAutorizarIngreso = async (id) => {
    try {
      await api.put(`/reservas/${id}/autorizar-ingreso`);
      showToast("Ingreso autorizado.", "success");
      loadData();
    } catch {
      showToast("Error al autorizar ingreso.", "error");
    }
  };

  if (loading) {
    return (
      <section className="user-reservas-page">
        <article className="user-reservas-shell user-reservas-shell-loading">
          <p>Cargando reservas...</p>
        </article>
      </section>
    );
  }

  return (
    <section className="user-reservas-page">
      <article className="user-reservas-shell">
        <header className="user-reservas-header">
          <div>
            <h1 className="user-reservas-title">Mis Reservas</h1>
            <p className="user-reservas-subtitle">Gestiona tus reservas de parqueadero.</p>
          </div>

          <button className="user-btn-add" onClick={() => setShowForm((v) => !v)}>
            <FaPlus /> {showForm ? "Cancelar" : "Nueva Reserva"}
          </button>
        </header>

        {showForm && (
          <form onSubmit={onSubmit} className="user-reserva-form">
            <div className="user-input-group">
              <FaCar className="user-input-icon" />
              <select
                value={formData.vehiculo_id}
                onChange={(e) => setFormData((prev) => ({ ...prev, vehiculo_id: e.target.value }))}
                required
              >
                <option value="">Selecciona vehiculo registrado</option>
                {vehiculos.map((vehiculo) => (
                  <option key={vehiculo.id} value={vehiculo.id}>
                    {formatVehiculoLabel(vehiculo)}
                  </option>
                ))}
              </select>
            </div>

            <button
              type="button"
              className="user-btn-add user-btn-add-ghost"
              onClick={() => setShowVehiculoForm((prev) => !prev)}
            >
              <FaPlus /> {showVehiculoForm ? "Ocultar registro de vehiculo" : "Registrar vehiculo"}
            </button>

            {showVehiculoForm && (
              <div className="user-vehiculo-form-panel">
                <div className="user-vehiculo-form-grid">
                  <div className="user-input-group">
                    <FaCar className="user-input-icon" />
                    <select
                      value={vehiculoForm.tipo}
                      onChange={(e) => setVehiculoForm((prev) => ({ ...prev, tipo: e.target.value }))}
                    >
                      <option value="carro">Carro</option>
                      <option value="moto">Moto</option>
                      <option value="bicicleta">Bicicleta</option>
                      <option value="camion">Camion</option>
                      <option value="ambulancia">Ambulancia</option>
                    </select>
                  </div>

                  <div className="user-input-group">
                    <FaIdCard className="user-input-icon" />
                    <input
                      type="text"
                      placeholder="Placa"
                      value={vehiculoForm.placa}
                      onChange={(e) => setVehiculoForm((prev) => ({ ...prev, placa: e.target.value }))}
                      required
                    />
                  </div>

                  <div className="user-input-group">
                    <FaPalette className="user-input-icon" />
                    <input
                      type="text"
                      placeholder="Color"
                      value={vehiculoForm.color}
                      onChange={(e) => setVehiculoForm((prev) => ({ ...prev, color: e.target.value }))}
                      required
                    />
                  </div>

                  <button
                    className="user-form-btn"
                    type="button"
                    onClick={onRegistrarVehiculo}
                    disabled={savingVehiculo}
                  >
                    {savingVehiculo ? "Guardando vehiculo..." : "Guardar vehiculo"}
                  </button>
                </div>
              </div>
            )}

            <div className="user-input-group">
              <FaCalendarAlt className="user-input-icon" />
              <select
                value={formData.parqueadero_id}
                onChange={(e) => setFormData((prev) => ({ ...prev, parqueadero_id: e.target.value }))}
                required
              >
                <option value="">Selecciona parqueadero</option>
                {parqueaderos.map((parqueadero) => (
                  <option key={parqueadero.id} value={parqueadero.id}>
                    {parqueadero.nombre} - {parqueadero.direccion}
                  </option>
                ))}
              </select>
            </div>

            <div className="user-input-group">
              <FaCalendarAlt className="user-input-icon" />
              <input
                type="date"
                value={formData.fecha_reserva}
                onChange={(e) => setFormData((prev) => ({ ...prev, fecha_reserva: e.target.value }))}
                required
              />
            </div>

            <div className="user-input-group">
              <FaClock className="user-input-icon" />
              <input
                type="time"
                value={formData.hora_inicio}
                onChange={(e) => setFormData((prev) => ({ ...prev, hora_inicio: e.target.value }))}
              />
            </div>

            <div className="user-input-group">
              <FaClock className="user-input-icon" />
              <input
                type="time"
                value={formData.hora_fin}
                onChange={(e) => setFormData((prev) => ({ ...prev, hora_fin: e.target.value }))}
              />
            </div>

            <div className="user-input-group">
              <FaComment className="user-input-icon" />
              <textarea
                placeholder="Observaciones"
                value={formData.observaciones}
                onChange={(e) => setFormData((prev) => ({ ...prev, observaciones: e.target.value }))}
              />
            </div>

            <button className="user-form-btn" type="submit" disabled={saving}>
              {saving ? "Guardando..." : "Crear Reserva"}
            </button>
          </form>
        )}

        <div className="user-reservas-list">
          {reservas.length === 0 ? (
            <p className="user-reservas-empty">No tienes reservas.</p>
          ) : (
            reservas.map((reserva) => (
              <article key={reserva.id} className={`user-reserva-item state-${reserva.estado}`}>
                <div className="user-reserva-head">
                  <h3>{reserva.parqueadero_nombre}</h3>
                  <span className={`user-status-badge ${reserva.estado}`}>{reserva.estado}</span>
                </div>
                <p>{reserva.direccion}</p>
                <p>
                  Horario: {reserva.hora_inicio || "--"} - {reserva.hora_fin || "--"}
                </p>
                <p>
                  Vehiculo que llega: {String(reserva.vehiculo_tipo || reserva.tipo_vehiculo || "No registrado").toUpperCase()} | Placa: {reserva.vehiculo_placa || reserva.placa || "No registrada"} | Color: {reserva.vehiculo_color || reserva.color || "No especificado"}
                </p>
                <p>Valor estimado: {toCurrency(reserva.valor_estimado)}</p>

                {reserva.estado === "pendiente" && (
                  <div className="user-reserva-actions">
                    <button className="user-btn-authorize" onClick={() => onAutorizarIngreso(reserva.id)}>
                      <FaKey /> Autorizar Ingreso
                    </button>
                    <button className="user-btn-cancel" onClick={() => onCancelarReserva(reserva.id)}>
                      <FaTimes /> Cancelar
                    </button>
                  </div>
                )}
              </article>
            ))
          )}
        </div>
      </article>
    </section>
  );
}

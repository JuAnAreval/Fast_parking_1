import React, { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { FaCheck, FaCog, FaHome, FaKey, FaTimes } from "react-icons/fa";
import { Link, useNavigate } from "react-router-dom";
import api from "../services/api";
import { API_BASE_URL } from "../services/apiBaseUrl";
import { getParqueaderoSession, getToken } from "../utils/session";
import { showToast } from "../utils/toast";
import "./parqueadero-reservas.css";

const toCurrency = (value) => {
  const n = Number(value || 0);
  return `$${n.toLocaleString("es-CO", { minimumFractionDigits: 0, maximumFractionDigits: 2 })}`;
};

const formatDate = (value) => {
  if (!value) return "--";
  const normalized = String(value).trim();
  return normalized.length >= 10 ? normalized.slice(0, 10) : normalized;
};

const formatTime = (value) => {
  if (!value) return "--";
  const normalized = String(value).trim();
  return normalized.length >= 5 ? normalized.slice(0, 5) : normalized;
};

const isEntryRegistered = (estado) => estado === "activa" || estado === "completada";

const getReservationSummaryItems = (reserva) => {
  const items = [];

  if (isEntryRegistered(reserva.estado)) {
    items.push({ label: "Hora de entrada", value: formatTime(reserva.hora_inicio) });

    if (reserva.estado === "completada") {
      items.push({ label: "Hora de salida", value: formatTime(reserva.hora_fin) });
      items.push({
        label: "Valor total",
        value: toCurrency(reserva.valor_total),
        highlight: true,
      });
    }

    return items;
  }

  items.push({
    label: "Horario reservado",
    value: `${formatTime(reserva.hora_inicio)} - ${formatTime(reserva.hora_fin)}`,
  });

  return items;
};
const REALTIME_FALLBACK_POLL_MS = 2000;

export default function ParqueaderoReservas() {
  const navigate = useNavigate();
  const [reservas, setReservas] = useState([]);
  const [loading, setLoading] = useState(true);
  const knownReservaIdsRef = useRef(new Set());
  const isPrimedRef = useRef(false);
  const audioContextRef = useRef(null);

  const parqueadero = useMemo(() => getParqueaderoSession(), []);
  const parqueaderoId = parqueadero?.id;
  const apiBaseUrl = API_BASE_URL;

  const primeAudioContext = useCallback(() => {
    const AudioContextCtor = window.AudioContext || window.webkitAudioContext;
    if (!AudioContextCtor) return null;

    if (!audioContextRef.current) {
      audioContextRef.current = new AudioContextCtor();
    }

    if (audioContextRef.current.state === "suspended") {
      void audioContextRef.current.resume();
    }

    return audioContextRef.current;
  }, []);

  const playNotificationSound = useCallback(() => {
    try {
      const ctx = primeAudioContext();
      if (!ctx) return;

      const playWhistle = (time, startFreq, endFreq, vol) => {
        const osc = ctx.createOscillator();
        const gain = ctx.createGain();

        osc.type = "sine";
        osc.frequency.setValueAtTime(startFreq, time);
        osc.frequency.exponentialRampToValueAtTime(endFreq, time + 0.1);

        gain.gain.setValueAtTime(0.0001, time);
        gain.gain.linearRampToValueAtTime(vol, time + 0.02);
        gain.gain.exponentialRampToValueAtTime(0.001, time + 0.25);

        osc.connect(gain);
        gain.connect(ctx.destination);
        osc.start(time);
        osc.stop(time + 0.3);
      };

      const now = ctx.currentTime;
      playWhistle(now, 1500, 1800, 0.8);
      playWhistle(now + 0.12, 1800, 2400, 1.0);
    } catch {
      // Ignore blocked audio if browser has no prior interaction.
    }
  }, [primeAudioContext]);

  const loadData = useCallback(
    async ({ silent = false } = {}) => {
      if (!parqueaderoId) {
        navigate("/");
        return;
      }

      try {
        if (!silent) {
          setLoading(true);
        }
        const reservasRes = await api.get(`/reservas/parqueadero/${parqueaderoId}`);
        const reservasData = Array.isArray(reservasRes.data) ? reservasRes.data : [];
        setReservas(reservasData);
        knownReservaIdsRef.current = new Set(
          reservasData
            .map((reserva) => Number(reserva?.id || 0))
            .filter((id) => Number.isInteger(id) && id > 0),
        );
        isPrimedRef.current = true;
      } catch {
        showToast("Error al cargar reservas.", "error");
      } finally {
        if (!silent) {
          setLoading(false);
        }
      }
    },
    [navigate, parqueaderoId],
  );

  useEffect(() => {
    loadData();
  }, [loadData]);

  useEffect(() => {
    const unlockAudio = () => {
      primeAudioContext();
      window.removeEventListener("pointerdown", unlockAudio);
      window.removeEventListener("keydown", unlockAudio);
    };

    window.addEventListener("pointerdown", unlockAudio, { once: true });
    window.addEventListener("keydown", unlockAudio, { once: true });

    return () => {
      window.removeEventListener("pointerdown", unlockAudio);
      window.removeEventListener("keydown", unlockAudio);
    };
  }, [primeAudioContext]);

  useEffect(() => {
    if (!parqueaderoId) return undefined;

    const token = getToken();
    if (!token) return undefined;

    const streamUrl =
      `${apiBaseUrl}/reservas/stream/parqueadero/${parqueaderoId}` +
      `?token=${encodeURIComponent(token)}`;

    const eventSource = new EventSource(streamUrl);

    const onReservaNueva = (event) => {
      let payload = null;
      try {
        payload = JSON.parse(event.data);
      } catch {
        payload = null;
      }

      const reservaId = Number(payload?.reserva?.id || payload?.reserva_id || 0);
      const isNewReserva =
        isPrimedRef.current &&
        Number.isInteger(reservaId) &&
        reservaId > 0 &&
        !knownReservaIdsRef.current.has(reservaId);

      if (isNewReserva) {
        showToast("Nueva reserva recibida.", "success", {
          duration: 30000,
          dismissible: true,
          actionLabel: "Ir a reservas",
          onAction: () => navigate("/reservas-parqueadero"),
        });
        playNotificationSound();
      }

      void loadData({ silent: true });
    };

    const onReservaActualizada = () => {
      void loadData({ silent: true });
    };

    eventSource.addEventListener("reserva_nueva", onReservaNueva);
    eventSource.addEventListener("reserva_actualizada", onReservaActualizada);
    eventSource.onerror = () => {
      // Backup refresh if stream fails temporarily.
      void loadData({ silent: true });
    };

    return () => {
      eventSource.removeEventListener("reserva_nueva", onReservaNueva);
      eventSource.removeEventListener("reserva_actualizada", onReservaActualizada);
      eventSource.onerror = null;
      eventSource.close();
    };
  }, [apiBaseUrl, loadData, navigate, parqueaderoId, playNotificationSound]);

  useEffect(() => {
    if (!parqueaderoId) return undefined;

    const timer = window.setInterval(() => {
      if (document.visibilityState !== "visible") return;
      void loadData({ silent: true });
    }, REALTIME_FALLBACK_POLL_MS);

    return () => window.clearInterval(timer);
  }, [loadData, parqueaderoId]);

  const onAutorizarIngreso = async (id) => {
    try {
      await api.put(`/reservas/${id}/autorizar-ingreso`);
      showToast("Ingreso autorizado.", "success");
      loadData();
    } catch {
      showToast("Error al autorizar ingreso.", "error");
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

  const onCompletarReserva = async (id) => {
    try {
      await api.put(`/reservas/${id}/completar`);
      showToast("Reserva completada.", "success");
      loadData();
    } catch {
      showToast("Error al completar reserva.", "error");
    }
  };

  if (loading) {
    return (
      <section className="parking-reservas-page">
        <article className="parking-reservas-shell parking-reservas-shell-loading">
          <p>Cargando reservas...</p>
        </article>
      </section>
    );
  }

  const reservasPendientes = reservas.filter((r) => r.estado === "pendiente").length;
  const reservasActivas = reservas.filter((r) => r.estado === "activa").length;
  const reservasCompletadas = reservas.filter((r) => r.estado === "completada").length;

  return (
    <section className="parking-reservas-page">
      <article className="parking-reservas-shell">
        <header className="parking-reservas-hero">
          <div>
            <p className="parking-reservas-kicker">Panel de reservas</p>
            <h1>Gestion de Parqueadero</h1>
            <p>
              {parqueadero?.nombre || "Parqueadero"} - Administra ingresos, estados y atencion al cliente.
            </p>
          </div>

          <div className="parking-reservas-hero-actions">
            <Link to="/dashboard" className="parking-reservas-link-btn">
              <FaHome /> Dashboard
            </Link>
            <Link to="/configuracion-parqueadero" className="parking-reservas-link-btn secondary">
              <FaCog /> Configuracion
            </Link>
          </div>
        </header>

        <section className="parking-reservas-stats-grid">
          <article className="parking-reservas-stat-card">
            <span>Pendientes</span>
            <strong>{reservasPendientes}</strong>
          </article>
          <article className="parking-reservas-stat-card">
            <span>Activas</span>
            <strong>{reservasActivas}</strong>
          </article>
          <article className="parking-reservas-stat-card">
            <span>Completadas</span>
            <strong>{reservasCompletadas}</strong>
          </article>
        </section>

        <section className="parking-reservas-list-panel">
          <div className="parking-reservas-list-head">
            <h2>Reservas actuales</h2>
            <span className="parking-reservas-total">{reservas.length} en total</span>
          </div>

          <div className="parking-reservas-list">
            {reservas.length === 0 ? (
              <p className="parking-reservas-empty">No hay reservas para este parqueadero.</p>
            ) : (
              reservas.map((reserva) => (
                <article key={reserva.id} className={`parking-reserva-card state-${reserva.estado}`}>
                  <div className="parking-reserva-head">
                    <div className="parking-reserva-head-main">
                      <h3>Reserva #{reserva.id}</h3>
                      <span className="parking-reserva-date">{formatDate(reserva.fecha_reserva)}</span>
                    </div>
                    <span className={`parking-status-badge ${reserva.estado}`}>{reserva.estado}</span>
                  </div>

                  <div className="parking-reserva-summary">
                    {getReservationSummaryItems(reserva).map((item) => (
                      <div
                        key={item.label}
                        className={`parking-reserva-summary-item${item.highlight ? " is-highlight" : ""}`}
                      >
                        <span>{item.label}</span>
                        <strong>{item.value}</strong>
                      </div>
                    ))}
                  </div>

                  <div className="parking-reserva-grid">
                    <p>
                      <span>Cliente</span>
                      <strong>{reserva.usuario_nombre || "No definido"}</strong>
                    </p>
                    <p>
                      <span>Email</span>
                      <strong>{reserva.usuario_email || "--"}</strong>
                    </p>
                    <p>
                      <span>Telefono</span>
                      <strong>{reserva.usuario_telefono || "No registrado"}</strong>
                    </p>
                    <p>
                      <span>Vehiculo</span>
                      <strong>
                        {String(reserva.vehiculo_tipo || reserva.tipo_vehiculo || "No registrado").toUpperCase()}
                      </strong>
                    </p>
                    <p>
                      <span>Placa</span>
                      <strong>{reserva.vehiculo_placa || reserva.placa || "No registrada"}</strong>
                    </p>
                    <p>
                      <span>Color</span>
                      <strong>{reserva.vehiculo_color || reserva.color || "No especificado"}</strong>
                    </p>
                  </div>

                  {reserva.observaciones && (
                    <p className="parking-reserva-note">
                      <span>Observaciones:</span> {reserva.observaciones}
                    </p>
                  )}

                  {(reserva.estado === "pendiente" || reserva.estado === "activa") && (
                    <div className="parking-reserva-actions">
                      {reserva.estado === "pendiente" && (
                        <>
                          <button className="parking-btn btn-authorize" onClick={() => onAutorizarIngreso(reserva.id)}>
                            <FaKey /> Autorizar Ingreso
                          </button>
                          <button className="parking-btn btn-cancel" onClick={() => onCancelarReserva(reserva.id)}>
                            <FaTimes /> Cancelar
                          </button>
                        </>
                      )}

                      {reserva.estado === "activa" && (
                        <button className="parking-btn btn-complete" onClick={() => onCompletarReserva(reserva.id)}>
                          <FaCheck /> Completar
                        </button>
                      )}
                    </div>
                  )}
                </article>
              ))
            )}
          </div>
        </section>
      </article>
    </section>
  );
}

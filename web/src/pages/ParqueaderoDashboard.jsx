import React, { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { FaCalendarAlt, FaCog, FaParking, FaUsers } from "react-icons/fa";
import { Link, useNavigate } from "react-router-dom";
import api from "../services/api";
import { API_BASE_URL } from "../services/apiBaseUrl";
import { getParqueaderoSession, getToken } from "../utils/session";
import { showToast } from "../utils/toast";
import "./dashboard.css";

const VEHICULO_TYPES = ["camion", "ambulancia", "carro", "moto", "bicicleta"];
const REALTIME_FALLBACK_POLL_MS = 2000;

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

const getTimelineSummary = (reserva) => {
  if (reserva.estado === "completada") {
    return `Entrada: ${formatTime(reserva.hora_inicio)} | Salida: ${formatTime(reserva.hora_fin)}`;
  }

  if (isEntryRegistered(reserva.estado)) {
    return `Entrada: ${formatTime(reserva.hora_inicio)}`;
  }

  return `Horario reservado: ${formatTime(reserva.hora_inicio)} - ${formatTime(reserva.hora_fin)}`;
};

export default function ParqueaderoDashboard() {
  const navigate = useNavigate();
  const [loading, setLoading] = useState(true);
  const [parqueadero, setParqueadero] = useState(null);
  const [tarifas, setTarifas] = useState([]);
  const [reservasRecientes, setReservasRecientes] = useState([]);
  const knownReservaIdsRef = useRef(new Set());
  const isPrimedRef = useRef(false);
  const audioContextRef = useRef(null);

  const session = useMemo(() => getParqueaderoSession(), []);
  const parqueaderoId = session?.id;
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
        if (!silent) setLoading(true);

        const [parqueaderoRes, tarifasRes, reservasRes] = await Promise.all([
          api.get(`/parqueaderos/${parqueaderoId}`),
          api.get(`/parqueaderos/${parqueaderoId}/tarifas`),
          api.get(`/reservas/parqueadero/${parqueaderoId}`),
        ]);

        const parking = parqueaderoRes.data;
        const tarifasData = Array.isArray(tarifasRes.data) ? tarifasRes.data : [];
        const reservasData = Array.isArray(reservasRes.data) ? reservasRes.data : [];

        setParqueadero(parking);
        setTarifas(tarifasData);
        setReservasRecientes(reservasData.slice(0, 5));

        knownReservaIdsRef.current = new Set(
          reservasData
            .map((reserva) => Number(reserva?.id || 0))
            .filter((id) => Number.isInteger(id) && id > 0),
        );
        isPrimedRef.current = true;
      } catch {
        showToast("Error al cargar datos del dashboard.", "error");
      } finally {
        if (!silent) setLoading(false);
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

  if (loading) {
    return (
      <section className="dashboard-page">
        <article className="dashboard-shell dashboard-shell-loading">
          <p>Cargando datos del parqueadero...</p>
        </article>
      </section>
    );
  }

  if (!parqueadero) {
    return (
      <section className="dashboard-page">
        <article className="dashboard-shell dashboard-shell-loading">
          <p>No se encontro informacion del parqueadero.</p>
        </article>
      </section>
    );
  }

  const isDisponible = parqueadero.disponible === 1 || parqueadero.disponible === true;
  const reservasActivas = reservasRecientes.filter((r) => r.estado === "activa").length;

  return (
    <section className="dashboard-page">
      <article className="dashboard-shell">
        <header className="dashboard-hero">
          <div>
            <p className="dashboard-kicker">Panel operativo</p>
            <h1 className="dashboard-title">Centro de Operaciones</h1>
            <p className="dashboard-subtitle">Monitorea tu parqueadero y atiende reservas en tiempo real.</p>
          </div>

          <div className="dashboard-hero-actions">
            <Link to="/reservas-parqueadero" className="dashboard-action-link" type="button">
              <FaCalendarAlt />
              <span>Ver reservas</span>
            </Link>
            <Link to="/configuracion-parqueadero" className="dashboard-action-link secondary" type="button">
              <FaCog />
              <span>Configurar</span>
            </Link>
          </div>
        </header>

        <section className="dashboard-stats-grid">
          <article className="dashboard-stat-card">
            <div className="dashboard-stat-icon">
              <FaParking />
            </div>
            <p className="dashboard-stat-label">Estado operativo</p>
            <strong className={`dashboard-stat-value ${isDisponible ? "is-available" : "is-unavailable"}`}>
              {isDisponible ? "Disponible" : "No disponible"}
            </strong>
          </article>

          <article className="dashboard-stat-card">
            <div className="dashboard-stat-icon">
              <FaUsers />
            </div>
            <p className="dashboard-stat-label">Cupos declarados</p>
            <strong className="dashboard-stat-value">{Number(parqueadero.cupos || 0)}</strong>
          </article>

          <article className="dashboard-stat-card">
            <div className="dashboard-stat-icon">
              <FaCalendarAlt />
            </div>
            <p className="dashboard-stat-label">Reservas activas</p>
            <strong className="dashboard-stat-value">{reservasActivas}</strong>
          </article>
        </section>

        <section className="dashboard-main-grid">
          <article className="dashboard-panel">
            <div className="dashboard-panel-head">
              <h2>Informacion del parqueadero</h2>
              <Link
                to="/configuracion-parqueadero"
                className="dashboard-mini-action"
                type="button"
                aria-label="Ir a configuracion"
              >
                <FaCog />
              </Link>
            </div>

            <dl className="dashboard-info-list">
              <div>
                <dt>Nombre</dt>
                <dd>{parqueadero.nombre || "--"}</dd>
              </div>
              <div>
                <dt>Direccion</dt>
                <dd>{parqueadero.direccion || "--"}</dd>
              </div>
              <div>
                <dt>Email</dt>
                <dd>{parqueadero.email || "--"}</dd>
              </div>
              <div>
                <dt>Cupos</dt>
                <dd>{Number(parqueadero.cupos || 0)}</dd>
              </div>
            </dl>
          </article>

          <article className="dashboard-panel">
            <div className="dashboard-panel-head">
              <h2>Tarifas</h2>
              <Link
                to="/configuracion-parqueadero"
                className="dashboard-mini-action"
                type="button"
                aria-label="Editar tarifas"
              >
                <FaCog />
              </Link>
            </div>

            {tarifas.length === 0 ? (
              <p className="dashboard-empty-note">No hay tarifas configuradas.</p>
            ) : (
              <div className="dashboard-table-wrap">
                <table className="dashboard-tarifas-table">
                  <thead>
                    <tr>
                      <th>Tipo de vehiculo</th>
                      <th>Primera hora</th>
                      <th>Hora adicional</th>
                    </tr>
                  </thead>
                  <tbody>
                    {VEHICULO_TYPES.map((tipo) => {
                      const tarifa = tarifas.find((item) => item.tipo_vehiculo === tipo);
                      return (
                        <tr key={tipo}>
                          <td>{tipo.charAt(0).toUpperCase() + tipo.slice(1)}</td>
                          <td>{tarifa ? toCurrency(tarifa.tarifa_primera_hora) : "No definida"}</td>
                          <td>{tarifa ? toCurrency(tarifa.tarifa_hora_adicional) : "No definida"}</td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            )}
          </article>
        </section>

        <section className="dashboard-panel">
          <div className="dashboard-panel-head">
            <h2>Reservas recientes</h2>
            <Link to="/reservas-parqueadero" className="dashboard-text-action">
              Ver todas
            </Link>
          </div>

          {reservasRecientes.length === 0 ? (
            <p className="dashboard-empty-note">No hay reservas recientes.</p>
          ) : (
            <div className="dashboard-reservas-grid">
              {reservasRecientes.map((reserva) => (
                <article key={reserva.id} className={`dashboard-reserva-card state-${reserva.estado}`}>
                  <div className="dashboard-reserva-head">
                    <span className="dashboard-reserva-id">#{reserva.id}</span>
                    <span className={`dashboard-status-badge ${reserva.estado}`}>{reserva.estado}</span>
                  </div>

                  <p className="dashboard-reserva-main">
                    <strong>{reserva.usuario_nombre || "Usuario"}</strong> - {reserva.tipo_vehiculo || "--"}
                    {reserva.vehiculo_placa ? ` (${reserva.vehiculo_placa})` : ""}
                  </p>

                  <p className="dashboard-reserva-row">
                    Contacto: {reserva.usuario_email || "--"} | {reserva.usuario_telefono || "No registrado"}
                  </p>
                  <p className="dashboard-reserva-row">Fecha: {formatDate(reserva.fecha_reserva)}</p>
                  <p className="dashboard-reserva-row">
                    {getTimelineSummary(reserva)}
                  </p>
                </article>
              ))}
            </div>
          )}
        </section>
      </article>
    </section>
  );
}

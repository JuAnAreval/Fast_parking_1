import React, { useCallback, useEffect, useMemo, useRef, useState } from "react";
import {
  FaAmbulance,
  FaBicycle,
  FaCar,
  FaCheckCircle,
  FaCrosshairs,
  FaMapMarkerAlt,
  FaMotorcycle,
  FaParking,
  FaSave,
  FaTimesCircle,
  FaTruck,
} from "react-icons/fa";
import { Marker, MapContainer, TileLayer, useMap, useMapEvents } from "react-leaflet";
import { useNavigate } from "react-router-dom";
import L from "leaflet";
import "leaflet/dist/leaflet.css";
import api from "../services/api";
import { API_BASE_URL } from "../services/apiBaseUrl";
import { getParqueaderoSession, getToken } from "../utils/session";
import { showToast } from "../utils/toast";
import "./configuracion-parqueadero.css";

delete L.Icon.Default.prototype._getIconUrl;
L.Icon.Default.mergeOptions({
  iconRetinaUrl: "https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.7.1/images/marker-icon-2x.png",
  iconUrl: "https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.7.1/images/marker-icon.png",
  shadowUrl: "https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.7.1/images/marker-shadow.png",
});

const MAP_FALLBACK_CENTER = [1.2136, -77.2811];

const VEHICLE_TYPES = [
  { key: "carro", label: "Carro", icon: FaCar },
  { key: "moto", label: "Moto", icon: FaMotorcycle },
  { key: "bicicleta", label: "Bicicleta", icon: FaBicycle },
  { key: "camion", label: "Camion", icon: FaTruck },
  { key: "ambulancia", label: "Ambulancia", icon: FaAmbulance },
];

const createTarifasForm = () => ({
  carro: { primera_hora: "", hora_adicional: "" },
  moto: { primera_hora: "", hora_adicional: "" },
  bicicleta: { primera_hora: "", hora_adicional: "" },
  camion: { primera_hora: "", hora_adicional: "" },
  ambulancia: { primera_hora: "", hora_adicional: "" },
});

const defaultForm = {
  nombre: "",
  direccion: "",
  cupos: 0,
  disponible: true,
  latitud: "",
  longitud: "",
};

const toNumber = (value) => {
  if (value === "" || value === null || value === undefined) return 0;
  const n = Number(value);
  return Number.isFinite(n) ? n : 0;
};

const toNonNegativeInt = (value) => {
  const n = Number(value);
  if (!Number.isFinite(n)) return 0;
  return Math.max(0, Math.round(n));
};

const toNullableNumber = (value) => {
  if (value === "" || value === null || value === undefined) return null;
  const n = Number(value);
  return Number.isFinite(n) ? n : null;
};

const hasRealCoordinates = (latitud, longitud) =>
  Number.isFinite(latitud) && Number.isFinite(longitud) && !(latitud === 0 && longitud === 0);

const formatMoney = (value) => {
  const numberValue = Number(value);
  if (!Number.isFinite(numberValue) || numberValue <= 0) return "$0";
  return numberValue.toLocaleString("es-CO", {
    style: "currency",
    currency: "COP",
    maximumFractionDigits: 0,
  });
};

function MapCenterSync({ center }) {
  const map = useMap();
  useEffect(() => {
    map.setView(center, 16, { animate: true });
  }, [center, map]);
  return null;
}

function ConfigLocationMarker({ latitud, longitud, onPick }) {
  useMapEvents({
    click(event) {
      const nextLatitud = Number(event.latlng.lat.toFixed(7));
      const nextLongitud = Number(event.latlng.lng.toFixed(7));
      onPick(nextLatitud, nextLongitud);
    },
  });

  if (!hasRealCoordinates(latitud, longitud)) {
    return null;
  }

  return <Marker position={[latitud, longitud]} />;
}

export default function ConfiguracionParqueadero() {
  const navigate = useNavigate();
  const [loading, setLoading] = useState(true);
  const [savingSection, setSavingSection] = useState("");
  const [locating, setLocating] = useState(false);
  const [formData, setFormData] = useState(defaultForm);
  const [tarifasForm, setTarifasForm] = useState(createTarifasForm());
  const audioContextRef = useRef(null);

  const parqueadero = useMemo(() => getParqueaderoSession(), []);
  const parqueaderoId = parqueadero?.id;
  const apiBaseUrl = API_BASE_URL;

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

        const [parqueaderoRes, tarifasRes] = await Promise.all([
          api.get(`/parqueaderos/${parqueaderoId}`),
          api.get(`/parqueaderos/${parqueaderoId}/tarifas`),
        ]);

        const parking = parqueaderoRes.data || {};
        const tarifas = Array.isArray(tarifasRes.data) ? tarifasRes.data : [];

        setFormData({
          nombre: parking.nombre || "",
          direccion: parking.direccion || "",
          cupos: toNumber(parking.cupos),
          disponible: parking.disponible === 1 || parking.disponible === true,
          latitud: parking.latitud ?? "",
          longitud: parking.longitud ?? "",
        });

        const nextTarifas = createTarifasForm();
        tarifas.forEach((item) => {
          const tipo = item?.tipo_vehiculo;
          if (!nextTarifas[tipo]) return;
          nextTarifas[tipo] = {
            primera_hora:
              Number(item?.tarifa_primera_hora || 0) > 0
                ? String(toNonNegativeInt(item.tarifa_primera_hora))
                : "",
            hora_adicional:
              Number(item?.tarifa_hora_adicional || 0) > 0
                ? String(toNonNegativeInt(item.tarifa_hora_adicional))
                : "",
          };
        });
        setTarifasForm(nextTarifas);
      } catch {
        showToast("Error al cargar la configuracion.", "error");
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

  const onGeneralChange = (event) => {
    const { name, value } = event.target;
    setFormData((prev) => ({
      ...prev,
      [name]: name === "cupos" ? toNumber(value) : value,
    }));
  };

  const onToggleDisponibilidad = () => {
    setFormData((prev) => ({ ...prev, disponible: !prev.disponible }));
  };

  const onTarifaChange = (tipo, field, value) => {
    setTarifasForm((prev) => ({
      ...prev,
      [tipo]: {
        ...prev[tipo],
        [field]: value,
      },
    }));
  };

  const onMapPick = (latitud, longitud) => {
    setFormData((prev) => ({
      ...prev,
      latitud: latitud.toString(),
      longitud: longitud.toString(),
    }));
  };

  const onUseCurrentLocation = () => {
    if (!navigator.geolocation) {
      showToast("Tu navegador no permite obtener ubicacion.", "error");
      return;
    }

    setLocating(true);
    navigator.geolocation.getCurrentPosition(
      ({ coords }) => {
        const nextLatitud = Number(coords.latitude.toFixed(7));
        const nextLongitud = Number(coords.longitude.toFixed(7));
        onMapPick(nextLatitud, nextLongitud);
        showToast("Ubicacion actual cargada. Guarda la seccion para aplicar cambios.", "success");
        setLocating(false);
      },
      () => {
        showToast("No se pudo obtener tu ubicacion. Revisa permisos del navegador.", "error");
        setLocating(false);
      },
      {
        enableHighAccuracy: true,
        timeout: 10000,
        maximumAge: 0,
      },
    );
  };

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

    const onReservaNueva = () => {
      showToast("Nueva reserva recibida.", "success", {
        duration: 30000,
        dismissible: true,
        actionLabel: "Ir a reservas",
        onAction: () => navigate("/reservas-parqueadero"),
      });
      playNotificationSound();
    };

    eventSource.addEventListener("reserva_nueva", onReservaNueva);
    eventSource.onerror = () => {};

    return () => {
      eventSource.removeEventListener("reserva_nueva", onReservaNueva);
      eventSource.onerror = null;
      eventSource.close();
    };
  }, [apiBaseUrl, navigate, parqueaderoId, playNotificationSound]);

  const latitudValue = toNullableNumber(formData.latitud);
  const longitudValue = toNullableNumber(formData.longitud);
  const hasCoordinates = hasRealCoordinates(latitudValue, longitudValue);
  const mapCenter = hasCoordinates ? [latitudValue, longitudValue] : MAP_FALLBACK_CENTER;

  const tarifasConfiguradas = VEHICLE_TYPES.filter(({ key }) => toNumber(tarifasForm[key].primera_hora) > 0).length;

  const validateBaseFields = () => {
    if (!formData.nombre.trim() || !formData.direccion.trim()) {
      showToast("Nombre y direccion son obligatorios.", "error");
      return false;
    }
    return true;
  };

  const onSaveGeneral = async () => {
    if (!parqueaderoId || !validateBaseFields()) return;

    if (toNumber(formData.cupos) <= 0) {
      showToast("Debes definir cupos validos.", "error");
      return;
    }

    try {
      setSavingSection("general");

      await api.put(`/parqueaderos/${parqueaderoId}`, {
        nombre: formData.nombre.trim(),
        direccion: formData.direccion.trim(),
        cupos: toNumber(formData.cupos),
      });

      await api.put(`/parqueaderos/${parqueaderoId}/disponibilidad`, {
        disponible: formData.disponible ? 1 : 0,
      });

      localStorage.setItem(
        "parqueadero",
        JSON.stringify({
          ...parqueadero,
          nombre: formData.nombre.trim(),
        }),
      );

      showToast("Datos generales guardados correctamente.", "success");
      await loadData({ silent: true });
    } catch {
      showToast("No se pudieron guardar los datos generales.", "error");
    } finally {
      setSavingSection("");
    }
  };

  const onSaveLocation = async () => {
    if (!parqueaderoId || !validateBaseFields()) return;

    if (!hasCoordinates) {
      showToast("Define una ubicacion valida en el mapa.", "error");
      return;
    }

    try {
      setSavingSection("location");

      await api.put(`/parqueaderos/${parqueaderoId}`, {
        nombre: formData.nombre.trim(),
        direccion: formData.direccion.trim(),
        latitud: latitudValue,
        longitud: longitudValue,
      });

      showToast("Ubicacion guardada correctamente.", "success");
      await loadData({ silent: true });
    } catch {
      showToast("No se pudo guardar la ubicacion.", "error");
    } finally {
      setSavingSection("");
    }
  };

  const onSaveTarifas = async () => {
    if (!parqueaderoId) return;

    const tarifasPayload = VEHICLE_TYPES.map(({ key }) => ({
      tipo_vehiculo: key,
      tarifa_primera_hora: toNonNegativeInt(tarifasForm[key].primera_hora),
      tarifa_hora_adicional: toNonNegativeInt(tarifasForm[key].hora_adicional),
    }));

    const hasValidTarifa = tarifasPayload.some((item) => item.tarifa_primera_hora > 0);
    if (!hasValidTarifa) {
      showToast("Configura al menos una tarifa valida.", "error");
      return;
    }

    try {
      setSavingSection("rates");

      await api.put(`/parqueaderos/${parqueaderoId}/tarifas`, {
        tarifas: tarifasPayload,
      });

      showToast("Tarifas guardadas correctamente.", "success");
      await loadData({ silent: true });
    } catch {
      showToast("No se pudieron guardar las tarifas.", "error");
    } finally {
      setSavingSection("");
    }
  };

  if (loading) {
    return (
      <section className="parking-config-page">
        <article className="parking-config-shell">
          <p className="parking-config-loading">Cargando configuracion...</p>
        </article>
      </section>
    );
  }

  return (
    <section className="parking-config-page">
      <article className="parking-config-shell">
        <header className="parking-config-header">
          <div>
            <h1>Configuracion del Parqueadero</h1>
            <p>Sigue el orden de arriba hacia abajo y guarda cada seccion.</p>
          </div>
          <div className="parking-config-header-side">
            <div className={`availability-pill ${formData.disponible ? "is-on" : "is-off"}`}>
              {formData.disponible ? <FaCheckCircle /> : <FaTimesCircle />}
              <span>{formData.disponible ? "Disponible" : "No disponible"}</span>
            </div>
            <p className="parking-config-flow-note">Orden recomendado: 1) Datos 2) Ubicacion 3) Tarifas</p>
          </div>
        </header>

        <section className="parking-config-summary">
          <div className="config-summary-row">
            <span>Cupos actuales</span>
            <strong>{toNumber(formData.cupos)}</strong>
          </div>
          <div className="config-summary-row">
            <span>Tarifas configuradas</span>
            <strong>
              {tarifasConfiguradas}/{VEHICLE_TYPES.length}
            </strong>
          </div>
          <div className="config-summary-row">
            <span>Ubicacion</span>
            <strong>
              {hasCoordinates ? `${latitudValue.toFixed(5)}, ${longitudValue.toFixed(5)}` : "Sin definir"}
            </strong>
          </div>
        </section>

        <div className="parking-config-grid">
          <section className="config-panel">
            <h2>
              <FaParking /> 1. Datos Generales
            </h2>
            <p className="config-panel-intro">Completa esta informacion como se mostrara a los usuarios.</p>
            <div className="config-fields">
              <label>
                Nombre
                <input
                  type="text"
                  name="nombre"
                  value={formData.nombre}
                  onChange={onGeneralChange}
                  placeholder="Ej: Parqueadero Centro Norte"
                  required
                />
              </label>

              <label>
                Direccion
                <input
                  type="text"
                  name="direccion"
                  value={formData.direccion}
                  onChange={onGeneralChange}
                  placeholder="Ej: Cra 20 #14-35"
                  required
                />
              </label>

              <label>
                Cupos
                <input
                  type="number"
                  min="1"
                  name="cupos"
                  value={formData.cupos}
                  onChange={onGeneralChange}
                  inputMode="numeric"
                  required
                />
                <span className="field-help">Capacidad maxima disponible para reservas simultaneas.</span>
              </label>

              <label>
                Estado operativo
                <button
                  type="button"
                  className={`availability-toggle ${formData.disponible ? "is-on" : "is-off"}`}
                  onClick={onToggleDisponibilidad}
                >
                  {formData.disponible ? "Disponible para reservas" : "No recibir reservas"}
                </button>
              </label>
            </div>

            <div className="config-panel-footer">
              <button
                type="button"
                className="save-section-btn"
                onClick={onSaveGeneral}
                disabled={Boolean(savingSection)}
              >
                <FaSave />
                {savingSection === "general" ? "Guardando..." : "Guardar datos generales"}
              </button>
            </div>
          </section>

          <section className="config-panel">
            <h2>
              <FaMapMarkerAlt /> 2. Ubicacion
            </h2>
            <p className="config-panel-intro">
              Define coordenadas manualmente o usa el mapa para ubicar el parqueadero con precision.
            </p>
            <div className="config-fields">
              <label>
                Latitud
                <input
                  type="number"
                  name="latitud"
                  step="0.0000001"
                  value={formData.latitud}
                  onChange={onGeneralChange}
                  placeholder="Ej: 1.2136000"
                  required
                />
              </label>

              <label>
                Longitud
                <input
                  type="number"
                  name="longitud"
                  step="0.0000001"
                  value={formData.longitud}
                  onChange={onGeneralChange}
                  placeholder="Ej: -77.2811000"
                  required
                />
              </label>
            </div>

            <div className="location-actions">
              <button
                type="button"
                className="map-action-btn"
                onClick={onUseCurrentLocation}
                disabled={locating || Boolean(savingSection)}
              >
                <FaCrosshairs />
                {locating ? "Buscando ubicacion..." : "Usar mi ubicacion actual"}
              </button>
              {hasCoordinates && (
                <p className="location-coords-preview">
                  Coordenadas actuales: {latitudValue.toFixed(6)}, {longitudValue.toFixed(6)}
                </p>
              )}
            </div>

            <MapContainer center={mapCenter} zoom={16} scrollWheelZoom className="config-map">
              <MapCenterSync center={mapCenter} />
              <TileLayer
                url="https://tile.openstreetmap.org/{z}/{x}/{y}.png"
                attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a>'
              />
              <ConfigLocationMarker latitud={latitudValue} longitud={longitudValue} onPick={onMapPick} />
            </MapContainer>
            <p className="config-help-text">Haz clic en el mapa para mover el marcador y actualizar coordenadas.</p>

            <div className="config-panel-footer">
              <button
                type="button"
                className="save-section-btn is-secondary"
                onClick={onSaveLocation}
                disabled={Boolean(savingSection)}
              >
                <FaSave />
                {savingSection === "location" ? "Guardando..." : "Guardar ubicacion"}
              </button>
            </div>
          </section>

          <section className="config-panel config-panel-wide">
            <h2>3. Tarifas por Tipo de Vehiculo</h2>
            <p className="config-panel-intro tarifa-help">
              Ingresa valores enteros en COP. Si dejas primera hora en 0, ese tipo queda sin tarifa activa.
            </p>
            <div className="tarifa-grid">
              {VEHICLE_TYPES.map(({ key, label, icon }) => (
                <div key={key} className="tarifa-card">
                  <h3>
                    {React.createElement(icon)}
                    {label}
                  </h3>

                  <label>
                    Primera hora
                    <div className="money-input">
                      <span>COP</span>
                      <input
                        type="number"
                        min="0"
                        step="1"
                        inputMode="numeric"
                        value={tarifasForm[key].primera_hora}
                        onChange={(event) => onTarifaChange(key, "primera_hora", event.target.value)}
                        placeholder="0"
                      />
                    </div>
                  </label>

                  <label>
                    Hora adicional
                    <div className="money-input">
                      <span>COP</span>
                      <input
                        type="number"
                        min="0"
                        step="1"
                        inputMode="numeric"
                        value={tarifasForm[key].hora_adicional}
                        onChange={(event) => onTarifaChange(key, "hora_adicional", event.target.value)}
                        placeholder="0"
                      />
                    </div>
                  </label>

                  <p className="tarifa-preview">Desde {formatMoney(tarifasForm[key].primera_hora)} la primera hora</p>
                </div>
              ))}
            </div>

            <div className="config-panel-footer">
              <button
                type="button"
                className="save-section-btn is-tertiary"
                onClick={onSaveTarifas}
                disabled={Boolean(savingSection)}
              >
                <FaSave />
                {savingSection === "rates" ? "Guardando..." : "Guardar tarifas"}
              </button>
            </div>
          </section>
        </div>
      </article>
    </section>
  );
}

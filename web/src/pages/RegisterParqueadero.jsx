import React, { useEffect, useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import { MapContainer, Marker, TileLayer, useMap, useMapEvents } from "react-leaflet";
import { FaEnvelope, FaHome, FaListOl, FaLock, FaMapMarkerAlt, FaParking } from "react-icons/fa";
import "leaflet/dist/leaflet.css";
import "./RegisterParqueadero.css";
import api from "../services/api";
import L from "leaflet";

const ciudades = [
  { nombre: "Pasto", coords: [1.2136, -77.2811] },
  { nombre: "Bogota", coords: [4.711, -74.0721] },
  { nombre: "Medellin", coords: [6.2476, -75.5658] },
  { nombre: "Cali", coords: [3.4516, -76.532] },
  { nombre: "Barranquilla", coords: [10.9639, -74.7964] },
  { nombre: "Cartagena", coords: [10.391, -75.4794] },
];

delete L.Icon.Default.prototype._getIconUrl;
L.Icon.Default.mergeOptions({
  iconRetinaUrl: "https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.7.1/images/marker-icon-2x.png",
  iconUrl: "https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.7.1/images/marker-icon.png",
  shadowUrl: "https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.7.1/images/marker-shadow.png",
});

function LocationMarker({ setLatitud, setLongitud, latitud, longitud }) {
  useMapEvents({
    click(e) {
      setLatitud(e.latlng.lat);
      setLongitud(e.latlng.lng);
    },
  });
  return latitud && longitud ? <Marker position={[latitud, longitud]} /> : null;
}

function ChangeView({ center, zoom }) {
  const map = useMap();
  useEffect(() => {
    map.setView(center, zoom);
  }, [center, zoom, map]);
  return null;
}

export default function RegisterParqueadero() {
  const [nombre, setNombre] = useState("");
  const [direccion, setDireccion] = useState("");
  const [cupos, setCupos] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [mensaje, setMensaje] = useState("");
  const [mensajeTipo, setMensajeTipo] = useState("");
  const [latitud, setLatitud] = useState(null);
  const [longitud, setLongitud] = useState(null);
  const [loading, setLoading] = useState(false);
  const [showToast, setShowToast] = useState(false);
  const navigate = useNavigate();

  const [mapCenter, setMapCenter] = useState(ciudades[0].coords);

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!latitud || !longitud) {
      setMensaje("Por favor selecciona una ubicacion en el mapa.");
      setMensajeTipo("warning");
      return;
    }
    setLoading(true);
    setMensaje("");
    setMensajeTipo("");
    try {
      const res = await api.post("/parqueaderos/register", {
        nombre,
        direccion,
        cupos: parseInt(cupos, 10),
        email,
        password,
        latitud,
        longitud,
      });
      setMensaje(res.data.message || "Registro completado con exito.");
      setMensajeTipo("success");
      setShowToast(true);
      setTimeout(() => {
        setShowToast(false);
        navigate("/");
      }, 2500);
    } catch (err) {
      const errorMsg = err.response?.data?.message || "Error al registrar el parqueadero. Intentalo de nuevo.";
      setMensaje(errorMsg);
      setMensajeTipo("error");
    } finally {
      setLoading(false);
    }
  };

  const handleCityChange = (e) => {
    const selectedCity = ciudades.find((ciudad) => ciudad.nombre === e.target.value);
    if (selectedCity) {
      setMapCenter(selectedCity.coords);
    }
  };

  return (
    <div className="register-container">
      <div className="auth-card">
        <div className="card-header">
          <h1 className="title">
            <FaParking />
            <span>FAST PARKING</span>
          </h1>
          <p className="subtitle">Registra tu parqueadero y empieza a recibir clientes.</p>
        </div>

        <div className="register-content">
          <div className="map-column">
            <div className="city-selector-group">
              <label htmlFor="city-select">Selecciona una ciudad para empezar:</label>
              <select id="city-select" onChange={handleCityChange} className="city-selector">
                {ciudades.map((ciudad) => (
                  <option key={ciudad.nombre} value={ciudad.nombre}>
                    {ciudad.nombre}
                  </option>
                ))}
              </select>
            </div>
            <p className="map-instruction">
              <FaMapMarkerAlt /> Haz clic para fijar la ubicacion
            </p>
            <MapContainer center={mapCenter} zoom={5} className="map-container">
              <ChangeView center={mapCenter} zoom={14} />
              <TileLayer
                url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
                attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a>'
              />
              <LocationMarker
                setLatitud={setLatitud}
                setLongitud={setLongitud}
                latitud={latitud}
                longitud={longitud}
              />
            </MapContainer>
            {latitud && longitud && (
              <p className="coords">Coordenadas: {latitud.toFixed(5)}, {longitud.toFixed(5)}</p>
            )}
          </div>

          <div className="form-column">
            <form onSubmit={handleSubmit}>
              <div className="input-group">
                <FaHome className="input-icon" />
                <input
                  type="text"
                  placeholder="Nombre del parqueadero"
                  value={nombre}
                  onChange={(e) => setNombre(e.target.value)}
                  required
                />
              </div>
              <div className="input-group">
                <FaEnvelope className="input-icon" />
                <input
                  type="email"
                  placeholder="Correo electronico"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  required
                />
              </div>
              <div className="input-group">
                <FaLock className="input-icon" />
                <input
                  type="password"
                  placeholder="Contrasena"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  required
                />
              </div>
              <div className="input-group">
                <FaMapMarkerAlt className="input-icon" />
                <input
                  type="text"
                  placeholder="Direccion"
                  value={direccion}
                  onChange={(e) => setDireccion(e.target.value)}
                  required
                />
              </div>
              <div className="input-group">
                <FaListOl className="input-icon" />
                <input
                  type="number"
                  placeholder="Cupos disponibles"
                  value={cupos}
                  onChange={(e) => setCupos(e.target.value)}
                  required
                  min="1"
                />
              </div>
              <button type="submit" className="btn-register" disabled={loading}>
                {loading ? "Registrando..." : "Crear Cuenta"}
              </button>
            </form>
          </div>
        </div>

        {mensaje && <p className={`msg ${mensajeTipo ? `msg-${mensajeTipo}` : ""}`}>{mensaje}</p>}

        <p className="footer-text">
          Ya tienes una cuenta?{" "}
          <Link to="/" className="link">
            Inicia sesion aqui
          </Link>
        </p>
      </div>

      {showToast && (
        <div className="toast-success">
          <span>Parqueadero registrado exitosamente</span>
        </div>
      )}
    </div>
  );
}

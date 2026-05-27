import React, { useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import { FaEnvelope, FaEye, FaEyeSlash, FaLock } from "react-icons/fa";
import api from "../services/api";
import { clearSession, setParqueaderoSession } from "../utils/session";
import "./login.css";

export default function Login() {
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [loading, setLoading] = useState(false);
  const [mensaje, setMensaje] = useState(null);
  const [showPassword, setShowPassword] = useState(false);
  const navigate = useNavigate();

  const handleLogin = async (e) => {
    e.preventDefault();
    setMensaje(null);
    setLoading(true);

    if (!email || !password) {
      setMensaje({
        type: "error",
        text: "Por favor ingresa correo y contrasena.",
      });
      setLoading(false);
      return;
    }

    try {
      const res = await api.post("/parqueaderos/login", { email, password });

      clearSession();
      setParqueaderoSession({
        token: res.data.token,
        parqueadero: res.data.parqueadero,
      });

      setMensaje({ type: "success", text: "Inicio de sesion exitoso." });
      setTimeout(() => navigate("/dashboard"), 700);
      } catch (err) {
        let errorText = "Error al iniciar sesion.";
        if (err.response) {
          if (err.response.status === 404) {
            errorText = "No registrado. Haz click en Registrar.";
          } else if (err.response.status === 401) {
            errorText = "Contrasena incorrecta.";
          } else if (err.response.status === 403) {
            errorText =
              err.response?.data?.message ||
              "Debes verificar tu correo antes de iniciar sesion.";
          }
        } else {
          errorText = "Error de conexion.";
      }
      setMensaje({ type: "error", text: errorText });
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="auth-box">
      <h1>Fast Parking</h1>
      <p>Accede a tu cuenta para gestionar tus parqueaderos.</p>

      <form onSubmit={handleLogin}>
        <div className="input-group">
          <FaEnvelope className="icon" />
          <input
            className="input"
            type="email"
            placeholder="Correo electronico"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            required
          />
        </div>

        <div className="input-group">
          <FaLock className="icon" />
          <input
            className="input"
            type={showPassword ? "text" : "password"}
            placeholder="Contrasena"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            required
          />
          <button
            type="button"
            className="toggle-pass"
            onClick={() => setShowPassword(!showPassword)}
            aria-label={showPassword ? "Ocultar contrasena" : "Mostrar contrasena"}
          >
            {showPassword ? <FaEyeSlash /> : <FaEye />}
          </button>
        </div>

        {mensaje && (
          <div className={`alert alert-${mensaje.type} text-center`}>{mensaje.text}</div>
        )}

        <button
          className={`btn btn-primary ${loading ? "opacity-75 cursor-not-allowed" : ""}`}
          type="submit"
          disabled={loading}
        >
          {loading ? (
            <span className="spinner" style={{ width: "1.2rem", height: "1.2rem", borderWidth: "2px" }} />
          ) : (
            "Ingresar"
          )}
        </button>
      </form>

      <p className="register-text">
        Olvidaste tu contrasena?{" "}
        <Link
          to={`/forgot-password?actor=parqueadero&email=${encodeURIComponent(email.trim())}`}
          className="link"
        >
          Recuperarla aqui
        </Link>
      </p>
      <p className="register-text">
        No tienes cuenta?{" "}
        <Link to="/register-parqueadero" className="link">
          Registrate aqui
        </Link>
      </p>
      <p className="register-text">
        Eres administrador?{" "}
        <Link to="/admin/login" className="link">
          Entrar al panel admin
        </Link>
      </p>
    </div>
  );
}

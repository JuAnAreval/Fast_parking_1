import React, { useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import { FaEnvelope, FaEye, FaEyeSlash, FaLock } from "react-icons/fa";
import api from "../services/api";
import { clearSession, setAdminSession } from "../utils/session";
import "./login.css";

export default function AdminLogin() {
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
      setMensaje({ type: "error", text: "Por favor ingresa correo y contrasena." });
      setLoading(false);
      return;
    }

    try {
      const res = await api.post("/admin/login", { email, password });
      clearSession();
      setAdminSession({
        token: res.data.token,
        admin: res.data.admin,
      });
      setMensaje({ type: "success", text: "Inicio de sesion admin exitoso." });
      setTimeout(() => navigate("/admin/dashboard"), 700);
    } catch (err) {
      const errorText =
        err.response?.data?.message ||
        "No fue posible iniciar sesion como administrador.";
      setMensaje({ type: "error", text: errorText });
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="auth-box">
      <h1>Fast Parking Admin</h1>
      <p>Accede al panel para gestionar usuarios, parqueaderos y verificaciones.</p>

      <form onSubmit={handleLogin}>
        <div className="input-group">
          <FaEnvelope className="icon" />
          <input
            className="input"
            type="email"
            placeholder="Correo del administrador"
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

        {mensaje && <div className={`alert alert-${mensaje.type} text-center`}>{mensaje.text}</div>}

        <button className="btn btn-primary" type="submit" disabled={loading}>
          {loading ? "Ingresando..." : "Ingresar al panel admin"}
        </button>
      </form>

      <p className="register-text">
        Volver al panel de parqueaderos?{" "}
        <Link to="/" className="link">
          Ingresar aqui
        </Link>
      </p>
    </div>
  );
}

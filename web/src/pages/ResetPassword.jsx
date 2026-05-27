import React, { useMemo, useState } from "react";
import { Link, useSearchParams } from "react-router-dom";
import { FaEye, FaEyeSlash, FaLock } from "react-icons/fa";
import api from "../services/api";
import "./login.css";

const normalizeActor = (value) => (value === "usuario" ? "usuario" : "parqueadero");

export default function ResetPassword() {
  const [searchParams] = useSearchParams();
  const actor = useMemo(() => normalizeActor(searchParams.get("actor")), [searchParams]);
  const token = searchParams.get("token") || "";
  const [password, setPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [loading, setLoading] = useState(false);
  const [mensaje, setMensaje] = useState(null);

  const endpoint = actor === "usuario" ? "/auth/reset-password" : "/parqueaderos/reset-password";

  const handleSubmit = async (event) => {
    event.preventDefault();
    setMensaje(null);

    if (!token) {
      setMensaje({ type: "error", text: "El enlace de recuperacion no es valido." });
      return;
    }

    if (password.length < 6) {
      setMensaje({ type: "error", text: "La contrasena debe tener al menos 6 caracteres." });
      return;
    }

    if (password !== confirmPassword) {
      setMensaje({ type: "error", text: "Las contrasenas no coinciden." });
      return;
    }

    setLoading(true);
    try {
      const res = await api.post(endpoint, { token, password });
      setMensaje({
        type: "success",
        text: res.data?.message || "Contrasena actualizada correctamente.",
      });
      setPassword("");
      setConfirmPassword("");
    } catch (err) {
      setMensaje({
        type: "error",
        text: err.response?.data?.message || "No se pudo cambiar la contrasena.",
      });
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="auth-box">
      <h1>Cambiar contrasena</h1>
      <p>Crea una nueva contrasena para {actor === "usuario" ? "tu cuenta" : "tu parqueadero"}.</p>

      <form onSubmit={handleSubmit}>
        <div className="input-group">
          <FaLock className="icon" />
          <input
            className="input"
            type={showPassword ? "text" : "password"}
            placeholder="Nueva contrasena"
            value={password}
            onChange={(event) => setPassword(event.target.value)}
            required
          />
          <button
            type="button"
            className="toggle-pass"
            onClick={() => setShowPassword((visible) => !visible)}
            aria-label={showPassword ? "Ocultar contrasena" : "Mostrar contrasena"}
          >
            {showPassword ? <FaEyeSlash /> : <FaEye />}
          </button>
        </div>

        <div className="input-group">
          <FaLock className="icon" />
          <input
            className="input"
            type={showPassword ? "text" : "password"}
            placeholder="Confirmar contrasena"
            value={confirmPassword}
            onChange={(event) => setConfirmPassword(event.target.value)}
            required
          />
        </div>

        {mensaje && <div className={`alert alert-${mensaje.type} text-center`}>{mensaje.text}</div>}

        <button className="btn btn-primary" type="submit" disabled={loading}>
          {loading ? "Guardando..." : "Cambiar contrasena"}
        </button>
      </form>

      {actor === "parqueadero" ? (
        <p className="register-text">
          Ya puedes volver al login:{" "}
          <Link className="link" to="/">
            Ingresar
          </Link>
        </p>
      ) : (
        <p className="register-text">Ya puedes volver a la app movil e iniciar sesion.</p>
      )}
    </div>
  );
}

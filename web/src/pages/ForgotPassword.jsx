import React, { useMemo, useState } from "react";
import { Link, useSearchParams } from "react-router-dom";
import { FaEnvelope } from "react-icons/fa";
import api from "../services/api";
import "./login.css";

const normalizeActor = (value) => (value === "usuario" ? "usuario" : "parqueadero");

export default function ForgotPassword() {
  const [searchParams] = useSearchParams();
  const actor = useMemo(() => normalizeActor(searchParams.get("actor")), [searchParams]);
  const initialEmail = searchParams.get("email") || "";
  const [email, setEmail] = useState(initialEmail);
  const [loading, setLoading] = useState(false);
  const [mensaje, setMensaje] = useState(null);

  const endpoint = actor === "usuario" ? "/auth/forgot-password" : "/parqueaderos/forgot-password";

  const handleSubmit = async (event) => {
    event.preventDefault();
    setMensaje(null);

    if (!email.trim()) {
      setMensaje({ type: "error", text: "Ingresa tu correo." });
      return;
    }

    setLoading(true);
    try {
      const res = await api.post(endpoint, { email: email.trim() });
      setMensaje({
        type: "success",
        text:
          res.data?.message ||
          "Si el correo existe, enviaremos un enlace para restablecer la contrasena.",
      });
    } catch (err) {
      setMensaje({
        type: "error",
        text: err.response?.data?.message || "No se pudo solicitar la recuperacion.",
      });
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="auth-box">
      <h1>Recuperar contrasena</h1>
      <p>
        Escribe el correo de {actor === "usuario" ? "tu cuenta movil" : "tu parqueadero"} y te
        enviaremos un enlace para cambiar la contrasena.
      </p>

      <form onSubmit={handleSubmit}>
        <div className="input-group">
          <FaEnvelope className="icon" />
          <input
            className="input"
            type="email"
            placeholder="Correo electronico"
            value={email}
            onChange={(event) => setEmail(event.target.value)}
            required
          />
        </div>

        {mensaje && <div className={`alert alert-${mensaje.type} text-center`}>{mensaje.text}</div>}

        <button className="btn btn-primary" type="submit" disabled={loading}>
          {loading ? "Enviando..." : "Enviar enlace"}
        </button>
      </form>

      {actor === "parqueadero" ? (
        <p className="register-text">
          Volver al login?{" "}
          <Link className="link" to="/">
            Ingresar aqui
          </Link>
        </p>
      ) : (
        <p className="register-text">Despues de cambiarla, vuelve a iniciar sesion en la app movil.</p>
      )}
    </div>
  );
}

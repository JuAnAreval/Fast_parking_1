import React, { useEffect, useMemo, useState } from "react";
import { Link, useSearchParams } from "react-router-dom";
import api from "../services/api";
import "./admin.css";

export default function EmailVerification() {
  const [searchParams] = useSearchParams();
  const actor = searchParams.get("actor");
  const token = searchParams.get("token");
  const [status, setStatus] = useState("loading");
  const [message, setMessage] = useState("Estamos verificando tu cuenta...");

  const endpoint = useMemo(() => {
    if (actor === "usuario") return "/auth/verify-email";
    if (actor === "parqueadero") return "/parqueaderos/verify-email";
    return null;
  }, [actor]);

  useEffect(() => {
    const verify = async () => {
      if (!endpoint || !token) {
        setStatus("error");
        setMessage("El enlace de verificacion es invalido o esta incompleto.");
        return;
      }

      try {
        const res = await api.get(`${endpoint}?token=${encodeURIComponent(token)}`);
        setStatus("success");
        setMessage(res.data?.message || "La cuenta fue verificada correctamente.");
      } catch (err) {
        setStatus("error");
        setMessage(
          err.response?.data?.message ||
            "No se pudo verificar la cuenta. El token puede haber expirado.",
        );
      }
    };

    verify();
  }, [endpoint, token]);

  return (
    <div className="auth-layout">
      <div className="auth-box">
        <h1>Verificacion de cuenta</h1>
        <p>{message}</p>
        {status === "loading" && <div className="spinner" style={{ margin: "0 auto" }} />}
        {status !== "loading" && (
          <div className={`alert alert-${status === "success" ? "success" : "error"}`}>
            {status === "success" ? "Cuenta verificada" : "No fue posible verificar la cuenta"}
          </div>
        )}
        {actor === "parqueadero" && (
          <p className="register-text">
            Ir al login del panel?{" "}
            <Link className="link" to="/">
              Ingresar al panel
            </Link>
          </p>
        )}
      </div>
    </div>
  );
}

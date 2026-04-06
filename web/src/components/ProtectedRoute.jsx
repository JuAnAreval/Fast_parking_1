import React from "react";
import { Navigate, useLocation } from "react-router-dom";
import { isAdminAuthenticated, isParqueaderoAuthenticated } from "../utils/session";

export default function ProtectedRoute({ children, actor = "parqueadero" }) {
  const location = useLocation();
  const isAllowed =
    actor === "admin" ? isAdminAuthenticated() : isParqueaderoAuthenticated();

  if (!isAllowed) {
    return (
      <Navigate
        to={actor === "admin" ? "/admin/login" : "/"}
        replace
        state={{ from: location.pathname }}
      />
    );
  }

  return children;
}

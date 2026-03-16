import React from "react";
import { Navigate, useLocation } from "react-router-dom";
import { isParqueaderoAuthenticated } from "../utils/session";

export default function ProtectedRoute({ children }) {
  const location = useLocation();

  if (!isParqueaderoAuthenticated()) {
    return <Navigate to="/" replace state={{ from: location.pathname }} />;
  }

  return children;
}


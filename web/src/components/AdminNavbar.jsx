import React, { useEffect, useMemo, useState } from "react";
import { Link, useLocation, useNavigate } from "react-router-dom";
import {
  FaBars,
  FaBuilding,
  FaMoon,
  FaSignOutAlt,
  FaSun,
  FaTimes,
  FaUsers,
} from "react-icons/fa";
import { clearSession, getAdminSession } from "../utils/session";

const links = [
  { to: "/admin/dashboard", label: "Usuarios", icon: FaUsers },
  { to: "/admin/parqueaderos", label: "Parqueaderos", icon: FaBuilding },
];
const THEME_STORAGE_KEY = "fast-parking-theme";

function AdminNavbarLink({ to, label, icon, isActive, onClick }) {
  const Icon = icon;
  return (
    <Link
      to={to}
      onClick={onClick}
      className={`navbar-link ${isActive ? "navbar-link-active" : ""}`}
    >
      <Icon className="navbar-link-icon" aria-hidden="true" />
      <span>{label}</span>
    </Link>
  );
}

export default function AdminNavbar() {
  const navigate = useNavigate();
  const location = useLocation();
  const [isMenuOpen, setIsMenuOpen] = useState(false);
  const [admin, setAdmin] = useState(null);
  const [theme, setTheme] = useState(() => {
    const saved = localStorage.getItem(THEME_STORAGE_KEY);
    if (saved === "dark" || saved === "light") return saved;
    return window.matchMedia("(prefers-color-scheme: dark)").matches ? "dark" : "light";
  });

  useEffect(() => {
    setAdmin(getAdminSession());
  }, [location.pathname]);

  useEffect(() => {
    setIsMenuOpen(false);
  }, [location.pathname]);

  useEffect(() => {
    document.documentElement.setAttribute("data-theme", theme);
    localStorage.setItem(THEME_STORAGE_KEY, theme);
  }, [theme]);

  const currentPath = location.pathname;
  const adminName = useMemo(() => admin?.nombre || "Administrador", [admin]);

  const handleLogout = () => {
    clearSession();
    navigate("/admin/login");
  };

  return (
    <nav className="navbar-root">
      <div className="navbar-inner">
        <div className="navbar-brand-wrap">
          <Link to="/admin/dashboard" className="navbar-brand">
            Fast Parking
          </Link>
          <span className="navbar-badge">Super Admin</span>
          <span className="navbar-park-name">{adminName}</span>
        </div>

        <div className="navbar-desktop">
          {links.map((link) => (
            <AdminNavbarLink
              key={link.to}
              to={link.to}
              label={link.label}
              icon={link.icon}
              isActive={currentPath === link.to}
            />
          ))}
          <button
            onClick={() => setTheme((prev) => (prev === "dark" ? "light" : "dark"))}
            className="navbar-theme-btn"
            type="button"
          >
            {theme === "dark" ? <FaSun /> : <FaMoon />}
            <span>{theme === "dark" ? "Claro" : "Oscuro"}</span>
          </button>
          <button onClick={handleLogout} className="navbar-logout-btn" type="button">
            <FaSignOutAlt />
            <span>Salir</span>
          </button>
        </div>

        <button
          type="button"
          className="navbar-menu-btn"
          onClick={() => setIsMenuOpen((open) => !open)}
          aria-label={isMenuOpen ? "Cerrar menu" : "Abrir menu"}
        >
          {isMenuOpen ? <FaTimes /> : <FaBars />}
        </button>
      </div>

      {isMenuOpen && (
        <div className="navbar-mobile-menu">
          {links.map((link) => (
            <AdminNavbarLink
              key={link.to}
              to={link.to}
              label={link.label}
              icon={link.icon}
              isActive={currentPath === link.to}
              onClick={() => setIsMenuOpen(false)}
            />
          ))}
          <button
            onClick={() => setTheme((prev) => (prev === "dark" ? "light" : "dark"))}
            className="navbar-theme-btn navbar-theme-mobile"
            type="button"
          >
            {theme === "dark" ? <FaSun /> : <FaMoon />}
            <span>{theme === "dark" ? "Modo claro" : "Modo oscuro"}</span>
          </button>
          <button
            onClick={handleLogout}
            className="navbar-logout-btn navbar-logout-mobile"
            type="button"
          >
            <FaSignOutAlt />
            <span>Salir</span>
          </button>
        </div>
      )}
    </nav>
  );
}

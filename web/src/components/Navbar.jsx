import React, { useEffect, useMemo, useState } from "react";
import { Link, useLocation, useNavigate } from "react-router-dom";
import {
  FaBars,
  FaCalendarAlt,
  FaCog,
  FaHome,
  FaMoon,
  FaSignOutAlt,
  FaSun,
  FaTimes,
} from "react-icons/fa";
import { clearSession, getParqueaderoSession } from "../utils/session";

const links = [
  { to: "/dashboard", label: "Dashboard", icon: FaHome },
  { to: "/reservas-parqueadero", label: "Reservas", icon: FaCalendarAlt },
  { to: "/configuracion-parqueadero", label: "Configuracion", icon: FaCog },
];
const THEME_STORAGE_KEY = "fast-parking-theme";

function NavbarLink({ to, label, icon, isActive, onClick }) {
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

export default function Navbar() {
  const navigate = useNavigate();
  const location = useLocation();
  const [isMenuOpen, setIsMenuOpen] = useState(false);
  const [parqueadero, setParqueadero] = useState(null);
  const [theme, setTheme] = useState(() => {
    const saved = localStorage.getItem(THEME_STORAGE_KEY);
    if (saved === "dark" || saved === "light") return saved;
    return window.matchMedia("(prefers-color-scheme: dark)").matches ? "dark" : "light";
  });

  useEffect(() => {
    setParqueadero(getParqueaderoSession());
  }, [location.pathname]);

  useEffect(() => {
    setIsMenuOpen(false);
  }, [location.pathname]);

  useEffect(() => {
    document.documentElement.setAttribute("data-theme", theme);
    localStorage.setItem(THEME_STORAGE_KEY, theme);
  }, [theme]);

  const currentPath = location.pathname;
  const parkName = useMemo(() => parqueadero?.nombre || "Parqueadero", [parqueadero]);

  const handleLogout = () => {
    clearSession();
    navigate("/");
  };

  const toggleTheme = () => {
    setTheme((prev) => (prev === "dark" ? "light" : "dark"));
  };

  return (
    <nav className="navbar-root">
      <div className="navbar-inner">
        <div className="navbar-brand-wrap">
          <Link to="/dashboard" className="navbar-brand">
            Fast Parking
          </Link>
          <span className="navbar-badge">Admin</span>
          <span className="navbar-park-name">{parkName}</span>
        </div>

        <div className="navbar-desktop">
          {links.map((link) => (
            <NavbarLink
              key={link.to}
              to={link.to}
              label={link.label}
              icon={link.icon}
              isActive={currentPath === link.to}
            />
          ))}
          <button
            onClick={toggleTheme}
            className="navbar-theme-btn"
            type="button"
            aria-label={theme === "dark" ? "Cambiar a modo claro" : "Cambiar a modo oscuro"}
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
            <NavbarLink
              key={link.to}
              to={link.to}
              label={link.label}
              icon={link.icon}
              isActive={currentPath === link.to}
              onClick={() => setIsMenuOpen(false)}
            />
          ))}
          <button onClick={toggleTheme} className="navbar-theme-btn navbar-theme-mobile" type="button">
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

import { useEffect } from "react";
import { BrowserRouter, Navigate, Outlet, Route, Routes } from "react-router-dom";
import Navbar from "./components/Navbar";
import ProtectedRoute from "./components/ProtectedRoute";
import ConfiguracionParqueadero from "./pages/ConfiguracionParqueadero";
import Login from "./pages/Login";
import ParqueaderoDashboard from "./pages/ParqueaderoDashboard";
import ParqueaderoReservas from "./pages/ParqueaderoReservas";
import RegisterParqueadero from "./pages/RegisterParqueadero";
import Reservas from "./pages/Reservas";
import { isParqueaderoAuthenticated } from "./utils/session";
import "./App.css";

const AuthLayout = () => {
  if (isParqueaderoAuthenticated()) {
    return <Navigate to="/dashboard" replace />;
  }

  return (
    <div className="auth-layout">
      <Outlet />
    </div>
  );
};

const MainLayout = () => (
  <ProtectedRoute>
    <div className="main-layout">
      <Navbar />
      <main className="main-content">
        <Outlet />
      </main>
    </div>
  </ProtectedRoute>
);

function App() {
  useEffect(() => {
    const savedTheme = localStorage.getItem("fast-parking-theme");
    if (savedTheme === "dark" || savedTheme === "light") {
      document.documentElement.setAttribute("data-theme", savedTheme);
      return;
    }
    const prefersDark = window.matchMedia("(prefers-color-scheme: dark)").matches;
    document.documentElement.setAttribute("data-theme", prefersDark ? "dark" : "light");
  }, []);

  return (
    <BrowserRouter>
      <Routes>
        <Route element={<AuthLayout />}>
          <Route path="/" element={<Login />} />
          <Route path="/register-parqueadero" element={<RegisterParqueadero />} />
        </Route>

        <Route element={<MainLayout />}>
          <Route path="/dashboard" element={<ParqueaderoDashboard />} />
          <Route path="/reservas-parqueadero" element={<ParqueaderoReservas />} />
          <Route path="/configuracion-parqueadero" element={<ConfiguracionParqueadero />} />
          <Route path="/reservas" element={<Reservas />} />
        </Route>

        <Route
          path="*"
          element={<Navigate to={isParqueaderoAuthenticated() ? "/dashboard" : "/"} replace />}
        />
      </Routes>
    </BrowserRouter>
  );
}

export default App;

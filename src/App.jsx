import { useEffect, useState } from "react";
import { Link, Navigate, Route, Routes } from "react-router-dom";
import api, { setAuthToken } from "./api";
import LoginPage from "./pages/LoginPage";
import AdminPage from "./pages/AdminPage";
import StaffPage from "./pages/StaffPage";
import SupervisorPage from "./pages/SupervisorPage";

const HOME_IMG = {
  admin: "https://images.unsplash.com/photo-1454165804606-c3d57bc86b40?auto=format&fit=crop&w=800&q=80",
  staff: "https://images.unsplash.com/photo-1581578731548-c64695cc6952?auto=format&fit=crop&w=800&q=80",
  supervisor: "https://images.unsplash.com/photo-1552664730-d307ca884978?auto=format&fit=crop&w=800&q=80",
};

function HomePage() {
  return (
    <main className="home-page">
      <section className="home-hero">
        <div className="home-hero-overlay" />
        <div className="home-hero-inner container">
          <p className="home-eyebrow">Station & facility operations</p>
          <h1>Maintenance Checklist &amp; Shift Verification</h1>
          <p className="home-lead">
            Role-based workflows for admins, cleaning staff, and supervisors—checklists tied to shifts,
            with submission review and history.
          </p>
          <Link className="home-cta" to="/login">
            Sign in
          </Link>
        </div>
      </section>

      <section className="container home-features">
        <h2 className="home-section-title">Who uses it</h2>
        <p className="home-section-intro muted">
          Each role has a focused dashboard; sign in with your account to open the right module.
        </p>

        <div className="home-card-grid">
          <article className="home-card">
            <img
              src={HOME_IMG.admin}
              alt=""
              className="home-card-img"
              width={800}
              height={520}
              loading="lazy"
            />
            <div className="home-card-body">
              <h3>Admin</h3>
              <p>Stations, users, shifts, templates, and checklist reports.</p>
            </div>
          </article>

          <article className="home-card">
            <img
              src={HOME_IMG.staff}
              alt=""
              className="home-card-img"
              width={800}
              height={520}
              loading="lazy"
            />
            <div className="home-card-body">
              <h3>Cleaning staff</h3>
              <p>Today&apos;s shifts, complete checklists, add remarks, submit.</p>
            </div>
          </article>

          <article className="home-card">
            <img
              src={HOME_IMG.supervisor}
              alt=""
              className="home-card-img"
              width={800}
              height={520}
              loading="lazy"
            />
            <div className="home-card-body">
              <h3>Supervisor</h3>
              <p>Review submissions, approve or reject, browse shift history.</p>
            </div>
          </article>
        </div>
      </section>
    </main>
  );
}

export default function App() {
  function roleHome(role) {
    if (role === "admin") return "/admin";
    if (role === "staff") return "/staff";
    if (role === "supervisor") return "/supervisor";
    return "/";
  }

  const [auth, setAuth] = useState(() => {
    const raw = localStorage.getItem("task_auth");
    return raw ? JSON.parse(raw) : null;
  });

  useEffect(() => {
    if (auth?.token) {
      setAuthToken(auth.token);
      localStorage.setItem("task_auth", JSON.stringify(auth));
    } else {
      setAuthToken("");
      localStorage.removeItem("task_auth");
    }
  }, [auth]);

  async function onLogin(loginData) {
    setAuth(loginData);
  }

  function onLogout() {
    setAuth(null);
  }

  async function verifyAuth() {
    if (!auth?.token) return;

    try {
      await api.get("/auth/me");
    } catch {
      setAuth(null);
    }
  }

  useEffect(() => {
    verifyAuth();
  }, []);

  return (
    <Routes>
      <Route path="/" element={<HomePage />} />

      <Route
        path="/login"
        element={
          auth?.token ? (
            <Navigate to={roleHome(auth?.user?.role)} replace />
          ) : (
            <LoginPage onLogin={onLogin} />
          )
        }
      />

      <Route
        path="/admin"
        element={
          auth?.user?.role === "admin" ? (
            <AdminPage auth={auth} onLogout={onLogout} />
          ) : (
            <Navigate to="/login" replace />
          )
        }
      />

      <Route
        path="/staff"
        element={
          auth?.user?.role === "staff" ? (
            <StaffPage auth={auth} onLogout={onLogout} />
          ) : (
            <Navigate to="/login" replace />
          )
        }
      />

      <Route
        path="/supervisor"
        element={
          auth?.user?.role === "supervisor" ? (
            <SupervisorPage auth={auth} onLogout={onLogout} />
          ) : (
            <Navigate to="/login" replace />
          )
        }
      />

      <Route path="*" element={<Navigate to="/" replace />} />
    </Routes>
  );
}

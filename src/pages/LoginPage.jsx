import { useState } from "react";
import { useNavigate } from "react-router-dom";
import api from "../api";

export default function LoginPage({ onLogin }) {
  const navigate = useNavigate();
  const [email, setEmail] = useState("admin@example.com");
  const [password, setPassword] = useState("Admin@123");
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);

  async function handleSubmit(event) {
    event.preventDefault();
    setError("");
    setLoading(true);
    try {
      const response = await api.post("/auth/login", {
        email: email.trim(),
        password: password.trim(),
      });
      const authData = response.data?.data;
      if (!authData?.token || !authData?.user?.role) {
        throw new Error("Login response did not include user session data.");
      }

      await onLogin(authData);
      const role = authData?.user?.role;
      const target =
        role === "admin"
          ? "/admin"
          : role === "staff"
            ? "/staff"
            : role === "supervisor"
              ? "/supervisor"
              : "/";
      navigate(target, { replace: true });
    } catch (err) {
      setError(
        err?.response?.data?.message ||
          err?.message ||
          "Login failed. Please check the API URL and CORS settings."
      );
    } finally {
      setLoading(false);
    }
  }

  return (
    <main className="auth-page">
      <section className="auth-card">
        <div className="auth-logo-wrap">
          <div className="auth-logo">MCS</div>
          <h1>Maintenance Checklist System</h1>
          <p className="muted">Sign in to continue</p>
        </div>
        <form className="form-grid" onSubmit={handleSubmit}>
          <label>
            Email
            <input value={email} onChange={(e) => setEmail(e.target.value)} />
          </label>
          <label>
            Password
            <input
              type="password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
            />
          </label>
          {error && <p className="error">{error}</p>}
          <button type="submit" disabled={loading}>
            {loading ? "Signing in..." : "Sign in"}
          </button>
        </form>
      </section>
    </main>
  );
}

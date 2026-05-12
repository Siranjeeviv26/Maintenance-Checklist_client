import React, { useEffect, useMemo, useState } from "react";
import api from "../api";

export default function SupervisorPage({ auth, onLogout }) {
  const [pending, setPending] = useState([]);
  const [history, setHistory] = useState([]);
  const [error, setError] = useState("");
  const [message, setMessage] = useState("");
  const [selectedSubmission, setSelectedSubmission] = useState(null);
  const [rejectModalOpen, setRejectModalOpen] = useState(false);
  const [rejectTargetId, setRejectTargetId] = useState(null);
  const [rejectionReason, setRejectionReason] = useState("");

  const welcome = useMemo(
    () => `Logged in as ${auth.user.name} (${auth.user.role})`,
    [auth.user.name, auth.user.role]
  );

  async function loadData() {
    setError("");
    try {
      const [pendingRes, historyRes] = await Promise.all([
        api.get("/supervisor/submissions?status=submitted"),
        api.get("/supervisor/history"),
      ]);
      setPending(pendingRes.data.data || []);
      setHistory(historyRes.data.data || []);
    } catch (err) {
      setError(err?.response?.data?.message || "Failed to load supervisor data.");
    }
  }

  useEffect(() => {
    loadData();
  }, []);

  async function approve(id) {
    setError("");
    setMessage("");
    try {
      await api.post(`/supervisor/submissions/${id}/approve`, {
        supervisorComment: "Verified and approved",
      });
      setMessage("Checklist approved.");
      await loadData();
    } catch (err) {
      setError(err?.response?.data?.message || "Approve failed.");
    }
  }

  async function reject(id) {
    setError("");
    setMessage("");
    setRejectTargetId(id);
    setRejectionReason("Incomplete checklist");
    setRejectModalOpen(true);
  }

  async function confirmReject() {
    if (!rejectTargetId || !rejectionReason.trim()) return;
    try {
      await api.post(`/supervisor/submissions/${rejectTargetId}/reject`, {
        supervisorComment: "Rejected",
        rejectionReason: rejectionReason.trim(),
      });
      setMessage("Checklist rejected.");
      await loadData();
      setRejectModalOpen(false);
      setRejectTargetId(null);
      setRejectionReason("");
    } catch (err) {
      setError(err?.response?.data?.message || "Reject failed.");
    }
  }

  function cancelReject() {
    setRejectModalOpen(false);
    setRejectTargetId(null);
    setRejectionReason("");
  }

  function renderChecklistItems(submission) {
    const itemMap = new Map(submission.items.map((i) => [i.templateItemId, i]));
    return (
      <div className="table-card" style={{ marginTop: "1rem" }}>
        <h3>Checklist Details</h3>
        <table className="data-table">
          <thead>
            <tr>
              <th>Item</th>
              <th>Mandatory</th>
              <th>Status</th>
              <th>Staff Remark</th>
            </tr>
          </thead>
          <tbody>
            {submission.template.items.map((item) => {
              const response = itemMap.get(item.id);
              return (
                <tr key={item.id}>
                  <td>{item.label}</td>
                  <td>{item.isMandatory ? "Yes" : "No"}</td>
                  <td>
                    <span className={`badge ${response?.completed ? "badge-success" : "badge-warning"}`}>
                      {response?.completed ? "Completed" : "Incomplete"}
                    </span>
                  </td>
                  <td>{response?.remark || "-"}</td>
                </tr>
              );
            })}
          </tbody>
        </table>
        {submission.staffRemark && (
          <div style={{ marginTop: "1rem", padding: "0.75rem", background: "#f8fafc", borderRadius: "0.5rem", border: "1px solid #e2e8f0" }}>
            <strong>Overall Staff Remark:</strong>
            <p style={{ margin: "0.25rem 0 0", color: "#475569" }}>{submission.staffRemark}</p>
          </div>
        )}
      </div>
    );
  }

  return (
    <main className="admin-layout">
      <aside className="admin-sidebar">
        <div>
          <h2>Supervisor Panel</h2>
          <p className="muted">{welcome}</p>
          <button className="nav-btn nav-btn-active">Verification Queue</button>
        </div>
        <button className="nav-btn nav-btn-logout" onClick={onLogout}>
          Logout
        </button>
      </aside>

      <section className="admin-main">
        <header className="admin-header">
          <div>
            <h1>Submitted Checklists</h1>
            <p className="muted">Approve or reject staff submissions.</p>
          </div>
        </header>

        {error && <p className="error">{error}</p>}
        {message && <p style={{ color: "#166534" }}>{message}</p>}

        <section className="table-card" style={{ marginBottom: "1rem" }}>
          <h2>Pending Verification</h2>
          <table className="data-table">
            <thead>
              <tr>
                <th>ID</th>
                <th>Station</th>
                <th>Shift</th>
                <th>Staff</th>
                <th>Submitted</th>
                <th>Actions</th>
              </tr>
            </thead>
            <tbody>
              {pending.length === 0 ? (
                <tr>
                  <td colSpan={6}>No pending submissions.</td>
                </tr>
              ) : (
                pending.map((row) => (
                  <React.Fragment key={row.id}>
                    <tr>
                      <td>{row.id}</td>
                    <td>{row.station?.name}</td>
                    <td>{row.shift?.name}</td>
                    <td>{row.staff?.name}</td>
                    <td>{row.submittedAt ? new Date(row.submittedAt).toLocaleString() : "-"}</td>
                    <td className="actions-cell">
                      <button className="btn-subtle" onClick={() => setSelectedSubmission(selectedSubmission?.id === row.id ? null : row)}>
                        {selectedSubmission?.id === row.id ? "Hide Details" : "View Details"}
                      </button>
                      <button className="btn-subtle" style={{ background: "#166534", color: "#fff" }} onClick={() => approve(row.id)}>
                        Approve
                      </button>
                      <button className="btn-danger" onClick={() => reject(row.id)}>
                        Reject
                      </button>
                    </td>
                  </tr>
                  {selectedSubmission?.id === row.id && (
                    <tr key={`${row.id}-details`}>
                      <td colSpan={6} style={{ padding: "0" }}>
                        <div style={{ padding: "1rem", background: "#f1f5f9" }}>
                          {renderChecklistItems(row)}
                        </div>
                      </td>
                    </tr>
                  )}
                  </React.Fragment>
                ))
              )}
            </tbody>
          </table>
        </section>

        <section className="table-card">
          <h2>History</h2>
          <table className="data-table">
            <thead>
              <tr>
                <th>ID</th>
                <th>Status</th>
                <th>Station</th>
                <th>Shift</th>
                <th>Staff</th>
                <th>Supervisor</th>
              </tr>
            </thead>
            <tbody>
              {history.length === 0 ? (
                <tr>
                  <td colSpan={6}>No history available.</td>
                </tr>
              ) : (
                history.map((row) => (
                  <tr key={row.id}>
                    <td>{row.id}</td>
                    <td>{row.status}</td>
                    <td>{row.station?.name || "-"}</td>
                    <td>{row.shift?.name || "-"}</td>
                    <td>{row.staff?.name || "-"}</td>
                    <td>{row.supervisor?.name || "-"}</td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </section>
      </section>

      {rejectModalOpen && (
        <div className="modal-overlay" onClick={cancelReject}>
          <div className="confirm-modal reject-modal" onClick={(event) => event.stopPropagation()}>
            <h2 style={{ color: "#b91c1c" }}>Reject Checklist</h2>
            <p className="muted" style={{ marginBottom: "1rem" }}>
              Please provide a reason for rejecting this checklist submission.
            </p>
            <label>
              Rejection Reason
              <textarea
                value={rejectionReason}
                onChange={(e) => setRejectionReason(e.target.value)}
                rows={4}
                placeholder="Enter reason for rejection..."
                style={{ resize: "vertical" }}
              />
            </label>
            <div className="confirm-actions" style={{ marginTop: "1.25rem" }}>
              <button type="button" className="btn-subtle" onClick={cancelReject}>
                Cancel
              </button>
              <button type="button" className="btn-danger" onClick={confirmReject} disabled={!rejectionReason.trim()}>
                Reject Checklist
              </button>
            </div>
          </div>
        </div>
      )}
    </main>
  );
}

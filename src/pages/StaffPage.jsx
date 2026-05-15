import { useEffect, useMemo, useState } from "react";
import api from "../api";

export default function StaffPage({ auth, onLogout }) {
  const [shifts, setShifts] = useState([]);
  const [selectedShiftId, setSelectedShiftId] = useState(null);
  const [checklistData, setChecklistData] = useState(null);
  const [responses, setResponses] = useState([]);
  const [staffRemark, setStaffRemark] = useState("");
  const [error, setError] = useState("");
  const [message, setMessage] = useState("");

  const welcome = useMemo(
    () => `Logged in as ${auth.user.name} (${auth.user.role})`,
    [auth.user.name, auth.user.role]
  );

  async function loadMyShifts() {
    setError("");
    try {
      const response = await api.get("/staff/my-shifts/today");
      setShifts(response.data.data || []);
    } catch (err) {
      setError(err?.response?.data?.message || "Failed to load shifts.");
    }
  }

  useEffect(() => {
    loadMyShifts();
  }, []);

  async function loadChecklist(shiftId) {
    setError("");
    setMessage("");
    setSelectedShiftId(shiftId);
    try {
      const response = await api.get(`/staff/checklists/${shiftId}`);
      const data = response.data.data;
      setChecklistData(data);
      setStaffRemark(data?.submission?.staffRemark || "");
      const existing = data?.submission?.items || [];
      const mapped = data.template.items.map((item) => {
        const found = existing.find((entry) => entry.templateItemId === item.id);
        return {
          templateItemId: item.id,
          completed: found?.completed ?? false,
          valueText: found?.valueText ?? "",
          remark: found?.remark ?? "",
          label: item.label,
          isMandatory: item.isMandatory,
        };
      });
      setResponses(mapped);
      
      // Auto-scroll to checklist section
      setTimeout(() => {
        const section = document.getElementById("checklist-section");
        if (section) section.scrollIntoView({ behavior: "smooth" });
      }, 100);
    } catch (err) {
      setChecklistData(null);
      setError(err?.response?.data?.message || "Failed to load checklist.");
    }
  }

  function updateResponse(itemId, key, value) {
    setResponses((prev) =>
      prev.map((entry) =>
        entry.templateItemId === itemId ? { ...entry, [key]: value } : entry
      )
    );
  }

  async function submitChecklist() {
    if (!selectedShiftId) return;
    setError("");
    setMessage("");
    try {
      const payload = {
        staffRemark,
        responses: responses.map((entry) => ({
          templateItemId: entry.templateItemId,
          completed: Boolean(entry.completed),
          valueText: entry.valueText,
          remark: entry.remark,
        })),
      };
      await api.post(`/staff/checklists/${selectedShiftId}/submit`, payload);
      setMessage("Checklist submitted successfully.");
      await Promise.all([loadChecklist(selectedShiftId), loadMyShifts()]);
    } catch (err) {
      setError(err?.response?.data?.message || "Submission failed.");
    }
  }

  return (
    <main className="admin-layout">
      <aside className="admin-sidebar">
        <div>
          <h2>{auth.user.panelName || "Staff Panel"}</h2>
          <p className="muted">{welcome}</p>
          <button className="nav-btn nav-btn-active">My Shift Checklists</button>
        </div>
        <button className="nav-btn nav-btn-logout" onClick={onLogout}>
          Logout
        </button>
      </aside>

      <section className="admin-main">
        <header className="admin-header">
          <div>
            <h1>Assigned Shifts (Today)</h1>
            <p className="muted">Open shift checklist and submit before expiry.</p>
          </div>
        </header>

        {error && <p className="error">{error}</p>}
        {message && <p style={{ color: "#166534" }}>{message}</p>}

        <div className="table-card" style={{ marginBottom: "1rem" }}>
          <table className="data-table">
            <thead>
              <tr>
                <th>Shift</th>
                <th>Station</th>
                <th>Date</th>
                <th>Status</th>
                <th>Action</th>
              </tr>
            </thead>
            <tbody>
              {shifts.length === 0 ? (
                <tr>
                  <td colSpan={5}>No shifts assigned for today.</td>
                </tr>
              ) : (
                shifts.map((assignment) => (
                  <tr key={assignment.id}>
                    <td>{assignment.shift.name}</td>
                    <td>{assignment.shift.station?.name || "-"}</td>
                    <td>{new Date(assignment.assignmentDate).toLocaleString()}</td>
                    <td>
                      <span className={`badge ${assignment.isSubmitted ? "badge-success" : "badge-warning"}`}>
                        {assignment.isSubmitted ? "Submitted" : "Pending"}
                      </span>
                    </td>
                    <td>
                      <button
                        className="btn-subtle"
                        onClick={() => loadChecklist(assignment.shift.id)}
                      >
                        {assignment.isSubmitted ? "View Submission" : "Open Checklist"}
                      </button>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>

        {checklistData && (
          <section id="checklist-section" className="table-card">
            <h2>{checklistData.template.title}</h2>
            <p className="muted">
              Shift: {checklistData.assignment.shift.name} | Station:{" "}
              {checklistData.assignment.shift.station?.name}
            </p>

            <table className="data-table">
              <thead>
                <tr>
                  <th>Item</th>
                  <th>Mandatory</th>
                  <th>Completed</th>
                  <th>Remark</th>
                </tr>
              </thead>
              <tbody>
                {responses.map((item) => (
                  <tr key={item.templateItemId}>
                    <td>{item.label}</td>
                    <td>{item.isMandatory ? "Yes" : "No"}</td>
                    <td>
                      <input
                        type="checkbox"
                        checked={Boolean(item.completed)}
                        onChange={(e) =>
                          updateResponse(item.templateItemId, "completed", e.target.checked)
                        }
                      />
                    </td>
                    <td>
                      <input
                        value={item.remark}
                        onChange={(e) =>
                          updateResponse(item.templateItemId, "remark", e.target.value)
                        }
                        placeholder="Optional remark"
                      />
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>

            <div style={{ marginTop: "0.75rem" }}>
              <label>
                Staff Remark
                <textarea
                  rows={3}
                  value={staffRemark}
                  onChange={(e) => setStaffRemark(e.target.value)}
                />
              </label>
            </div>
            <div style={{ marginTop: "0.75rem" }}>
              <button onClick={submitChecklist}>Submit Checklist</button>
            </div>
          </section>
        )}
      </section>
    </main>
  );
}

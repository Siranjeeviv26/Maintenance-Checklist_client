import { useEffect, useMemo, useState } from "react";
import api from "../api";

const sectionConfig = {
  stations: {
    title: "Stations",
    endpoint: "/admin/stations",
    columns: [
      { key: "id", label: "ID" },
      { key: "name", label: "Name" },
      { key: "code", label: "Code" },
      { key: "isActive", label: "Active" },
    ],
    defaults: { name: "", code: "", description: "" },
  },
  users: {
    title: "Users",
    endpoint: "/admin/users",
    columns: [
      { key: "id", label: "ID" },
      { key: "name", label: "Name" },
      { key: "email", label: "Email" },
      { key: "role", label: "Role" },
      { key: "isActive", label: "Active" },
    ],
    defaults: { name: "", email: "", password: "", role: "staff", isActive: true },
  },
  shifts: {
    title: "Shifts",
    endpoint: "/admin/shifts",
    columns: [
      { key: "id", label: "ID" },
      { key: "name", label: "Shift" },
      { key: "station.name", label: "Station" },
      { key: "startTime", label: "Start" },
      { key: "endTime", label: "End" },
    ],
    defaults: {
      stationId: "",
      name: "",
      startTime: "09:00",
      endTime: "17:00",
      timezone: "Asia/Kolkata",
      assignmentDate: new Date().toISOString().slice(0, 10),
      assignedStaffIds: [],
      assignedSupervisorIds: [],
    },
  },
  templates: {
    title: "Templates",
    endpoint: "/admin/templates",
    columns: [
      { key: "id", label: "ID" },
      { key: "title", label: "Title" },
      { key: "station.name", label: "Station" },
      { key: "version", label: "Version" },
      { key: "isActive", label: "Active" },
    ],
    defaults: {
      stationId: "",
      title: "",
      version: "1",
      isActive: true,
      items: [
        { label: "Clean floor", isMandatory: true, inputType: "boolean" },
        { label: "Check bins", isMandatory: true, inputType: "boolean" },
      ],
    },
  },
};

function valueAtPath(row, path) {
  return path.split(".").reduce((acc, key) => acc?.[key], row);
}

function boolText(value) {
  return value ? "Yes" : "No";
}

function toDateValue(input) {
  if (!input) return new Date().toISOString().slice(0, 10);
  const date = new Date(input);
  if (Number.isNaN(date.getTime())) return new Date().toISOString().slice(0, 10);
  return date.toISOString().slice(0, 10);
}

function normalizeForForm(section, row) {
  if (section === "stations") {
    return { name: row.name || "", code: row.code || "", description: row.description || "" };
  }
  if (section === "users") {
    return {
      name: row.name || "",
      email: row.email || "",
      password: "",
      role: row.role || "staff",
      isActive: Boolean(row.isActive),
    };
  }
  if (section === "shifts") {
    const staffIds = (row.assignments || [])
      .filter((item) => item.assignmentRole === "staff")
      .map((item) => Number(item.userId));
    const supervisorIds = (row.assignments || [])
      .filter((item) => item.assignmentRole === "supervisor")
      .map((item) => Number(item.userId));
    return {
      stationId: String(row.stationId || ""),
      name: row.name || "",
      startTime: row.startTime || "09:00",
      endTime: row.endTime || "17:00",
      timezone: row.timezone || "Asia/Kolkata",
      assignmentDate: toDateValue(row.assignmentDate),
      assignedStaffIds: staffIds,
      assignedSupervisorIds: supervisorIds,
    };
  }
  return {
    stationId: String(row.stationId || ""),
    title: row.title || "",
    version: String(row.version || 1),
    isActive: Boolean(row.isActive),
    items:
      (row.items || []).length > 0
        ? row.items.map((item) => ({ 
            label: item.label || "",
            isMandatory: Boolean(item.isMandatory),
            inputType: item.inputType || "boolean"
          }))
        : [{ label: "", isMandatory: true, inputType: "boolean" }],
  };
}

function buildPayload(section, form, isEdit) {
  if (section === "stations") {
    return {
      name: form.name,
      code: form.code,
      description: form.description,
    };
  }
  if (section === "users") {
    const payload = {
      name: form.name,
      email: form.email,
      role: form.role,
      isActive: Boolean(form.isActive),
    };
    if (!isEdit || form.password) {
      payload.password = form.password;
    }
    return payload;
  }
  if (section === "shifts") {
    const stationId = Number(form.stationId);
    if (!stationId) throw new Error("Please select a station.");
    
    return {
      stationId,
      name: form.name,
      startTime: form.startTime,
      endTime: form.endTime,
      timezone: form.timezone,
      assignmentDate: new Date(`${form.assignmentDate}T00:00:00`).toISOString(),
      assignedStaffIds: form.assignedStaffIds,
      assignedSupervisorIds: form.assignedSupervisorIds,
    };
  }

  const stationId = Number(form.stationId);
  if (!stationId) throw new Error("Please select a station.");

  const cleanItems = (form.items || [])
    .filter((item) => item.label && item.label.trim())
    .map((item, index) => ({
      label: item.label.trim(),
      displayOrder: index,
      isMandatory: item.isMandatory ?? true,
      inputType: item.inputType ?? "boolean",
    }));

  if (cleanItems.length === 0) throw new Error("At least one checklist item is required.");

  return {
    stationId,
    title: form.title,
    version: Number(form.version || 1),
    isActive: Boolean(form.isActive),
    items: cleanItems,
  };
}

export default function AdminPage({ auth, onLogout }) {
  const [activeSection, setActiveSection] = useState("stations");
  const [rows, setRows] = useState([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [panelMode, setPanelMode] = useState(null);
  const [selectedRow, setSelectedRow] = useState(null);
  const [form, setForm] = useState(sectionConfig.stations.defaults);
  const [lookups, setLookups] = useState({ stations: [], staff: [], supervisors: [] });

  const activeConfig = sectionConfig[activeSection];

  const welcome = useMemo(
    () => `Logged in as ${auth.user.name} (${auth.user.role})`,
    [auth.user.name, auth.user.role]
  );

  async function loadLookups() {
    try {
      const [stationResponse, userResponse] = await Promise.all([
        api.get("/admin/stations"),
        api.get("/admin/users"),
      ]);
      const stations = stationResponse.data.data || [];
      const users = userResponse.data.data || [];
      setLookups({
        stations,
        staff: users.filter((item) => item.role === "staff" && item.isActive),
        supervisors: users.filter((item) => item.role === "supervisor" && item.isActive),
      });
    } catch {
      setLookups({ stations: [], staff: [], supervisors: [] });
    }
  }

  async function loadSection(section = activeSection) {
    setLoading(true);
    setError("");
    try {
      const response = await api.get(sectionConfig[section].endpoint);
      setRows(response.data.data || []);
    } catch (err) {
      setError(err?.response?.data?.message || "Failed to load records.");
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    loadLookups();
  }, []);

  useEffect(() => {
    setPanelMode(null);
    setSelectedRow(null);
    setForm(sectionConfig[activeSection].defaults);
    loadSection(activeSection);
  }, [activeSection]);

  function openCreate() {
    setError("");
    setSelectedRow(null);
    setForm(activeConfig.defaults);
    setPanelMode("create");
  }

  function openEdit(row) {
    setError("");
    setSelectedRow(row);
    setForm(normalizeForForm(activeSection, row));
    setPanelMode("edit");
  }

  function openView(row) {
    setError("");
    setSelectedRow(row);
    setPanelMode("view");
  }

  async function handleDelete(row) {
    const confirmed = window.confirm(`Delete this ${activeSection.slice(0, -1)} record?`);
    if (!confirmed) return;
    setError("");
    try {
      await api.delete(`${activeConfig.endpoint}/${row.id}`);
      await loadSection();
    } catch (err) {
      setError(err?.response?.data?.message || "Delete failed.");
    }
  }

  function toggleSelectId(field, id) {
    const numericId = Number(id);
    setForm((prev) => {
      const current = prev[field] || [];
      const exists = current.includes(numericId);
      return {
        ...prev,
        [field]: exists ? current.filter((item) => item !== numericId) : [...current, numericId],
      };
    });
  }

  function updateTemplateItem(index, value) {
    setForm((prev) => ({
      ...prev,
      items: prev.items.map((item, itemIndex) => (itemIndex === index ? { ...item, label: value } : item)),
    }));
  }

  function addTemplateItem() {
    setForm((prev) => ({
      ...prev,
      items: [...prev.items, { label: "", isMandatory: true, inputType: "boolean" }],
    }));
  }

  function removeTemplateItem(index) {
    setForm((prev) => ({
      ...prev,
      items: prev.items.filter((_, itemIndex) => itemIndex !== index),
    }));
  }

  async function submitForm(event) {
    event.preventDefault();
    setError("");
    try {
      const payload = buildPayload(activeSection, form, panelMode === "edit");
      if (panelMode === "create") {
        await api.post(activeConfig.endpoint, payload);
      } else if (panelMode === "edit" && selectedRow?.id) {
        await api.put(`${activeConfig.endpoint}/${selectedRow.id}`, payload);
      }
      await Promise.all([loadSection(), loadLookups()]);
      setPanelMode(null);
      setSelectedRow(null);
      setForm(activeConfig.defaults);
    } catch (err) {
      setError(err?.response?.data?.message || "Save failed. Check required fields.");
    }
  }

  function renderFormFields() {
    if (activeSection === "stations") {
      return (
        <>
          <label>Name<input value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} /></label>
          <label>Code<input value={form.code} onChange={(e) => setForm({ ...form, code: e.target.value })} /></label>
          <label>
            Description
            <textarea rows={3} value={form.description} onChange={(e) => setForm({ ...form, description: e.target.value })} />
          </label>
        </>
      );
    }
    if (activeSection === "users") {
      return (
        <>
          <label>Name<input value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} /></label>
          <label>Email<input type="email" value={form.email} onChange={(e) => setForm({ ...form, email: e.target.value })} /></label>
          <label>
            Password
            <input
              type="password"
              value={form.password}
              onChange={(e) => setForm({ ...form, password: e.target.value })}
              placeholder={panelMode === "edit" ? "Leave blank to keep existing password" : ""}
            />
          </label>
          <label>
            Role
            <select value={form.role} onChange={(e) => setForm({ ...form, role: e.target.value })}>
              <option value="admin">admin</option>
              <option value="staff">staff</option>
              <option value="supervisor">supervisor</option>
            </select>
          </label>
          <label className="checkbox-label">
            <input
              type="checkbox"
              checked={Boolean(form.isActive)}
              onChange={(e) => setForm({ ...form, isActive: e.target.checked })}
            />
            Active user
          </label>
        </>
      );
    }
    if (activeSection === "shifts") {
      return (
        <>
          <label>
            Station
            <select value={form.stationId} onChange={(e) => setForm({ ...form, stationId: e.target.value })}>
              <option value="">Select station</option>
              {lookups.stations.map((station) => (
                <option key={station.id} value={station.id}>
                  {station.name} ({station.code})
                </option>
              ))}
            </select>
          </label>
          <label>Shift Name<input value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} /></label>
          <label>Start Time<input type="time" value={form.startTime} onChange={(e) => setForm({ ...form, startTime: e.target.value })} /></label>
          <label>End Time<input type="time" value={form.endTime} onChange={(e) => setForm({ ...form, endTime: e.target.value })} /></label>
          <label>Timezone<input value={form.timezone} onChange={(e) => setForm({ ...form, timezone: e.target.value })} /></label>
          <label>
            Assignment Date
            <input type="date" value={form.assignmentDate} onChange={(e) => setForm({ ...form, assignmentDate: e.target.value })} />
          </label>
          <div>
            <p className="muted">Assign Staff</p>
            <div className="choice-grid">
              {lookups.staff.length === 0 ? (
                <p className="muted">No active staff users found.</p>
              ) : (
                lookups.staff.map((user) => (
                  <label key={user.id} className="checkbox-label">
                    <input
                      type="checkbox"
                      checked={(form.assignedStaffIds || []).includes(user.id)}
                      onChange={() => toggleSelectId("assignedStaffIds", user.id)}
                    />
                    {user.name} ({user.email})
                  </label>
                ))
              )}
            </div>
          </div>
          <div>
            <p className="muted">Assign Supervisors</p>
            <div className="choice-grid">
              {lookups.supervisors.length === 0 ? (
                <p className="muted">No active supervisors found.</p>
              ) : (
                lookups.supervisors.map((user) => (
                  <label key={user.id} className="checkbox-label">
                    <input
                      type="checkbox"
                      checked={(form.assignedSupervisorIds || []).includes(user.id)}
                      onChange={() => toggleSelectId("assignedSupervisorIds", user.id)}
                    />
                    {user.name} ({user.email})
                  </label>
                ))
              )}
            </div>
          </div>
        </>
      );
    }
    return (
      <>
        <label>
          Station
          <select value={form.stationId} onChange={(e) => setForm({ ...form, stationId: e.target.value })}>
            <option value="">Select station</option>
            {lookups.stations.map((station) => (
              <option key={station.id} value={station.id}>
                {station.name} ({station.code})
              </option>
            ))}
          </select>
        </label>
        <label>Title<input value={form.title} onChange={(e) => setForm({ ...form, title: e.target.value })} /></label>
        <label>Version<input type="number" min="1" value={form.version} onChange={(e) => setForm({ ...form, version: e.target.value })} /></label>
        <label className="checkbox-label">
          <input
            type="checkbox"
            checked={Boolean(form.isActive)}
            onChange={(e) => setForm({ ...form, isActive: e.target.checked })}
          />
          Active template
        </label>
        <div style={{ marginTop: "1rem" }}>
          <div className="row-between" style={{ marginBottom: "0.75rem" }}>
            <p className="muted" style={{ margin: 0 }}>Checklist Items</p>
            <button type="button" className="btn-subtle" onClick={addTemplateItem}>Add item</button>
          </div>
          <div className="form-grid">
            {(form.items || []).map((item, index) => (
              <div key={index} className="item-row">
                <input
                  value={item.label}
                  onChange={(e) => updateTemplateItem(index, e.target.value)}
                  placeholder={`Item ${index + 1}`}
                />
                <button type="button" className="btn-danger" onClick={() => removeTemplateItem(index)} disabled={(form.items || []).length === 1}>
                  Remove
                </button>
              </div>
            ))}
          </div>
        </div>
      </>
    );
  }

  function renderViewContent() {
    if (!selectedRow) return null;
    if (activeSection === "stations") {
      return (
        <dl className="view-grid">
          <dt>Name</dt><dd>{selectedRow.name || "-"}</dd>
          <dt>Code</dt><dd>{selectedRow.code || "-"}</dd>
          <dt>Description</dt><dd>{selectedRow.description || "-"}</dd>
          <dt>Active</dt><dd>{boolText(selectedRow.isActive)}</dd>
        </dl>
      );
    }
    if (activeSection === "users") {
      return (
        <dl className="view-grid">
          <dt>Name</dt><dd>{selectedRow.name || "-"}</dd>
          <dt>Email</dt><dd>{selectedRow.email || "-"}</dd>
          <dt>Role</dt><dd>{selectedRow.role || "-"}</dd>
          <dt>Active</dt><dd>{boolText(selectedRow.isActive)}</dd>
        </dl>
      );
    }
    if (activeSection === "shifts") {
      const staffAssignments = (selectedRow.assignments || []).filter((item) => item.assignmentRole === "staff");
      const supervisorAssignments = (selectedRow.assignments || []).filter((item) => item.assignmentRole === "supervisor");
      return (
        <div className="form-grid">
          <dl className="view-grid">
            <dt>Station</dt><dd>{selectedRow.station?.name || "-"}</dd>
            <dt>Shift</dt><dd>{selectedRow.name || "-"}</dd>
            <dt>Time</dt><dd>{selectedRow.startTime} - {selectedRow.endTime}</dd>
            <dt>Timezone</dt><dd>{selectedRow.timezone || "-"}</dd>
            <dt>Date</dt><dd>{toDateValue(selectedRow.assignmentDate)}</dd>
          </dl>
          <div>
            <p className="muted">Assigned Staff</p>
            <ul className="simple-list">
              {staffAssignments.length === 0 ? <li>-</li> : staffAssignments.map((item) => <li key={item.id}>{item.user?.name || item.userId}</li>)}
            </ul>
          </div>
          <div>
            <p className="muted">Assigned Supervisors</p>
            <ul className="simple-list">
              {supervisorAssignments.length === 0 ? <li>-</li> : supervisorAssignments.map((item) => <li key={item.id}>{item.user?.name || item.userId}</li>)}
            </ul>
          </div>
        </div>
      );
    }
    return (
      <div className="form-grid">
        <dl className="view-grid">
          <dt>Station</dt><dd>{selectedRow.station?.name || "-"}</dd>
          <dt>Title</dt><dd>{selectedRow.title || "-"}</dd>
          <dt>Version</dt><dd>{selectedRow.version || "-"}</dd>
          <dt>Active</dt><dd>{boolText(selectedRow.isActive)}</dd>
        </dl>
        <div>
          <p className="muted">Checklist Items</p>
          <ul className="simple-list">
            {(selectedRow.items || []).length === 0 ? <li>-</li> : selectedRow.items.map((item) => <li key={item.id || item.label}>{item.label}</li>)}
          </ul>
        </div>
      </div>
    );
  }

  return (
    <main className="admin-layout">
      <aside className="admin-sidebar">
        <div>
          <h2>Admin Panel</h2>
          <p className="muted">{welcome}</p>
          {Object.keys(sectionConfig).map((section) => (
            <button
              key={section}
              className={`nav-btn ${activeSection === section ? "nav-btn-active" : ""}`}
              onClick={() => setActiveSection(section)}
            >
              {sectionConfig[section].title}
            </button>
          ))}
        </div>
        <button className="nav-btn nav-btn-logout" onClick={onLogout}>Logout</button>
      </aside>

      <section className="admin-main">
        <header className="admin-header">
          <div>
            <h1>{activeConfig.title}</h1>
            <p className="muted">Manage records with full CRUD actions.</p>
          </div>
          <button onClick={openCreate}>Add New</button>
        </header>

        {error && <p className="error">{error}</p>}

        <div className="table-card">
          {loading ? (
            <p>Loading...</p>
          ) : (
            <table className="data-table">
              <thead>
                <tr>
                  {activeConfig.columns.map((column) => (
                    <th key={column.key}>{column.label}</th>
                  ))}
                  <th>Actions</th>
                </tr>
              </thead>
              <tbody>
                {rows.length === 0 ? (
                  <tr>
                    <td colSpan={activeConfig.columns.length + 1}>No records found.</td>
                  </tr>
                ) : (
                  rows.map((row) => (
                    <tr key={row.id}>
                      {activeConfig.columns.map((column) => {
                        const value = valueAtPath(row, column.key);
                        const displayValue = typeof value === "boolean" ? boolText(value) : String(value ?? "-");
                        return <td key={column.key}>{displayValue}</td>;
                      })}
                      <td className="actions-cell">
                        <button className="btn-subtle" onClick={() => openView(row)}>View</button>
                        <button className="btn-subtle" onClick={() => openEdit(row)}>Edit</button>
                        <button className="btn-danger" onClick={() => handleDelete(row)}>Delete</button>
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          )}
        </div>
      </section>

      {panelMode && (
        <div className="panel-overlay" onClick={() => setPanelMode(null)}>
          <aside className="side-panel" onClick={(event) => event.stopPropagation()}>
            <div className="row-between">
              <h2>
                {panelMode === "create" && "Add"}
                {panelMode === "edit" && "Edit"}
                {panelMode === "view" && "View"} {activeConfig.title.slice(0, -1)}
              </h2>
              <button className="btn-subtle" onClick={() => setPanelMode(null)}>Close</button>
            </div>

            {panelMode === "view" ? (
              renderViewContent()
            ) : (
              <form className="form-grid" onSubmit={submitForm}>
                {renderFormFields()}
                <button type="submit">{panelMode === "create" ? "Create" : "Update"}</button>
              </form>
            )}
          </aside>
        </div>
      )}
    </main>
  );
}

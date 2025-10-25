// App.js (COMPLET AVEC GESTION CLIENTS et LOGIQUE NEW-SALE)
import React, { useEffect, useMemo, useRef, useState } from "react";

/** =====================================
 * CONFIG GLOBALE & HELPERS
 * ===================================== */
const API_BASE = "https://fish-manage-back.onrender.com"; // Assurez-vous que cette URL est correcte
const SIDEBAR_WIDTH = 250; // px
const money = (n) => (n ?? 0).toLocaleString("fr-FR", { style: "currency", currency: "XOF" });
const formatDate = (dateString) => {
    if (!dateString) return 'N/A';
    try { return new Date(dateString).toISOString().slice(0, 10); } catch (e) { return dateString; }
}
const formatDateTime = (dateString) => {
    if (!dateString) return 'N/A';
    try { return new Date(dateString).toLocaleString('fr-FR', { dateStyle: 'short', timeStyle: 'short' }); } catch (e) { return dateString; }
}

// Helper fetch pour l'App "Admin"
function apiFetch(path, options = {}) {
  const token = typeof window !== "undefined" ? localStorage.getItem("token") : null;
  const headers = { "Content-Type": "application/json", ...(options.headers || {}) };
  if (token) headers["Authorization"] = `Bearer ${token}`;
  return fetch(`${API_BASE}${path}`, { ...options, headers });
}

// NOUVEAU: Helper fetch pour l'App "Super Admin"
function apiFetchSuperAdmin(path, options = {}) {
  const token = typeof window !== "undefined" ? localStorage.getItem("superToken") : null; // Utilise un token différent
  const headers = { "Content-Type": "application/json", ...(options.headers || {}) };
  if (token) headers["Authorization"] = `Bearer ${token}`;
  return fetch(`${API_BASE}${path}`, { ...options, headers });
}

const validateClientName = (name) => /^[A-Z0-9]+$/.test(name);
function BadgeFish({ type }) {
  const cls = type === "tilapia" ? "text-bg-primary" : "text-bg-success";
  return <span className={`badge rounded-pill fw-normal ${cls}`}>{type === "tilapia" ? "Tilapia" : "Pangasius"}</span>;
}

/** =====================================
 * HOOKS (Communs)
 * ===================================== */
function useViewport() {
  const [w, setW] = useState(typeof window !== "undefined" ? window.innerWidth : 1200);
  useEffect(() => {
    const onR = () => setW(window.innerWidth);
    window.addEventListener("resize", onR);
    return () => window.removeEventListener("resize", onR);
  }, []);
  return { width: w, isMdUp: w >= 768 };
}

function useChartJs() {
  const [ready, setReady] = useState(!!(typeof window !== "undefined" && window.Chart));
  useEffect(() => {
    if (typeof window === "undefined") return; if (window.Chart) { try { window.Chart.register(...(window.Chart.registerables || [])); } catch {} setReady(true); return; }
    const s = document.createElement("script"); s.src = "https://cdn.jsdelivr.net/npm/chart.js"; s.async = true;
    s.onload = () => { try { window.Chart.register(...(window.Chart.registerables || [])); } catch {} setReady(true); };
    document.body.appendChild(s);
    return () => s.remove();
  }, []);
  return ready;
}

// Hook pour l'app "Admin" (MIS À JOUR AVEC ÉCOUTE D'ÉVÉNEMENT)
function useClients() {
    const [clients, setClients] = useState([]);
    
    const loadClients = async () => { // Extrait la logique dans une fonction
        try {
            const res = await apiFetch("/api/clients");
            const data = await res.json();
            setClients(Array.isArray(data) ? data.sort() : []); 
        } catch (e) { console.error("Erreur chargement clients:", e); }
    };
    
    useEffect(() => { 
        loadClients(); 
        const handler = () => loadClients(); // Gère l'événement personnalisé
        window.addEventListener("reload-clients", handler); 
        return () => window.removeEventListener("reload-clients", handler);
    }, []);
    
    return clients;
}

// NOUVEAU: Hook pour l'app "Super Admin" (pour charger les Admins/Users)
function useAdminUsers() {
    const [users, setUsers] = useState([]);
    const [loading, setLoading] = useState(true);
    
    const loadUsers = async () => {
        setLoading(true);
        try {
            const res = await apiFetchSuperAdmin("/api/admin/users");
            const data = await res.json();
            if (!res.ok) throw new Error(data.error || "Erreur chargement utilisateurs");
            setUsers(Array.isArray(data) ? data : []);
        } catch (e) {
            console.error(e.message);
            setUsers([]);
        } finally {
            setLoading(false);
        }
    };
    
    useEffect(() => { loadUsers(); }, []);
    
    return { users, loading, reloadUsers: loadUsers };
}


/** #####################################################################################
 * #####################################################################################
 * ###                                                                               ###
 * ###                      APPLICATION SUPER ADMIN (NOUVEAU)                        ###
 * ###                                                                               ###
 * #####################################################################################
 * ##################################################################################### */

// =====================================
// SUPER ADMIN: Login
// =====================================
function AdminLogin() {
    const [email, setEmail] = useState("");
    const [password, setPassword] = useState("");
    const [err, setErr] = useState("");

    const submit = async (e) => {
        e.preventDefault();
        setErr("");
        try {
            const res = await fetch(`${API_BASE}/api/admin/login`, {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({ email, password }),
            });
            const data = await res.json();
            if (!res.ok) throw new Error(data.error || "Erreur");
            localStorage.setItem("superToken", data.token); // Stocke le token Super Admin
            window.location.hash = "#/admin"; // Redirige vers le panneau
            window.location.reload(); // Force le rechargement pour que le routeur prenne effet
        } catch (e) {
            setErr(e.message);
        }
    };

    return (
        <div className="d-flex align-items-center justify-content-center" style={{ minHeight: "100vh", background: "#212529" }}>
            <div className="container">
                <div className="row justify-content-center">
                    <div className="col-12 col-sm-10 col-md-7 col-lg-5">
                        <div className="card border-0 shadow-lg rounded-4 p-2 bg-light">
                            <div className="card-body p-4">
                                <div className="text-center mb-4">
                                    <i className="bi bi-shield-lock-fill text-danger display-4"></i>
                                    <h3 className="fw-bold mt-2">Super Admin</h3>
                                    <p className="text-muted small">Connexion Fondateur</p>
                                </div>
                                <form onSubmit={submit} className="mt-3">
                                    <div className="mb-3">
                                        <label className="form-label fw-semibold">Email</label>
                                        <input type="email" className="form-control form-control-lg" value={email} onChange={(e) => setEmail(e.target.value)} required />
                                    </div>
                                    <div className="mb-4">
                                        <label className="form-label fw-semibold">Mot de passe</label>
                                        <input type="password" className="form-control form-control-lg" value={password} onChange={(e) => setPassword(e.target.value)} required />
                                    </div>
                                    {err && <div className="alert alert-danger small">{err}</div>}
                                    <div className="d-grid gap-3">
                                        <button className="btn btn-danger btn-lg rounded-pill shadow-sm" type="submit">
                                            Connexion Super Admin
                                        </button>
                                        <a href="#/" className="btn btn-link text-secondary">Retour au site normal</a>
                                    </div>
                                </form>
                            </div>
                        </div>
                    </div>
                </div>
            </div>
        </div>
    );
}

// =====================================
// SUPER ADMIN: Sidebar & Topbar
// =====================================
function AdminSidebar({ currentPage, onNavigate, onLogout, open, setOpen, isMdUp }) {
    const navItems = [
        { id: "dashboard", icon: "bi-bar-chart-fill", label: "Dashboard Global" },
        { id: "users", icon: "bi-people-fill", label: "Gestion Admins" },
        { id: "history", icon: "bi-search", label: "Historiques Admins" },
    ];
    return (
        <>
            {!isMdUp && <div onClick={() => setOpen(false)} className={`position-fixed top-0 start-0 w-100 h-100 bg-dark bg-opacity-50 ${open ? "d-block" : "d-none"}`} style={{ zIndex: 1029 }} />}
            <aside className={`bg-danger text-white shadow-lg d-flex flex-column p-3 position-fixed top-0 start-0`} style={{ width: SIDEBAR_WIDTH, height: "100vh", zIndex: 1030, transition: "transform .25s ease", transform: !isMdUp && !open ? `translateX(-${SIDEBAR_WIDTH}px)` : "translateX(0)" }}>
                <button type="button" className="btn btn-link text-white d-md-none align-self-end p-0 mb-2" onClick={() => setOpen(false)}><i className="bi bi-x-lg fs-5" /></button>
                <a href="#" className="d-flex align-items-center mb-3 text-white text-decoration-none">
                    <i className="bi bi-shield-lock-fill me-2 fs-4"></i><span className="fs-5 fw-bold">Super Admin</span>
                </a>
                <hr className="border-light" />
                <ul className="nav nav-pills flex-column mb-auto">
                    {navItems.map((item) => (
                        <li className="nav-item" key={item.id}>
                            <button className={`btn nav-link text-start text-white w-100 mb-1 ${currentPage === item.id ? "active bg-light text-danger shadow-sm" : "link-body-emphasis"}`} onClick={() => { onNavigate(item.id); if (!isMdUp) setOpen(false); }}>
                                <i className={`bi ${item.icon} me-2`}></i>{item.label}
                            </button>
                        </li>
                    ))}
                </ul>
                <hr className="border-light mt-auto" />
                <div className="d-flex align-items-center text-white">
                    <i className="bi bi-person-circle me-2 fs-5"></i><strong className="text-truncate">Fondateur</strong>
                    <button className="btn btn-link text-light ms-auto p-0" onClick={onLogout} title="Se déconnecter"><i className="bi bi-box-arrow-right fs-5"></i></button>
                </div>
            </aside>
        </>
    );
}

function AdminTopbar({ title, onBurger }) {
    return (
        <div className="d-flex align-items-center mb-4 pb-2 border-bottom border-secondary-subtle">
            <button className="btn btn-outline-secondary d-md-none me-2" onClick={onBurger}><i className="bi bi-list"></i></button>
            <h1 className="h5 h-md2 m-0 text-dark fw-semibold">{title}</h1>
            <div className="ms-auto small text-muted d-none d-md-block">Mode: <strong>Super Administrateur</strong></div>
        </div>
    );
}

// =====================================
// SUPER ADMIN: Page "Gestion Admins"
// =====================================
function AdminUsersPage() {
    const { users, loading, reloadUsers } = useAdminUsers();
    const [modal, setModal] = useState({ mode: null, user: null }); // 'add', 'edit'
    
    // State pour le formulaire
    const [companyName, setCompanyName] = useState("");
    const [email, setEmail] = useState("");
    const [password, setPassword] = useState("");
    const [formLoading, setFormLoading] = useState(false);
    
    useEffect(() => {
        if (modal.mode === 'edit' && modal.user) {
            setCompanyName(modal.user.companyName);
            setEmail(modal.user.email);
            setPassword(""); // Ne pas pré-remplir le mot de passe
        } else {
            setCompanyName(""); setEmail(""); setPassword("");
        }
    }, [modal]);

    const handleSubmit = async (e) => {
        e.preventDefault();
        setFormLoading(true);
        try {
            let res, data;
            if (modal.mode === 'add') {
                res = await apiFetchSuperAdmin("/api/admin/users", {
                    method: "POST",
                    body: JSON.stringify({ companyName, email, password })
                });
            } else {
                res = await apiFetchSuperAdmin(`/api/admin/users/${modal.user._id}`, {
                    method: "PUT",
                    body: JSON.stringify({ companyName, password: password || undefined }) // N'envoie le mdp que s'il est changé
                });
            }
            data = await res.json();
            if (!res.ok) throw new Error(data.error || "Erreur serveur");
            setModal({ mode: null, user: null });
            reloadUsers();
        } catch (e) {
            alert(e.message);
        } finally {
            setFormLoading(false);
        }
    };
    
    const handleDelete = async (user) => {
        if (!window.confirm(`Confirmer la SUPPRESSION de ${user.companyName} (${user.email}) ?\n\nTOUTES ses ventes et historiques seront PERMANEMMENT supprimés.`)) return;
        
        try {
            const res = await apiFetchSuperAdmin(`/api/admin/users/${user._id}`, { method: "DELETE" });
            const data = await res.json();
            if (!res.ok) throw new Error(data.error || "Erreur suppression");
            reloadUsers();
        } catch (e) {
            alert(e.message);
        }
    };
    
    return (
        <div className="card border-0 shadow rounded-4 bg-white">
            {/* Modale d'ajout/édition */}
            {modal.mode && (
                <div className="modal show d-block" style={{ backgroundColor: 'rgba(0,0,0,0.5)' }}>
                    <div className="modal-dialog modal-dialog-centered">
                        <div className="modal-content">
                            <form onSubmit={handleSubmit}>
                                <div className="modal-header">
                                    <h5 className="modal-title">{modal.mode === 'add' ? 'Ajouter un Admin' : 'Modifier un Admin'}</h5>
                                    <button type="button" className="btn-close" onClick={() => setModal({mode: null, user: null})}></button>
                                </div>
                                <div className="modal-body">
                                    <div className="mb-3">
                                        <label className="form-label">Nom Entreprise</label>
                                        <input className="form-control" value={companyName} onChange={(e) => setCompanyName(e.target.value)} required />
                                    </div>
                                    <div className="mb-3">
                                        <label className="form-label">Email</label>
                                        <input type="email" className="form-control" value={email} onChange={(e) => setEmail(e.target.value)} required disabled={modal.mode === 'edit'} />
                                    </div>
                                    <div className="mb-3">
                                        <label className="form-label">Mot de passe</label>
                                        <input type="password" className="form-control" value={password} onChange={(e) => setPassword(e.target.value)} required={modal.mode === 'add'} placeholder={modal.mode === 'edit' ? 'Laisser vide pour ne pas changer' : ''} />
                                    </div>
                                </div>
                                <div className="modal-footer">
                                    <button type="button" className="btn btn-secondary" onClick={() => setModal({mode: null, user: null})}>Annuler</button>
                                    <button type="submit" className="btn btn-primary" disabled={formLoading}>
                                        {formLoading ? 'Sauvegarde...' : 'Sauvegarder'}
                                    </button>
                                </div>
                            </form>
                        </div>
                    </div>
                </div>
            )}
            
            <div className="card-body p-4">
                <div className="d-flex align-items-center mb-4">
                    <h5 className="m-0 text-dark"><i className="bi bi-people-fill me-2"></i> Gestion des Admins (Entreprises)</h5>
                    <button className="btn btn-primary rounded-pill ms-auto" onClick={() => setModal({ mode: 'add', user: null })}>
                        <i className="bi bi-plus-circle-fill me-2"></i> Ajouter un Admin
                    </button>
                </div>
                
                <div className="table-responsive">
                    <table className="table align-middle table-hover">
                        <thead className="table-light">
                            <tr>
                                <th>Entreprise</th>
                                <th>Email</th>
                                <th>Inscrit le</th>
                                <th style={{ width: 150 }}>Actions</th>
                            </tr>
                        </thead>
                        <tbody>
                            {loading && <tr><td colSpan="4" className="text-center py-4 text-muted"><i className="bi bi-arrow-clockwise spin me-2"></i>Chargement...</td></tr>}
                            {!loading && users.length === 0 && <tr><td colSpan="4" className="text-center py-4 text-muted">Aucun utilisateur admin trouvé.</td></tr>}
                            {users.map(user => (
                                <tr key={user._id}>
                                    <td className="fw-semibold">{user.companyName}</td>
                                    <td>{user.email}</td>
                                    <td>{formatDate(user.createdAt)}</td>
                                    <td>
                                        <button className="btn btn-sm btn-outline-warning rounded-circle me-2" title="Modifier" onClick={() => setModal({ mode: 'edit', user: user })}>
                                            <i className="bi bi-pencil-fill"></i>
                                        </button>
                                        <button className="btn btn-sm btn-outline-danger rounded-circle" title="Supprimer" onClick={() => handleDelete(user)}>
                                            <i className="bi bi-trash-fill"></i>
                                        </button>
                                    </td>
                                </tr>
                            ))}
                        </tbody>
                    </table>
                </div>
            </div>
        </div>
    );
}

// =====================================
// SUPER ADMIN: Page "Dashboard Global"
// =====================================
function AdminDashboardPage() {
    const { users, loading: usersLoading } = useAdminUsers();
    const [selectedUserId, setSelectedUserId] = useState("");
    const [endDate, setEndDate] = useState(new Date().toISOString().slice(0, 10));
    const [startDate, setStartDate] = useState(() => {
        const d = new Date(); d.setFullYear(d.getFullYear() - 1); return d.toISOString().slice(0, 10);
    });
    
    const [data, setData] = useState(null);
    const [loading, setLoading] = useState(false);
    
    useEffect(() => {
        if (!selectedUserId && users.length > 0) {
            setSelectedUserId(users[0]._id);
        }
    }, [users, selectedUserId]);
    
    useEffect(() => {
        if (!selectedUserId) return;
        
        const loadData = async () => {
            setLoading(true);
            setData(null);
            const qs = new URLSearchParams();
            if (startDate) qs.set('startDate', startDate);
            if (endDate) qs.set('endDate', endDate);
            
            try {
                const res = await apiFetchSuperAdmin(`/api/admin/summary-for-user/${selectedUserId}?${qs.toString()}`);
                const result = await res.json();
                if (!res.ok) throw new Error(result.error || "Erreur chargement résumé");
                setData(result);
            } catch (e) {
                alert(e.message);
            } finally {
                setLoading(false);
            }
        };
        loadData();
    }, [selectedUserId, startDate, endDate]);
    
    const Card = ({ title, amount, iconClass, cardClass }) => (
        <div className="col-12 col-md-3">
          <div className={`card border-0 shadow-sm rounded-4 ${cardClass} h-100`}>
            <div className="card-body d-flex align-items-center p-4">
              <div className="me-3 p-3 rounded-circle bg-opacity-25 bg-white d-flex align-items-center justify-content-center" style={{ width: 60, height: 60 }}><i className={`bi ${iconClass} fs-3`}></i></div>
              <div>
                <div className="text-uppercase small opacity-75">{title}</div>
                <div className="h3 m-0 fw-bold">{money(amount)}</div>
              </div>
            </div>
          </div>
        </div>
    );
    
    return (
        <>
            <div className="card border-0 shadow rounded-4 mb-4 bg-white">
                <div className="card-body p-4">
                    <h5 className="fw-bold mb-3"><i className="bi bi-funnel-fill me-2 text-info"></i>Filtres du Dashboard Global</h5>
                    <div className="row g-3">
                        <div className="col-12 col-md-4">
                            <label className="form-label small fw-semibold">Admin / Entreprise</label>
                            <select className="form-select" value={selectedUserId} onChange={(e) => setSelectedUserId(e.target.value)} disabled={usersLoading || loading}>
                                <option value="">-- Sélectionner un admin --</option>
                                {users.map(user => <option key={user._id} value={user._id}>{user.companyName}</option>)}
                            </select>
                        </div>
                        <div className="col-6 col-md-4">
                            <label className="form-label small fw-semibold">Date de Début</label>
                            <input type="date" className="form-control" value={startDate} onChange={(e) => setStartDate(e.target.value)} disabled={loading} />
                        </div>
                        <div className="col-6 col-md-4">
                            <label className="form-label small fw-semibold">Date de Fin</label>
                            <input type="date" className="form-control" value={endDate} onChange={(e) => setEndDate(e.target.value)} disabled={loading} />
                        </div>
                    </div>
                </div>
            </div>
            
            {loading && <div className="text-center py-5 text-muted"><i className="bi bi-arrow-clockwise spin me-2"></i>Chargement des données...</div>}
            
            <div className="row g-4 mb-5">
              <Card title="Total Ventes (Période)" amount={data?.totalAmount || 0} iconClass="bi-graph-up-arrow text-primary" cardClass="bg-primary text-white bg-opacity-75" />
              <Card title="Total Encaissé (Période)" amount={data?.totalPayment || 0} iconClass="bi-check-circle-fill text-success" cardClass="bg-success text-white bg-opacity-75" />
              <Card title="Dettes Clients (Actuelles)" amount={data?.totalDebt || 0} iconClass="bi-currency-exchange text-danger" cardClass="bg-danger text-white bg-opacity-75" />
              <Card title="Crédits Dûs (Actuels)" amount={data?.totalCredit || 0} iconClass="bi-arrow-down-circle-fill text-info" cardClass="bg-info text-white bg-opacity-75" />
            </div>
        </>
    );
}

// =====================================
// SUPER ADMIN: Page "Historiques Admins"
// =====================================
function AdminHistoryPage() {
    const { users, loading: usersLoading } = useAdminUsers();
    const [selectedUserId, setSelectedUserId] = useState("");
    const [endDate, setEndDate] = useState(new Date().toISOString().slice(0, 10));
    const [startDate, setStartDate] = useState(() => {
        const d = new Date(); d.setMonth(d.getMonth() - 1); return d.toISOString().slice(0, 10); // 1 mois par défaut
    });
    
    const [sales, setSales] = useState([]);
    const [logs, setLogs] = useState([]);
    const [loading, setLoading] = useState(false);
    
    const handleSearch = async () => {
        if (!selectedUserId) {
            alert("Veuillez sélectionner un admin."); return;
        }
        setLoading(true); setSales([]); setLogs([]);
        const qs = new URLSearchParams();
        if (startDate) qs.set('startDate', startDate);
        if (endDate) qs.set('endDate', endDate);
        
        try {
            // Fetch Ventes
            const resSales = await apiFetchSuperAdmin(`/api/admin/sales-for-user/${selectedUserId}?${qs.toString()}`);
            const dataSales = await resSales.json();
            if (!resSales.ok) throw new Error(dataSales.error || "Erreur chargement ventes");
            setSales(dataSales);
            
            // Fetch Logs
            const resLogs = await apiFetchSuperAdmin(`/api/admin/logs-for-user/${selectedUserId}?${qs.toString()}`);
            const dataLogs = await resLogs.json();
            if (!resLogs.ok) throw new Error(dataLogs.error || "Erreur chargement logs");
            setLogs(dataLogs);
            
        } catch (e) {
            alert(e.message);
        } finally {
            setLoading(false);
        }
    };
    
    const handleExport = async () => {
        if (!selectedUserId) { alert("Veuillez sélectionner un admin."); return; }
        
        const qs = new URLSearchParams();
        if (startDate) qs.set('startDate', startDate);
        if (endDate) qs.set('endDate', endDate);
        
        try {
            const res = await apiFetchSuperAdmin(`/api/admin/export/${selectedUserId}?${qs.toString()}`, { method: "GET" });
            if (!res.ok) throw new Error("Export impossible");
            const blob = await res.blob();
            const url = window.URL.createObjectURL(blob);
            const a = document.createElement("a");
            a.href = url;
            const admin = users.find(u => u._id === selectedUserId)?.companyName.replace(/\s/g, '_') || selectedUserId;
            a.download = `Export_Admin_${admin}_${startDate}_${endDate}.xlsx`;
            document.body.appendChild(a); a.click(); a.remove();
            window.URL.revokeObjectURL(url);
        } catch (e) {
            alert(e.message);
        }
    };
    
    // NOUVEAU: Logique d'export des Soldes Clients
    const handleExportClientBalances = async () => {
        if (!selectedUserId) { alert("Veuillez sélectionner un admin."); return; }
        
        try {
            setLoading(true);
            // Appel de la nouvelle route backend
            const res = await apiFetchSuperAdmin(`/api/admin/export-balances/${selectedUserId}`, { method: "GET" });
            
            if (!res.ok) {
                const errorText = await res.text();
                throw new Error(errorText || "Export des soldes impossible");
            }
            
            const blob = await res.blob();
            const url = window.URL.createObjectURL(blob);
            const a = document.createElement("a");
            a.href = url;
            const admin = users.find(u => u._id === selectedUserId)?.companyName.replace(/\s/g, '_') || selectedUserId;
            // Nom de fichier avec le nom de l'admin
            a.download = `Soldes_Clients_${admin}_${new Date().toISOString().slice(0,10)}.xlsx`;
            document.body.appendChild(a); 
            a.click(); 
            a.remove();
            window.URL.revokeObjectURL(url);
        } catch (e) {
            alert(e.message);
        } finally {
            setLoading(false);
        }
    };

    return (
        <>
            <div className="card border-0 shadow rounded-4 mb-4 bg-white">
                <div className="card-body p-4">
                    <h5 className="fw-bold mb-3"><i className="bi bi-funnel-fill me-2 text-info"></i>Filtres Historiques</h5>
                    <div className="row g-3">
                        <div className="col-12 col-md-4">
                            <label className="form-label small fw-semibold">Admin / Entreprise</label>
                            <select className="form-select" value={selectedUserId} onChange={(e) => setSelectedUserId(e.target.value)} disabled={usersLoading || loading}>
                                <option value="">-- Sélectionner un admin --</option>
                                {users.map(user => <option key={user._id} value={user._id}>{user.companyName}</option>)}
                            </select>
                        </div>
                        <div className="col-6 col-md-3">
                            <label className="form-label small fw-semibold">Date de Début</label>
                            <input type="date" className="form-control" value={startDate} onChange={(e) => setStartDate(e.target.value)} disabled={loading} />
                        </div>
                        <div className="col-6 col-md-3">
                            <label className="form-label small fw-semibold">Date de Fin</label>
                            <input type="date" className="form-control" value={endDate} onChange={(e) => setEndDate(e.target.value)} disabled={loading} />
                        </div>
                        <div className="col-12 col-md-2 d-flex align-items-end gap-2">
                            <button className="btn btn-primary w-100" onClick={handleSearch} disabled={loading || !selectedUserId}>
                                <i className="bi bi-search"></i>
                            </button>
                            {/* BOUTON EXPORT VENTES/LOGS */}
                            <button className="btn btn-success w-100" onClick={handleExport} disabled={loading || !selectedUserId} title="Exporter Ventes et Logs (Période)">
                                <i className="bi bi-file-earmark-excel-fill"></i>
                            </button>
                            {/* NOUVEAU BOUTON EXPORT SOLDES CLIENTS */}
                            <button className="btn btn-info w-100 text-white" onClick={handleExportClientBalances} disabled={loading || !selectedUserId} title="Exporter Soldes Clients Actuels (Dette/Crédit)">
                                <i className="bi bi-cash-coin"></i>
                            </button>
                        </div>
                    </div>
                </div>
            </div>

            {loading && <div className="text-center py-5 text-muted"><i className="bi bi-arrow-clockwise spin me-2"></i>Chargement des historiques...</div>}
            
            {/* Table des Ventes */}
            <div className="card border-0 shadow rounded-4 mb-4 bg-white">
                <div className="card-header bg-light"><h5 className="m-0">Historique des Ventes</h5></div>
                <div className="card-body p-4">
                    <div className="table-responsive">
                        <table className="table table-sm table-striped align-middle">
                            <thead className="table-dark">
                                <tr>
                                    <th>Date</th><th>Client</th><th>Poisson</th><th>Montant</th><th>Payé</th><th>Solde</th>
                                </tr>
                            </thead>
                            <tbody>
                                {!loading && sales.length === 0 && <tr><td colSpan="6" className="text-center py-3 text-muted">Aucune vente trouvée pour cette sélection.</td></tr>}
                                {sales.map(s => (
                                    <tr key={s._id} className={s.balance > 0 ? 'table-danger-subtle' : (s.balance < 0 ? 'table-success-subtle' : '')}>
                                        <td>{formatDate(s.date)}</td>
                                        <td className="fw-semibold">{s.clientName}</td>
                                        <td><BadgeFish type={s.fishType} /></td>
                                        <td>{money(s.amount)}</td>
                                        <td>{money(s.payment)}</td>
                                        <td className="fw-bold">{money(s.balance)}</td>
                                    </tr>
                                ))}
                            </tbody>
                        </table>
                    </div>
                </div>
            </div>
            
            {/* Table des Actions */}
            <div className="card border-0 shadow rounded-4 mb-4 bg-white">
                <div className="card-header bg-light"><h5 className="m-0">Historique des Actions (Modifications / Suppressions)</h5></div>
                <div className="card-body p-4">
                     <div className="table-responsive">
                        <table className="table table-sm table-bordered align-middle">
                            <thead className="table-dark">
                                <tr>
                                    <th>Action</th><th>Date Action</th><th>Motif</th><th>Client (Vente)</th><th>Montant (Vente)</th>
                                </tr>
                            </thead>
                            <tbody>
                                {!loading && logs.length === 0 && <tr><td colSpan="5" className="text-center py-3 text-muted">Aucune action trouvée pour cette sélection.</td></tr>}
                                {logs.map(log => {
                                    const s = log.saleData;
                                    const isEdit = log.actionType === 'edit';
                                    return (
                                        <tr key={log._id} className={isEdit ? 'table-warning-subtle' : 'table-danger-subtle'}>
                                            <td><span className={`badge ${isEdit ? 'text-bg-warning' : 'text-bg-danger'}`}>{isEdit ? 'Modifié' : 'Supprimé'}</span></td>
                                            <td className="small">{formatDateTime(log.createdAt)}</td>
                                            <td className="small">{log.motif}</td>
                                            <td className="fw-semibold">{s.clientName}</td>
                                            <td>{money(s.amount)}</td>
                                        </tr>
                                    );
                                })}
                            </tbody>
                        </table>
                    </div>
                </div>
            </div>
        </>
    );
}


// =====================================
// SUPER ADMIN: Application Principale
// =====================================
function AdminApp() {
    const { isMdUp } = useViewport();
    const [sidebarOpen, setSidebarOpen] = useState(false);
    const [currentPage, setCurrentPage] = useState("dashboard");

    // Vérification du Super Token
    if (typeof window !== "undefined" && !localStorage.getItem("superToken")) {
        window.location.hash = "#/admin-login";
        return <AdminLogin />;
    }
    
    const handleLogout = () => {
        localStorage.removeItem("superToken");
        window.location.hash = "#/admin-login";
        window.location.reload();
    };

    const getPageTitle = (page) => {
        switch (page) {
            case "dashboard": return "Dashboard Global 📊";
            case "users": return "Gestion des Administrateurs 👥";
            case "history": return "Historiques des Admins 🔍";
            default: return "Super Admin";
        }
    };

    const renderPage = () => {
        switch (currentPage) {
            case "users": return <AdminUsersPage />;
            case "history": return <AdminHistoryPage />;
            case "dashboard": default: return <AdminDashboardPage />;
        }
    };

    return (
        <div className="d-flex" style={{ overflowX: "hidden" }}>
            <AdminSidebar
                currentPage={currentPage}
                onNavigate={setCurrentPage}
                onLogout={handleLogout}
                open={sidebarOpen}
                setOpen={setSidebarOpen}
                isMdUp={isMdUp}
            />
            <main className="flex-grow-1" style={{ marginLeft: isMdUp ? SIDEBAR_WIDTH : 0, background: "#f0f2f5", minHeight: "100vh", transition: "margin-left .25s ease", width: "100%" }}>
                <div className="container-fluid py-3 py-md-4">
                    <AdminTopbar title={getPageTitle(currentPage)} onBurger={() => setSidebarOpen(true)} />
                    {renderPage()}
                </div>
            </main>
        </div>
    );
}


/** #####################################################################################
 * #####################################################################################
 * ###                                                                               ###
 * ###                    APPLICATION "ADMIN" (UTILISATEUR NORMAL)                   ###
 * ###                                                                               ###
 * #####################################################################################
 * ##################################################################################### */

// =====================================
// ADMIN/USER: Sidebar + Topbar (MIS À JOUR)
// =====================================
function Sidebar({ companyName, currentPage, onNavigate, onLogout, open, setOpen, isMdUp }) {
  const navItems = [
    { id: "dashboard", icon: "bi-house-door-fill", label: "Dashboard" },
    { id: "client-analysis", icon: "bi-search", label: "Analyse Client" }, 
    { id: "client-management", icon: "bi-people-fill", label: "Gestion Clients" }, // AJOUTÉ
    { id: "new-sale", icon: "bi-cash-coin", label: "Nouvelle Vente" },
    { id: "sales", icon: "bi-table", label: "Historique & Actions" },
    { id: "debts", icon: "bi-exclamation-triangle-fill", label: "Dettes Clients" },
    { id: "sales-balance", icon: "bi-cash-stack", label: "Bilan des Ventes" }, 
    { id: "client-report", icon: "bi-file-earmark-bar-graph-fill", label: "Bilan Client / Export" }, 
    { id: "charts", icon: "bi-graph-up", label: "Analyse Graphique" },
    { id: "motif-summary", icon: "bi-journal-text", label: "Bilan Motifs" },
    { id: "action-history", icon: "bi-trash-fill", label: "Historiques Actions" },
  ];
  return (
    <>
      {!isMdUp && <div onClick={() => setOpen(false)} className={`position-fixed top-0 start-0 w-100 h-100 bg-dark bg-opacity-50 ${open ? "d-block" : "d-none"}`} style={{ zIndex: 1029 }} />}
      <aside className={`bg-dark text-white shadow-lg d-flex flex-column p-3 position-fixed top-0 start-0`} style={{ width: SIDEBAR_WIDTH, height: "100vh", zIndex: 1030, transition: "transform .25s ease", transform: !isMdUp && !open ? `translateX(-${SIDEBAR_WIDTH}px)` : "translateX(0)", overflowY: "auto" }}>
        <button type="button" className="btn btn-link text-white d-md-none align-self-end p-0 mb-2" onClick={() => setOpen(false)}><i className="bi bi-x-lg fs-5" /></button>
        <a href="#" className="d-flex align-items-center mb-3 text-white text-decoration-none"><i className="bi bi-water me-2 fs-4 text-info"></i><span className="fs-5 fw-bold">Fish Manage</span></a>
        <hr className="border-secondary" />
        <ul className="nav nav-pills flex-column mb-auto">
          {navItems.map((item) => (
            <li className="nav-item" key={item.id}>
              <button className={`btn nav-link text-start text-white w-100 mb-1 ${currentPage === item.id ? "active bg-primary shadow-sm" : "link-body-emphasis"}`} onClick={() => { onNavigate(item.id); if (!isMdUp) setOpen(false); }}>
                <i className={`bi ${item.icon} me-2`}></i>{item.label}
              </button>
            </li>
          ))}
        </ul>
        <hr className="border-secondary mt-auto" />
        <div className="d-flex align-items-center text-white">
          <i className="bi bi-person-circle me-2 fs-5"></i><strong className="text-truncate" style={{ maxWidth: 150 }}>{companyName}</strong>
          <button className="btn btn-link text-danger ms-auto p-0" onClick={onLogout} title="Se déconnecter"><i className="bi bi-box-arrow-right fs-5"></i></button>
        </div>
      </aside>
    </>
  );
}

function Topbar({ title, companyName, onBurger }) {
  return (
    <div className="d-flex align-items-center mb-4 pb-2 border-bottom border-secondary-subtle">
      <button className="btn btn-outline-secondary d-md-none me-2" onClick={onBurger}><i className="bi bi-list"></i></button>
      <h1 className="h5 h-md2 m-0 text-dark fw-semibold">{title}</h1>
      <div className="ms-auto small text-muted d-none d-md-block">Connecté en tant que <strong>{companyName}</strong></div>
    </div>
  );
}

// =====================================
// ADMIN/USER: Auth
// =====================================
function AuthView({ onAuth }) {
  const [mode, setMode] = useState("login");
  const [companyName, setCompanyName] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [err, setErr] = useState("");

  const submit = async (e) => {
    e.preventDefault(); setErr("");
    try {
      const path = mode === "login" ? "/api/auth/login" : "/api/auth/register";
      const body = mode === "login" ? { email, password } : { companyName, email, password };
      const res = await fetch(`${API_BASE}${path}`, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(body), });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Erreur");
      localStorage.setItem("token", data.token);
      localStorage.setItem("companyName", data.companyName);
      onAuth();
    } catch (e) { setErr(e.message); }
  };

  return (
    <div className="d-flex align-items-center justify-content-center" style={{ minHeight: "100vh", background: "#f8f9fa" }}>
      <div className="container">
        <div className="row justify-content-center">
          <div className="col-12 col-sm-10 col-md-7 col-lg-5">
            <div className="card border-0 shadow-lg rounded-4 p-2">
              <div className="card-body p-4">
                <div className="text-center mb-4">
                  <i className="bi bi-water text-primary display-4"></i>
                  <h3 className="fw-bold mt-2">Fish Manage</h3>
                  <p className="text-muted small">Connexion au Dashboard Admin</p>
                </div>
                <form onSubmit={submit} className="mt-3">
                  {mode === "register" && (
                    <div className="mb-3">
                      <label className="form-label fw-semibold">Nom de l'Entreprise</label>
                      <input className="form-control form-control-lg" value={companyName} onChange={(e) => setCompanyName(e.target.value)} required />
                    </div>
                  )}
                  <div className="mb-3">
                    <label className="form-label fw-semibold">Email</label>
                    <input type="email" className="form-control form-control-lg" value={email} onChange={(e) => setEmail(e.target.value)} required />
                  </div>
                  <div className="mb-4">
                    <label className="form-label fw-semibold">Mot de passe</label>
                    <input type="password" className="form-control form-control-lg" value={password} onChange={(e) => setPassword(e.target.value)} required />
                  </div>
                  {err && <div className="alert alert-danger small">{err}</div>}
                  <div className="d-grid gap-3">
                    <button className="btn btn-primary btn-lg rounded-pill shadow-sm" type="submit">
                      {mode === "login" ? "Connexion" : "Inscription"}
                    </button>
                    <button type="button" className="btn btn-link text-secondary" onClick={() => setMode(mode === "login" ? "register" : "login")}>
                      {mode === "login" ? "Créer un compte" : "J'ai déjà un compte"}
                    </button>
                  </div>
                </form>
                <div className="text-center text-muted mt-3 small">
                    {/* <a href="#/admin-login">Connexion Super Admin</a> */}
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

// =====================================
// ADMIN/USER: Formulaires et Modales
// =====================================
function SaleFormBody({ data, setData, disabled = false, isEdit = false }) {
    return (
        <div className="row g-3">
            {isEdit && (
                <>
                    <div className="col-12 col-md-6">
                        <label className="form-label small fw-semibold">Client (MAJUSCULES SANS ESPACE)</label>
                        <input className="form-control" value={data.clientName} onChange={(e) => setData(p => ({...p, clientName: e.target.value.toUpperCase().replace(/\s/g, '')}))} pattern="^[A-Z0-9]+$" title="Uniquement des lettres majuscules (A-Z) et des chiffres (0-9)." required disabled={disabled} />
                    </div>
                    <div className="col-12 col-md-6">
                        <label className="form-label small fw-semibold">Date</label>
                        <input type="date" className="form-control" value={data.date} onChange={(e) => setData(p => ({...p, date: e.target.value}))} required disabled={disabled} />
                    </div>
                    <div className="col-12"><hr/></div>
                </>
            )}
            <div className="col-6">
                <label className="form-label small fw-semibold">Poisson</label>
                <select className="form-select" value={data.fishType} onChange={(e) => setData(p => ({...p, fishType: e.target.value}))} disabled={disabled}>
                    <option value="tilapia">Tilapia</option><option value="pangasius">Pangasius</option>
                </select>
            </div>
            <div className="col-6">
                <label className="form-label small fw-semibold">Qté Commandée (kg)</label>
                <input type="number" step="0.01" className="form-control" value={data.quantity} onChange={(e) => setData(p => ({...p, quantity: e.target.value}))} required disabled={disabled} />
            </div>
            <div className="col-6">
                <label className="form-label small fw-semibold">Prix Unitaire (XOF)</label>
                <input type="number" step="0.01" className="form-control" value={data.unitPrice} onChange={(e) => setData(p => ({...p, unitPrice: e.target.value}))} required disabled={disabled} />
            </div>
            <div className="col-6">
                <label className="form-label small fw-semibold">Qté Livrée (kg)</label>
                <input type="number" step="0.01" className="form-control" value={data.delivered} onChange={(e) => setData(p => ({...p, delivered: e.target.value}))} disabled={disabled} />
            </div>
            <div className="col-6">
                <label className="form-label small fw-semibold">Règlement Payé (XOF)</label>
                <input type="number" step="0.01" className="form-control" value={data.payment} onChange={(e) => setData(p => ({...p, payment: e.target.value}))} disabled={disabled} />
            </div>
            <div className="col-6"> 
                <label className="form-label small fw-semibold">Observation</label>
                <input className="form-control" value={data.observation} onChange={(e) => setData(p => ({...p, observation: e.target.value}))} placeholder="Notes de la vente..." disabled={disabled} />
            </div>
        </div>
    );
}

// SaleForm (MIS À JOUR AVEC SÉLECTION/SAISIE CLIENT FORCÉE)
function SaleForm({ onSaved }) {
    const clients = useClients(); // UTILISE LE HOOK
    const [formData, setFormData] = useState({ fishType: 'tilapia', quantity: '', delivered: '', unitPrice: '', payment: '', observation: '' });
    const [date, setDate] = useState(new Date().toISOString().slice(0, 10));
    const [clientName, setClient] = useState(""); // Sera le client sélectionné ou le nouveau client
    const [isNewClient, setIsNewClient] = useState(false); // NOUVEAU: Pour gérer la création vs sélection
    const [loading, setLoading] = useState(false);
    
    const amount = (Number(formData.quantity || 0) * Number(formData.unitPrice || 0)) || 0;
    const balance = amount - Number(formData.payment || 0); 
    const remainingToDeliver = Math.max(0, Number(formData.quantity || 0) - Number(formData.delivered || 0));

    const save = async (e) => {
        e.preventDefault(); setLoading(true);
        try {
            const clientUpper = clientName.toUpperCase();
            if (isNewClient && !validateClientName(clientUpper)) throw new Error("Le nom du client doit être en MAJUSCULES (A-Z, 0-9) sans espace/caractère spécial. Ex: ENTREPRISEA1");
            if (!clientUpper) throw new Error("Veuillez sélectionner ou saisir un nom de client."); // Double vérification
            
            const q = Number(formData.quantity || 0); const u = Number(formData.unitPrice || 0);
            if (q <= 0) throw new Error("La quantité commandée doit être positive.");
            if (u <= 0) throw new Error("Le prix unitaire doit être positif.");
            
            const res = await apiFetch("/api/sales", { 
                method: "POST", 
                body: JSON.stringify({ 
                    date, clientName: clientUpper, 
                    ...formData, 
                    quantity: q, 
                    unitPrice: u, 
                    delivered: Number(formData.delivered || 0), 
                    payment: Number(formData.payment || 0) 
                }), 
            });
            const data = await res.json(); 
            if (!res.ok) throw new Error(data.error || "Erreur");
            
            // Réinitialisation après succès
            setClient(""); setFormData({fishType: 'tilapia', quantity: '', delivered: '', unitPrice: '', payment: '', observation: ''});
            setIsNewClient(false); // On revient à la sélection
            onSaved && onSaved(data); 
            window.dispatchEvent(new Event("reload-sales")); 
            window.dispatchEvent(new Event("reload-clients")); // Mettre à jour la liste des clients partout
        } catch (err) { 
            alert(err.message); 
        }
        finally { setLoading(false); }
    };

    return (
        <div className="card border-0 shadow rounded-4 mb-4 bg-white">
            <div className="card-header bg-primary text-white rounded-top-4 p-3 d-flex align-items-center"><i className="bi bi-bag-plus-fill me-2 fs-5"></i><h5 className="m-0">Nouvelle Vente Rapide</h5></div>
            <div className="card-body p-4">
                <form onSubmit={save} className="row g-3">
                    {/* SÉLECTION/SAISIE DU CLIENT - NOUVELLE LOGIQUE */}
                    <div className="col-12 mb-4 p-3 bg-light rounded-3 border">
                        <label className="form-label small fw-semibold">Client / Entreprise</label>
                        {!isNewClient ? (
                            <select 
                                className="form-select form-select-lg" 
                                value={clientName} 
                                onChange={(e) => { 
                                    if (e.target.value === 'NEW') setIsNewClient(true);
                                    else setClient(e.target.value);
                                }} 
                                required
                            >
                                <option value="" disabled>-- Sélectionner un client --</option>
                                {clients.map(client => <option key={client} value={client}>{client}</option>)}
                                <option value="NEW">-- Nouveau Client --</option>
                            </select>
                        ) : (
                            <div className="input-group">
                                <input 
                                    className="form-control form-control-lg" 
                                    value={clientName} 
                                    onChange={(e) => setClient(e.target.value.toUpperCase().replace(/\s/g, ''))} 
                                    pattern="^[A-Z0-9]+$" 
                                    title="Uniquement des lettres majuscules (A-Z) et des chiffres (0-9). Pas d'espaces." 
                                    placeholder="ENTREPRISEB" 
                                    required
                                />
                                <button type="button" className="btn btn-outline-secondary" onClick={() => { setIsNewClient(false); setClient(""); }}>Annuler</button>
                            </div>
                        )}
                        {(isNewClient && clientName) ? (
                            <div className="small text-danger mt-1">Nouveau client : **{clientName}** sera créé.</div>
                        ) : (
                            <div className="small text-muted mt-1">Ex: ENTREPRISEB ou DUPONT34.</div>
                        )}
                    </div>

                    {clientName && ( // Le reste du formulaire n'apparaît que si un client est sélectionné/saisi
                        <>
                            <div className="col-6 col-sm-6 col-md-6 col-lg-3">
                                <label className="form-label small fw-semibold">Date</label>
                                <input type="date" className="form-control" value={date} onChange={(e) => setDate(e.target.value)} required />
                            </div>
                            <div className="col-12"><SaleFormBody data={formData} setData={setFormData} isEdit={false} /></div>
                            <div className="col-12 d-grid gap-2 mt-4">
                                <button className="btn btn-primary btn-lg rounded-pill" disabled={loading}><i className={`bi ${loading ? "bi-hourglass-split" : "bi-check-circle-fill"} me-2`}></i>{loading ? "Enregistrement..." : "Enregistrer la Vente"}</button>
                            </div>
                            <div className="col-12 d-flex justify-content-between flex-wrap pt-3 mt-3 border-top">
                                <span className="badge bg-secondary p-2">Montant: <strong className="fs-6">{money(amount)}</strong></span>
                                <span className="badge bg-warning text-dark p-2">Reste à livrer: <strong className="fs-6">{remainingToDeliver} kg</strong></span>
                                <span className={`badge ${balance > 0 ? 'bg-danger' : 'bg-success'} p-2`}>{balance > 0 ? "Solde à payer" : "Crédit Client"}: <strong className="fs-6">{money(Math.abs(balance))}</strong></span>
                            </div>
                        </>
                    )}
                    
                </form>
            </div>
        </div>
    );
}

function ManualCompensationForm({ creditSale, creditAvailable, setLoading, onCompensationSuccess }) {
    const [debts, setDebts] = useState([]);
    const [selectedDebt, setSelectedDebt] = useState(null);
    const [amountToCompensate, setAmountToCompensate] = useState(creditAvailable.toFixed(2));
    const [clientLoading, setClientLoading] = useState(false);
    
    useEffect(() => {
        const loadDebts = async () => {
            setClientLoading(true);
            try {
                const res = await apiFetch(`/api/sales/client-balances/${encodeURIComponent(creditSale.clientName)}`);
                const data = await res.json();
                const validDebts = data.debts.filter(d => d.balance > 0); setDebts(validDebts);
                if (validDebts.length > 0) setSelectedDebt(validDebts[0]); else setSelectedDebt(null);
            } catch (e) { console.error("Erreur chargement des dettes:", e); alert("Erreur lors du chargement des dettes: " + e.message); }
            finally { setClientLoading(false); }
        };
        loadDebts();
    }, [creditSale.clientName]);

    useEffect(() => {
        if (selectedDebt) { const max = Math.min(creditAvailable, selectedDebt.balance); setAmountToCompensate(max.toFixed(2)); } 
        else { setAmountToCompensate(creditAvailable.toFixed(2)); }
    }, [selectedDebt, creditAvailable]);

    const handleCompensation = async (e) => {
        e.preventDefault(); setLoading(true);
        try {
            if (!selectedDebt) throw new Error("Veuillez sélectionner une dette à solder.");
            const amount = Number(amountToCompensate); if (amount <= 0) throw new Error("Montant invalide.");
            const max = Math.min(creditAvailable, selectedDebt.balance);
            if (amount > max) throw new Error(`Le montant ne peut pas dépasser ${money(max)} (Max entre crédit et dette).`);
            const res = await apiFetch(`/api/sales/compensate-manual`, { method: "PATCH", body: JSON.stringify({ debtId: selectedDebt._id, creditId: creditSale._id, amountToUse: amount }) });
            const data = await res.json(); if (!res.ok) throw new Error(data.error || "Erreur lors de la compensation");
            alert(`Compensation de ${money(data.compensatedAmount)} effectuée.`);
            onCompensationSuccess();
        } catch (e) { alert(e.message); }
        finally { setLoading(false); }
    };

    if (clientLoading) return <div className="text-center py-5 text-muted"><i className="bi bi-arrow-clockwise spin me-2"></i>Chargement des dettes...</div>;
    if (debts.length === 0) return <div className="alert alert-info text-center">Ce client n'a **aucune dette** en cours à compenser.</div>;
    
    return (
        <form onSubmit={handleCompensation}>
            <div className="alert alert-danger small">Crédit disponible : <strong className="text-success">{money(creditAvailable)}</strong> (Ligne ID : {creditSale._id.slice(-6)}).</div>
            <div className="mb-3">
                <label className="form-label fw-semibold">Dette à Solder (par ancienneté)</label>
                <select className="form-select form-select-lg" onChange={(e) => setSelectedDebt(debts.find(d => d._id === e.target.value))} value={selectedDebt?._id || ''} required>
                    {debts.map(d => <option key={d._id} value={d._id}>{d.date} - Reste à Payer: {money(d.balance)} (ID: {d._id.slice(-6)})</option>)}
                </select>
                {selectedDebt && (<small className="text-muted">Max à compenser: {money(Math.min(creditAvailable, selectedDebt.balance))}</small>)}
            </div>
            <div className="mb-3">
                <label className="form-label fw-semibold">Montant à Compenser</label>
                <input type="number" step="0.01" className="form-control form-control-lg" value={amountToCompensate} onChange={(e) => setAmountToCompensate(e.target.value)} min="0.01" max={Math.min(creditAvailable, selectedDebt?.balance || creditAvailable)} required />
            </div>
            <div className="d-grid mt-4">
                <button type="submit" className="btn btn-warning btn-lg" disabled={setLoading || !selectedDebt}><i className={`bi ${setLoading ? "bi-hourglass-split" : "bi-arrow-left-right"} me-2`}></i>{setLoading ? "Traitement..." : "Compenser la Dette Manuellement"}</button>
            </div>
        </form>
    );
}

function CreditUseModal({ sale, onClose, onRefundSuccess, onNewSaleSuccess, onManualCompensationSuccess }) {
    const [useType, setUseType] = useState('refund'); 
    const [amount, setAmount] = useState(Math.abs(sale.balance).toFixed(2));
    const [loading, setLoading] = useState(false);
    const [newSaleFormData, setNewSaleFormData] = useState({ fishType: 'tilapia', quantity: '', delivered: '', unitPrice: '', payment: 0, observation: '' });
    const creditAvailable = Math.abs(sale.balance);

    const handleRefund = async () => {
        setLoading(true);
        try {
            const refundAmount = Number(amount);
            if (refundAmount <= 0) throw new Error("Montant de remboursement invalide.");
            if (refundAmount > creditAvailable) throw new Error("Le montant dépasse le crédit disponible.");
            const res = await apiFetch(`/api/sales/${sale._id}/refund`, { method: "PATCH", body: JSON.stringify({ amount: refundAmount }) });
            const data = await res.json(); if (!res.ok) throw new Error(data.error || "Erreur lors du remboursement");
            alert(`Remboursement de ${money(refundAmount)} effectué.`);
            onRefundSuccess();
        } catch (e) { alert(e.message); } finally { setLoading(false); }
    };
    
    const handleNewSale = async () => {
        setLoading(true);
        try {
            const q = Number(newSaleFormData.quantity || 0); const u = Number(newSaleFormData.unitPrice || 0);
            if (q <= 0 || u <= 0) throw new Error("Quantité et Prix Unitaire doivent être positifs.");
            const clientNameUpper = sale.clientName.toUpperCase(); 
            const res = await apiFetch("/api/sales", { method: "POST", body: JSON.stringify({ date: new Date().toISOString().slice(0, 10), clientName: clientNameUpper, fishType: newSaleFormData.fishType, quantity: q, delivered: Number(newSaleFormData.delivered || 0), unitPrice: u, payment: newSaleFormData.payment || 0, observation: `Vente potentiellement payée par CREDIT client. Utilisation MANUELLE nécessaire. ${newSaleFormData.observation}` }), });
            const data = await res.json(); if (!res.ok) throw new Error(data.error || "Erreur création vente");
            alert(`Nouvelle vente de ${money(q * u)} créée. Utilisez "Solder les dettes" pour appliquer le crédit.`);
            onNewSaleSuccess();
        } catch (e) { alert(e.message); } finally { setLoading(false); }
    };

    return (
        <div className="modal show d-block" style={{ backgroundColor: 'rgba(0,0,0,0.5)' }}>
            <div className="modal-dialog modal-dialog-centered modal-xl"> 
                <div className="modal-content">
                    <div className="modal-header bg-success text-white"><h5 className="modal-title">Utilisation du Crédit Client : {sale.clientName}</h5><button type="button" className="btn-close btn-close-white" onClick={onClose}></button></div>
                    <div className="modal-body">
                        <div className="alert alert-success text-center">Crédit disponible : <strong className="fs-4">{money(creditAvailable)}</strong> (Sur Vente ID: {sale._id.slice(-6)})</div>
                        <ul className="nav nav-tabs justify-content-center mb-4">
                            <li className="nav-item"><button className={`nav-link ${useType === 'refund' ? 'active' : ''}`} onClick={() => setUseType('refund')}><i className="bi bi-wallet2 me-2"></i> Remboursement Espèces</button></li>
                            <li className="nav-item"><button className={`nav-link ${useType === 'new-sale' ? 'active' : ''}`} onClick={() => setUseType('new-sale')}><i className="bi bi-bag-fill me-2"></i> Utilisation sur Nouvelle Vente</button></li>
                            <li className="nav-item"><button className={`nav-link ${useType === 'compensate' ? 'active' : ''}`} onClick={() => setUseType('compensate')}><i className="bi bi-arrow-left-right me-2"></i> Solder les Dettes</button></li>
                        </ul>
                        
                        {useType === 'refund' && (
                            <form onSubmit={(e) => { e.preventDefault(); handleRefund(); }}>
                                <div className="mb-3">
                                    <label className="form-label fw-semibold">Montant à Rembourser</label>
                                    <input type="number" step="0.01" className="form-control form-control-lg" value={amount} onChange={(e) => setAmount(e.target.value)} min="0.01" max={creditAvailable} required />
                                    <small className="text-muted">Max : {money(creditAvailable)}</small>
                                </div>
                                <div className="d-grid mt-4">
                                    <button type="submit" className="btn btn-success btn-lg" disabled={loading}>
                                        <i className={`bi ${loading ? "bi-hourglass-split" : "bi-cash-coin"} me-2`}></i>
                                        {loading ? "Traitement..." : "Confirmer le Remboursement"}
                                    </button>
                                </div>
                            </form>
                        )}
                        
                        {useType === 'new-sale' && (
                            <form onSubmit={(e) => { e.preventDefault(); handleNewSale(); }}>
                                <div className="alert alert-info small">Enregistrez une nouvelle vente. Le crédit NE sera PAS appliqué automatiquement. Vous devrez utiliser l'onglet "Solder les Dettes" après l'enregistrement.</div>
                                <SaleFormBody data={newSaleFormData} setData={setNewSaleFormData} disabled={false} isEdit={false} /> 
                                <div className="alert alert-warning small text-center mt-3">
                                    Montant de la nouvelle vente (Dette créée) : 
                                    <strong className="fs-5 ms-2">{money(Number(newSaleFormData.quantity || 0) * Number(newSaleFormData.unitPrice || 0))}</strong>
                                </div>
                                <div className="d-grid mt-4">
                                    <button type="submit" className="btn btn-secondary btn-lg" disabled={loading}>
                                        <i className={`bi ${loading ? "bi-hourglass-split" : "bi-check2-circle"} me-2`}></i>
                                        {loading ? "Traitement..." : "Confirmer la Création de Vente"}
                                    </button>
                                </div>
                            </form>
                        )}
                        
                        {useType === 'compensate' && (<ManualCompensationForm creditSale={sale} creditAvailable={creditAvailable} setLoading={setLoading} onCompensationSuccess={onManualCompensationSuccess} />)}
                    </div>
                </div>
            </div>
        </div>
    );
}
function EditSaleModal({ sale, onClose, onSaveSuccess }) {
    const [formData, setFormData] = useState({ ...sale, date: formatDate(sale.date) });
    const [motif, setMotif] = useState("");
    const [loading, setLoading] = useState(false);

    const handleSubmit = async (e) => {
        e.preventDefault(); if (motif.trim() === "") { alert("Le motif de la modification est obligatoire."); return; }
        setLoading(true);
        try {
            const clientUpper = formData.clientName.toUpperCase();
            if (!validateClientName(clientUpper)) throw new Error("Le nom du client doit être en MAJUSCULES (A-Z, 0-9) sans espace/caractère spécial.");
            const q = Number(formData.quantity || 0); const u = Number(formData.unitPrice || 0);
            if (q <= 0 || u <= 0) throw new Error("Quantité et Prix Unitaire doivent être positifs.");
            const res = await apiFetch(`/api/sales/${sale._id}`, { method: "PUT", body: JSON.stringify({ saleData: { ...formData, clientName: clientUpper }, motif: motif }) });
            const data = await res.json(); if (!res.ok) throw new Error(data.error || "Erreur lors de la mise à jour");
            alert("Vente mise à jour avec succès."); onSaveSuccess();
        } catch (e) { alert(e.message); } finally { setLoading(false); }
    };

    return (
        <div className="modal show d-block" style={{ backgroundColor: 'rgba(0,0,0,0.5)' }}>
            <div className="modal-dialog modal-dialog-centered modal-lg">
                <div className="modal-content">
                    <form onSubmit={handleSubmit}>
                        <div className="modal-header bg-warning text-dark"><h5 className="modal-title">Modifier la Vente</h5><button type="button" className="btn-close" onClick={onClose} disabled={loading}></button></div>
                        <div className="modal-body">
                            <SaleFormBody data={formData} setData={setFormData} disabled={loading} isEdit={true} />
                            <hr className="my-4"/>
                            <div className="mb-3">
                                <label htmlFor="motifEdit" className="form-label fw-semibold text-danger">Motif de la modification (Obligatoire)</label>
                                <textarea id="motifEdit" className="form-control" rows="3" value={motif} onChange={(e) => setMotif(e.target.value)} required disabled={loading} placeholder="Ex: Correction du prix unitaire..."></textarea>
                            </div>
                        </div>
                        <div className="modal-footer">
                            <button type="button" className="btn btn-secondary" onClick={onClose} disabled={loading}>Annuler</button>
                            <button type="submit" className="btn btn-warning" disabled={loading || motif.trim() === ""}><i className={`bi ${loading ? "bi-hourglass-split" : "bi-check-circle-fill"} me-2`}></i>{loading ? "Sauvegarde..." : "Sauvegarder"}</button>
                        </div>
                    </form>
                </div>
            </div>
        </div>
    );
}

function DeleteMotifModal({ sale, onClose, onDeleteSuccess }) {
    const [motif, setMotif] = useState("");
    const [loading, setLoading] = useState(false);

    const handleSubmit = async (e) => {
        e.preventDefault(); if (motif.trim() === "") { alert("Le motif de la suppression est obligatoire."); return; }
        if (!window.confirm(`Êtes-vous sûr de vouloir SUPPRIMER DÉFINITIVEMENT cette vente pour ${sale.clientName} ?\n\nMontant: ${money(sale.amount)}\nMotif: ${motif}\n\nCette action est irréversible.`)) return;
        setLoading(true);
        try {
            const res = await apiFetch(`/api/sales/${sale._id}`, { method: "DELETE", body: JSON.stringify({ motif: motif }) });
            const data = await res.json(); if (!res.ok) throw new Error(data.error || "Erreur suppression");
            alert("Vente supprimée avec succès."); onDeleteSuccess();
        } catch (e) { alert(e.message); } finally { setLoading(false); }
    };

    return (
        <div className="modal show d-block" style={{ backgroundColor: 'rgba(0,0,0,0.5)' }}>
            <div className="modal-dialog modal-dialog-centered">
                <div className="modal-content">
                    <form onSubmit={handleSubmit}>
                        <div className="modal-header bg-danger text-white"><h5 className="modal-title">Supprimer la Vente</h5><button type="button" className="btn-close btn-close-white" onClick={onClose} disabled={loading}></button></div>
                        <div className="modal-body">
                            <div className="alert alert-danger text-center"><i className="bi bi-exclamation-triangle-fill fs-4 me-2"></i>Vous êtes sur le point de **supprimer définitivement** cette vente.</div>
                            <ul className="list-group list-group-flush mb-3">
                                <li className="list-group-item d-flex justify-content-between"><strong>Client:</strong> {sale.clientName}</li>
                                <li className="list-group-item d-flex justify-content-between"><strong>Date:</strong> {formatDate(sale.date)}</li>
                                <li className="list-group-item d-flex justify-content-between"><strong>Montant:</strong> {money(sale.amount)}</li>
                            </ul>
                            <div className="mb-3">
                                <label htmlFor="motifDelete" className="form-label fw-semibold text-danger">Motif de la suppression (Obligatoire)</label>
                                <textarea id="motifDelete" className="form-control" rows="3" value={motif} onChange={(e) => setMotif(e.target.value)} required disabled={loading} placeholder="Ex: Erreur de saisie..."></textarea>
                            </div>
                        </div>
                        <div className="modal-footer">
                            <button type="button" className="btn btn-secondary" onClick={onClose} disabled={loading}>Annuler</button>
                            <button type="submit" className="btn btn-danger" disabled={loading || motif.trim() === ""}><i className={`bi ${loading ? "bi-hourglass-split" : "bi-trash-fill"} me-2`}></i>{loading ? "Suppression..." : "Confirmer"}</button>
                        </div>
                    </form>
                </div>
            </div>
        </div>
    );
}

// =====================================
// ADMIN/USER: Composants de Page
// =====================================

// NOUVEAU: Modale d'édition de client (Nom)
function EditClientModal({ clientName, onClose, onSaveSuccess }) {
    const [newName, setNewName] = useState(clientName);
    const [motif, setMotif] = useState("");
    const [loading, setLoading] = useState(false);

    const handleSubmit = async (e) => {
        e.preventDefault(); 
        if (motif.trim() === "") { alert("Le motif de la modification est obligatoire."); return; }
        // Vérifie si le nom a réellement changé
        if (newName.toUpperCase().replace(/\s/g, '') === clientName) { alert("Le nouveau nom est identique à l'ancien."); return; }
        setLoading(true);
        try {
            const newNameUpper = newName.toUpperCase().replace(/\s/g, '');
            if (!validateClientName(newNameUpper)) throw new Error("Le nouveau nom doit être en MAJUSCULES (A-Z, 0-9) sans espace/caractère spécial.");
            
            // Note: La route encode oldName car il peut contenir des caractères spéciaux si non normalisé initialement.
            const res = await apiFetch(`/api/clients-management/${encodeURIComponent(clientName)}`, { 
                method: "PATCH", 
                body: JSON.stringify({ newName: newNameUpper, motif }) 
            });
            const data = await res.json(); 
            if (!res.ok) throw new Error(data.error || "Erreur lors de la mise à jour du client");
            
            alert(`Client "${clientName}" renommé en "${newNameUpper}" avec succès.`); 
            onSaveSuccess();
        } catch (e) { 
            alert(e.message); 
        } finally { 
            setLoading(false); 
        }
    };

    return (
        <div className="modal show d-block" style={{ backgroundColor: 'rgba(0,0,0,0.5)' }}>
            <div className="modal-dialog modal-dialog-centered">
                <div className="modal-content">
                    <form onSubmit={handleSubmit}>
                        <div className="modal-header bg-warning text-dark"><h5 className="modal-title">Renommer le Client : {clientName}</h5><button type="button" className="btn-close" onClick={onClose} disabled={loading}></button></div>
                        <div className="modal-body">
                            <div className="mb-3">
                                <label className="form-label fw-semibold">Nouveau Nom (MAJUSCULES SANS ESPACE)</label>
                                <input className="form-control" value={newName} onChange={(e) => setNewName(e.target.value)} pattern="^[A-Z0-9]+$" title="Uniquement des lettres majuscules (A-Z) et des chiffres (0-9)." required disabled={loading} />
                            </div>
                            <div className="mb-3">
                                <label htmlFor="motifEditClient" className="form-label fw-semibold text-danger">Motif du Renommage (Obligatoire)</label>
                                <textarea id="motifEditClient" className="form-control" rows="3" value={motif} onChange={(e) => setMotif(e.target.value)} required disabled={loading} placeholder="Ex: Correction d'une faute de frappe, changement de raison sociale..."></textarea>
                            </div>
                        </div>
                        <div className="modal-footer">
                            <button type="button" className="btn btn-secondary" onClick={onClose} disabled={loading}>Annuler</button>
                            <button type="submit" className="btn btn-warning" disabled={loading || motif.trim() === "" || newName.toUpperCase().replace(/\s/g, '') === clientName}><i className={`bi ${loading ? "bi-hourglass-split" : "bi-check-circle-fill"} me-2`}></i>{loading ? "Sauvegarde..." : "Renommer le Client"}</button>
                        </div>
                    </form>
                </div>
            </div>
        </div>
    );
}

// NOUVEAU: Page de Gestion des Clients
function ClientManagementPage() {
    const [clients, setClients] = useState([]);
    const [loading, setLoading] = useState(true);
    const [clientToEditName, setClientToEditName] = useState(null); // Utilisé pour stocker le nom du client à renommer

    const loadClients = async () => {
        setLoading(true);
        try {
            // Utiliser la nouvelle route pour la liste complète avec les soldes
            const res = await apiFetch("/api/clients-management/balances");
            const data = await res.json();
            setClients(Array.isArray(data) ? data : []);
        } catch (e) {
            console.error("Erreur chargement clients management:", e);
            setClients([]);
        } finally {
            setLoading(false);
        }
    };

    useEffect(() => { loadClients(); }, []);

    const handleEditSuccess = () => {
        setClientToEditName(null); 
        loadClients(); // Recharger la liste après un renommage
        // Dispatch un événement pour recharger d'autres vues (comme les listes déroulantes de clients)
        window.dispatchEvent(new Event("reload-clients")); 
    };
    
    return (
        <div className="card border-0 shadow rounded-4 mb-4 bg-white">
            {clientToEditName && <EditClientModal clientName={clientToEditName} onClose={() => setClientToEditName(null)} onSaveSuccess={handleEditSuccess} />}
            <div className="card-header bg-dark text-white rounded-top-4 p-3 d-flex align-items-center">
                <i className="bi bi-people-fill me-2 fs-5"></i>
                <h5 className="m-0">Gestion & Historique des Clients</h5>
            </div>
            <div className="card-body p-4">
                <p className="text-muted">Liste de tous les clients ayant effectué au moins une opération, avec leur solde actuel.</p>

                <div className="table-responsive">
                    <table className="table align-middle table-hover">
                        <thead className="table-dark">
                            <tr>
                                <th>Client</th>
                                <th>Dette Totale</th>
                                <th>Crédit Total</th>
                                <th>Solde Net</th>
                                <th style={{ width: 100 }}>Actions</th>
                            </tr>
                        </thead>
                        <tbody>
                            {loading && <tr><td colSpan="5" className="text-center py-4 text-muted"><i className="bi bi-arrow-clockwise spin me-2"></i>Chargement...</td></tr>}
                            {!loading && clients.length === 0 && <tr><td colSpan="5" className="text-center py-4 text-muted">Aucun client trouvé.</td></tr>}
                            {clients.map(client => {
                                const netBalance = client.totalDebt - client.totalCredit;
                                return (
                                    <tr key={client.clientName} className={netBalance > 0 ? 'table-danger-subtle' : (netBalance < 0 ? 'table-success-subtle' : '')}>
                                        <td className="fw-semibold">{client.clientName}</td>
                                        <td className="text-danger">{money(client.totalDebt)}</td>
                                        <td className="text-success">{money(client.totalCredit)}</td>
                                        <td className={`fw-bold ${netBalance > 0 ? 'text-danger' : (netBalance < 0 ? 'text-success' : 'text-dark')}`}>
                                            {money(Math.abs(netBalance))} {netBalance < 0 && <span className="small">(Crédit)</span>}
                                        </td>
                                        <td>
                                            <button className="btn btn-sm btn-outline-warning rounded-circle" title="Renommer le client" onClick={() => setClientToEditName(client.clientName)}>
                                                <i className="bi bi-pencil-fill"></i>
                                            </button>
                                        </td>
                                    </tr>
                                );
                            })}
                        </tbody>
                    </table>
                </div>
                
                <div className="alert alert-info small mt-4">
                    **Note :** L'ajout de clients se fait automatiquement par l'enregistrement d'une nouvelle vente. L'action ici permet de renommer un client existant, ce qui met à jour l'historique complet des ventes de ce client.
                </div>
            </div>
        </div>
    );
}


function SalesTable({ clientName, startDate, endDate, loading, setLoading }) {
  const [sales, setSales] = useState([]);
  const [filterType, setFilterType] = useState("");
  const [searchClient, setSearchClient] = useState(""); 
  const [openRow, setOpenRow] = useState(null);
  const [actionType, setActionType] = useState("");
  const [actionValue, setActionValue] = useState("");
  const [modalSale, setModalSale] = useState(null);
  const [saleToEdit, setSaleToEdit] = useState(null);
  const [saleToDelete, setSaleToDelete] = useState(null);

  const load = async () => {
    setLoading(true); await new Promise(resolve => setTimeout(resolve, 100)); 
    const qs = new URLSearchParams();
    if (filterType) qs.set("fishType", filterType);
    if (clientName || searchClient) qs.set("client", clientName || searchClient);
    if (startDate) qs.set("startDate", startDate); if (endDate) qs.set("endDate", endDate);
    const res = await apiFetch(`/api/sales?${qs.toString()}`);
    const data = await res.json(); setSales(Array.isArray(data) ? data : []);
    setLoading(false);
  };
  useEffect(() => { load(); }, [filterType, clientName, searchClient, startDate, endDate]);

  const toggleAction = (id, type, suggested) => {
    if (openRow === id && actionType === type) { setOpenRow(null); setActionType(""); setActionValue(""); } 
    else { setOpenRow(id); setActionType(type); setActionValue(suggested ?? ""); }
  };

  const handleActionSuccess = () => {
    setModalSale(null); setSaleToEdit(null); setSaleToDelete(null);
    window.dispatchEvent(new Event("reload-sales")); 
  };

  const submitAction = async (sale) => {
    try {
      if (actionType === "deliver") {
        const qty = Number(actionValue || 0); if (qty <= 0) throw new Error("Quantité invalide.");
        const remainingToDeliver = Math.max(0, sale.quantity - (sale.delivered || 0));
        if (qty > remainingToDeliver) throw new Error(`La quantité (${qty} kg) dépasse le reste (${remainingToDeliver} kg).`);
        const res = await apiFetch(`/api/sales/${sale._id}/deliver`, { method: "PATCH", body: JSON.stringify({ qty }) });
        const data = await res.json(); if (!res.ok) throw new Error(data.error || "Erreur");
        setSales((prev) => prev.map((s) => (s._id === sale._id ? data : s)));
      } else if (actionType === "pay") {
        const amount = Number(actionValue || 0); if (amount <= 0) throw new Error("Montant invalide.");
        const res = await apiFetch(`/api/sales/${sale._id}/pay`, { method: "PATCH", body: JSON.stringify({ amount }) });
        const data = await res.json(); if (!res.ok) throw new Error(data.error || "Erreur");
        setSales((prev) => prev.map((s) => (s._id === sale._id ? data : s)));
        window.dispatchEvent(new Event("reload-sales")); 
      } 
      setOpenRow(null); setActionType(""); setActionValue("");
    } catch (e) { alert(e.message); }
  };

  const settleAll = async (id) => {
    if (!window.confirm("Solder totalement cette vente ?")) return;
    const res = await apiFetch(`/api/sales/${id}/settle`, { method: "PATCH" });
    const data = await res.json(); if (!res.ok) return alert(data.error || "Erreur");
    setSales((prev) => prev.map((s) => (s._id === id ? data : s)));
    window.dispatchEvent(new Event("reload-sales"));
  };

  const exportExcel = async () => {
    try {
      const res = await apiFetch("/api/exports/sales.xlsx", { method: "GET" });
      if (!res.ok) throw new Error("Export impossible");
      const blob = await res.blob(); const url = window.URL.createObjectURL(blob);
      const a = document.createElement("a"); a.href = url; a.download = "historique_ventes.xlsx";
      document.body.appendChild(a); a.click(); a.remove(); window.URL.revokeObjectURL(url);
    } catch (e) { alert(e.message); }
  };

  return (
    <div className="card border-0 shadow rounded-4 bg-white">
      {modalSale && <CreditUseModal sale={modalSale} onClose={() => setModalSale(null)} onRefundSuccess={handleActionSuccess} onNewSaleSuccess={handleActionSuccess} onManualCompensationSuccess={handleActionSuccess} />}
      {saleToEdit && <EditSaleModal sale={saleToEdit} onClose={() => setSaleToEdit(null)} onSaveSuccess={handleActionSuccess} />}
      {saleToDelete && <DeleteMotifModal sale={saleToDelete} onClose={() => setSaleToDelete(null)} onDeleteSuccess={handleActionSuccess} />}
      
      <div className="card-body p-4">
        <div className="d-flex flex-wrap gap-3 align-items-center mb-4 p-3 bg-light rounded-3 border">
          <h5 className="m-0 text-dark"><i className="bi bi-table me-2"></i> Historique des Opérations</h5>
          <div className="ms-auto d-flex gap-2 w-100 w-md-auto">
            <div className="input-group"><span className="input-group-text"><i className="bi bi-search"></i></span><input className="form-control" placeholder="Rechercher client..." value={clientName || searchClient} onChange={(e) => setSearchClient(e.target.value)} disabled={!!clientName} /></div>
            <select className="form-select" value={filterType} onChange={(e) => setFilterType(e.target.value)}><option value="">Tous les poissons</option><option value="tilapia">Tilapia</option><option value="pangasius">Pangasius</option></select>
            <button className="btn btn-outline-success rounded-pill" onClick={exportExcel}><i className="bi bi-file-earmark-excel me-1"></i> Exporter</button>
          </div>
        </div>
        <div className="table-responsive">
          <table className="table align-middle table-hover border-light">
            <thead className="table-dark"><tr><th>Date</th><th>Client</th><th>Poisson</th><th>Qté (Kg)</th><th>Livré (Kg)</th><th>Reste (Kg)</th><th>PU</th><th>Montant</th><th>Payé</th><th>Solde</th><th>Statut</th><th style={{ width: 300 }}>Actions</th></tr></thead>
            <tbody>
              {loading && <tr><td colSpan="12" className="text-center py-4 text-muted"><i className="bi bi-arrow-clockwise spin me-2"></i>Chargement...</td></tr>}
              {!loading && sales.length === 0 && <tr><td colSpan="12" className="text-center py-4 text-muted">Aucune vente enregistrée.</td></tr>}
              {sales.map((s) => {
                const remainingToDeliver = Math.max(0, s.quantity - (s.delivered || 0)); const balance = s.balance || 0; const remainingToPay = Math.max(0, balance); 
                let rowClass = ""; if (balance > 0) rowClass = "table-danger-subtle border-start border-danger border-4"; if (balance < 0) rowClass = "table-success-subtle border-start border-success border-4";
                return (
                  <React.Fragment key={s._id}>
                    <tr className={rowClass}>
                      <td>{formatDate(s.date)}</td><td className="fw-semibold">{s.clientName}</td><td><BadgeFish type={s.fishType} /></td>
                      <td>{s.quantity}</td><td>{s.delivered || 0}</td><td className={remainingToDeliver > 0 ? "text-warning fw-bold" : ""}>{remainingToDeliver}</td>
                      <td>{money(s.unitPrice)}</td><td>{money(s.amount)}</td><td>{money(s.payment)}</td>
                      <td className={balance > 0 ? "text-danger fw-bold" : (balance < 0 ? "text-success fw-bold" : "")}>{money(Math.abs(balance))}{balance < 0 && <span className="small text-success"> (Crédit)</span>}</td>
                      <td>{s.settled ? <span className="badge text-bg-success"><i className="bi bi-check-circle-fill"></i> Soldé</span> : <span className="badge text-bg-warning text-dark"><i className="bi bi-clock-history"></i> Non soldé</span>}</td>
                      <td>
                        <div className="d-flex flex-wrap gap-2">
                          {remainingToDeliver > 0 && (<button className="btn btn-sm btn-primary rounded-pill" onClick={() => toggleAction(s._id, "deliver", remainingToDeliver)}><i className="bi bi-truck"></i> Livrer</button>)}
                          <button className="btn btn-sm btn-secondary rounded-pill" onClick={() => toggleAction(s._id, "pay", remainingToPay)} disabled={s.settled && balance >= 0}><i className="bi bi-wallet"></i> Régler</button>
                          {balance < 0 && (<button className="btn btn-sm btn-success rounded-pill" onClick={() => setModalSale(s)}><i className="bi bi-arrow-left-right"></i> Crédit</button>)}
                          {balance > 0 && (<button className="btn btn-sm btn-outline-success rounded-circle" title="Solder toute la dette" onClick={() => settleAll(s._id)}><i className="bi bi-currency-dollar"></i></button>)}
                          <button className="btn btn-sm btn-outline-warning rounded-circle" title="Modifier la vente" onClick={() => setSaleToEdit(s)}><i className="bi bi-pencil-fill"></i></button>
                          <button className="btn btn-sm btn-outline-danger rounded-circle" title="Supprimer la vente" onClick={() => setSaleToDelete(s)}><i className="bi bi-trash-fill"></i></button>
                        </div>
                      </td>
                    </tr>
                    {openRow === s._id && (
                      <tr><td colSpan="12">
                          <div className="bg-light p-3 rounded-3 border border-secondary">
                            {actionType === "deliver" ? (
                              <div className="d-flex align-items-center gap-3 flex-wrap">
                                <div className="small text-muted">Action : Livraison (Reste: {remainingToDeliver} kg)</div>
                                <div className="input-group" style={{ maxWidth: 350 }}><span className="input-group-text">Qté à livrer</span><input type="number" min="0" step="0.01" className="form-control" value={actionValue} onChange={(e) => setActionValue(e.target.value)} /><button className="btn btn-outline-primary" onClick={() => setActionValue(remainingToDeliver)}>Max</button></div>
                                <button className="btn btn-primary" onClick={() => submitAction(s)}>Valider</button><button className="btn btn-link text-danger" onClick={() => { setOpenRow(null); setActionType(""); }}>Annuler</button>
                              </div>
                            ) : actionType === "pay" ? (
                              <div className="d-flex align-items-center gap-3 flex-wrap">
                                <div className="small text-muted">Action : Règlement (Solde dû: {money(remainingToPay)})</div>
                                <div className="input-group" style={{ maxWidth: 350 }}><span className="input-group-text">Montant</span><input type="number" min="0" step="0.01" className="form-control" value={actionValue} onChange={(e) => setActionValue(e.target.value)} />{remainingToPay > 0 && (<button className="btn btn-outline-secondary" onClick={() => setActionValue(remainingToPay)}>Max</button>)}</div>
                                <button className="btn btn-secondary" onClick={() => submitAction(s)}>Valider</button><button className="btn btn-link text-danger" onClick={() => { setOpenRow(null); setActionType(""); }}>Annuler</button>
                              </div>
                            ) : null} 
                          </div>
                      </td></tr>
                    )}
                  </React.Fragment>
                );
              })}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}

function ReloadableSalesTableWrapper({ clientName, startDate, endDate, loading, setLoading }) {
  const [key, setKey] = useState(0); 
  useEffect(() => { const handler = () => setKey((k) => k + 1); window.addEventListener("reload-sales", handler); return () => window.removeEventListener("reload-sales", handler); }, []);
  return <SalesTable key={key} clientName={clientName} startDate={startDate} endDate={endDate} loading={loading} setLoading={setLoading} />;
}

function ReloadableSalesTable() {
  const [key, setKey] = useState(0); 
  const [loading, setLoading] = useState(false);
  useEffect(() => { const handler = () => setKey((k) => k + 1); window.addEventListener("reload-sales", handler); return () => window.removeEventListener("reload-sales", handler); }, []);
  return <SalesTable key={key} clientName={""} startDate={""} endDate={""} loading={loading} setLoading={setLoading} />;
}

function ChartsPanel({ sales, loading }) { 
  const chartReady = useChartJs();
  const salesRef = useRef(null); const debtsRef = useRef(null); const typeRef = useRef(null);
  const salesChart = useRef(null); const debtsChart = useRef(null); const typeChart = useRef(null);
  const data = useMemo(() => {
    const monthlyMap = new Map(); let tilapiaAmount = 0; let pangasiusAmount = 0;
    sales.forEach((s) => {
      const d = new Date(s.date); const k = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}`;
      const curr = monthlyMap.get(k) || { amount: 0, balance: 0 };
      curr.amount += Number(s.amount || 0); curr.balance += Math.max(0, Number(s.balance || 0)); 
      monthlyMap.set(k, curr);
      if (s.fishType === "tilapia") tilapiaAmount += Number(s.amount || 0);
      if (s.fishType === "pangasius") pangasiusAmount += Number(s.amount || 0);
    });
    const labels = Array.from(monthlyMap.keys()).sort(); const amounts = labels.map((k) => monthlyMap.get(k).amount);
    const balances = labels.map((k) => monthlyMap.get(k).balance);
    return { labels, amounts, balances, tilapiaAmount, pangasiusAmount };
  }, [sales]);
  useEffect(() => {
    if (!chartReady || sales.length === 0) { [salesChart, debtsChart, typeChart].forEach((chart) => chart.current?.destroy?.()); return; };
    const Chart = window.Chart; [salesChart, debtsChart, typeChart].forEach((chart) => chart.current?.destroy?.());
    salesChart.current = new Chart(salesRef.current, { type: "bar", data: { labels: data.labels, datasets: [{ label: "Ventes (XOF)", data: data.amounts, backgroundColor: "rgba(0, 123, 255, 0.8)", borderRadius: 5, barThickness: "flex", maxBarThickness: 50, }], }, options: { responsive: true, maintainAspectRatio: false, scales: { y: { beginAtZero: true } } }, });
    debtsChart.current = new Chart(debtsRef.current, { type: "line", data: { labels: data.labels, datasets: [{ label: "Dettes (Solde XOF)", data: data.balances, borderColor: "rgb(220, 53, 69)", backgroundColor: "rgba(220, 53, 69, 0.1)", fill: true, tension: 0.4, pointRadius: 3, }], }, options: { responsive: true, maintainAspectRatio: false, scales: { y: { beginAtZero: true } } }, });
    typeChart.current = new Chart(typeRef.current, { type: "doughnut", data: { labels: ["Tilapia", "Pangasius"], datasets: [{ data: [data.tilapiaAmount, data.pangasiusAmount], backgroundColor: ["#007bff", "#198754"], hoverOffset: 4 }], }, options: { responsive: true, maintainAspectRatio: false, plugins: { legend: { position: "bottom" } } }, });
    return () => { [salesChart, debtsChart, typeChart].forEach((chart) => chart.current?.destroy?.()); };
  }, [chartReady, data, sales]); 
  if (loading || sales.length === 0) {
      return (<div className="row g-4 mb-4"><div className="col-lg-6 col-xl-4"><div className="card border-0 shadow-sm rounded-4 h-100 p-5 text-center text-muted">Aucune donnée de vente.</div></div><div className="col-lg-6 col-xl-4"><div className="card border-0 shadow-sm rounded-4 h-100 p-5 text-center text-muted">Aucune donnée de vente.</div></div><div className="col-lg-12 col-xl-4"><div className="card border-0 shadow-sm rounded-4 h-100 p-5 text-center text-muted">Aucune donnée de vente.</div></div></div>);
  }
  return (
    <div className="row g-4 mb-4">
      <div className="col-lg-6 col-xl-4"><div className="card border-0 shadow-sm rounded-4 h-100"><div className="card-body"><h5 className="fw-bold text-dark mb-3"><i className="bi bi-bar-chart-fill me-2 text-primary"></i>Volume des Ventes</h5><div style={{ height: 300 }} className="chart-container">{!chartReady ? <div className="text-muted small text-center pt-5">Chargement...</div> : <canvas ref={salesRef} />}</div></div></div></div>
      <div className="col-lg-6 col-xl-4"><div className="card border-0 shadow-sm rounded-4 h-100"><div className="card-body"><h5 className="fw-bold text-dark mb-3"><i className="bi bi-file-earmark-bar-graph-fill me-2 text-danger"></i>Évolution des Dettes</h5><div style={{ height: 300 }} className="chart-container">{!chartReady ? <div className="text-muted small text-center pt-5">Chargement...</div> : <canvas ref={debtsRef} />}</div></div></div></div>
      <div className="col-lg-12 col-xl-4"><div className="card border-0 shadow-sm rounded-4 h-100"><div className="card-body"><h5 className="fw-bold text-dark mb-3"><i className="bi bi-pie-chart-fill me-2 text-info"></i>Ventes par Espèce</h5><div style={{ height: 300 }} className="d-flex align-items-center justify-content-center chart-container">{!chartReady ? <div className="text-muted small">Chargement...</div> : <canvas ref={typeRef} style={{ maxHeight: "250px" }} />}</div></div></div></div>
    </div>
  );
}

function DueNotificationsPanel({ sales, loading }) { 
  const [thresholdDays, setThresholdDays] = useState(Number(localStorage.getItem("due_threshold_days") || 30));
  const [perm, setPerm] = useState(typeof Notification !== "undefined" ? Notification?.permission : "default");
  useEffect(() => { localStorage.setItem("due_threshold_days", String(thresholdDays)); }, [thresholdDays]);
  const overdue = useMemo(() => {
    if (loading || sales.length === 0) return []; const now = Date.now(); const cut = thresholdDays * 24 * 3600 * 1000;
    return sales.filter((s) => Number(s.balance || 0) > 0 && now - new Date(s.date).getTime() > cut).map((s) => ({ id: s._id, client: s.clientName, date: new Date(s.date), balance: s.balance, days: Math.floor((now - new Date(s.date).getTime()) / (24 * 3600 * 1000)) })).sort((a, b) => b.days - a.days);
  }, [sales, thresholdDays, loading]); 
  const askPerm = async () => { if (typeof window === "undefined" || !("Notification" in window)) { alert("Notifications non supportées."); return; } const p = await Notification.requestPermission(); setPerm(p); };
  const notifyNow = () => { if (perm !== "granted" || overdue.length === 0) return; const top = overdue.slice(0, 3); const body = top.map((o) => `${o.client}: ${money(o.balance)} (${o.days} j)`).join("\n"); new Notification("Dettes en retard", { body }); };
  if (loading && sales.length === 0) return <div className="card border-0 shadow rounded-4 mb-4 bg-white"><div className="card-body p-4"><div className="text-center py-3 text-muted">Chargement des alertes...</div></div></div>;
  return (
    <div className="card border-0 shadow rounded-4 mb-4 bg-white">
      <div className="card-body p-4">
        <div className="d-flex align-items-center mb-4 pb-2 border-bottom flex-wrap gap-3">
          <h5 className="m-0 fw-bold"><i className="bi bi-bell-fill me-2 text-warning"></i>Clients en Retard (Alerte)</h5>
          <div className="ms-auto d-flex gap-3 align-items-center">
            <div className="input-group input-group-sm" style={{ width: 200 }}><span className="input-group-text small">Retard ≥</span><input type="number" className="form-control" min="1" value={thresholdDays} onChange={(e) => setThresholdDays(Number(e.target.value) || 1)} /><span className="input-group-text small">jours</span></div>
            {perm !== "granted" ? <button className="btn btn-warning btn-sm rounded-pill" onClick={askPerm}>Activer</button> : <button className="btn btn-outline-secondary btn-sm rounded-pill" onClick={notifyNow}>Tester</button>}
          </div>
        </div>
        <div className="table-responsive"><table className="table align-middle table-striped"><thead className="table-light"><tr><th>Client</th><th>Date Opération</th><th>Jours Retard</th><th>Solde Dû</th></tr></thead>
            <tbody>
              {overdue.length === 0 && <tr><td colSpan="4" className="text-center py-3 text-muted">🎉 Aucune dette n'a dépassé le seuil de {thresholdDays} jours.</td></tr>}
              {overdue.map((o) => (<tr key={o.id} className="table-warning-subtle"><td className="fw-bold">{o.client}</td><td>{o.date.toISOString().slice(0, 10)}</td><td className="text-danger fw-bold">{o.days}</td><td className="text-danger fw-bolder">{money(o.balance)}</td></tr>))}
            </tbody>
        </table></div>
      </div>
    </div>
  );
}

function SummaryCards({ sum, loading }) {
  if (loading || !sum) {
      const CardLoading = ({ title, iconClass, cardClass }) => (<div className="col-12 col-md-3"><div className={`card border-0 shadow-sm rounded-4 ${cardClass} h-100`}><div className="card-body d-flex align-items-center p-4"><div className="me-3 p-3 rounded-circle bg-opacity-25 bg-white d-flex align-items-center justify-content-center" style={{ width: 60, height: 60 }}><i className={`bi ${iconClass} fs-3`}></i></div><div><div className="text-uppercase small opacity-75">{title}</div><div className="h3 m-0 fw-bold">{loading ? <i className="bi bi-arrow-clockwise spin small"></i> : money(0)}</div></div></div></div></div>);
      return (<div className="row g-4 mb-5"><CardLoading title="Total Ventes" iconClass="bi-graph-up-arrow text-primary" cardClass="bg-primary text-white bg-opacity-75" /><CardLoading title="Total Encaissé" iconClass="bi-check-circle-fill text-success" cardClass="bg-success text-white bg-opacity-75" /><CardLoading title="Dettes Clients" iconClass="bi-currency-exchange text-danger" cardClass="bg-danger text-white bg-opacity-75" /><CardLoading title="Crédits Dûs" iconClass="bi-arrow-down-circle-fill text-info" cardClass="bg-info text-white bg-opacity-75" /><div className="col-12 col-md-6"><div className="card border-0 shadow-sm rounded-4 h-100 bg-white"><div className="card-body text-center text-muted">Détail Tilapia (0 XOF)</div></div></div><div className="col-12 col-md-6"><div className="card border-0 shadow-sm rounded-4 h-100 bg-white"><div className="card-body text-center text-muted">Détail Pangasius (0 XOF)</div></div></div></div>);
  }
  const byTilapia = sum.byFish?.find((f) => f.fishType === "tilapia") || { amount: 0, payment: 0, balance: 0 };
  const byPanga = sum.byFish?.find((f) => f.fishType === "pangasius") || { amount: 0, payment: 0, balance: 0 };
  const totalDebt = sum.totalDebt || 0; const totalCredit = sum.totalCredit || 0; 
  const Card = ({ title, amount, iconClass, cardClass }) => (<div className="col-12 col-md-3"><div className={`card border-0 shadow-sm rounded-4 ${cardClass} h-100`}><div className="card-body d-flex align-items-center p-4"><div className="me-3 p-3 rounded-circle bg-opacity-25 bg-white d-flex align-items-center justify-content-center" style={{ width: 60, height: 60 }}><i className={`bi ${iconClass} fs-3`}></i></div><div><div className="text-uppercase small opacity-75">{title}</div><div className="h3 m-0 fw-bold">{money(amount)}</div></div></div></div></div>);
  return (
    <div className="row g-4 mb-5">
      <Card title="Total Ventes" amount={sum.totalAmount} iconClass="bi-graph-up-arrow text-primary" cardClass="bg-primary text-white bg-opacity-75" />
      <Card title="Total Encaissé" amount={sum.totalPayment} iconClass="bi-check-circle-fill text-success" cardClass="bg-success text-white bg-opacity-75" />
      <Card title="Dettes Clients (Actuelles)" amount={totalDebt} iconClass="bi-currency-exchange text-danger" cardClass="bg-danger text-white bg-opacity-75" />
      <Card title="Crédits Dûs (Entreprise)" amount={totalCredit} iconClass="bi-arrow-down-circle-fill text-info" cardClass="bg-info text-white bg-opacity-75" />
      <div className="col-12 col-md-6"><div className="card border-0 shadow-sm rounded-4 h-100 bg-white"><div className="card-body"><div className="d-flex justify-content-between align-items-center"><h6 className="m-0 fw-bold">Détail Tilapia</h6><BadgeFish type="tilapia" /></div><hr /><div className="row small text-muted"><div className="col-4">Ventes: <br /><strong className="text-primary">{money(byTilapia.amount)}</strong></div><div className="col-4">Payé: <br /><strong className="text-success">{money(byTilapia.payment)}</strong></div><div className="col-4">{byTilapia.balance >= 0 ? "Solde Net:" : "Crédit Net:"} <br /><strong className={byTilapia.balance >= 0 ? "text-danger" : "text-success"}>{money(Math.abs(byTilapia.balance))}</strong></div></div></div></div></div>
      <div className="col-12 col-md-6"><div className="card border-0 shadow-sm rounded-4 h-100 bg-white"><div className="card-body"><div className="d-flex justify-content-between align-items-center"><h6 className="m-0 fw-bold">Pangasius</h6><BadgeFish type="pangasius" /></div><hr /><div className="row small text-muted"><div className="col-4">Ventes: <br /><strong className="text-primary">{money(byPanga.amount)}</strong></div><div className="col-4">Payé: <br /><strong className="text-success">{money(byPanga.payment)}</strong></div><div className="col-4">{byPanga.balance >= 0 ? "Solde Net:" : "Crédit Net:"} <br /><strong className={byPanga.balance >= 0 ? "text-danger" : "text-success"}>{money(Math.abs(byPanga.balance))}</strong></div></div></div></div></div>
    </div>
  );
}

function DebtsBoard({ clientName, loading }) {
  const [debts, setDebts] = useState([]);
  const loadDebts = useMemo(() => async () => { const res = await apiFetch("/api/dashboard/debts"); const data = await res.json(); setDebts(Array.isArray(data) ? data : []); }, []); 
  useEffect(() => { loadDebts(); const handler = () => loadDebts(); window.addEventListener("reload-sales", handler); return () => window.removeEventListener("reload-sales", handler); }, [loadDebts]); 
  const total = debts.reduce((sum, d) => sum + d.totalDebt, 0);
  if (clientName === undefined) {
      if (loading) return <div className="card border-0 shadow rounded-4 bg-white"><div className="card-body p-4"><div className="d-flex align-items-center mb-4 pb-2 border-bottom"><h5 className="m-0 fw-bold"><i className="bi bi-person-lines-fill me-2 text-danger"></i>Top Dettes Clients</h5><span className="ms-auto badge text-bg-danger p-2 fs-6">Total: {money(0)}</span></div><div className="text-center py-5 text-muted"><i className="bi bi-arrow-clockwise spin me-2"></i></div></div></div>;
      return <div className="card border-0 shadow rounded-4 bg-white"><div className="card-body p-4"><div className="d-flex align-items-center mb-4 pb-2 border-bottom"><h5 className="m-0 fw-bold"><i className="bi bi-person-lines-fill me-2 text-danger"></i>Top Dettes Clients</h5><span className="ms-auto badge text-bg-danger p-2 fs-6">Total: {money(0)}</span></div><div className="text-center py-5 text-muted">Sélectionnez un filtre.</div></div></div>;
  }
  return (
    <div className="card border-0 shadow rounded-4 bg-white"><div className="card-body p-4"><div className="d-flex align-items-center mb-4 pb-2 border-bottom"><h5 className="m-0 fw-bold"><i className="bi bi-person-lines-fill me-2 text-danger"></i>Top Dettes Clients</h5><span className="ms-auto badge text-bg-danger p-2 fs-6">Encours Total: {money(total)}</span></div><div className="table-responsive" style={{ maxHeight: 300, overflowY: "auto" }}><table className="table align-middle table-sm table-hover"><thead><tr className="table-light"><th>Client</th><th># Opé.</th><th>Dette</th></tr></thead><tbody>
      {debts.length === 0 && (<tr><td colSpan="3" className="text-center py-3 text-muted">Aucune dette.</td></tr>)}
      {debts.map((d) => (<tr key={d.clientName}><td className="fw-semibold">{d.clientName}</td><td className="small text-muted">{d.count}</td><td className="text-danger fw-bolder">{money(d.totalDebt)}</td></tr>))}
    </tbody></table></div></div></div>
  );
}

function CreditsBoard({ clientName, loading }) {
  const [credits, setCredits] = useState([]);
  const loadCredits = useMemo(() => async () => { const res = await apiFetch("/api/dashboard/credits"); const data = await res.json(); setCredits(Array.isArray(data) ? data : []); }, []);
  useEffect(() => { loadCredits(); const handler = () => loadCredits(); window.addEventListener("reload-sales", handler); return () => window.removeEventListener("reload-sales", handler); }, [loadCredits]); 
  const total = credits.reduce((sum, d) => sum + d.totalCredit, 0);
  if (clientName === undefined) {
      if (loading) return <div className="card border-0 shadow rounded-4 bg-white"><div className="card-body p-4"><div className="d-flex align-items-center mb-4 pb-2 border-bottom"><h5 className="m-0 fw-bold"><i className="bi bi-person-check-fill me-2 text-success"></i>Crédits Clients</h5><span className="ms-auto badge text-bg-success p-2 fs-6">Total: {money(0)}</span></div><div className="text-center py-5 text-muted"><i className="bi bi-arrow-clockwise spin me-2"></i></div></div></div>;
      return <div className="card border-0 shadow rounded-4 bg-white"><div className="card-body p-4"><div className="d-flex align-items-center mb-4 pb-2 border-bottom"><h5 className="m-0 fw-bold"><i className="bi bi-person-check-fill me-2 text-success"></i>Crédits Clients</h5><span className="ms-auto badge text-bg-success p-2 fs-6">Total: {money(0)}</span></div><div className="text-center py-5 text-muted">Sélectionnez un filtre.</div></div></div>;
  }
  return (
    <div className="card border-0 shadow rounded-4 bg-white"><div className="card-body p-4"><div className="d-flex align-items-center mb-4 pb-2 border-bottom"><h5 className="m-0 fw-bold"><i className="bi bi-person-check-fill me-2 text-success"></i>Crédits Clients (Dû)</h5><span className="ms-auto badge text-bg-success p-2 fs-6">Crédit Total: {money(total)}</span></div><div className="table-responsive" style={{ maxHeight: 300, overflowY: "auto" }}><table className="table align-middle table-sm table-hover"><thead><tr className="table-light"><th>Client</th><th># Opé.</th><th>Crédit</th></tr></thead><tbody>
      {credits.length === 0 && (<tr><td colSpan="3" className="text-center py-3 text-muted">Aucun crédit.</td></tr>)}
      {credits.map((d) => (<tr key={d.clientName}><td className="fw-semibold">{d.clientName}</td><td className="small text-muted">{d.count}</td><td className="text-success fw-bolder">{money(d.totalCredit)}</td></tr>))}
    </tbody></table></div></div></div>
  );
}

function ClientReportPage() {
  const clients = useClients();
  const [selectedClient, setSelectedClient] = useState("all");
  const [loading, setLoading] = useState(false);
  
  useEffect(() => { 
    // Mettre à jour la liste des clients si useClients revient avec des données
    // L'implémentation de useClients semble déjà le faire
  }, [clients]);

  const exportReport = async () => {
    setLoading(true);
    try {
      const clientParam = selectedClient !== "all" ? `?clientName=${encodeURIComponent(selectedClient)}` : '';
      const res = await apiFetch(`/api/exports/client-report.xlsx${clientParam}`, { method: "GET" });
      if (!res.ok) throw new Error("Export impossible");
      const blob = await res.blob(); const url = window.URL.createObjectURL(blob); const a = document.createElement("a");
      a.href = url; const filename = selectedClient !== "all" ? `bilan_${selectedClient.replace(/\s/g, '_')}_${new Date().toISOString().slice(0,10)}.xlsx` : `bilan_global_${new Date().toISOString().slice(0,10)}.xlsx`;
      a.download = filename; document.body.appendChild(a); a.click(); a.remove(); window.URL.revokeObjectURL(url);
    } catch (e) { alert(e.message); } finally { setLoading(false); }
  };
  
  return (
    <div className="card border-0 shadow rounded-4 mb-4 bg-white">
      <div className="card-header bg-dark text-white rounded-top-4 p-3 d-flex align-items-center"><i className="bi bi-file-earmark-bar-graph-fill me-2 fs-5"></i><h5 className="m-0">Bilan Financier Client / Export</h5> </div>
      <div className="card-body p-4">
        <p className="text-muted">Sélectionnez un client pour exporter son historique complet, ou 'Tous les clients' pour un export global.</p>
        <div className="d-flex flex-wrap gap-3 align-items-center mt-4">
          <label className="form-label small fw-semibold m-0">Client à Exporter :</label>
          <select className="form-select" style={{ maxWidth: 300 }} value={selectedClient} onChange={(e) => setSelectedClient(e.target.value)} disabled={loading}>
            <option value="all">Tous les clients</option>{clients.map(client => <option key={client} value={client}>{client}</option>)}
          </select>
          <button className="btn btn-primary btn-lg rounded-pill ms-auto" onClick={exportReport} disabled={loading || (selectedClient !== 'all' && clients.length === 0)}><i className={`bi ${loading ? "bi-hourglass-split" : "bi-file-earmark-spreadsheet-fill"} me-2`}></i>{loading ? "Préparation..." : "Exporter Bilan Excel"}</button>
        </div>
      </div>
    </div>
  );
}

function SalesBalancePage() {
  const [sum, setSum] = useState(null); 
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const loadSummary = async () => {
      setLoading(true);
      try { 
        const res = await apiFetch("/api/summary?isGlobal=true"); 
        const data = await res.json(); 
        setSum(data); 
      } 
      catch (e) { 
        console.error("Erreur chargement bilan:", e); 
        setSum(null); 
      } finally { 
        setLoading(false); 
      }
    };
    loadSummary(); 
    const handler = () => loadSummary(); 
    window.addEventListener("reload-sales", handler); 
    return () => window.removeEventListener("reload-sales", handler);
  }, []);

  // NOUVEAU: Fonction pour l'export des soldes clients
  const exportClientBalances = async () => {
    try {
      setLoading(true); // Optionnel, pour indiquer un chargement
      const res = await apiFetch("/api/exports/client-balances.xlsx", { method: "GET" });
      
      if (!res.ok) {
        const errorText = await res.text();
        throw new Error(`Export impossible. Erreur: ${errorText}`);
      }
      
      const blob = await res.blob();
      const url = window.URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      // Utilisez un nom de fichier plus spécifique
      a.download = `bilan_solde_clients_${new Date().toISOString().slice(0,10)}.xlsx`;
      document.body.appendChild(a); 
      a.click(); 
      a.remove();
      window.URL.revokeObjectURL(url);
      alert("Fichier 'bilan_solde_clients.xlsx' exporté avec succès !");

    } catch (e) {
      alert("Erreur lors de l'export du bilan des soldes: " + e.message);
    } finally {
        setLoading(false);
    }
  };


  if (loading && !sum) return <div className="text-center py-5 text-muted"><i className="bi bi-arrow-clockwise spin me-2"></i>Chargement du Bilan Global...</div>;
  
  const totalDebt = sum?.totalDebt || 0; 
  const totalCredit = sum?.totalCredit || 0;

  const byTilapia = sum?.byFish?.find((f) => f.fishType === "tilapia") || { amount: 0, payment: 0, balance: 0 };
  const byPanga = sum?.byFish?.find((f) => f.fishType === "pangasius") || { amount: 0, payment: 0, balance: 0 };
  
  return (
    <div className="card border-0 shadow rounded-4 mb-4 bg-white">
      <div className="card-header bg-dark text-white rounded-top-4 p-3 d-flex align-items-center">
        <i className="bi bi-file-earmark-spreadsheet-fill me-2 fs-5"></i>
        <h5 className="m-0">Bilan Financier Global de l'Entreprise</h5>
        
        {/* NOUVEAU BOUTON D'EXPORT */}
        <button 
            className="btn btn-primary rounded-pill ms-auto" 
            onClick={exportClientBalances} 
            disabled={loading}
        >
            <i className="bi bi-file-earmark-excel-fill me-2"></i>
            {loading ? "Exportation..." : "Exporter Soldes Clients"}
        </button>
      </div>
      <div className="card-body p-4">
        {/* Reste du contenu de la page Bilan Global (inchangé) */}
        <p className="text-muted small">Ce bilan présente les totaux globaux (toutes périodes et tous clients confondus).</p>
        <div className="row g-4 mb-5">
            <div className="col-md-6 col-lg-3"><div className="card bg-primary text-white bg-opacity-75 shadow h-100"><div className="card-body"><div className="small text-uppercase">Total Ventes</div><h4 className="fw-bold m-0">{money(sum?.totalAmount || 0)}</h4></div></div></div>
            <div className="col-md-6 col-lg-3"><div className="card bg-success text-white bg-opacity-75 shadow h-100"><div className="card-body"><div className="small text-uppercase">Total Encaissé</div><h4 className="fw-bold m-0">{money(sum?.totalPayment || 0)}</h4></div></div></div>
            <div className="col-md-6 col-lg-3"><div className="card bg-danger text-white bg-opacity-75 shadow h-100"><div className="card-body"><div className="small text-uppercase">Dettes Totales Clients</div><h4 className="fw-bold m-0">{money(totalDebt)}</h4></div></div></div>
            <div className="col-md-6 col-lg-3"><div className="card bg-info text-white bg-opacity-75 shadow h-100"><div className="card-body"><div className="small text-uppercase">Crédits Totaux Dûs</div><h4 className="fw-bold m-0">{money(totalCredit)}</h4></div></div></div>
        </div>
        <h5 className="fw-bold mb-3">Détail des Ventes par Type</h5>
        <div className="row g-4">
            <div className="col-lg-6"><div className="card border-0 shadow-sm rounded-4 h-100 bg-white"><div className="card-body"><div className="d-flex justify-content-between align-items-center"><h6 className="m-0 fw-bold">Tilapia</h6><BadgeFish type="tilapia" /></div><hr /><div className="row small text-muted"><div className="col-4">Ventes: <br /><strong className="text-primary">{money(byTilapia.amount)}</strong></div><div className="col-4">Payé: <br /><strong className="text-success">{money(byTilapia.payment)}</strong></div><div className="col-4">Solde Net: <br /><strong className={byTilapia.balance >= 0 ? "text-danger" : "text-success"}>{money(Math.abs(byTilapia.balance))}</strong></div></div></div></div></div>
            <div className="col-lg-6"><div className="card border-0 shadow-sm rounded-4 h-100 bg-white"><div className="card-body"><div className="d-flex justify-content-between align-items-center"><h6 className="m-0 fw-bold">Pangasius</h6><BadgeFish type="pangasius" /></div><hr /><div className="row small text-muted"><div className="col-4">Ventes: <br /><strong className="text-primary">{money(byPanga.amount)}</strong></div><div className="col-4">Payé: <br /><strong className="text-success">{money(byPanga.payment)}</strong></div><div className="col-4">Solde Net: <br /><strong className={byPanga.balance >= 0 ? "text-danger" : "text-success"}>{money(Math.abs(byPanga.balance))}</strong></div></div></div></div></div>
        </div>
      </div>
    </div>
  );
}

function ChartsPage() {
    const [sum, setSum] = useState(null); const [salesData, setSalesData] = useState([]); const [loading, setLoading] = useState(true);
    useEffect(() => {
        const loadData = async () => {
            setLoading(true);
            try {
                const resSummary = await apiFetch("/api/summary?isGlobal=true"); const resultSummary = await resSummary.json();
                if (!resSummary.ok) throw new Error(resultSummary.error || "Erreur résumé."); setSum(resultSummary);
                const resSales = await apiFetch(`/api/sales`); const resultSales = await resSales.json();
                if (!resSales.ok) throw new Error(resultSales.error || "Erreur ventes."); setSalesData(resultSales);
            } catch (e) { console.error("Erreur chargement graphiques:", e); setSum(null); setSalesData([]); }
            finally { setLoading(false); }
        };
        loadData(); const handler = () => loadData(); window.addEventListener("reload-sales", handler); return () => window.removeEventListener("reload-sales", handler);
    }, []);
    return (
        <>
            <div className="alert alert-info text-center"><i className="bi bi-info-circle me-2"></i> Les graphiques et totaux représentent les **données globales** (toutes périodes/clients).</div>
            <ChartsPanel sales={salesData} loading={loading} />
            <SummaryCards sum={sum} loading={loading} />
            <DueNotificationsPanel sales={salesData} loading={loading} />
        </>
    );
}

function ClientAnalysisPage() {
    const clients = useClients(); const [selectedClient, setSelectedClient] = useState("");
    const [endDate, setEndDate] = useState(new Date().toISOString().slice(0, 10));
    const [startDate, setStartDate] = useState(() => { const d = new Date(); d.setFullYear(d.getFullYear() - 1); return d.toISOString().slice(0, 10); });
    const [data, setData] = useState(null); const [loading, setLoading] = useState(false); const [error, setError] = useState('');
    useEffect(() => { if (!selectedClient && clients.length > 0) setSelectedClient(clients[0]); }, [clients, selectedClient]);
    const loadClientData = async (client, start, end) => {
        if (!client) return; setLoading(true); setError(''); setData(null);
        const qs = new URLSearchParams(); if (start) qs.set('startDate', start); if (end) qs.set('endDate', end);
        try {
            const res = await apiFetch(`/api/client-analysis/${encodeURIComponent(client)}?${qs.toString()}`);
            const result = await res.json(); if (!res.ok) throw new Error(result.error || "Erreur chargement."); setData(result);
        } catch (e) { setError(e.message); } finally { setLoading(false); }
    };
    useEffect(() => { if (selectedClient) loadClientData(selectedClient, startDate, endDate); }, [selectedClient, startDate, endDate]);
    const summary = data?.summary; const totalDebt = data?.totalDebt || 0; const totalCredit = data?.totalCredit || 0; const recentSales = data?.recentSales || [];
    const dateRangeDisplay = `${startDate || 'Début'} au ${endDate || 'Aujourd\'hui'}`;
    return (
        <div className="card border-0 shadow rounded-4 mb-4 bg-white">
            <div className="card-header bg-dark text-white rounded-top-4 p-3 d-flex align-items-center"><i className="bi bi-search me-2 fs-5"></i><h5 className="m-0">Analyse Détaillée Client et Période</h5></div>
            <div className="card-body p-4">
                <div className="alert alert-info small text-center">Sélectionnez un client et une période pour voir ses statistiques agrégées.</div>
                <div className="row g-3 mb-4 p-3 bg-light rounded-3 border">
                    <div className="col-12 col-md-4"><label className="form-label small fw-semibold">Client / Entreprise</label><select className="form-select form-select-lg" value={selectedClient} onChange={(e) => setSelectedClient(e.target.value)} disabled={loading || clients.length === 0}><option value="">-- Sélectionner --</option>{clients.map(client => <option key={client} value={client}>{client}</option>)}</select></div>
                    <div className="col-6 col-md-4"><label className="form-label small fw-semibold">Date de Début</label><input type="date" className="form-control form-control-lg" value={startDate} onChange={(e) => setStartDate(e.target.value)} disabled={loading} /></div>
                    <div className="col-6 col-md-4"><label className="form-label small fw-semibold">Date de Fin</label><input type="date" className="form-control form-control-lg" value={endDate} onChange={(e) => setEndDate(e.target.value)} disabled={loading} /></div>
                </div>
                {loading && <div className="text-center py-5 text-muted"><i className="bi bi-arrow-clockwise spin me-2"></i>Chargement...</div>}
                {error && <div className="alert alert-danger text-center">{error}</div>}
                {data && !loading && selectedClient && (
                    <>
                        <h4 className="fw-bold mb-3">Synthèse pour {selectedClient} ({dateRangeDisplay})</h4>
                        <div className="row g-4 mb-4">
                            <div className="col-lg-3 col-md-6"><div className="card bg-primary text-white bg-opacity-75 shadow h-100"><div className="card-body"><div className="small text-uppercase">Ventes Période</div><h4 className="fw-bold m-0">{money(summary.totalAmount)}</h4><div className="small opacity-75">{summary.numSales} ventes</div></div></div></div>
                            <div className="col-lg-3 col-md-6"><div className="card bg-success text-white bg-opacity-75 shadow h-100"><div className="card-body"><div className="small text-uppercase">Règlement Période</div><h4 className="fw-bold m-0">{money(summary.totalPayment)}</h4><div className="small opacity-75">{summary.totalDelivered} kg livrés</div></div></div></div>
                            <div className="col-lg-3 col-md-6"><div className={`card ${totalDebt > totalCredit ? 'bg-danger' : 'bg-success'} text-white bg-opacity-75 shadow h-100`}><div className="card-body"><div className="small text-uppercase">Solde Net Global Actuel</div><h4 className="fw-bold m-0">{money(Math.abs(totalDebt - totalCredit))}</h4><div className="small opacity-75">{totalDebt > totalCredit ? 'Dette Client' : (totalCredit > totalDebt ? 'Crédit Entreprise' : 'Soldé')}</div></div></div></div>
                            <div className="col-lg-3 col-md-6"><div className="card bg-warning text-dark bg-opacity-75 shadow h-100"><div className="card-body"><div className="small text-uppercase">Encours Total (Actuel)</div><h6 className="m-0">Dettes: <strong className="text-danger">{money(totalDebt)}</strong></h6><h6 className="m-0">Crédits: <strong className="text-success">{money(totalCredit)}</strong></h6></div></div></div>
                        </div>
                        <h5 className="fw-bold mt-5 mb-3">10 Dernières Opérations dans la Période</h5>
                        <div className="table-responsive"><table className="table table-striped align-middle"><thead className="table-dark"><tr><th>Date</th><th>Poisson</th><th>Qté (Kg)</th><th>Montant</th><th>Payé</th><th>Solde</th></tr></thead>
                            <tbody>
                                {recentSales.map(s => (<tr key={s._id} className={s.balance > 0 ? 'table-danger-subtle' : (s.balance < 0 ? 'table-success-subtle' : '')}><td>{formatDate(s.date)}</td><td><BadgeFish type={s.fishType} /></td><td>{s.quantity}</td><td>{money(s.amount)}</td><td>{money(s.payment)}</td><td className={s.balance > 0 ? 'text-danger fw-bold' : (s.balance < 0 ? 'text-success fw-bold' : '')}>{money(Math.abs(s.balance))}{s.balance < 0 && <span className="small text-success"> (Crédit)</span>}</td></tr>))}
                                {recentSales.length === 0 && (<tr><td colSpan="6" className="text-center text-muted">Aucune vente trouvée.</td></tr>)}
                            </tbody>
                        </table></div>
                    </>
                )}
            </div>
        </div>
    );
}

function DashboardPage() {
    const clients = useClients();
    const [selectedClient, setSelectedClient] = useState("");
    const [endDate, setEndDate] = useState(new Date().toISOString().slice(0, 10));
    const [startDate, setStartDate] = useState(() => { const d = new Date(); d.setFullYear(d.getFullYear() - 1); return d.toISOString().slice(0, 10); });
    const [summaryData, setSummaryData] = useState(null); const [salesData, setSalesData] = useState([]);
    const [loading, setLoading] = useState(false); const [error, setError] = useState('');
    const hasFilter = useMemo(() => !!selectedClient || !!startDate || !!endDate, [selectedClient, startDate, endDate]);
    const loadData = async (client, start, end) => {
        setLoading(true); setError(''); setSummaryData(null); setSalesData([]);
        const qs = new URLSearchParams(); if (client) qs.set('clientName', client); if (start) qs.set('startDate', start); if (end) qs.set('endDate', end);
        try {
            const resSummary = await apiFetch(`/api/summary?${qs.toString()}`); const resultSummary = await resSummary.json();
            if (!resSummary.ok) throw new Error(resultSummary.error || "Erreur résumé."); setSummaryData(resultSummary);
            const qsSales = new URLSearchParams(); if (client) qsSales.set('client', client); if (start) qsSales.set('startDate', start); if (end) qsSales.set('endDate', end);
            const resSales = await apiFetch(`/api/sales?${qsSales.toString()}`); const resultSales = await resSales.json();
            if (!resSales.ok) throw new Error(resultSales.error || "Erreur ventes."); setSalesData(resultSales);
        } catch (e) { setError(e.message); } finally { setLoading(false); window.dispatchEvent(new Event("reload-sales")); }
    };
    useEffect(() => {
        if (hasFilter) loadData(selectedClient, startDate, endDate);
        else { setSummaryData(null); setSalesData([]); setLoading(false); }
    }, [selectedClient, startDate, endDate, hasFilter]);
    const showLoading = loading || (hasFilter && !summaryData && !salesData.length);
    return (
        <>
            <div className="card border-0 shadow rounded-4 mb-4 bg-white">
                <div className="card-body p-4">
                    <h5 className="fw-bold mb-3"><i className="bi bi-funnel-fill me-2 text-info"></i>Filtres du Dashboard</h5>
                    <div className="row g-3">
                        <div className="col-12 col-md-4"><label className="form-label small fw-semibold">Client / Entreprise</label><select className="form-select" value={selectedClient} onChange={(e) => setSelectedClient(e.target.value)} disabled={loading}><option value="">-- Tous les clients --</option>{clients.map(client => <option key={client} value={client}>{client}</option>)}</select></div>
                        <div className="col-6 col-md-4"><label className="form-label small fw-semibold">Date de Début</label><input type="date" className="form-control" value={startDate} onChange={(e) => setStartDate(e.target.value)} disabled={loading} /></div>
                        <div className="col-6 col-md-4"><label className="form-label small fw-semibold">Date de Fin</label><input type="date" className="form-control" value={endDate} onChange={(e) => setEndDate(e.target.value)} disabled={loading} /></div>
                    </div>
                </div>
            </div>
            {!hasFilter && <div className="alert alert-warning text-center"><i className="bi bi-info-circle me-2"></i> Veuillez sélectionner un client ou une période.</div>}
            {error && <div className="alert alert-danger text-center">{error}</div>}
            <SummaryCards sum={hasFilter ? summaryData : null} loading={showLoading} />
            <DueNotificationsPanel sales={salesData} loading={showLoading} />
            <ChartsPanel sales={salesData} loading={showLoading} />
            <div className="row g-4 mt-1">
              <div className="col-lg-6"><DebtsBoard clientName={hasFilter ? "placeholder" : undefined} loading={showLoading} /></div>
              <div className="col-lg-6"><CreditsBoard clientName={hasFilter ? "placeholder" : undefined} loading={showLoading} /></div>
            </div>
            <div className="row g-4 mt-4"><div className="col-12"><ReloadableSalesTableWrapper clientName={selectedClient} startDate={startDate} endDate={endDate} loading={loading} setLoading={setLoading} /></div></div>
        </>
    );
}

function MotifSummaryPage() {
    const [logs, setLogs] = useState([]); const [loading, setLoading] = useState(true);
    useEffect(() => {
        const loadLogs = async () => {
            setLoading(true);
            try { 
                const res = await apiFetch("/api/action-logs"); 
                const data = await res.json(); 
                if (!res.ok) throw new Error(data.error || "Erreur chargement logs"); 
                setLogs(Array.isArray(data) ? data : []); 
            } 
            catch (e) { 
                alert(e.message); setLogs([]); 
            } finally { 
                setLoading(false); 
            }
        }; loadLogs();
    }, []);
    return (
        <div className="card border-0 shadow rounded-4 mb-4 bg-white">
            <div className="card-header bg-dark text-white rounded-top-4 p-3 d-flex align-items-center"><i className="bi bi-journal-text me-2 fs-5"></i><h5 className="m-0">Bilan des Motifs d'Actions</h5></div>
            <div className="card-body p-4">
                <p className="text-muted">Liste des modifications et suppressions, avec le motif associé.</p>
                <div className="table-responsive"><table className="table table-striped align-middle"><thead className="table-dark"><tr><th>Date Action</th><th>Utilisateur</th><th>Action</th><th>Motif</th><th>ID Vente</th></tr></thead>
                    <tbody>
                        {loading && <tr><td colSpan="5" className="text-center py-5 text-muted"><i className="bi bi-arrow-clockwise spin me-2"></i>Chargement...</td></tr>}
                        {!loading && logs.length === 0 && <tr><td colSpan="5" className="text-center py-5 text-muted">Aucun motif enregistré.</td></tr>}
                        {logs.map(log => (<tr key={log._id}><td>{formatDateTime(log.createdAt)}</td><td>{log.companyName}</td><td>{log.actionType === 'edit' ? <span className="badge text-bg-warning">Modif.</span> : <span className="badge text-bg-danger">Suppr.</span>}</td><td className="small" style={{ minWidth: 250 }}>{log.motif}</td><td className="small text-muted">{log.saleId}</td></tr>))}
                    </tbody>
                </table></div>
            </div>
        </div>
    );
}

function ActionHistoryPage() {
    const [logs, setLogs] = useState([]); const [loading, setLoading] = useState(true);
    useEffect(() => {
        const loadLogs = async () => {
            setLoading(true);
            try { const res = await apiFetch("/api/action-logs"); const data = await res.json(); if (!res.ok) throw new Error(data.error || "Erreur chargement logs"); setLogs(Array.isArray(data) ? data : []); }
            catch (e) { alert(e.message); setLogs([]); } finally { setLoading(false); }
        }; loadLogs();
    }, []);
    return (
        <div className="card border-0 shadow rounded-4 mb-4 bg-white">
            <div className="card-header bg-danger text-white rounded-top-4 p-3 d-flex align-items-center"><i className="bi bi-trash-fill me-2 fs-5"></i><h5 className="m-0">Historique des Ventes Modifiées & Supprimées</h5></div>
            <div className="card-body p-4">
                <p className="text-muted">Snapshot des ventes au moment de leur modification ou suppression.</p>
                <div className="table-responsive"><table className="table table-sm table-bordered align-middle"><thead className="table-dark"><tr><th>Action</th><th>Date Action</th><th>Utilisateur</th><th>Motif</th><th>Date Vente</th><th>Client</th><th>Poisson</th><th>Montant</th><th>Solde</th></tr></thead>
                    <tbody>
                        {loading && <tr><td colSpan="9" className="text-center py-5 text-muted"><i className="bi bi-arrow-clockwise spin me-2"></i>Chargement...</td></tr>}
                        {!loading && logs.length === 0 && <tr><td colSpan="9" className="text-center py-5 text-muted">Aucune action enregistrée.</td></tr>}
                        {logs.map(log => {
                            const s = log.saleData; const isEdit = log.actionType === 'edit';
                            return (<tr key={log._id} className={isEdit ? 'table-warning-subtle' : 'table-danger-subtle'}>
                                <td><span className={`badge ${isEdit ? 'text-bg-warning' : 'text-bg-danger'}`}>{isEdit ? 'Modifié' : 'Supprimé'}</span></td>
                                <td className="small">{formatDateTime(log.createdAt)}</td><td className="small">{log.companyName}</td>
                                <td className="small" style={{ minWidth: 200 }}>{log.motif}</td><td>{formatDate(s.date)}</td>
                                <td className="fw-semibold">{s.clientName}</td><td><BadgeFish type={s.fishType} /></td>
                                <td>{money(s.amount)}</td><td className={s.balance > 0 ? "text-danger" : (s.balance < 0 ? "text-success" : "")}>{money(s.balance)}</td>
                            </tr>);
                        })}
                    </tbody>
                </table></div>
            </div>
        </div>
    );
}

// =====================================
// ADMIN/USER: App Principale (MIS À JOUR)
// =====================================
function App() {
  const { isMdUp } = useViewport();
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const [authed, setAuthed] = useState(!!(typeof window !== "undefined" && localStorage.getItem("token")));
  const companyName = (typeof window !== "undefined" && localStorage.getItem("companyName")) || "Mon Entreprise";
  const [currentPage, setCurrentPage] = useState("dashboard");

  const handleLogout = () => {
    localStorage.removeItem("token"); localStorage.removeItem("companyName");
    setAuthed(false);
  };

  const getPageTitle = (page) => {
    switch (page) {
      case "dashboard": return "Tableau de Bord 📊";
      case "client-analysis": return "Analyse Client / Période 🔍";
      case "client-management": return "Gestion des Clients 👥"; // AJOUTÉ
      case "new-sale": return "Nouvelle Vente 📝";
      case "sales": return "Historique des Ventes 📋";
      case "debts": return "Vue Dettes Clients 💰";
      case "sales-balance": return "Bilan Global des Ventes 💰";
      case "client-report": return "Bilan Client / Export 📄"; 
      case "charts": return "Analyse Graphique 📈";
      case "motif-summary": return "Bilan des Motifs ✍️";
      case "action-history": return "Historique des Actions 📋";
      default: return "Tableau de Bord";
    }
  };

  if (!authed) return <AuthView onAuth={() => setAuthed(true)} />;

  const renderPage = () => {
    switch (currentPage) {
      case "sales-balance": return <SalesBalancePage />;
      case "client-analysis": return <ClientAnalysisPage />; 
      case "client-management": return <ClientManagementPage />; // AJOUTÉ
      case "new-sale": return <SaleForm onSaved={() => setCurrentPage("sales")} />;
      case "sales": return <ReloadableSalesTable />; 
      case "debts": return (<><div className="row g-4 mb-4"><div className="col-lg-6"><DebtsBoard clientName={""} loading={false} /></div><div className="col-lg-6"><CreditsBoard clientName={""} loading={false} /></div></div><ReloadableSalesTable /></>);
      case "client-report": return <ClientReportPage />;
      case "charts": return <ChartsPage />;
      case "motif-summary": return <MotifSummaryPage />;
      case "action-history": return <ActionHistoryPage />;
      case "dashboard": default: return <DashboardPage />; 
    }
  };

  return (
    <div className="d-flex" style={{ overflowX: "hidden" }}>
      <Sidebar companyName={companyName} currentPage={currentPage} onNavigate={setCurrentPage} onLogout={handleLogout} open={sidebarOpen} setOpen={setSidebarOpen} isMdUp={isMdUp} />
      <main className="flex-grow-1" style={{ marginLeft: isMdUp ? SIDEBAR_WIDTH : 0, background: "#f0f2f5", minHeight: "100vh", transition: "margin-left .25s ease", width: "100%" }}>
        <div className="container-fluid py-3 py-md-4">
          <Topbar title={getPageTitle(currentPage)} companyName={companyName} onBurger={() => setSidebarOpen(true)} />
          {renderPage()}
        </div>
      </main>
    </div>
  );
}


/** #####################################################################################
 * #####################################################################################
 * ###                                                                               ###
 * ###                     ROUTEUR PRINCIPAL (Choisit l'App)                         ###
 * ###                                                                               ###
 * #####################################################################################
 * ##################################################################################### */

function RootApp() {
    const [hash, setHash] = useState(window.location.hash);

    useEffect(() => {
        const handleHashChange = () => setHash(window.location.hash);
        window.addEventListener('hashchange', handleHashChange);
        return () => window.removeEventListener('hashchange', handleHashChange);
    }, []);

    if (hash.startsWith('#/admin-login')) {
        return <AdminLogin />;
    }
    
    if (hash.startsWith('#/admin')) {
        return <AdminApp />;
    }

    // Par défaut, afficher l'application utilisateur normale
    return <App />;
}

export default RootApp;
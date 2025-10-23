import React, { useEffect, useMemo, useRef, useState, useCallback } from "react";
// Importez le CSS de Bootstrap Icons pour les icônes (bi)
// <link rel="stylesheet" href="https://cdn.jsdelivr.net/npm/bootstrap-icons@1.11.3/font/bootstrap-icons.min.css"></link>

/** === CONFIG API (fixe) === */
const API_BASE = "https://fish-manage-back.onrender.com";
const SIDEBAR_WIDTH = 280; // Largeur de la sidebar augmentée pour plus de style

/** === Helpers === */
const money = (n) =>
  (n ?? 0).toLocaleString("fr-FR", { style: "currency", currency: "XOF" });

function apiFetch(path, options = {}) {
  const token = localStorage.getItem("token");
  const headers = { "Content-Type": "application/json", ...(options.headers || {}) };
  if (token) headers["Authorization"] = `Bearer ${token}`;
  return fetch(`${API_BASE}${path}`, { ...options, headers });
}

function BadgeFish({ type }) {
  // Styles améliorés pour les badges poissons
  const cls = type === "tilapia" ? "text-bg-primary" : "text-bg-success";
  return <span className={`badge rounded-pill fw-normal ${cls} shadow-sm`}>{type === "tilapia" ? "Tilapia" : "Pangasius"}</span>;
}

/** === Chargement dynamique de Chart.js (CDN) === */
function useChartJs() {
  const [ready, setReady] = useState(!!window.Chart);
  useEffect(() => {
    if (window.Chart) return;
    const s = document.createElement("script");
    s.src = "https://cdn.jsdelivr.net/npm/chart.js";
    s.async = true;
    s.onload = () => {
        // Enregistrement des éléments nécessaires pour Chart.js
        window.Chart.register(window.Chart.controllers.bar, window.Chart.controllers.line, window.Chart.controllers.doughnut, window.Chart.elements.Arc, window.Chart.elements.Line, window.Chart.elements.Point);
        setReady(true);
    };
    document.body.appendChild(s);
    return () => s.remove();
  }, []);
  return ready;
}

/* ========================= NOUVEAU SIDEBAR RESPONSIVE ========================= */
function Sidebar({ companyName, onLogout, currentPage, onNavigate, isOpen, onClose }) {
  const navItems = [
    { id: "dashboard", icon: "bi-house-door-fill", label: "Dashboard" },
    { id: "new-sale", icon: "bi-cash-coin", label: "Nouvelle Vente" },
    { id: "sales", icon: "bi-table", label: "Historique & Actions" },
    { id: "debts", icon: "bi-exclamation-triangle-fill", label: "Dettes Clients" },
    { id: "charts", icon: "bi-graph-up", label: "Analyse Graphique" },
  ];

  const handleNavigate = (id) => {
    onNavigate(id);
    onClose(); // Ferme le sidebar après la navigation sur mobile
  };
  
  const sidebarClass = `offcanvas-md offcanvas-start bg-dark shadow-lg`; // Offcanvas pour le responsive
  const visibilityStyle = {
    width: SIDEBAR_WIDTH,
    // La gestion de la visibilité est faite par Bootstrap Offcanvas sur mobile
  };

  return (
    <>
      {/* Offcanvas Overlay pour le mobile */}
      {isOpen && window.innerWidth < 768 && (
        <div className="offcanvas-backdrop fade show" onClick={onClose}></div>
      )}
      
      {/* Sidebar - Utilisation d'offcanvas pour le mobile (masqué sur md et +) */}
      <div 
        className={`${sidebarClass} ${isOpen ? 'show' : ''}`} 
        tabIndex="-1" 
        id="sidebarMenu"
        aria-labelledby="sidebarMenuLabel"
        style={visibilityStyle}
      >
        <div className="offcanvas-header d-md-none text-white">
          <h5 className="offcanvas-title" id="sidebarMenuLabel">Navigation</h5>
          <button type="button" className="btn-close btn-close-white" aria-label="Close" onClick={onClose}></button>
        </div>
        
        <div className="offcanvas-body p-3 d-flex flex-column">
          {/* Logo/Titre */}
          <a href="#" className="d-flex align-items-center mb-3 me-md-auto text-white text-decoration-none">
            <i className="bi bi-water me-2 fs-4 text-info"></i>
            <span className="fs-5 fw-bold">Fish Manage</span>
          </a>
          <hr className="border-secondary" />

          {/* Navigation */}
          <ul className="nav nav-pills flex-column mb-auto">
            {navItems.map(item => (
              <li className="nav-item" key={item.id}>
                <button 
                  className={`btn nav-link text-start text-white w-100 mb-1 rounded-3 ${currentPage === item.id ? 'active bg-primary shadow-sm' : 'link-body-emphasis hover-bg-light-dark'}`} 
                  onClick={() => handleNavigate(item.id)}
                >
                  <i className={`bi ${item.icon} me-2`}></i>
                  {item.label}
                </button>
              </li>
            ))}
          </ul>
          <hr className="border-secondary" />

          {/* Footer / Déconnexion */}
          <div className="dropdown">
            <div className="d-flex align-items-center text-white text-decoration-none">
              <i className="bi bi-person-circle me-2 fs-5"></i>
              <strong className="text-truncate" style={{maxWidth: 180}}>{companyName}</strong>
              <button className="btn btn-link text-danger ms-auto p-0" onClick={onLogout} title="Déconnexion">
                <i className="bi bi-box-arrow-right fs-5"></i>
              </button>
            </div>
          </div>
        </div>
      </div>
    </>
  );
}

/* ========================= NOUVEAU HEADER MOBILE ========================= */
function MobileHeader({ title, onToggleSidebar }) {
    // Ce header est visible uniquement sur les petits écrans (d-md-none)
    return (
        <header className="navbar navbar-expand-lg navbar-dark bg-dark sticky-top d-md-none shadow-sm">
            <div className="container-fluid">
                <button 
                    className="navbar-toggler border-0 p-1" 
                    type="button" 
                    onClick={onToggleSidebar} 
                    aria-controls="sidebarMenu" 
                    aria-expanded="false" 
                    aria-label="Toggle navigation"
                >
                    <span className="navbar-toggler-icon"></span>
                </button>
                <span className="navbar-brand text-truncate mx-2">{title}</span>
            </div>
        </header>
    );
}


/* ========================= AUTH (Redesign minimal) ========================= */
// ... (AuthView reste presque identique, sauf ajout de classes plus modernes) ...
function AuthView({ onAuth }) {
  const [mode, setMode] = useState("login");
  const [companyName, setCompanyName] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [err, setErr] = useState("");

  const submit = async (e) => {
    e.preventDefault();
    setErr("");
    try {
      const path = mode === "login" ? "/api/auth/login" : "/api/auth/register";
      const body =
        mode === "login"
          ? { email, password }
          : { companyName, email, password };
      const res = await fetch(`${API_BASE}${path}`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Erreur");
      localStorage.setItem("token", data.token);
      localStorage.setItem("companyName", data.companyName);
      onAuth();
    } catch (e) {
      setErr(e.message);
    }
  };

  return (
    <div className="d-flex align-items-center justify-content-center" style={{ minHeight: "100vh", background: "#e9ecef" }}>
      <div className="col-12 col-sm-10 col-md-8 col-lg-5 col-xl-4 p-3">
        <div className="card border-0 shadow-lg rounded-4 p-2">
          <div className="card-body p-4">
              <div className="text-center mb-4">
                <i className="bi bi-water text-primary display-4"></i>
                <h3 className="fw-bold mt-2">Fish Manage</h3>
                <p className="text-muted small">Connexion au Dashboard</p>
              </div>
            <form onSubmit={submit} className="mt-3">
              {mode === "register" && (
                <div className="mb-3">
                  <label className="form-label fw-semibold">Nom de l'Entreprise</label>
                  <input
                    className="form-control form-control-lg rounded-3"
                    value={companyName}
                    onChange={(e) => setCompanyName(e.target.value)}
                    required
                  />
                </div>
              )}
              <div className="mb-3">
                <label className="form-label fw-semibold">Email</label>
                <input
                  type="email"
                  className="form-control form-control-lg rounded-3"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  required
                />
              </div>
              <div className="mb-4">
                <label className="form-label fw-semibold">Mot de passe</label>
                <input
                  type="password"
                  className="form-control form-control-lg rounded-3"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  required
                />
              </div>
              {err && <div className="alert alert-danger small rounded-3">{err}</div>}
              <div className="d-grid gap-3">
                <button className="btn btn-primary btn-lg rounded-pill shadow" type="submit">
                  {mode === "login" ? "Connexion" : "Inscription"}
                </button>
                <button
                  type="button"
                  className="btn btn-link text-secondary"
                  onClick={() => setMode(mode === "login" ? "register" : "login")}
                >
                  {mode === "login" ? "Créer un compte" : "J'ai déjà un compte"}
                </button>
              </div>
            </form>
          </div>
        </div>
        <div className="text-center text-muted mt-3 small">
          Backend: <code>{API_BASE}</code>
        </div>
      </div>
    </div>
  );
}


/* ========================= FORM VENTE (Optimisé pour mobile) ========================= */
function SaleForm({ onSaved }) {
    // La logique reste inchangée, les classes sont optimisées pour la lisibilité
    // sur mobile (g-3 par défaut, form-control simple)
    const [date, setDate] = useState(new Date().toISOString().slice(0, 10));
    const [clientName, setClient] = useState("");
    const [fishType, setFishType] = useState("tilapia");
    const [quantity, setQty] = useState("");
    const [delivered, setDelivered] = useState("");
    const [unitPrice, setUnit] = useState("");
    const [payment, setPay] = useState("");
    const [observation, setObs] = useState("");
    const [loading, setLoading] = useState(false);

    const amount = (Number(quantity || 0) * Number(unitPrice || 0)) || 0;
    const balance = Math.max(0, amount - Number(payment || 0));
    const remainingToDeliver = Math.max(0, Number(quantity || 0) - Number(delivered || 0));

    const save = async (e) => {
      e.preventDefault();
      setLoading(true);
      try {
        const res = await apiFetch("/api/sales", {
          method: "POST",
          body: JSON.stringify({
            date, clientName, fishType,
            quantity: Number(quantity),
            delivered: Number(delivered || 0),
            unitPrice: Number(unitPrice),
            payment: Number(payment || 0),
            observation,
          }),
        });
        const data = await res.json();
        if (!res.ok) throw new Error(data.error || "Erreur");
        setClient(""); setQty(""); setDelivered(""); setUnit(""); setPay(""); setObs("");
        onSaved && onSaved(data);
        window.dispatchEvent(new Event("reload-sales")); // Pour rafraîchir le tableau
      } catch (err) { alert(err.message); }
      finally { setLoading(false); }
    };

    return (
      <div className="card border-0 shadow rounded-4 mb-4 bg-white">
        <div className="card-header bg-primary text-white rounded-top-4 p-3 d-flex align-items-center">
          <i className="bi bi-bag-plus-fill me-2 fs-5"></i>
          <h5 className="m-0">Nouvelle Vente Rapide</h5>
        </div>
        <div className="card-body p-4">
          <form onSubmit={save} className="row g-3">
            <div className="col-12">
              <label className="form-label small fw-semibold">Client / Entreprise</label>
              <input className="form-control rounded-3" value={clientName} onChange={(e) => setClient(e.target.value)} required />
            </div>
            {/* Colonnes s'adaptant mieux sur mobile */}
            <div className="col-12 col-sm-6">
              <label className="form-label small fw-semibold">Date</label>
              <input type="date" className="form-control rounded-3" value={date} onChange={(e) => setDate(e.target.value)} required />
            </div>
            <div className="col-12 col-sm-6">
              <label className="form-label small fw-semibold">Poisson</label>
              <select className="form-select rounded-3" value={fishType} onChange={(e) => setFishType(e.target.value)}>
                <option value="tilapia">Tilapia</option>
                <option value="pangasius">Pangasius</option>
              </select>
            </div>
            <div className="col-12 col-sm-6">
              <label className="form-label small fw-semibold">Qté Commandée (kg)</label>
              <input type="number" step="0.01" className="form-control rounded-3" value={quantity} onChange={(e) => setQty(e.target.value)} required />
            </div>
            <div className="col-12 col-sm-6">
              <label className="form-label small fw-semibold">Prix Unitaire (XOF)</label>
              <input type="number" step="0.01" className="form-control rounded-3" value={unitPrice} onChange={(e) => setUnit(e.target.value)} required />
            </div>
            <div className="col-12 col-sm-6">
              <label className="form-label small fw-semibold">Qté Livrée (kg)</label>
              <input type="number" step="0.01" className="form-control rounded-3" value={delivered} onChange={(e) => setDelivered(e.target.value)} />
            </div>
            <div className="col-12 col-sm-6">
              <label className="form-label small fw-semibold">Règlement Payé (XOF)</label>
              <input type="number" step="0.01" className="form-control rounded-3" value={payment} onChange={(e) => setPay(e.target.value)} />
            </div>
            <div className="col-12">
              <label className="form-label small fw-semibold">Observation</label>
              <input className="form-control rounded-3" value={observation} onChange={(e) => setObs(e.target.value)} placeholder="Notes de la vente..." />
            </div>

            <div className="col-12 d-grid gap-2 mt-4">
              <button className="btn btn-primary btn-lg rounded-pill shadow" disabled={loading}>
                <i className={`bi ${loading ? 'bi-hourglass-split' : 'bi-check-circle-fill'} me-2`}></i>
                {loading ? "Enregistrement en cours..." : "Enregistrer la Vente"}
              </button>
            </div>

            <div className="col-12 d-flex justify-content-between flex-wrap pt-3 mt-3 border-top gap-2">
              <span className="badge bg-secondary p-2">Montant: <strong className="fs-6">{money(amount)}</strong></span>
              <span className="badge bg-warning text-dark p-2">Reste à livrer: <strong className="fs-6">{remainingToDeliver} kg</strong></span>
              <span className="badge bg-danger p-2">Solde à payer: <strong className="fs-6">{money(balance)}</strong></span>
            </div>
          </form>
        </div>
      </div>
    );
}

/* ========================= TABLE + ACTIONS (Responsif & Rénové) ========================= */
// ... (SalesTable reste fonctionnellement identique, mais les classes visuelles sont rafraîchies) ...
function SalesTable() {
    const [sales, setSales] = useState([]);
    const [filterType, setFilterType] = useState("");
    const [searchClient, setSearchClient] = useState("");
    const [loading, setLoading] = useState(true);
    const [openRow, setOpenRow] = useState(null);
    const [actionType, setActionType] = useState(""); // "deliver" | "pay"
    const [actionValue, setActionValue] = useState("");

    const load = useCallback(async () => {
      setLoading(true);
      const qs = new URLSearchParams();
      if (filterType) qs.set("fishType", filterType);
      if (searchClient) qs.set("client", searchClient);
      const res = await apiFetch(`/api/sales?${qs.toString()}`);
      const data = await res.json();
      setSales(Array.isArray(data) ? data : []);
      setLoading(false);
    }, [filterType, searchClient]);
    
    useEffect(() => { load(); }, [load]);

    const toggleAction = (id, type, suggested) => {
      if (openRow === id && actionType === type) {
        setOpenRow(null); setActionType(""); setActionValue("");
      } else {
        setOpenRow(id); setActionType(type); setActionValue(suggested ?? "");
      }
    };

    const submitAction = async (sale) => {
      try {
        // ... (Logique submitAction inchangée) ...
        if (actionType === "deliver") {
            const qty = Number(actionValue || 0);
            const res = await apiFetch(`/api/sales/${sale._id}/deliver`, { method: "PATCH", body: JSON.stringify({ qty }) });
            const data = await res.json(); if (!res.ok) throw new Error(data.error || "Erreur livraison");
            setSales((prev) => prev.map((s) => (s._id === sale._id ? data : s)));
          } else if (actionType === "pay") {
            const amount = Number(actionValue || 0);
            const res = await apiFetch(`/api/sales/${sale._id}/pay`, { method: "PATCH", body: JSON.stringify({ amount }) });
            const data = await res.json(); if (!res.ok) throw new Error(data.error || "Erreur règlement");
            setSales((prev) => prev.map((s) => (s._id === sale._id ? data : s)));
          }
        setOpenRow(null); setActionType(""); setActionValue("");
      } catch (e) { alert(e.message); }
    };

    const settleAll = async (id) => {
      if (!window.confirm("Solder totalement cette vente ?")) return;
      const res = await apiFetch(`/api/sales/${id}/settle`, { method: "PATCH" });
      const data = await res.json();
      if (!res.ok) return alert(data.error || "Erreur");
      setSales((prev) => prev.map((s) => (s._id === id ? data : s)));
    };

    const exportExcel = async () => {
      try {
        const res = await apiFetch("/api/exports/sales.xlsx", { method: "GET" });
        if (!res.ok) throw new Error("Export impossible");
        const blob = await res.blob();
        const url = window.URL.createObjectURL(blob);
        const a = document.createElement("a");
        a.href = url;
        a.download = "historique_ventes.xlsx";
        document.body.appendChild(a);
        a.click();
        a.remove();
        window.URL.revokeObjectURL(url);
      } catch (e) {
        alert(e.message);
      }
    };

    return (
      <div className="card border-0 shadow rounded-4 bg-white">
        <div className="card-body p-4">
          
          {/* En-tête avec fond léger pour un look pro */}
          <div className="d-flex flex-wrap gap-3 align-items-center mb-4 p-3 bg-light rounded-3 border">
            <h5 className="m-0 text-dark flex-grow-1"><i className="bi bi-table me-2"></i> Historique des Opérations</h5>
            <div className="d-flex gap-2 flex-wrap justify-content-end">
              <div className="input-group" style={{maxWidth: 250}}>
                <span className="input-group-text"><i className="bi bi-search"></i></span>
                <input className="form-control" placeholder="Rechercher client..." value={searchClient} onChange={(e) => setSearchClient(e.target.value)} />
              </div>
              
              <select className="form-select" style={{width: 150}} value={filterType} onChange={(e) => setFilterType(e.target.value)}>
                <option value="">Tous</option>
                <option value="tilapia">Tilapia</option>
                <option value="pangasius">Pangasius</option>
              </select>
              <button className="btn btn-outline-success rounded-pill" onClick={exportExcel}>
                  <i className="bi bi-file-earmark-excel me-1"></i> Exporter
              </button>
            </div>
          </div>

          <div className="table-responsive">
            <table className="table align-middle table-hover border-light">
              <thead className="table-dark">
                <tr>
                  <th>Date</th><th>Client</th><th>Poisson</th>
                  <th>Qté (Kg)</th><th>Livré (Kg)</th><th>Reste</th>
                  <th>Solde Dû</th><th style={{width:180}}>Actions</th>
                </tr>
              </thead>
              <tbody>
                {loading && <tr><td colSpan="8" className="text-center py-4 text-muted"><i className="bi bi-arrow-clockwise spin me-2"></i>Chargement de l'historique...</td></tr>}
                {!loading && sales.length === 0 && <tr><td colSpan="8" className="text-center py-4 text-muted">Aucune vente enregistrée.</td></tr>}

                {sales.map((s) => {
                  const remainingToDeliver = Math.max(0, s.quantity - (s.delivered || 0));
                  const remainingToPay = Math.max(0, s.amount - (s.payment || 0));
                  
                  const rowClass = s.balance > 0 ? "table-danger-subtle border-start border-danger border-4" : "";

                  return (
                    <React.Fragment key={s._id}>
                      <tr className={rowClass}>
                        <td>{new Date(s.date).toISOString().slice(0, 10)}</td>
                        <td className="fw-semibold text-primary">{s.clientName}</td>
                        <td><BadgeFish type={s.fishType} /></td>
                        <td>{s.quantity}</td>
                        <td>{s.delivered || 0}</td>
                        <td className={remainingToDeliver > 0 ? "text-warning fw-bold" : ""}>{remainingToDeliver}</td>
                        <td className={s.balance > 0 ? "text-danger fw-bolder" : ""}>{money(s.balance)}</td>
                        <td>
                          <div className="d-flex flex-wrap gap-1">
                            {remainingToDeliver > 0 && (
                              <button className="btn btn-sm btn-primary rounded-pill flex-grow-1"
                                onClick={() => toggleAction(s._id, "deliver", remainingToDeliver)}>
                                <i className="bi bi-truck"></i>
                              </button>
                            )}
                            {!s.settled && (
                              <>
                                <button className="btn btn-sm btn-secondary rounded-pill flex-grow-1"
                                  onClick={() => toggleAction(s._id, "pay", remainingToPay)}>
                                  <i className="bi bi-wallet"></i>
                                </button>
                                <button className="btn btn-sm btn-outline-success rounded-circle" title="Solder toute la dette"
                                  onClick={() => settleAll(s._id)}>
                                  <i className="bi bi-currency-dollar"></i>
                                </button>
                              </>
                            )}
                          </div>
                        </td>
                      </tr>

                      {openRow === s._id && (
                        <tr>
                          <td colSpan="8">
                            <div className="bg-light p-3 rounded-3 border border-secondary">
                              <div className="d-flex align-items-center gap-3 flex-wrap">
                                <div className="small text-muted">
                                    Action : {actionType === "deliver" ? `Livraison (Reste: ${remainingToDeliver} kg)` : `Règlement (Solde: ${money(remainingToPay)})`}
                                </div>
                                <div className="input-group flex-grow-1" style={{maxWidth: 350}}>
                                  <span className="input-group-text">{actionType === "deliver" ? "Qté à livrer" : "Montant"}</span>
                                  <input type="number" min="0" step="0.01" className="form-control"
                                    value={actionValue} onChange={(e)=>setActionValue(e.target.value)} />
                                  <button className={`btn btn-outline-${actionType === 'deliver' ? 'primary' : 'secondary'}`}
                                    onClick={()=>setActionValue(actionType === 'deliver' ? remainingToDeliver : remainingToPay)}>
                                    Max
                                  </button>
                                </div>
                                <button className={`btn btn-${actionType === 'deliver' ? 'primary' : 'secondary'}`} onClick={()=>submitAction(s)}>Valider</button>
                                <button className="btn btn-link text-danger" onClick={()=>{ setOpenRow(null); setActionType(""); }}>Annuler</button>
                              </div>
                            </div>
                          </td>
                        </tr>
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

// ... (ChartsPanel, DueNotificationsPanel, SummaryCards, DebtsBoard restent fonctionnellement inchangés,
//      mais les classes visuelles sont rafraîchies pour un meilleur look) ...

/* ========================= DASHBOARD DETTES (Refonte pour mobile) ========================= */
function DebtsBoard() {
  const [debts, setDebts] = useState([]);
  useEffect(() => { (async () => {
    const res = await apiFetch("/api/dashboard/debts"); const data = await res.json();
    setDebts(Array.isArray(data) ? data : []);
  })(); }, []);
  const total = debts.reduce((sum, d) => sum + d.totalDebt, 0);

  return (
    <div className="card border-0 shadow rounded-4 bg-white">
      <div className="card-body p-4">
        <div className="d-flex flex-wrap align-items-center mb-4 pb-2 border-bottom">
          <h5 className="m-0 fw-bold"><i className="bi bi-person-lines-fill me-2 text-danger"></i>Top Dettes Clients</h5>
          <span className="ms-auto badge text-bg-danger p-2 fs-6 mt-2 mt-sm-0">Encours Total: {money(total)}</span>
        </div>
        <div className="table-responsive" style={{ maxHeight: 300, overflowY: 'auto' }}>
          <table className="table align-middle table-sm table-hover">
            <thead>
                <tr className="table-light">
                    <th>Client</th><th># Opérations</th><th>Dette</th>
                </tr>
            </thead>
            <tbody>
              {debts.length === 0 && <tr><td colSpan="3" className="text-center py-3 text-muted">Aucune dette en cours.</td></tr>}
              {debts.map((d) => (
                <tr key={d.clientName} className="align-middle">
                  <td className="fw-semibold text-dark">{d.clientName}</td>
                  <td className="small text-muted">{d.count}</td>
                  <td className="text-danger fw-bolder">{money(d.totalDebt)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}

/* ========================= RÉSUMÉ GLOBAL (Optimisé pour mobile) ========================= */
function SummaryCards() {
    const [sum, setSum] = useState(null);
    useEffect(() => { (async () => {
      const res = await apiFetch("/api/summary"); const data = await res.json(); setSum(data);
    })(); }, []);
    if (!sum) return null;

    const byTilapia = sum.byFish?.find((f) => f.fishType === "tilapia") || { amount: 0, payment: 0, balance: 0 };
    const byPanga = sum.byFish?.find((f) => f.fishType === "pangasius") || { amount: 0, payment: 0, balance: 0 };

    const Card = ({ title, amount, iconClass, cardClass }) => (
      <div className="col-12 col-md-6 col-lg-4"> {/* col-12 sur mobile, col-md-6, col-lg-4 */}
        <div className={`card border-0 shadow-sm rounded-4 ${cardClass} h-100`}>
          <div className="card-body d-flex align-items-center p-4">
            <div className="me-3 p-3 rounded-circle bg-opacity-25 bg-white d-flex align-items-center justify-content-center" style={{width: 60, height: 60}}>
                <i className={`bi ${iconClass} fs-3`}></i>
            </div>
            <div>
              <div className="text-uppercase small opacity-75">{title}</div>
              <div className="h3 m-0 fw-bold">{money(amount)}</div>
            </div>
          </div>
        </div>
      </div>
    );

    return (
      <div className="row g-4 mb-5">
        <Card title="Total Ventes" amount={sum.totalAmount} iconClass="bi-graph-up-arrow text-primary" cardClass="bg-primary text-white bg-opacity-75" />
        <Card title="Total Encaissé" amount={sum.totalPayment} iconClass="bi-check-circle-fill text-success" cardClass="bg-success text-white bg-opacity-75" />
        <Card title="Solde/Encours" amount={sum.totalBalance} iconClass="bi-currency-exchange text-danger" cardClass="bg-danger text-white bg-opacity-75" />
        
        {/* Détail par Poisson - S'aligne sur deux colonnes sur desktop, une colonne sur mobile */}
        <div className="col-12 col-lg-6">
          <div className="card border-0 shadow-sm rounded-4 h-100 bg-white">
            <div className="card-body">
              <div className="d-flex justify-content-between align-items-center">
                  <h6 className="m-0 fw-bold">Détail Tilapia</h6>
                  <BadgeFish type="tilapia" />
              </div>
              <hr/>
              <div className="row small text-muted">
                  <div className="col-4">Ventes: <br/><strong className="text-primary">{money(byTilapia.amount)}</strong></div>
                  <div className="col-4">Payé: <br/><strong className="text-success">{money(byTilapia.payment)}</strong></div>
                  <div className="col-4">Solde: <br/><strong className="text-danger">{money(byTilapia.balance)}</strong></div>
              </div>
            </div>
          </div>
        </div>
        <div className="col-12 col-lg-6">
          <div className="card border-0 shadow-sm rounded-4 h-100 bg-white">
            <div className="card-body">
              <div className="d-flex justify-content-between align-items-center">
                  <h6 className="m-0 fw-bold">Détail Pangasius</h6>
                  <BadgeFish type="pangasius" />
              </div>
              <hr/>
              <div className="row small text-muted">
                  <div className="col-4">Ventes: <br/><strong className="text-primary">{money(byPanga.amount)}</strong></div>
                  <div className="col-4">Payé: <br/><strong className="text-success">{money(byPanga.payment)}</strong></div>
                  <div className="col-4">Solde: <br/><strong className="text-danger">{money(byPanga.balance)}</strong></div>
              </div>
            </div>
          </div>
        </div>
      </div>
    );
}

/* ========================= GRAPHIQUES MENSUELS (Refonte Totale) ========================= */
function ChartsPanel() {
    const chartReady = useChartJs();
    const [sales, setSales] = useState([]);

    useEffect(() => {
      (async () => {
        const res = await apiFetch("/api/sales");
        const data = await res.json();
        setSales(Array.isArray(data) ? data : []);
      })();
    }, []);

    const data = useMemo(() => {
      const monthlyMap = new Map();
      let tilapiaAmount = 0;
      let pangasiusAmount = 0;

      sales.forEach((s) => {
        const d = new Date(s.date);
        const k = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}`;
        const curr = monthlyMap.get(k) || { amount: 0, balance: 0 };
        curr.amount += Number(s.amount || 0);
        curr.balance += Number(s.balance || 0);
        monthlyMap.set(k, curr);

        if (s.fishType === 'tilapia') tilapiaAmount += Number(s.amount || 0);
        if (s.fishType === 'pangasius') pangasiusAmount += Number(s.amount || 0);
      });

      const labels = Array.from(monthlyMap.keys()).sort();
      const amounts = labels.map((k) => monthlyMap.get(k).amount);
      const balances = labels.map((k) => monthlyMap.get(k).balance);
      
      return { labels, amounts, balances, tilapiaAmount, pangasiusAmount };
    }, [sales]);

    const salesRef = useRef(null);
    const debtsRef = useRef(null);
    const typeRef = useRef(null);
    const salesChart = useRef(null);
    const debtsChart = useRef(null);
    const typeChart = useRef(null);

    useEffect(() => {
      if (!chartReady || data.labels.length === 0) return; // Ne pas dessiner sans données

      const Chart = window.Chart;

      // Destruction des anciens graphiques
      [salesChart, debtsChart, typeChart].forEach(chart => chart.current?.destroy?.());

      // 1. Ventes Mensuelles (Bar Chart)
      salesChart.current = new Chart(salesRef.current, {
        type: "bar",
        data: {
          labels: data.labels,
          datasets: [{ 
              label: "Ventes (XOF)", 
              data: data.amounts,
              backgroundColor: 'rgba(0, 123, 255, 0.8)', 
              borderRadius: 5,
              barThickness: 'flex',
              maxBarThickness: 50
          }],
        },
        options: { 
            responsive: true, 
            maintainAspectRatio: false,
            scales: { y: { beginAtZero: true } }
        },
      });

      // 2. Dettes/Solde Mensuel (Line Chart)
      debtsChart.current = new Chart(debtsRef.current, {
        type: "line",
        data: {
          labels: data.labels,
          datasets: [{ 
              label: "Dettes (Solde XOF)", 
              data: data.balances,
              borderColor: 'rgb(220, 53, 69)', 
              backgroundColor: 'rgba(220, 53, 69, 0.1)',
              fill: true,
              tension: 0.4,
              pointRadius: 3 
          }],
        },
        options: { 
            responsive: true, 
            maintainAspectRatio: false,
            scales: { y: { beginAtZero: true } }
        },
      });
      
      // 3. Répartition par Type de Poisson (Doughnut Chart)
      typeChart.current = new Chart(typeRef.current, {
          type: "doughnut",
          data: {
              labels: ['Tilapia', 'Pangasius'],
              datasets: [{
                  data: [data.tilapiaAmount, data.pangasiusAmount],
                  backgroundColor: ['#007bff', '#198754'],
                  hoverOffset: 4
              }]
          },
          options: {
              responsive: true,
              maintainAspectRatio: false,
              plugins: {
                  legend: { position: 'bottom' }
              }
          }
      });

      return () => {
          [salesChart, debtsChart, typeChart].forEach(chart => chart.current?.destroy?.());
      };
    }, [chartReady, data]);

    if (!chartReady) {
        return <div className="text-center py-5 text-muted">Chargement des graphiques...</div>;
    }

    // Adapté à 1, 2 ou 3 colonnes selon l'écran
    return (
      <div className="row g-4 mb-4">
        <div className="col-12 col-lg-6 col-xl-4">
          <div className="card border-0 shadow-sm rounded-4 h-100">
            <div className="card-body">
              <h5 className="fw-bold text-dark mb-3"><i className="bi bi-bar-chart-fill me-2 text-primary"></i>Volume des Ventes</h5>
              <div style={{ height: 300 }} className="chart-container">
                  <canvas ref={salesRef} />
              </div>
            </div>
          </div>
        </div>
        <div className="col-12 col-lg-6 col-xl-4">
          <div className="card border-0 shadow-sm rounded-4 h-100">
            <div className="card-body">
              <h5 className="fw-bold text-dark mb-3"><i className="bi bi-file-earmark-bar-graph-fill me-2 text-danger"></i>Évolution des Dettes</h5>
              <div style={{ height: 300 }} className="chart-container">
                  <canvas ref={debtsRef} />
              </div>
            </div>
          </div>
        </div>
        <div className="col-12 col-xl-4">
          <div className="card border-0 shadow-sm rounded-4 h-100">
            <div className="card-body">
              <h5 className="fw-bold text-dark mb-3"><i className="bi bi-pie-chart-fill me-2 text-info"></i>Ventes par Espèce</h5>
                <div style={{ height: 300 }} className="d-flex align-items-center justify-content-center chart-container">
                  <canvas ref={typeRef} style={{ maxHeight: '250px' }} />
              </div>
            </div>
          </div>
        </div>
      </div>
    );
}

/* ========================= NOTIFICATIONS D’ÉCHÉANCE (Refonte pour mobile) ========================= */
function DueNotificationsPanel() {
    const [sales, setSales] = useState([]);
    const [thresholdDays, setThresholdDays] = useState(
      Number(localStorage.getItem("due_threshold_days") || 30)
    );
    const [perm, setPerm] = useState(Notification?.permission || "default");

    useEffect(() => {
      (async () => {
        const res = await apiFetch("/api/sales");
        const data = await res.json();
        setSales(Array.isArray(data) ? data : []);
      })();
    }, []);

    useEffect(() => {
      localStorage.setItem("due_threshold_days", String(thresholdDays));
    }, [thresholdDays]);

    const overdue = useMemo(() => {
      const now = Date.now();
      const cut = thresholdDays * 24 * 3600 * 1000;
      return sales
        .filter((s) => Number(s.balance || 0) > 0 && now - new Date(s.date).getTime() > cut)
        .map((s) => ({
          id: s._id,
          client: s.clientName,
          date: new Date(s.date),
          balance: s.balance,
          days: Math.floor((now - new Date(s.date).getTime()) / (24 * 3600 * 1000)),
        }))
        .sort((a, b) => b.days - a.days);
    }, [sales, thresholdDays]);

    const askPerm = async () => {
      if (!("Notification" in window)) {
        alert("Les notifications ne sont pas supportées par ce navigateur.");
        return;
      }
      const p = await Notification.requestPermission();
      setPerm(p);
    };

    const notifyNow = () => {
      if (perm !== "granted" || overdue.length === 0) return;
      const top = overdue.slice(0, 3);
      const body = top.map(o => `${o.client}: ${money(o.balance)} (${o.days} j)`).join("\n");
      new Notification("Dettes en retard", { body });
    };

    return (
      <div className="card border-0 shadow rounded-4 mb-4 bg-white">
        <div className="card-body p-4">
          <div className="d-flex flex-wrap align-items-center mb-4 pb-2 border-bottom">
            <h5 className="m-0 fw-bold"><i className="bi bi-bell-fill me-2 text-warning"></i>Clients en Retard (Alerte)</h5>
            <div className="ms-auto d-flex flex-wrap gap-2 align-items-center mt-2 mt-sm-0">
              <div className="input-group input-group-sm" style={{ width: 180 }}>
                <span className="input-group-text small">Retard ≥</span>
                <input type="number" className="form-control" min="1" value={thresholdDays}
                        onChange={(e) => setThresholdDays(Number(e.target.value) || 1)} />
                <span className="input-group-text small">jours</span>
              </div>
              {perm !== "granted" ? (
                <button className="btn btn-warning btn-sm rounded-pill" onClick={askPerm}>Activer les alertes</button>
              ) : (
                <button className="btn btn-outline-secondary btn-sm rounded-pill" onClick={notifyNow}>Tester alerte</button>
              )}
            </div>
          </div>

          <div className="table-responsive">
            <table className="table align-middle table-striped">
              <thead className="table-light">
              <tr><th>Client</th><th>Date Op.</th><th>Jours Retard</th><th>Solde Dû</th></tr>
              </thead>
              <tbody>
              {overdue.length === 0 && <tr><td colSpan="4" className="text-center py-3 text-muted">🎉 Aucune dette n'a dépassé le seuil de {thresholdDays} jours.</td></tr>}
              {overdue.map(o => (
                <tr key={o.id} className="table-warning-subtle">
                  <td className="fw-bold text-dark">{o.client}</td>
                  <td>{o.date.toISOString().slice(0,10)}</td>
                  <td className="text-danger fw-bold">{o.days}</td>
                  <td className="text-danger fw-bolder">{money(o.balance)}</td>
                </tr>
              ))}
              </tbody>
            </table>
          </div>
        </div>
      </div>
    );
}

function ReloadableSalesTable() {
    const [key, setKey] = useState(0);
    useEffect(() => {
      const handler = () => setKey((k) => k + 1);
      window.addEventListener("reload-sales", handler);
      return () => window.removeEventListener("reload-sales", handler);
    }, []);
    return <SalesTable key={key} />;
}


/* ========================= APP (Layout Responsif) ========================= */
export default function App() {
  const [authed, setAuthed] = useState(!!localStorage.getItem("token"));
  const companyName = localStorage.getItem("companyName") || "Mon Entreprise";
  const [currentPage, setCurrentPage] = useState("dashboard");
  const [isSidebarOpen, setIsSidebarOpen] = useState(false); // État pour le sidebar dynamique

  const handleLogout = () => {
    localStorage.removeItem("token");
    localStorage.removeItem("companyName");
    setAuthed(false);
  };
    
  const getPageTitle = (page) => {
      switch(page) {
          case 'dashboard': return 'Tableau de Bord 📊 - Synthèse';
          case 'new-sale': return 'Nouvelle Opération de Vente 📝';
          case 'sales': return 'Historique des Ventes & Actions 📋';
          case 'debts': return 'Vue Dettes Clients 💰';
          case 'charts': return 'Analyse Graphique 📈';
          default: return 'Tableau de Bord';
      }
  }

  if (!authed) return <AuthView onAuth={() => setAuthed(true)} />;

  const renderPage = () => {
      switch(currentPage) {
          case 'new-sale':
              return <SaleForm onSaved={() => setCurrentPage('sales')} />;
          case 'sales':
              return <ReloadableSalesTable />;
          case 'debts':
              return (
                  <>
                    <DebtsBoard />
                    <DueNotificationsPanel />
                    <ReloadableSalesTable /> 
                  </>
              );
          case 'charts':
              return (
                  <>
                    <ChartsPanel />
                    <SummaryCards />
                  </>
              );
          case 'dashboard':
          default:
              return (
                  <>
                      <SummaryCards />
                      <DueNotificationsPanel />
                      <ChartsPanel />
                      <div className="row g-4 mt-1">
                          <div className="col-lg-4"><DebtsBoard /></div>
                          <div className="col-lg-8"><ReloadableSalesTable /></div>
                      </div>
                  </>
              );
      }
  }

  return (
    <div className="d-flex">
      {/* Sidebar - Fixé sur desktop, Offcanvas sur mobile */}
      <Sidebar 
          companyName={companyName} 
          onLogout={handleLogout} 
          currentPage={currentPage}
          onNavigate={setCurrentPage}
          isOpen={isSidebarOpen}
          onClose={() => setIsSidebarOpen(false)}
      />

      {/* Header Mobile - Uniquement visible sur les petits écrans */}
      <MobileHeader 
        title={getPageTitle(currentPage)} 
        onToggleSidebar={() => setIsSidebarOpen(true)} 
      />

      {/* Contenu Principal - Adapté à la présence/absence du sidebar sur desktop/mobile */}
      <main 
          className="flex-grow-1 p-0" 
          style={{ 
              marginLeft: window.innerWidth >= 768 ? SIDEBAR_WIDTH : 0, 
              background: "#f0f2f5", 
              minHeight: "100vh",
              transition: 'margin-left 0.3s ease'
          }}
      >
        <div className="container-fluid py-4 p-md-4">
          
          {/* Header de la page pour Desktop et Tablettes */}
          <div className="d-none d-md-flex align-items-center mb-4 pb-2 border-bottom border-secondary-subtle">
              <h1 className="h2 m-0 text-dark fw-light">{getPageTitle(currentPage)}</h1>
              <div className="ms-auto small text-muted">Connecté en tant que **{companyName}**</div>
          </div>

          {/* Rendu du contenu de la page active */}
          {renderPage()}

          {/* Footer pour le style */}
          <footer className="py-3 text-center text-muted small mt-5 border-top">
              &copy; {new Date().getFullYear()} Fish Manage. Design amélioré par Gemini.
          </footer>
        </div>
      </main>
    </div>
  );
}
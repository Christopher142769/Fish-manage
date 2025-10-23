import React, { useEffect, useMemo, useRef, useState } from "react";

/** === CONFIG API (fixe) === */
const API_BASE = "https://fish-manage-back.onrender.com";
const SIDEBAR_WIDTH = 280; // Largeur de la sidebar en pixels

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
  const cls = type === "tilapia" ? "text-bg-primary" : "text-bg-success";
  return <span className={`badge rounded-pill fw-normal ${cls}`}>{type === "tilapia" ? "Tilapia" : "Pangasius"}</span>;
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
      window.Chart.register(window.Chart.controllers.bar, window.Chart.controllers.line, window.Chart.controllers.doughnut);
      setReady(true);
    };
    document.body.appendChild(s);
    return () => s.remove();
  }, []);
  return ready;
}

/* ========================= SIDEBAR DYNAMIQUE ULTRA-RESPONSIVE ========================= */
function Sidebar({ companyName, onLogout, currentPage, onNavigate, isOpen, onToggle }) {
  const navItems = [
    { id: "dashboard", icon: "bi-house-door-fill", label: "Dashboard" },
    { id: "new-sale", icon: "bi-cash-coin", label: "Nouvelle Vente" },
    { id: "sales", icon: "bi-table", label: "Historique & Actions" },
    { id: "debts", icon: "bi-exclamation-triangle-fill", label: "Dettes Clients" },
    { id: "charts", icon: "bi-graph-up", label: "Analyse Graphique" },
  ];

  return (
    <>
      {/* Overlay pour mobile */}
      <div 
        className={`sidebar-overlay ${isOpen ? 'd-block' : 'd-none'} d-md-none`}
        onClick={onToggle}
      />
      
      {/* Sidebar */}
      <div 
        className="sidebar d-flex flex-column flex-shrink-0 text-white shadow-2xl"
        style={{ 
          width: SIDEBAR_WIDTH, 
          height: '100vh', 
          top: 0, 
          left: isOpen ? 0 : '-100%', 
          position: 'fixed', 
          zIndex: 1040,
          transition: 'left 0.3s cubic-bezier(0.4, 0, 0.2, 1)',
          background: 'linear-gradient(145deg, #1e3a8a 0%, #1e40af 50%, #1d4ed8 100%)'
        }}
      >
        {/* Header Sidebar */}
        <div className="p-4 border-bottom" style={{borderColor: 'rgba(255,255,255,0.1)'}}>
          <div className="d-flex align-items-center justify-content-between">
            <div className="d-flex align-items-center">
              <div className="me-3 p-2 rounded-3" style={{background: 'rgba(255,255,255,0.15)'}}>
                <i className="bi bi-water fs-3 text-cyan-400"></i>
              </div>
              <div>
                <h5 className="mb-0 fw-bold">Fish Manage</h5>
                <small className="opacity-75">Gestion Pro</small>
              </div>
            </div>
            <button className="btn btn-sm btn-link text-white d-md-none" onClick={onToggle}>
              <i className="bi bi-x-lg"></i>
            </button>
          </div>
        </div>

        {/* Navigation */}
        <nav className="flex-grow-1 p-2 pt-4">
          <ul className="list-unstyled">
            {navItems.map(item => (
              <li key={item.id} className="mb-2">
                <button 
                  className={`nav-btn w-100 text-start p-3 rounded-3 transition-all ${
                    currentPage === item.id 
                      ? 'active bg-gradient-primary shadow-lg shadow-primary/50 scale-105' 
                      : 'hover-bg-primary/20'
                  }`}
                  onClick={() => {
                    onNavigate(item.id);
                    if (window.innerWidth < 768) onToggle(); // Ferme sur mobile
                  }}
                >
                  <div className="d-flex align-items-center">
                    <i className={`bi ${item.icon} me-3 fs-4 opacity-90`}></i>
                    <span className="fw-semibold fs-5">{item.label}</span>
                  </div>
                </button>
              </li>
            ))}
          </ul>
        </nav>

        {/* Footer */}
        <div className="p-4 border-top" style={{borderColor: 'rgba(255,255,255,0.1)'}}>
          <div className="d-flex align-items-center p-3 rounded-3 bg-white/10">
            <div className="me-3">
              <div className="rounded-circle bg-white/20 p-2">
                <i className="bi bi-person-circle fs-4"></i>
              </div>
            </div>
            <div className="flex-grow-1 min-w-0">
              <div className="fw-bold small mb-0 text-truncate">{companyName}</div>
              <small className="opacity-75">Admin</small>
            </div>
            <button className="btn btn-sm btn-outline-light rounded-pill px-3" onClick={onLogout}>
              <i className="bi bi-box-arrow-right me-1"></i>
              Déco
            </button>
          </div>
        </div>
      </div>
    </>
  );
}

/* ========================= CSS INJECTÉ POUR LES ANIMATIONS ========================= */
function injectGlobalStyles() {
  useEffect(() => {
    const style = document.createElement('style');
    style.textContent = `
      @keyframes spin { to { transform: rotate(360deg); } }
      .spin { animation: spin 1s linear infinite; }
      
      .sidebar-overlay {
        position: fixed;
        top: 0;
        left: 0;
        right: 0;
        bottom: 0;
        background: rgba(0,0,0,0.5);
        z-index: 1039;
        backdrop-filter: blur(4px);
      }
      
      .nav-btn {
        transition: all 0.2s cubic-bezier(0.4, 0, 0.2, 1);
        border: none;
        background: transparent;
        color: white;
      }
      
      .nav-btn:hover {
        transform: translateX(8px);
      }
      
      .nav-btn.active {
        box-shadow: 0 10px 25px rgba(0,0,0,0.3) !important;
      }
      
      .hover-bg-primary\\\/20:hover {
        background: rgba(59, 130, 246, 0.2) !important;
      }
      
      .bg-gradient-primary {
        background: linear-gradient(135deg, #3b82f6 0%, #1d4ed8 100%) !important;
      }
      
      .shadow-2xl {
        box-shadow: 0 25px 50px -12px rgba(0, 0, 0, 0.25) !important;
      }
      
      .scale-105 {
        transform: scale(1.02) !important;
      }
      
      @media (max-width: 768px) {
        .main-content {
          transition: margin-left 0.3s ease !important;
        }
      }
    `;
    document.head.appendChild(style);
    return () => style.remove();
  }, []);
}

/* ========================= AUTH ULTRA MODERNE ========================= */
function AuthView({ onAuth }) {
  injectGlobalStyles();
  const [mode, setMode] = useState("login");
  const [companyName, setCompanyName] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [err, setErr] = useState("");
  const [loading, setLoading] = useState(false);

  const submit = async (e) => {
    e.preventDefault();
    setErr("");
    setLoading(true);
    try {
      const path = mode === "login" ? "/api/auth/login" : "/api/auth/register";
      const body = mode === "login" ? { email, password } : { companyName, email, password };
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
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="vh-100 d-flex align-items-center justify-content-center p-4" 
         style={{ 
           background: 'linear-gradient(135deg, #667eea 0%, #764ba2 100%)',
           position: 'relative',
           overflow: 'hidden'
         }}>
      {/* Particles background */}
      <div className="position-absolute w-100 h-100 opacity-20">
        <div className="position-absolute top-0 start-0 w-50 h-50 bg-white rounded-circle" style={{transform: 'translate(-50%, -50%) scale(0.8)'}}></div>
        <div className="position-absolute bottom-0 end-0 w-75 h-75 bg-primary rounded-circle opacity-25" style={{transform: 'translate(30%, 30%) scale(0.6)'}}></div>
      </div>
      
      <div className="col-lg-5 col-xl-4 col-xxl-3">
        <div className="card border-0 shadow-2xl rounded-4 overflow-hidden">
          <div className="card-header bg-gradient-primary text-white p-5 text-center position-relative overflow-hidden">
            <div className="position-absolute top-0 start-0 w-100 h-100 bg-white opacity-5"></div>
            <i className="bi bi-water display-3 mb-3 d-block"></i>
            <h2 className="fw-bold mb-1">Fish Manage</h2>
            <p className="opacity-90 mb-0">Dashboard Pro</p>
          </div>
          <div className="card-body p-5">
            <form onSubmit={submit}>
              {mode === "register" && (
                <div className="mb-4">
                  <label className="form-label fw-bold fs-5 mb-2">Nom Entreprise</label>
                  <input
                    className="form-control form-control-lg rounded-4 shadow-sm"
                    value={companyName}
                    onChange={(e) => setCompanyName(e.target.value)}
                    required
                    placeholder="Votre entreprise"
                  />
                </div>
              )}
              <div className="mb-4">
                <label className="form-label fw-bold fs-5 mb-2">Email</label>
                <input
                  type="email"
                  className="form-control form-control-lg rounded-4 shadow-sm"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  required
                  placeholder="contact@votreentreprise.com"
                />
              </div>
              <div className="mb-5">
                <label className="form-label fw-bold fs-5 mb-2">Mot de passe</label>
                <input
                  type="password"
                  className="form-control form-control-lg rounded-4 shadow-sm"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  required
                  placeholder="••••••••"
                />
              </div>
              {err && <div className="alert alert-danger rounded-4 mb-4">{err}</div>}
              <button 
                className="btn btn-primary btn-lg w-100 rounded-4 shadow-lg mb-3 fw-bold fs-5 py-3"
                type="submit"
                disabled={loading}
              >
                {loading ? (
                  <>
                    <span className="spinner-border spinner-border-sm me-2" role="status"></span>
                    Connexion en cours...
                  </>
                ) : mode === "login" ? "Se connecter" : "Créer le compte"}
              </button>
              <button
                type="button"
                className="btn btn-outline-primary btn-lg w-100 rounded-4 fw-semibold py-3"
                onClick={() => setMode(mode === "login" ? "register" : "login")}
              >
                {mode === "login" ? "Créer un compte" : "J'ai déjà un compte"}
              </button>
            </form>
          </div>
        </div>
        <div className="text-center text-white mt-4 opacity-75 small">
          Backend: <code className="bg-black bg-opacity-25 px-2 py-1 rounded">{API_BASE}</code>
        </div>
      </div>
    </div>
  );
}

/* ========================= FORM VENTE RESPONSIVE ========================= */
function SaleForm({ onSaved }) {
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
      setDate(new Date().toISOString().slice(0, 10));
      onSaved && onSaved(data);
      window.dispatchEvent(new Event("reload-sales"));
    } catch (err) { 
      alert(err.message); 
    } finally { 
      setLoading(false); 
    }
  };

  return (
    <div className="card border-0 shadow-xl rounded-4 mb-4 overflow-hidden">
      <div className="card-header bg-gradient-primary text-white p-4 position-relative">
        <div className="position-absolute top-0 start-0 w-100 h-100 bg-white opacity-10"></div>
        <div className="d-flex align-items-center position-relative">
          <div className="p-3 rounded-3 bg-white bg-opacity-20 me-3">
            <i className="bi bi-bag-plus-fill fs-3"></i>
          </div>
          <h4 className="m-0 fw-bold">Nouvelle Vente Lightning</h4>
        </div>
      </div>
      <div className="card-body p-4 p-md-5">
        <form onSubmit={save} className="row g-3 g-md-4">
          <div className="col-12">
            <label className="form-label fw-bold">👤 Client / Entreprise</label>
            <input className="form-control form-control-lg rounded-3 shadow-sm" 
                   value={clientName} onChange={(e) => setClient(e.target.value)} 
                   required placeholder="Nom du client" />
          </div>
          
          <div className="col-6 col-md-3">
            <label className="form-label fw-bold">📅 Date</label>
            <input type="date" className="form-control form-control-lg rounded-3 shadow-sm" 
                   value={date} onChange={(e) => setDate(e.target.value)} required />
          </div>
          
          <div className="col-6 col-md-3">
            <label className="form-label fw-bold">🐟 Poisson</label>
            <select className="form-select form-select-lg rounded-3 shadow-sm" 
                    value={fishType} onChange={(e) => setFishType(e.target.value)}>
              <option value="tilapia">Tilapia</option>
              <option value="pangasius">Pangasius</option>
            </select>
          </div>
          
          <div className="col-md-6">
            <label className="form-label fw-bold">⚖️ Qté Commandée (kg)</label>
            <input type="number" step="0.01" className="form-control form-control-lg rounded-3 shadow-sm" 
                   value={quantity} onChange={(e) => setQty(e.target.value)} required />
          </div>
          
          <div className="col-md-6">
            <label className="form-label fw-bold">💰 Prix Unitaire</label>
            <input type="number" step="0.01" className="form-control form-control-lg rounded-3 shadow-sm" 
                   value={unitPrice} onChange={(e) => setUnit(e.target.value)} required />
          </div>
          
          <div className="col-md-6">
            <label className="form-label fw-bold">🚚 Déjà Livré (kg)</label>
            <input type="number" step="0.01" className="form-control form-control-lg rounded-3 shadow-sm" 
                   value={delivered} onChange={(e) => setDelivered(e.target.value)} />
          </div>
          
          <div className="col-md-6">
            <label className="form-label fw-bold">💵 Acompte Payé</label>
            <input type="number" step="0.01" className="form-control form-control-lg rounded-3 shadow-sm" 
                   value={payment} onChange={(e) => setPay(e.target.value)} />
          </div>
          
          <div className="col-12">
            <label className="form-label fw-bold">📝 Observation</label>
            <input className="form-control form-control-lg rounded-3 shadow-sm" 
                   value={observation} onChange={(e) => setObs(e.target.value)} 
                   placeholder="Notes importantes..." />
          </div>

          <div className="col-12">
            <button className="btn btn-success btn-lg w-100 rounded-4 shadow-lg fw-bold py-3 fs-5" 
                    disabled={loading || !clientName || !quantity || !unitPrice}>
              {loading ? (
                <>
                  <span className="spinner-border spinner-border-sm me-2"></span>
                  Enregistrement...
                </>
              ) : (
                <>
                  <i className="bi bi-lightning-charge me-2"></i>
                  ENREGISTRER LA VENTE
                </>
              )}
            </button>
          </div>

          {/* Résumé en temps réel */}
          <div className="col-12">
            <div className="row g-2 p-4 rounded-4 bg-gradient-info text-white shadow-lg">
              <div className="col-4 col-md-3 text-center">
                <div className="fs-5 fw-bold">{money(amount)}</div>
                <small>Montant Total</small>
              </div>
              <div className="col-4 col-md-3 text-center">
                <div className={`fs-5 fw-bold ${remainingToDeliver > 0 ? 'text-warning' : 'text-success'}`}>
                  {remainingToDeliver} kg
                </div>
                <small>Reste à Livrer</small>
              </div>
              <div className="col-4 col-md-3 text-center">
                <div className={`fs-5 fw-bold ${balance > 0 ? 'text-danger' : 'text-success'}`}>
                  {money(balance)}
                </div>
                <small>À Recevoir</small>
              </div>
              <div className="col-md-3 d-none d-md-block text-center">
                <BadgeFish type={fishType} />
              </div>
            </div>
          </div>
        </form>
      </div>
    </div>
  );
}

/* ========================= TABLE RESPONSIVE PRO ========================= */
function SalesTable() {
  const [sales, setSales] = useState([]);
  const [filterType, setFilterType] = useState("");
  const [searchClient, setSearchClient] = useState("");
  const [loading, setLoading] = useState(true);
  const [openRow, setOpenRow] = useState(null);
  const [actionType, setActionType] = useState("");
  const [actionValue, setActionValue] = useState("");

  const load = async () => {
    setLoading(true);
    const qs = new URLSearchParams();
    if (filterType) qs.set("fishType", filterType);
    if (searchClient) qs.set("client", searchClient);
    const res = await apiFetch(`/api/sales?${qs.toString()}`);
    const data = await res.json();
    setSales(Array.isArray(data) ? data : []);
    setLoading(false);
  };

  useEffect(() => { load(); }, [filterType, searchClient]);

  // ... reste de la logique inchangée mais avec UI améliorée
  const toggleAction = (id, type, suggested) => {
    if (openRow === id && actionType === type) {
      setOpenRow(null); setActionType(""); setActionValue("");
    } else {
      setOpenRow(id); setActionType(type); setActionValue(suggested ?? "");
    }
  };

  const submitAction = async (sale) => {
    try {
      if (actionType === "deliver") {
        const qty = Number(actionValue || 0);
        const res = await apiFetch(`/api/sales/${sale._id}/deliver`, { 
          method: "PATCH", 
          body: JSON.stringify({ qty }) 
        });
        const data = await res.json(); 
        if (!res.ok) throw new Error(data.error || "Erreur livraison");
        setSales((prev) => prev.map((s) => (s._id === sale._id ? data : s)));
      } else if (actionType === "pay") {
        const amount = Number(actionValue || 0);
        const res = await apiFetch(`/api/sales/${sale._id}/pay`, { 
          method: "PATCH", 
          body: JSON.stringify({ amount }) 
        });
        const data = await res.json(); 
        if (!res.ok) throw new Error(data.error || "Erreur règlement");
        setSales((prev) => prev.map((s) => (s._id === sale._id ? data : s)));
      }
      setOpenRow(null); setActionType(""); setActionValue("");
    } catch (e) { alert(e.message); }
  };

  return (
    <div className="card border-0 shadow-xl rounded-4 overflow-hidden">
      <div className="card-body p-0">
        {/* Header amélioré */}
        <div className="p-4 pb-3 bg-gradient-light border-bottom">
          <div className="d-flex flex-column flex-sm-row gap-3 align-items-start align-items-sm-center justify-content-between">
            <div>
              <h4 className="mb-1 fw-bold">
                <i className="bi bi-table me-2 text-primary"></i>
                Historique Complet
              </h4>
              <small className="text-muted">{sales.length} opérations</small>
            </div>
            <div className="d-flex gap-2 flex-wrap">
              <div className="input-group input-group-sm">
                <span className="input-group-text bg-white border-0 shadow-sm">
                  <i className="bi bi-search text-muted"></i>
                </span>
                <input className="form-control border-0 shadow-sm" 
                       placeholder="Rechercher client..." 
                       value={searchClient} 
                       onChange={(e) => setSearchClient(e.target.value)} />
              </div>
              <select className="form-select form-select-sm rounded-3 shadow-sm" 
                      value={filterType} 
                      onChange={(e) => setFilterType(e.target.value)}>
                <option value="">Tous</option>
                <option value="tilapia">Tilapia</option>
                <option value="pangasius">Pangasius</option>
              </select>
              <button className="btn btn-success btn-sm rounded-pill shadow-sm px-4" 
                      onClick={async () => {
                        const res = await apiFetch("/api/exports/sales.xlsx");
                        const blob = await res.blob();
                        const url = URL.createObjectURL(blob);
                        const a = document.createElement("a");
                        a.href = url;
                        a.download = `ventes-${new Date().toISOString().slice(0,10)}.xlsx`;
                        a.click();
                      }}>
                <i className="bi bi-download me-1"></i>Excel
              </button>
            </div>
          </div>
        </div>

        <div className="table-responsive" style={{maxHeight: '70vh'}}>
          <table className="table table-hover mb-0 align-middle">
            <thead className="table-dark sticky-top">
              <tr>
                <th className="py-3">Date</th>
                <th className="py-3">Client</th>
                <th className="py-3">🐟</th>
                <th className="py-3 d-none d-md-table-cell">Qté</th>
                <th className="py-3 d-none d-lg-table-cell">Livré</th>
                <th className="py-3">💰</th>
                <th className="py-3 d-none d-md-table-cell">Solde</th>
                <th className="py-3">⚡</th>
              </tr>
            </thead>
            <tbody>
              {loading && (
                <tr>
                  <td colSpan="8" className="text-center py-5">
                    <div className="spinner-border text-primary mb-3" style={{width: '3rem', height: '3rem'}}></div>
                    <div>Chargement ultra-rapide...</div>
                  </td>
                </tr>
              )}
              {!loading && sales.length === 0 && (
                <tr>
                  <td colSpan="8" className="text-center py-5 text-muted">
                    <i className="bi bi-inbox display-4 mb-3 opacity-25"></i>
                    <div>Aucune vente pour le moment</div>
                  </td>
                </tr>
              )}
              {sales.map((s) => {
                const remainingToDeliver = Math.max(0, s.quantity - (s.delivered || 0));
                const remainingToPay = Math.max(0
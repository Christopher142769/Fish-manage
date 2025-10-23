import React, { useEffect, useMemo, useRef, useState } from "react";

/** =====================================
 * CONFIG GLOBALE
 * ===================================== */
const API_BASE = "https://fish-manage-back.onrender.com";
const SIDEBAR_WIDTH = 250; // px

/** Helpers */
const money = (n) => (n ?? 0).toLocaleString("fr-FR", { style: "currency", currency: "XOF" });

function apiFetch(path, options = {}) {
  const token = typeof window !== "undefined" ? localStorage.getItem("token") : null;
  const headers = { "Content-Type": "application/json", ...(options.headers || {}) };
  if (token) headers["Authorization"] = `Bearer ${token}`;
  return fetch(`${API_BASE}${path}`, { ...options, headers });
}

function BadgeFish({ type }) {
  const cls = type === "tilapia" ? "text-bg-primary" : "text-bg-success";
  return (
    <span className={`badge rounded-pill fw-normal ${cls}`}>
      {type === "tilapia" ? "Tilapia" : "Pangasius"}
    </span>
  );
}

/** =====================================
 * HOOKS
 * ===================================== */
function useViewport() {
  const [w, setW] = useState(typeof window !== "undefined" ? window.innerWidth : 1200);
  useEffect(() => {
    const onR = () => setW(window.innerWidth);
    window.addEventListener("resize", onR);
    return () => window.removeEventListener("resize", onR);
  }, []);
  // isMdUp est désormais basé sur la convention Bootstrap (768px)
  return { width: w, isMdUp: w >= 768 };
}

/** Chargement dynamique Chart.js (CDN) + enregistrement */
function useChartJs() {
  const [ready, setReady] = useState(!!(typeof window !== "undefined" && window.Chart));
  useEffect(() => {
    if (typeof window === "undefined") return;
    if (window.Chart) {
      try { window.Chart.register(...(window.Chart.registerables || [])); } catch {}
      setReady(true);
      return;
    }
    const s = document.createElement("script");
    s.src = "https://cdn.jsdelivr.net/npm/chart.js";
    s.async = true;
    s.onload = () => {
      try { window.Chart.register(...(window.Chart.registerables || [])); } catch {}
      setReady(true);
    };
    document.body.appendChild(s);
    return () => s.remove();
  }, []);
  return ready;
}

/** =====================================
 * SIDEBAR + NAVBAR
 * ===================================== */
function Sidebar({ companyName, currentPage, onNavigate, onLogout, open, setOpen, isMdUp }) {
  const navItems = [
    { id: "dashboard", icon: "bi-house-door-fill", label: "Dashboard" },
    { id: "new-sale", icon: "bi-cash-coin", label: "Nouvelle Vente" },
    { id: "sales", icon: "bi-table", label: "Historique & Actions" },
    { id: "debts", icon: "bi-exclamation-triangle-fill", label: "Dettes Clients" },
    { id: "client-report", icon: "bi-file-earmark-bar-graph-fill", label: "Bilan Client" }, 
    { id: "charts", icon: "bi-graph-up", label: "Analyse Graphique" },
  ];

  // Fermeture au clic à l'extérieur (mobile)
  useEffect(() => {
    if (isMdUp || !open) return;
    const onKey = (e) => e.key === "Escape" && setOpen(false);
    document.addEventListener("keydown", onKey);
    return () => document.removeEventListener("keydown", onKey);
  }, [open, isMdUp, setOpen]);

  // J'ai corrigé le style de transition pour la rendre plus propre sur mobile
  return (
    <>
      {/* Overlay pour mobile */}
      {!isMdUp && (
        <div
          onClick={() => setOpen(false)}
          className={`position-fixed top-0 start-0 w-100 h-100 bg-dark bg-opacity-50 ${open ? "d-block" : "d-none"}`}
          style={{ zIndex: 1029 }}
        />
      )}

      <aside
        className={`bg-dark text-white shadow-lg d-flex flex-column p-3 position-fixed top-0 start-0`}
        style={{ 
          width: SIDEBAR_WIDTH, 
          height: "100vh", 
          zIndex: 1030, 
          transition: "transform .25s ease",
          // Déplacement hors écran si non-md (mobile) et fermé
          transform: !isMdUp && !open ? `translateX(-${SIDEBAR_WIDTH}px)` : "translateX(0)",
        }}
      >
        <button
          type="button"
          className="btn btn-link text-white d-md-none align-self-end p-0 mb-2"
          onClick={() => setOpen(false)}
          aria-label="Fermer le menu"
        >
          <i className="bi bi-x-lg fs-5" />
        </button>

        <a href="#" className="d-flex align-items-center mb-3 text-white text-decoration-none">
          <i className="bi bi-water me-2 fs-4 text-info"></i>
          <span className="fs-5 fw-bold">Fish Manage</span>
        </a>
        <hr className="border-secondary" />

        <ul className="nav nav-pills flex-column mb-auto">
          {navItems.map((item) => (
            <li className="nav-item" key={item.id}>
              <button
                className={`btn nav-link text-start text-white w-100 mb-1 ${
                  currentPage === item.id ? "active bg-primary shadow-sm" : "link-body-emphasis"
                }`}
                onClick={() => {
                  onNavigate(item.id);
                  if (!isMdUp) setOpen(false);
                }}
              >
                <i className={`bi ${item.icon} me-2`}></i>
                {item.label}
              </button>
            </li>
          ))}
        </ul>

        <hr className="border-secondary mt-auto" />
        <div className="d-flex align-items-center text-white">
          <i className="bi bi-person-circle me-2 fs-5"></i>
          <strong className="text-truncate" style={{ maxWidth: 150 }}>{companyName}</strong>
          <button className="btn btn-link text-danger ms-auto p-0" onClick={onLogout} title="Se déconnecter">
            <i className="bi bi-box-arrow-right fs-5"></i>
          </button>
        </div>
      </aside>
    </>
  );
}

function Topbar({ title, companyName, onBurger }) {
  return (
    <div className="d-flex align-items-center mb-4 pb-2 border-bottom border-secondary-subtle">
      <button className="btn btn-outline-secondary d-md-none me-2" onClick={onBurger} aria-label="Ouvrir le menu">
        <i className="bi bi-list"></i>
      </button>
      <h1 className="h5 h-md2 m-0 text-dark fw-semibold">{title}</h1>
      <div className="ms-auto small text-muted d-none d-md-block">Connecté en tant que <strong>{companyName}</strong></div>
    </div>
  );
}

/** =====================================
 * AUTH VIEW
 * ===================================== */
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
    }
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
                  <p className="text-muted small">Connexion au Dashboard</p>
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
              </div>
            </div>
            <div className="text-center text-muted mt-3 small">
              {/* Backend: <code>{API_BASE}</code> */}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

// ----------------------------------------------------------------------------------------------------------------------------------------------------------
// NOUVEAU COMPOSANT : Corps de formulaire de vente réutilisable
// ----------------------------------------------------------------------------------------------------------------------------------------------------------
function SaleFormBody({ data, setData, disabled = false }) {
    return (
        <div className="row g-3">
            <div className="col-6">
                <label className="form-label small fw-semibold">Poisson</label>
                <select 
                    className="form-select" 
                    value={data.fishType} 
                    onChange={(e) => setData(p => ({...p, fishType: e.target.value}))}
                    disabled={disabled}
                >
                    <option value="tilapia">Tilapia</option>
                    <option value="pangasius">Pangasius</option>
                </select>
            </div>
            <div className="col-6">
                <label className="form-label small fw-semibold">Qté Commandée (kg)</label>
                <input 
                    type="number" 
                    step="0.01" 
                    className="form-control" 
                    value={data.quantity} 
                    onChange={(e) => setData(p => ({...p, quantity: e.target.value}))} 
                    required 
                    disabled={disabled}
                />
            </div>
            <div className="col-6">
                <label className="form-label small fw-semibold">Prix Unitaire (XOF)</label>
                <input 
                    type="number" 
                    step="0.01" 
                    className="form-control" 
                    value={data.unitPrice} 
                    onChange={(e) => setData(p => ({...p, unitPrice: e.target.value}))} 
                    required 
                    disabled={disabled}
                />
            </div>
            <div className="col-6">
                <label className="form-label small fw-semibold">Qté Livrée (kg)</label>
                <input 
                    type="number" 
                    step="0.01" 
                    className="form-control" 
                    value={data.delivered} 
                    onChange={(e) => setData(p => ({...p, delivered: e.target.value}))} 
                    disabled={disabled}
                />
            </div>
            <div className="col-6">
                <label className="form-label small fw-semibold">Règlement Payé (XOF)</label>
                <input 
                    type="number" 
                    step="0.01" 
                    className="form-control" 
                    value={data.payment} 
                    onChange={(e) => setData(p => ({...p, payment: e.target.value}))} 
                    disabled={disabled}
                />
            </div>
            <div className="col-12">
                <label className="form-label small fw-semibold">Observation</label>
                <input 
                    className="form-control" 
                    value={data.observation} 
                    onChange={(e) => setData(p => ({...p, observation: e.target.value}))} 
                    placeholder="Notes de la vente..."
                    disabled={disabled}
                />
            </div>
        </div>
    );
}

/** =====================================
 * SALE FORM
 * ===================================== */
function SaleForm({ onSaved }) {
    // Fusionner les états liés au formulaire dans un seul objet pour SaleFormBody
    const [formData, setFormData] = useState({
        fishType: 'tilapia',
        quantity: '',
        delivered: '',
        unitPrice: '',
        payment: '',
        observation: '',
    });
    // Les champs Client et Date restent en états séparés
    const [date, setDate] = useState(new Date().toISOString().slice(0, 10));
    const [clientName, setClient] = useState("");
    const [loading, setLoading] = useState(false);
    
    // Calculs basés sur formData
    const amount = (Number(formData.quantity || 0) * Number(formData.unitPrice || 0)) || 0;
    const balance = amount - Number(formData.payment || 0); 
    const remainingToDeliver = Math.max(0, Number(formData.quantity || 0) - Number(formData.delivered || 0));

    const save = async (e) => {
        e.preventDefault();
        setLoading(true);

        try {
            const q = Number(formData.quantity || 0);
            const d = Number(formData.delivered || 0);
            const u = Number(formData.unitPrice || 0);
            const p = Number(formData.payment || 0);

            if (q <= 0) throw new Error("La quantité commandée doit être positive.");
            if (u <= 0) throw new Error("Le prix unitaire doit être positif.");
            if (d > q) throw new Error(`La quantité livrée (${d} kg) ne peut pas dépasser la quantité commandée (${q} kg).`);

            const res = await apiFetch("/api/sales", {
                method: "POST",
                body: JSON.stringify({
                    date, clientName, 
                    fishType: formData.fishType,
                    quantity: q, delivered: d,
                    unitPrice: u, payment: p,
                    observation: formData.observation,
                }),
            });
            const data = await res.json();
            if (!res.ok) throw new Error(data.error || "Erreur");
            
            // Réinitialisation après succès
            setClient(""); 
            setFormData({fishType: 'tilapia', quantity: '', delivered: '', unitPrice: '', payment: '', observation: ''});
            
            onSaved && onSaved(data);
            window.dispatchEvent(new Event("reload-sales")); 
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
                        <input className="form-control" value={clientName} onChange={(e) => setClient(e.target.value)} required />
                    </div>
                    <div className="col-6 col-sm-6 col-md-6 col-lg-3">
                        <label className="form-label small fw-semibold">Date</label>
                        <input type="date" className="form-control" value={date} onChange={(e) => setDate(e.target.value)} required />
                    </div>
                    
                    {/* Utilisation du nouveau composant SaleFormBody */}
                    <div className="col-12">
                       <SaleFormBody data={formData} setData={setFormData} />
                    </div>

                    <div className="col-12 d-grid gap-2 mt-4">
                        <button className="btn btn-primary btn-lg rounded-pill" disabled={loading}>
                            <i className={`bi ${loading ? "bi-hourglass-split" : "bi-check-circle-fill"} me-2`}></i>
                            {loading ? "Enregistrement en cours..." : "Enregistrer la Vente"}
                        </button>
                    </div>

                    <div className="col-12 d-flex justify-content-between flex-wrap pt-3 mt-3 border-top">
                        <span className="badge bg-secondary p-2">Montant: <strong className="fs-6">{money(amount)}</strong></span>
                        <span className="badge bg-warning text-dark p-2">Reste à livrer: <strong className="fs-6">{remainingToDeliver} kg</strong></span>
                        <span className={`badge ${balance > 0 ? 'bg-danger' : 'bg-success'} p-2`}>
                            {balance > 0 ? "Solde à payer" : "Crédit Client"}: <strong className="fs-6">{money(Math.abs(balance))}</strong>
                        </span>
                    </div>
                </form>
            </div>
        </div>
    );
}

// ----------------------------------------------------------------------------------------------------------------------------------------------------------
// Composant MODAL pour gérer l'utilisation du crédit (remboursement ou nouvelle vente)
// ----------------------------------------------------------------------------------------------------------------------------------------------------------
function CreditUseModal({ sale, onClose, onRefundSuccess, onNewSaleSuccess }) {
    const [useType, setUseType] = useState('refund'); // 'refund' ou 'new-sale'
    const [amount, setAmount] = useState(Math.abs(sale.balance).toFixed(2));
    const [loading, setLoading] = useState(false);
    
    // Utiliser l'objet pour SaleFormBody, mais initialiser le payment à 0
    const [newSaleFormData, setNewSaleFormData] = useState({
        fishType: 'tilapia',
        quantity: '',
        delivered: '',
        unitPrice: '',
        payment: 0, 
        observation: '',
    });

    const creditAvailable = Math.abs(sale.balance);

    const handleRefund = async () => {
        setLoading(true);
        try {
            const refundAmount = Number(amount);
            if (refundAmount <= 0) throw new Error("Montant de remboursement invalide.");
            if (refundAmount > creditAvailable) throw new Error("Le montant dépasse le crédit disponible.");

            const res = await apiFetch(`/api/sales/${sale._id}/refund`, { 
                method: "PATCH", 
                body: JSON.stringify({ amount: refundAmount }) 
            });
            const data = await res.json(); 
            if (!res.ok) throw new Error(data.error || "Erreur lors du remboursement");
            
            alert(`Remboursement de ${money(refundAmount)} effectué. Le crédit restant est de ${money(Math.abs(data.balance))}.`);
            onRefundSuccess();

        } catch (e) {
            alert(e.message);
        } finally {
            setLoading(false);
        }
    };
    
    const handleNewSale = async () => {
        setLoading(true);
        try {
            const q = Number(newSaleFormData.quantity || 0);
            const u = Number(newSaleFormData.unitPrice || 0);
            const d = Number(newSaleFormData.delivered || 0);
            const obs = newSaleFormData.observation;
            const totalSaleAmount = q * u;

            if (q <= 0 || u <= 0) throw new Error("Quantité et Prix Unitaire doivent être positifs.");
            if (d > q) throw new Error(`La quantité livrée (${d} kg) ne peut pas dépasser la quantité commandée (${q} kg).`);
            if (totalSaleAmount > creditAvailable) throw new Error(`Le montant de la nouvelle vente (${money(totalSaleAmount)}) dépasse le crédit disponible.`);

            // 1. Créer la nouvelle vente. Le paiement sera égal au montant total (payé par crédit).
            const res = await apiFetch("/api/sales", {
                method: "POST",
                body: JSON.stringify({
                    date: new Date().toISOString().slice(0, 10),
                    clientName: sale.clientName,
                    fishType: newSaleFormData.fishType,
                    quantity: q,
                    delivered: d,
                    unitPrice: u,
                    payment: totalSaleAmount, // Le PAIEMENT est fait par l'utilisation du crédit
                    observation: `Vente payée par CREDIT client (Utilisation de ${money(totalSaleAmount)}). ${obs}`,
                }),
            });
            const data = await res.json();
            if (!res.ok) throw new Error(data.error || "Erreur lors de la création de la vente");

            // 2. Rembourser (ajuster) la VENTE INITIALE (sale) du montant utilisé.
            const refundRes = await apiFetch(`/api/sales/${sale._id}/refund`, {
                method: "PATCH",
                body: JSON.stringify({ amount: totalSaleAmount })
            });
            if (!refundRes.ok) throw new Error("Erreur lors de l'ajustement du crédit après nouvelle vente.");

            alert(`Nouvelle vente de ${money(totalSaleAmount)} créée et payée par crédit. Crédit restant ajusté.`);
            onNewSaleSuccess();

        } catch (e) {
            alert(e.message);
        } finally {
            setLoading(false);
        }
    };

    return (
        <div className="modal show d-block" style={{ backgroundColor: 'rgba(0,0,0,0.5)' }}>
            <div className="modal-dialog modal-dialog-centered modal-lg"> {/* Utilisation de modal-lg pour plus de place */}
                <div className="modal-content">
                    <div className="modal-header bg-success text-white">
                        <h5 className="modal-title">Utilisation du Crédit Client : {sale.clientName}</h5>
                        <button type="button" className="btn-close btn-close-white" onClick={onClose}></button>
                    </div>
                    <div className="modal-body">
                        <div className="alert alert-success text-center">
                            Crédit disponible : <strong className="fs-4">{money(creditAvailable)}</strong> (Sur Vente ID: {sale._id.slice(-6)})
                        </div>

                        <ul className="nav nav-tabs justify-content-center mb-4">
                            <li className="nav-item">
                                <button 
                                    className={`nav-link ${useType === 'refund' ? 'active' : ''}`}
                                    onClick={() => setUseType('refund')}
                                >
                                    <i className="bi bi-wallet2 me-2"></i> Remboursement Espèces
                                </button>
                            </li>
                            <li className="nav-item">
                                <button 
                                    className={`nav-link ${useType === 'new-sale' ? 'active' : ''}`}
                                    onClick={() => setUseType('new-sale')}
                                >
                                    <i className="bi bi-bag-fill me-2"></i> Utilisation sur Nouvelle Vente
                                </button>
                            </li>
                        </ul>

                        {/* Remboursement Espèces */}
                        {useType === 'refund' && (
                            <form onSubmit={(e) => { e.preventDefault(); handleRefund(); }}>
                                <div className="mb-3">
                                    <label className="form-label fw-semibold">Montant à Rembourser</label>
                                    <input 
                                        type="number" 
                                        step="0.01" 
                                        className="form-control form-control-lg" 
                                        value={amount} 
                                        onChange={(e) => setAmount(e.target.value)} 
                                        min="0.01"
                                        max={creditAvailable}
                                        required
                                    />
                                    <small className="text-muted">Max : {money(creditAvailable)}</small>
                                </div>
                                <div className="d-grid mt-4">
                                    <button type="submit" className="btn btn-success btn-lg" disabled={loading}>
                                        <i className={`bi ${loading ? "bi-hourglass-split" : "bi-cash-coin"} me-2`}></i>
                                        {loading ? "Traitement..." : "Confirmer le Remboursement en Espèces"}
                                    </button>
                                </div>
                            </form>
                        )}

                        {/* Utilisation sur Nouvelle Vente */}
                        {useType === 'new-sale' && (
                            <form onSubmit={(e) => { e.preventDefault(); handleNewSale(); }}>
                                <div className="alert alert-info small">
                                    Cette vente sera automatiquement payée en utilisant une partie du crédit disponible.
                                </div>
                                
                                {/* Utilisation du SaleFormBody pour la nouvelle vente */}
                                <SaleFormBody 
                                    data={newSaleFormData} 
                                    setData={setNewSaleFormData} 
                                    // Le champ paiement est laissé modifiable mais la valeur réelle est gérée par le crédit
                                    disabled={false}
                                /> 
                                
                                {/* Affichage du montant de la nouvelle vente */}
                                <div className="alert alert-warning small text-center mt-3">
                                    Montant de la nouvelle vente : 
                                    <strong className="fs-5 ms-2">
                                        {money(Number(newSaleFormData.quantity || 0) * Number(newSaleFormData.unitPrice || 0))}
                                    </strong>
                                    <br />
                                    (Doit être $\le$ {money(creditAvailable)})
                                </div>

                                <div className="d-grid mt-4">
                                    <button type="submit" className="btn btn-secondary btn-lg" disabled={loading}>
                                        <i className={`bi ${loading ? "bi-hourglass-split" : "bi-check2-circle"} me-2`}></i>
                                        {loading ? "Traitement..." : "Confirmer Vente par Crédit"}
                                    </button>
                                </div>
                            </form>
                        )}
                    </div>
                </div>
            </div>
        </div>
    );
}

/** =====================================
 * SALES TABLE + ACTIONS
 * ===================================== */
function SalesTable() {
  const [sales, setSales] = useState([]);
  const [filterType, setFilterType] = useState("");
  const [searchClient, setSearchClient] = useState("");
  const [loading, setLoading] = useState(true);
  const [openRow, setOpenRow] = useState(null);
  const [actionType, setActionType] = useState("");
  const [actionValue, setActionValue] = useState("");
  const [modalSale, setModalSale] = useState(null); // 🚨 Ajout pour la modale de crédit

  const load = async () => {
    setLoading(true);
    // Ajoutez un petit délai pour permettre à la page de bien se charger si elle est appelée via un router
    await new Promise(resolve => setTimeout(resolve, 100)); 
    const qs = new URLSearchParams();
    if (filterType) qs.set("fishType", filterType);
    if (searchClient) qs.set("client", searchClient);
    const res = await apiFetch(`/api/sales?${qs.toString()}`);
    const data = await res.json();
    setSales(Array.isArray(data) ? data : []);
    setLoading(false);
  };
  useEffect(() => { load(); }, [filterType, searchClient]);

  const toggleAction = (id, type, suggested) => {
    if (openRow === id && actionType === type) {
      setOpenRow(null); setActionType(""); setActionValue("");
    } else {
      setOpenRow(id); setActionType(type); setActionValue(suggested ?? "");
    }
  };

  const handleModalSuccess = () => {
    setModalSale(null);
    window.dispatchEvent(new Event("reload-sales")); // Recharger tout pour la compensation
  };

  const submitAction = async (sale) => {
    try {
      if (actionType === "deliver") {
        const qty = Number(actionValue || 0);
        if (qty <= 0) throw new Error("Quantité invalide.");

        // --- VALIDATION DE LA LIVRAISON (MAINTENUE) ---
        const remainingToDeliver = Math.max(0, sale.quantity - (sale.delivered || 0));
        if (qty > remainingToDeliver) {
            throw new Error(`La quantité à livrer (${qty} kg) dépasse le reste à livrer (${remainingToDeliver} kg).`);
        }
        // --------------------------------------------------

        const res = await apiFetch(`/api/sales/${sale._id}/deliver`, { method: "PATCH", body: JSON.stringify({ qty }) });
        const data = await res.json(); if (!res.ok) throw new Error(data.error || "Erreur livraison");
        setSales((prev) => prev.map((s) => (s._id === sale._id ? data : s)));
      } else if (actionType === "pay") {
        const amount = Number(actionValue || 0);
        if (amount <= 0) throw new Error("Montant invalide.");

        const res = await apiFetch(`/api/sales/${sale._id}/pay`, { method: "PATCH", body: JSON.stringify({ amount }) });
        const data = await res.json(); 
        if (!res.ok) throw new Error(data.error || "Erreur règlement");

        setSales((prev) => prev.map((s) => (s._id === sale._id ? data : s)));
        window.dispatchEvent(new Event("reload-sales")); 

      } 
      // 🚨 La logique 'refund' est déplacée dans la modale CreditUseModal
      setOpenRow(null); setActionType(""); setActionValue("");
    } catch (e) { alert(e.message); }
  };

  const settleAll = async (id) => {
    if (!window.confirm("Solder totalement cette vente ? Cela paiera exactement le solde restant (sans créer de crédit).")) return;
    const res = await apiFetch(`/api/sales/${id}/settle`, { method: "PATCH" });
    const data = await res.json();
    if (!res.ok) return alert(data.error || "Erreur");
    setSales((prev) => prev.map((s) => (s._id === id ? data : s)));
    window.dispatchEvent(new Event("reload-sales"));
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
    } catch (e) { alert(e.message); }
  };

  return (
    <div className="card border-0 shadow rounded-4 bg-white">
      {modalSale && (
        <CreditUseModal 
          sale={modalSale} 
          onClose={() => setModalSale(null)} 
          onRefundSuccess={handleModalSuccess} 
          onNewSaleSuccess={handleModalSuccess}
        />
      )}
      
      <div className="card-body p-4">
        <div className="d-flex flex-wrap gap-3 align-items-center mb-4 p-3 bg-light rounded-3 border">
          <h5 className="m-0 text-dark"><i className="bi bi-table me-2"></i> Historique des Opérations</h5>
          <div className="ms-auto d-flex gap-2 w-100 w-md-auto">
            <div className="input-group">
              <span className="input-group-text"><i className="bi bi-search"></i></span>
              <input className="form-control" placeholder="Rechercher client..." value={searchClient} onChange={(e) => setSearchClient(e.target.value)} />
            </div>
            <select className="form-select" value={filterType} onChange={(e) => setFilterType(e.target.value)}>
              <option value="">Tous les poissons</option>
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
            <thead>
              <tr className="table-dark">
                <th>Date</th>
                <th>Client</th>
                <th>Poisson</th>
                <th>Qté (Kg)</th>
                <th>Livré (Kg)</th>
                <th>Reste (Kg)</th>
                <th>PU</th>
                <th>Montant</th>
                <th>Payé</th>
                <th>Solde</th>
                <th>Statut</th>
                <th style={{ width: 220 }}>Actions</th>
              </tr>
            </thead>
            <tbody>
              {loading && (
                <tr>
                  <td colSpan="12" className="text-center py-4 text-muted">
                    <i className="bi bi-arrow-clockwise spin me-2"></i>Chargement de l'historique...
                  </td>
                </tr>
              )}
              {!loading && sales.length === 0 && (
                <tr>
                  <td colSpan="12" className="text-center py-4 text-muted">Aucune vente enregistrée.</td>
                </tr>
              )}

              {sales.map((s) => {
                const remainingToDeliver = Math.max(0, s.quantity - (s.delivered || 0));
                const balance = s.balance || 0;
                const remainingToPay = Math.max(0, balance); 
                
                let rowClass = "";
                if (balance > 0) rowClass = "table-danger-subtle border-start border-danger border-4";
                if (balance < 0) rowClass = "table-success-subtle border-start border-success border-4";

                return (
                  <React.Fragment key={s._id}>
                    <tr className={rowClass}>
                      <td>{new Date(s.date).toISOString().slice(0, 10)}</td>
                      <td className="fw-semibold">{s.clientName}</td>
                      <td><BadgeFish type={s.fishType} /></td>
                      <td>{s.quantity}</td>
                      <td>{s.delivered || 0}</td>
                      <td className={remainingToDeliver > 0 ? "text-warning fw-bold" : ""}>{remainingToDeliver}</td>
                      <td>{money(s.unitPrice)}</td>
                      <td>{money(s.amount)}</td>
                      <td>{money(s.payment)}</td>
                      <td className={balance > 0 ? "text-danger fw-bold" : (balance < 0 ? "text-success fw-bold" : "")}>
                        {money(Math.abs(balance))}
                        {balance < 0 && <span className="small text-success"> (Crédit)</span>}
                      </td>
                      <td>
                        {s.settled ? (
                          <span className="badge text-bg-success"><i className="bi bi-check-circle-fill"></i> Soldé</span>
                        ) : (
                          <span className="badge text-bg-warning text-dark"><i className="bi bi-clock-history"></i> Non soldé</span>
                        )}
                      </td>
                      <td>
                        <div className="d-flex flex-wrap gap-2">
                          {remainingToDeliver > 0 && (
                            <button className="btn btn-sm btn-primary rounded-pill" onClick={() => toggleAction(s._id, "deliver", remainingToDeliver)}>
                              <i className="bi bi-truck"></i> Livrer
                            </button>
                          )}
                          <button 
                            className="btn btn-sm btn-secondary rounded-pill" 
                            onClick={() => toggleAction(s._id, "pay", remainingToPay)}
                            disabled={s.settled && balance >= 0} 
                          >
                            <i className="bi bi-wallet"></i> Régler
                          </button>
                          
                          {/* 🚨 MODIFIÉ : Ouvre la modale d'utilisation de crédit */}
                          {balance < 0 && (
                              <button 
                                  className="btn btn-sm btn-success rounded-pill" 
                                  onClick={() => setModalSale(s)}
                              >
                                  <i className="bi bi-arrow-left-right"></i> Utiliser Crédit
                              </button>
                          )}
                          
                          {balance > 0 && (
                            <button className="btn btn-sm btn-outline-success rounded-circle" title="Solder toute la dette" onClick={() => settleAll(s._id)}>
                              <i className="bi bi-currency-dollar"></i>
                            </button>
                          )}
                        </div>
                      </td>
                    </tr>

                    {openRow === s._id && (
                      <tr>
                        <td colSpan="12">
                          <div className="bg-light p-3 rounded-3 border border-secondary">
                            {actionType === "deliver" ? (
                              <div className="d-flex align-items-center gap-3 flex-wrap">
                                <div className="small text-muted">Action : Livraison (Reste: {remainingToDeliver} kg)</div>
                                <div className="input-group" style={{ maxWidth: 350 }}>
                                  <span className="input-group-text">Qté à livrer</span>
                                  <input type="number" min="0" step="0.01" className="form-control" value={actionValue} onChange={(e) => setActionValue(e.target.value)} />
                                  <button className="btn btn-outline-primary" onClick={() => setActionValue(remainingToDeliver)}>
                                    Max
                                  </button>
                                </div>
                                <button className="btn btn-primary" onClick={() => submitAction(s)}>Valider</button>
                                <button className="btn btn-link text-danger" onClick={() => { setOpenRow(null); setActionType(""); }}>Annuler</button>
                              </div>
                            ) : actionType === "pay" ? (
                              <div className="d-flex align-items-center gap-3 flex-wrap">
                                <div className="small text-muted">Action : Règlement (Solde dû: {money(remainingToPay)})</div>
                                <div className="input-group" style={{ maxWidth: 350 }}>
                                  <span className="input-group-text">Montant</span>
                                  <input type="number" min="0" step="0.01" className="form-control" value={actionValue} onChange={(e) => setActionValue(e.target.value)} />
                                  {remainingToPay > 0 && ( 
                                    <button className="btn btn-outline-secondary" onClick={() => setActionValue(remainingToPay)}>
                                      Max
                                    </button>
                                  )}
                                </div>
                                <button className="btn btn-secondary" onClick={() => submitAction(s)}>Valider</button>
                                <button className="btn btn-link text-danger" onClick={() => { setOpenRow(null); setActionType(""); }}>Annuler</button>
                              </div>
                            ) : null} 
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

/** =====================================
 * CHARTS
 * ===================================== */
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
    
      curr.balance += Math.max(0, Number(s.balance || 0)); 
      monthlyMap.set(k, curr);
      if (s.fishType === "tilapia") tilapiaAmount += Number(s.amount || 0);
      if (s.fishType === "pangasius") pangasiusAmount += Number(s.amount || 0);
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
    if (!chartReady) return;
    const Chart = window.Chart;
    [salesChart, debtsChart, typeChart].forEach((chart) => chart.current?.destroy?.());

    salesChart.current = new Chart(salesRef.current, {
      type: "bar",
      data: {
        labels: data.labels,
        datasets: [{
          label: "Ventes (XOF)",
          data: data.amounts,
          backgroundColor: "rgba(0, 123, 255, 0.8)",
          borderRadius: 5,
          barThickness: "flex",
          maxBarThickness: 50,
        }],
      },
      options: { responsive: true, maintainAspectRatio: false, scales: { y: { beginAtZero: true } } },
    });

    debtsChart.current = new Chart(debtsRef.current, {
      type: "line",
      data: {
        labels: data.labels,
        datasets: [{
          label: "Dettes (Solde XOF)",
          data: data.balances,
          borderColor: "rgb(220, 53, 69)",
          backgroundColor: "rgba(220, 53, 69, 0.1)",
          fill: true,
          tension: 0.4,
          pointRadius: 3,
        }],
      },
      options: { responsive: true, maintainAspectRatio: false, scales: { y: { beginAtZero: true } } },
    });

    typeChart.current = new Chart(typeRef.current, {
      type: "doughnut",
      data: {
        labels: ["Tilapia", "Pangasius"],
        datasets: [{ data: [data.tilapiaAmount, data.pangasiusAmount], backgroundColor: ["#007bff", "#198754"], hoverOffset: 4 }],
      },
      options: { responsive: true, maintainAspectRatio: false, plugins: { legend: { position: "bottom" } } },
    });
  }, [chartReady, data]);

  return (
    <div className="row g-4 mb-4">
      <div className="col-lg-6 col-xl-4">
        <div className="card border-0 shadow-sm rounded-4 h-100">
          <div className="card-body">
            <h5 className="fw-bold text-dark mb-3"><i className="bi bi-bar-chart-fill me-2 text-primary"></i>Volume des Ventes</h5>
            <div style={{ height: 300 }} className="chart-container">
              {!chartReady ? <div className="text-muted small text-center pt-5">Chargement...</div> : <canvas ref={salesRef} />}
            </div>
          </div>
        </div>
      </div>
      <div className="col-lg-6 col-xl-4">
        <div className="card border-0 shadow-sm rounded-4 h-100">
          <div className="card-body">
            <h5 className="fw-bold text-dark mb-3"><i className="bi bi-file-earmark-bar-graph-fill me-2 text-danger"></i>Évolution des Dettes</h5>
            <div style={{ height: 300 }} className="chart-container">
              {!chartReady ? <div className="text-muted small text-center pt-5">Chargement...</div> : <canvas ref={debtsRef} />}
            </div>
          </div>
        </div>
      </div>
      <div className="col-lg-12 col-xl-4">
        <div className="card border-0 shadow-sm rounded-4 h-100">
          <div className="card-body">
            <h5 className="fw-bold text-dark mb-3"><i className="bi bi-pie-chart-fill me-2 text-info"></i>Ventes par Espèce</h5>
            <div style={{ height: 300 }} className="d-flex align-items-center justify-content-center chart-container">
              {!chartReady ? <div className="text-muted small">Chargement...</div> : <canvas ref={typeRef} style={{ maxHeight: "250px" }} />}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

/** =====================================
 * NOTIFS D'ÉCHÉANCE
 * ===================================== */
function DueNotificationsPanel() {
  const [sales, setSales] = useState([]);
  const [thresholdDays, setThresholdDays] = useState(Number(localStorage.getItem("due_threshold_days") || 30));
  const [perm, setPerm] = useState(typeof Notification !== "undefined" ? Notification?.permission : "default");

  useEffect(() => { (async () => {
    const res = await apiFetch("/api/sales");
    const data = await res.json();
    setSales(Array.isArray(data) ? data : []);
  })(); }, []);

  useEffect(() => { localStorage.setItem("due_threshold_days", String(thresholdDays)); }, [thresholdDays]);

  const overdue = useMemo(() => {
    const now = Date.now();
    const cut = thresholdDays * 24 * 3600 * 1000;
    return sales
      .filter((s) => Number(s.balance || 0) > 0 && now - new Date(s.date).getTime() > cut) // Balance > 0 = dette client
      .map((s) => ({ id: s._id, client: s.clientName, date: new Date(s.date), balance: s.balance, days: Math.floor((now - new Date(s.date).getTime()) / (24 * 3600 * 1000)) }))
      .sort((a, b) => b.days - a.days);
  }, [sales, thresholdDays]);

  const askPerm = async () => {
    if (typeof window === "undefined" || !("Notification" in window)) {
      alert("Les notifications ne sont pas supportées par ce navigateur.");
      return;
    }
    const p = await Notification.requestPermission();
    setPerm(p);
  };

  const notifyNow = () => {
    if (perm !== "granted" || overdue.length === 0) return;
    const top = overdue.slice(0, 3);
    const body = top.map((o) => `${o.client}: ${money(o.balance)} (${o.days} j)`).join("\n");
    new Notification("Dettes en retard", { body });
  };

  return (
    <div className="card border-0 shadow rounded-4 mb-4 bg-white">
      <div className="card-body p-4">
        <div className="d-flex align-items-center mb-4 pb-2 border-bottom flex-wrap gap-3">
          <h5 className="m-0 fw-bold"><i className="bi bi-bell-fill me-2 text-warning"></i>Clients en Retard (Alerte)</h5>
          <div className="ms-auto d-flex gap-3 align-items-center">
            <div className="input-group input-group-sm" style={{ width: 200 }}>
              <span className="input-group-text small">Retard ≥</span>
              <input type="number" className="form-control" min="1" value={thresholdDays} onChange={(e) => setThresholdDays(Number(e.target.value) || 1)} />
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
              <tr><th>Client</th><th>Date Opération</th><th>Jours de Retard</th><th>Solde Dû</th></tr>
            </thead>
            <tbody>
              {overdue.length === 0 && (
                <tr>
                  <td colSpan="4" className="text-center py-3 text-muted">
                    🎉 Aucune dette n'a dépassé le seuil de {thresholdDays} jours.
                  </td>
                </tr>
              )}
              {overdue.map((o) => (
                <tr key={o.id} className="table-warning-subtle">
                  <td className="fw-bold">{o.client}</td>
                  <td>{o.date.toISOString().slice(0, 10)}</td>
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

/** =====================================
 * SUMMARY CARDS
 * ===================================== */
function SummaryCards() {
  const [sum, setSum] = useState(null);
  useEffect(() => { (async () => {
    const res = await apiFetch("/api/summary");
    const data = await res.json();
    setSum(data);
  })(); }, []);
  if (!sum) return null;

  const byTilapia = sum.byFish?.find((f) => f.fishType === "tilapia") || { amount: 0, payment: 0, balance: 0 };
  const byPanga = sum.byFish?.find((f) => f.fishType === "pangasius") || { amount: 0, payment: 0, balance: 0 };
  
  const totalBalanceAbs = Math.abs(sum.totalBalance);
  const totalBalanceIsCredit = sum.totalBalance < 0;

  const Card = ({ title, amount, iconClass, cardClass, isCredit }) => (
    <div className="col-12 col-md-4">
      <div className={`card border-0 shadow-sm rounded-4 ${cardClass} h-100`}>
        <div className="card-body d-flex align-items-center p-4">
          <div className="me-3 p-3 rounded-circle bg-opacity-25 bg-white d-flex align-items-center justify-content-center" style={{ width: 60, height: 60 }}>
            <i className={`bi ${iconClass} fs-3`}></i>
          </div>
          <div>
            <div className="text-uppercase small opacity-75">{title}</div>
            {isCredit && <div className="text-uppercase small opacity-75">(Crédit Net)</div>}
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
      <Card 
        title={totalBalanceIsCredit ? "Crédit Net" : "Solde/Encours"} 
        amount={totalBalanceAbs} 
        isCredit={totalBalanceIsCredit}
        iconClass={totalBalanceIsCredit ? "bi-arrow-down-circle-fill text-success" : "bi-currency-exchange text-danger"} 
        cardClass={totalBalanceIsCredit ? "bg-success text-white bg-opacity-75" : "bg-danger text-white bg-opacity-75"} 
      />
      <div className="col-12 col-md-6">
        <div className="card border-0 shadow-sm rounded-4 h-100 bg-white">
          <div className="card-body">
            <div className="d-flex justify-content-between align-items-center">
              <h6 className="m-0 fw-bold">Détail Tilapia</h6>
              <BadgeFish type="tilapia" />
            </div>
            <hr />
            <div className="row small text-muted">
              <div className="col-4">Ventes: <br /><strong className="text-primary">{money(byTilapia.amount)}</strong></div>
              <div className="col-4">Payé: <br /><strong className="text-success">{money(byTilapia.payment)}</strong></div>
              <div className="col-4">
                {byTilapia.balance >= 0 ? "Solde:" : "Crédit:"} <br />
                <strong className={byTilapia.balance >= 0 ? "text-danger" : "text-success"}>{money(Math.abs(byTilapia.balance))}</strong>
              </div>
            </div>
          </div>
        </div>
      </div>
      <div className="col-12 col-md-6">
        <div className="card border-0 shadow-sm rounded-4 h-100 bg-white">
          <div className="card-body">
            <div className="d-flex justify-content-between align-items-center">
              <h6 className="m-0 fw-bold">Détail Pangasius</h6>
              <BadgeFish type="pangasius" />
            </div>
            <hr />
            <div className="row small text-muted">
              <div className="col-4">Ventes: <br /><strong className="text-primary">{money(byPanga.amount)}</strong></div>
              <div className="col-4">Payé: <br /><strong className="text-success">{money(byPanga.payment)}</strong></div>
              <div className="col-4">
                {byPanga.balance >= 0 ? "Solde:" : "Crédit:"} <br />
                <strong className={byPanga.balance >= 0 ? "text-danger" : "text-success"}>{money(Math.abs(byPanga.balance))}</strong>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

/** =====================================
 * DEBTS BOARD
 * ===================================== */
function DebtsBoard() {
  const [debts, setDebts] = useState([]);
  useEffect(() => { (async () => {
    const res = await apiFetch("/api/dashboard/debts");
    const data = await res.json();
    setDebts(Array.isArray(data) ? data : []);
  })(); }, []);
  const total = debts.reduce((sum, d) => sum + d.totalDebt, 0);

  return (
    <div className="card border-0 shadow rounded-4 bg-white">
      <div className="card-body p-4">
        <div className="d-flex align-items-center mb-4 pb-2 border-bottom">
          <h5 className="m-0 fw-bold"><i className="bi bi-person-lines-fill me-2 text-danger"></i>Top Dettes Clients</h5>
          <span className="ms-auto badge text-bg-danger p-2 fs-6">Encours Total: {money(total)}</span>
        </div>
        <div className="table-responsive" style={{ maxHeight: 300, overflowY: "auto" }}>
          <table className="table align-middle table-sm table-hover">
            <thead>
              <tr className="table-light"><th>Client</th><th># Opérations</th><th>Dette</th></tr>
            </thead>
            <tbody>
              {debts.length === 0 && (
                <tr><td colSpan="3" className="text-center py-3 text-muted">Aucune dette en cours.</td></tr>
              )}
              {debts.map((d) => (
                <tr key={d.clientName} className="align-middle">
                  <td className="fw-semibold">{d.clientName}</td>
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

/** =====================================
 * CREDITS BOARD (NOUVEAU)
 * ===================================== */
function CreditsBoard() {
  const [credits, setCredits] = useState([]);
  useEffect(() => { (async () => {
    const res = await apiFetch("/api/dashboard/credits");
    const data = await res.json();
    setCredits(Array.isArray(data) ? data : []);
  })(); }, []);
  const total = credits.reduce((sum, d) => sum + d.totalCredit, 0);

  return (
    <div className="card border-0 shadow rounded-4 bg-white">
      <div className="card-body p-4">
        <div className="d-flex align-items-center mb-4 pb-2 border-bottom">
          <h5 className="m-0 fw-bold"><i className="bi bi-person-check-fill me-2 text-success"></i>Crédits Clients (Dû par l'entreprise)</h5>
          <span className="ms-auto badge text-bg-success p-2 fs-6">Crédit Total: {money(total)}</span>
        </div>
        <div className="table-responsive" style={{ maxHeight: 300, overflowY: "auto" }}>
          <table className="table align-middle table-sm table-hover">
            <thead>
              <tr className="table-light"><th>Client</th><th># Opérations</th><th>Crédit</th></tr>
            </thead>
            <tbody>
              {credits.length === 0 && (
                <tr><td colSpan="3" className="text-center py-3 text-muted">Aucun crédit client en cours.</td></tr>
              )}
              {credits.map((d) => (
                <tr key={d.clientName} className="align-middle">
                  <td className="fw-semibold">{d.clientName}</td>
                  <td className="small text-muted">{d.count}</td>
                  <td className="text-success fw-bolder">{money(d.totalCredit)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}

/** =====================================
 * CLIENT REPORT (BILAN)
 * ===================================== */
function ClientReportPage() {
  const [clients, setClients] = useState([]);
  const [selectedClient, setSelectedClient] = useState("all");
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    (async () => {
      try {
        const res = await apiFetch("/api/clients");
        const data = await res.json();
        setClients(Array.isArray(data) ? data : []);
      } catch (e) {
        alert("Erreur lors du chargement des clients: " + e.message);
      }
    })();
  }, []);

  const exportReport = async () => {
    setLoading(true);
    try {
      const clientParam = selectedClient !== "all" ? `?clientName=${encodeURIComponent(selectedClient)}` : '';
      const res = await apiFetch(`/api/exports/client-report.xlsx${clientParam}`, { method: "GET" });
      
      if (!res.ok) throw new Error("Export impossible");
      
      const blob = await res.blob();
      const url = window.URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      
      const filename = selectedClient !== "all" 
        ? `bilan_${selectedClient.replace(/\s/g, '_')}_${new Date().toISOString().slice(0,10)}.xlsx` 
        : `bilan_global_${new Date().toISOString().slice(0,10)}.xlsx`;
        
      a.download = filename;
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
    <div className="card border-0 shadow rounded-4 mb-4 bg-white">
      <div className="card-header bg-dark text-white rounded-top-4 p-3 d-flex align-items-center">
        <i className="bi bi-file-earmark-bar-graph-fill me-2 fs-5"></i>
        <h5 className="m-0">Bilan Financier Client</h5>
      </div>
      <div className="card-body p-4">
        <p className="text-muted">Sélectionnez un client pour exporter l'historique de toutes ses transactions (achats, livraisons, paiements, solde/crédit) ou choisissez 'Tous les clients' pour un export global.</p>
        
        <div className="d-flex flex-wrap gap-3 align-items-center mt-4">
          <label className="form-label small fw-semibold m-0">Client à Exporter :</label>
          <select 
            className="form-select" 
            style={{ maxWidth: 300 }}
            value={selectedClient} 
            onChange={(e) => setSelectedClient(e.target.value)}
            disabled={loading}
          >
            <option value="all">Tous les clients</option>
            {clients.map(client => (
              <option key={client} value={client}>{client}</option>
            ))}
          </select>

          <button 
            className="btn btn-primary btn-lg rounded-pill ms-auto" 
            onClick={exportReport}
            disabled={loading || (selectedClient !== 'all' && clients.length === 0)}
          >
            <i className={`bi ${loading ? "bi-hourglass-split" : "bi-file-earmark-spreadsheet-fill"} me-2`}></i>
            {loading ? "Préparation de l'export..." : "Exporter le Bilan Excel"}
          </button>
        </div>

        {selectedClient !== 'all' && (
          <p className="small text-muted mt-3">
            L'export pour <strong>{selectedClient}</strong> contiendra l'historique complet de ses opérations, incluant le solde détaillé (dette ou crédit) pour chaque vente.
          </p>
        )}
      </div>
    </div>
  );
}


// Cette fonction est responsable du rechargement forcé du tableau après une nouvelle vente ou une action.
function ReloadableSalesTable() {
  const [key, setKey] = useState(0); 
  useEffect(() => {
    const handler = () => setKey((k) => k + 1);
    window.addEventListener("reload-sales", handler);
    return () => window.removeEventListener("reload-sales", handler);
  }, []);
  return <SalesTable key={key} />;
}

/** =====================================
 * APP PRINCIPALE
 * ===================================== */
export default function App() {
  const { isMdUp, width } = useViewport();
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const [authed, setAuthed] = useState(!!(typeof window !== "undefined" && localStorage.getItem("token")));
  const companyName = (typeof window !== "undefined" && localStorage.getItem("companyName")) || "Mon Entreprise";
  const [currentPage, setCurrentPage] = useState("dashboard");

  const handleLogout = () => {
    localStorage.removeItem("token");
    localStorage.removeItem("companyName");
    setAuthed(false);
  };

  const getPageTitle = (page) => {
    switch (page) {
      case "dashboard": return "Tableau de Bord 📊 - Synthèse";
      case "new-sale": return "Nouvelle Opération de Vente 📝";
      case "sales": return "Historique des Ventes & Actions 📋";
      case "debts": return "Vue Dettes Clients 💰";
      case "client-report": return "Bilan Financier Client 📄";
      case "charts": return "Analyse Graphique 📈";
      default: return "Tableau de Bord";
    }
  };

  if (!authed) return <AuthView onAuth={() => setAuthed(true)} />;

  const renderPage = () => {
    switch (currentPage) {
      case "new-sale":
        return <SaleForm onSaved={() => setCurrentPage("sales")} />;
      case "sales":
        return <ReloadableSalesTable />;
      case "debts":
        return (
          <>
            <div className="row g-4 mb-4">
              <div className="col-lg-6"><DebtsBoard /></div>
              <div className="col-lg-6"><CreditsBoard /></div>
            </div>
            <DueNotificationsPanel />
            <ReloadableSalesTable />
          </>
        );
      case "client-report": 
        return <ClientReportPage />;
      case "charts":
        return (
          <>
            <ChartsPanel />
            <SummaryCards />
          </>
        );
      case "dashboard":
      default:
        return (
          <>
            <SummaryCards />
            <DueNotificationsPanel />
            <ChartsPanel />
            <div className="row g-4 mt-1">
              <div className="col-lg-6"><DebtsBoard /></div>
              <div className="col-lg-6"><CreditsBoard /></div>
            </div>
            <div className="row g-4 mt-4">
              <div className="col-12"><ReloadableSalesTable /></div>
            </div>
          </>
        );
    }
  };

  return (
    <div className="d-flex" style={{ overflowX: "hidden" }}>
      <Sidebar
        companyName={companyName}
        currentPage={currentPage}
        onNavigate={setCurrentPage}
        onLogout={handleLogout}
        open={sidebarOpen} 
        setOpen={setSidebarOpen}
        isMdUp={isMdUp}
      />

      <main
        className="flex-grow-1"
        style={{
          marginLeft: isMdUp ? SIDEBAR_WIDTH : 0, 
          background: "#f0f2f5",
          minHeight: "100vh",
          transition: "margin-left .25s ease",
          width: "100%",
        }}
      >
        <div className="container-fluid py-3 py-md-4">
          <Topbar title={getPageTitle(currentPage)} companyName={companyName} onBurger={() => setSidebarOpen(true)} />
          {renderPage()}
        </div>
      </main>
    </div>
  );
}
// App.js
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

// 🚨 FONCTION pour valider le nom de client (MAJUSCULES SANS ESPACE)
const validateClientName = (name) => {
    // N'autorise que les lettres majuscules (A-Z) et les chiffres (0-9)
    return /^[A-Z0-9]+$/.test(name);
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
 * HOOKS (inchangés)
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
 * SIDEBAR + NAVBAR (Mise à jour pour l'Analyse Client)
 * ===================================== */
function Sidebar({ companyName, currentPage, onNavigate, onLogout, open, setOpen, isMdUp }) {
  const navItems = [
    { id: "dashboard", icon: "bi-house-door-fill", label: "Dashboard" },
    // 🚨 NOUVEL ÉLÉMENT : Analyse Client
    { id: "client-analysis", icon: "bi-search", label: "Analyse Client" }, 
    { id: "new-sale", icon: "bi-cash-coin", label: "Nouvelle Vente" },
    { id: "sales", icon: "bi-table", label: "Historique & Actions" },
    { id: "debts", icon: "bi-exclamation-triangle-fill", label: "Dettes Clients" },
    { id: "client-report", icon: "bi-file-earmark-bar-graph-fill", label: "Bilan Client / Export" }, 
    { id: "charts", icon: "bi-graph-up", label: "Analyse Graphique" },
  ];

  // ... (Reste du composant Sidebar inchangé)
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
 * AUTH VIEW (inchangée)
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
// Composant : Corps de formulaire de vente réutilisable (inchangé)
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
 * SALE FORM (AJOUT DE LA VALIDATION CLIENT)
 * ===================================== */
function SaleForm({ onSaved }) {
    const [formData, setFormData] = useState({
        fishType: 'tilapia',
        quantity: '',
        delivered: '',
        unitPrice: '',
        payment: '',
        observation: '',
    });
    const [date, setDate] = useState(new Date().toISOString().slice(0, 10));
    const [clientName, setClient] = useState("");
    const [loading, setLoading] = useState(false);
    
    const amount = (Number(formData.quantity || 0) * Number(formData.unitPrice || 0)) || 0;
    const balance = amount - Number(formData.payment || 0); 
    const remainingToDeliver = Math.max(0, Number(formData.quantity || 0) - Number(formData.delivered || 0));

    const save = async (e) => {
        e.preventDefault();
        setLoading(true);

        try {
            // 🚨 VALIDATION DU NOM DE CLIENT
            const clientUpper = clientName.toUpperCase();
            if (!validateClientName(clientUpper)) {
                throw new Error("Le nom du client doit être en MAJUSCULES (A-Z, 0-9) sans espace/caractère spécial. Ex: ENTREPRISEA1");
            }
            
            const q = Number(formData.quantity || 0);
            const u = Number(formData.unitPrice || 0);
            
            if (q <= 0) throw new Error("La quantité commandée doit être positive.");
            if (u <= 0) throw new Error("Le prix unitaire doit être positif.");

            const res = await apiFetch("/api/sales", {
                method: "POST",
                body: JSON.stringify({
                    date, clientName: clientUpper, // Utilisation de la version en majuscules
                    fishType: formData.fishType,
                    quantity: q, delivered: Number(formData.delivered || 0),
                    unitPrice: u, payment: Number(formData.payment || 0),
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
                        <label className="form-label small fw-semibold">Client / Entreprise (MAJUSCULES SANS ESPACE)</label>
                        <input 
                            className="form-control" 
                            value={clientName} 
                            onChange={(e) => setClient(e.target.value.toUpperCase().replace(/\s/g, ''))} // Conversion et suppression des espaces en direct
                            pattern="^[A-Z0-9]+$" // Validation HTML5 visuelle
                            title="Uniquement des lettres majuscules (A-Z) et des chiffres (0-9). Pas d'espaces."
                            required 
                        />
                         <div className="small text-muted mt-1">Ex: ENTREPRISEB ou DUPONT34</div>
                    </div>
                    <div className="col-6 col-sm-6 col-md-6 col-lg-3">
                        <label className="form-label small fw-semibold">Date</label>
                        <input type="date" className="form-control" value={date} onChange={(e) => setDate(e.target.value)} required />
                    </div>
                    
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
// Composant MODAL pour gérer l'utilisation du crédit (Compensation manuelle)
// ----------------------------------------------------------------------------------------------------------------------------------------------------------

// Composant de Compensation Manuelle
function ManualCompensationForm({ creditSale, creditAvailable, setLoading, onCompensationSuccess }) {
    const [debts, setDebts] = useState([]);
    const [selectedDebt, setSelectedDebt] = useState(null);
    const [amountToCompensate, setAmountToCompensate] = useState(creditAvailable.toFixed(2));
    const [clientLoading, setClientLoading] = useState(false);
    
    // Charger les dettes existantes du client
    useEffect(() => {
        const loadDebts = async () => {
            setClientLoading(true);
            try {
                // Nouvelle route backend pour obtenir les dettes
                const res = await apiFetch(`/api/sales/client-balances/${encodeURIComponent(creditSale.clientName)}`);
                const data = await res.json();
                const validDebts = data.debts.filter(d => d.balance > 0); 
                setDebts(validDebts);
                if (validDebts.length > 0) {
                    setSelectedDebt(validDebts[0]);
                } else {
                    setSelectedDebt(null);
                }
            } catch (e) {
                console.error("Erreur de chargement des dettes:", e);
                alert("Erreur lors du chargement des dettes: " + e.message);
            } finally {
                setClientLoading(false);
            }
        };
        loadDebts();
    }, [creditSale.clientName]);

    useEffect(() => {
        if (selectedDebt) {
            const max = Math.min(creditAvailable, selectedDebt.balance);
            setAmountToCompensate(max.toFixed(2));
        } else {
            setAmountToCompensate(creditAvailable.toFixed(2));
        }
    }, [selectedDebt, creditAvailable]);

    const handleCompensation = async (e) => {
        e.preventDefault();
        setLoading(true);

        try {
            if (!selectedDebt) throw new Error("Veuillez sélectionner une dette à solder.");
            const amount = Number(amountToCompensate);
            if (amount <= 0) throw new Error("Montant invalide.");
            
            const max = Math.min(creditAvailable, selectedDebt.balance);
            if (amount > max) throw new Error(`Le montant ne peut pas dépasser ${money(max)} (Max entre crédit et dette).`);

            // Nouvelle route de compensation manuelle
            const res = await apiFetch(`/api/sales/compensate-manual`, { 
                method: "PATCH", 
                body: JSON.stringify({ 
                    debtId: selectedDebt._id, 
                    creditId: creditSale._id, 
                    amountToUse: amount 
                }) 
            });
            
            const data = await res.json(); 
            if (!res.ok) throw new Error(data.error || "Erreur lors de la compensation");
            
            alert(`Compensation de ${money(data.compensatedAmount)} effectuée. Les soldes ont été ajustés.`);
            onCompensationSuccess();

        } catch (e) {
            alert(e.message);
        } finally {
            setLoading(false);
        }
    };

    if (clientLoading) {
        return <div className="text-center py-5 text-muted"><i className="bi bi-arrow-clockwise spin me-2"></i>Chargement des dettes...</div>;
    }

    if (debts.length === 0) {
        return (
            <div className="alert alert-info text-center">
                Ce client n'a **aucune dette** en cours à compenser.
            </div>
        );
    }
    
    return (
        <form onSubmit={handleCompensation}>
            <div className="alert alert-danger small">
                Crédit disponible : <strong className="text-success">{money(creditAvailable)}</strong> (Ligne ID : {creditSale._id.slice(-6)}).
            </div>
            
            <div className="mb-3">
                <label className="form-label fw-semibold">Dette à Solder (par ancienneté)</label>
                <select 
                    className="form-select form-select-lg"
                    onChange={(e) => setSelectedDebt(debts.find(d => d._id === e.target.value))}
                    value={selectedDebt?._id || ''}
                    required
                >
                    {debts.map(d => (
                        <option key={d._id} value={d._id}>
                            {d.date} - Reste à Payer: {money(d.balance)} (ID: {d._id.slice(-6)})
                        </option>
                    ))}
                </select>
                {selectedDebt && (
                     <small className="text-muted">Max à compenser: {money(Math.min(creditAvailable, selectedDebt.balance))}</small>
                )}
            </div>
            
            <div className="mb-3">
                <label className="form-label fw-semibold">Montant à Compenser</label>
                <input 
                    type="number" 
                    step="0.01" 
                    className="form-control form-control-lg" 
                    value={amountToCompensate} 
                    onChange={(e) => setAmountToCompensate(e.target.value)} 
                    min="0.01"
                    max={Math.min(creditAvailable, selectedDebt?.balance || creditAvailable)} 
                    required
                />
            </div>

            <div className="d-grid mt-4">
                <button type="submit" className="btn btn-warning btn-lg" disabled={setLoading || !selectedDebt}>
                    <i className={`bi ${setLoading ? "bi-hourglass-split" : "bi-arrow-left-right"} me-2`}></i>
                    {setLoading ? "Traitement..." : "Compenser la Dette Manuellement"}
                </button>
            </div>
        </form>
    );
}


function CreditUseModal({ sale, onClose, onRefundSuccess, onNewSaleSuccess, onManualCompensationSuccess }) {
    const [useType, setUseType] = useState('refund'); 
    const [amount, setAmount] = useState(Math.abs(sale.balance).toFixed(2));
    const [loading, setLoading] = useState(false);
    
    // Pour l'onglet "Nouvelle Vente"
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
            
            alert(`Remboursement de ${money(refundAmount)} effectué.`);
            
            onRefundSuccess();

        } catch (e) {
            alert(e.message);
        } finally {
            setLoading(false);
        }
    };
    
    // Nouvelle vente : ne déclenche PLUS la compensation automatique
    const handleNewSale = async () => {
        setLoading(true);
        try {
            const q = Number(newSaleFormData.quantity || 0);
            const u = Number(newSaleFormData.unitPrice || 0);
            
            if (q <= 0 || u <= 0) throw new Error("Quantité et Prix Unitaire doivent être positifs.");
            
            const clientNameUpper = sale.clientName.toUpperCase(); 

            // Créer la nouvelle vente. La dette est créée.
            const res = await apiFetch("/api/sales", {
                method: "POST",
                body: JSON.stringify({
                    date: new Date().toISOString().slice(0, 10),
                    clientName: clientNameUpper, 
                    fishType: newSaleFormData.fishType,
                    quantity: q,
                    delivered: Number(newSaleFormData.delivered || 0),
                    unitPrice: u,
                    payment: newSaleFormData.payment || 0, 
                    observation: `Vente potentiellement payée par CREDIT client. Utilisation MANUELLE nécessaire sur l'onglet 'Solder les Dettes'. ${newSaleFormData.observation}`,
                }),
            });
            const data = await res.json();
            if (!res.ok) throw new Error(data.error || "Erreur lors de la création de la vente");

            alert(`Nouvelle vente de ${money(q * u)} créée. Utilisez l'option "Solder les dettes" pour appliquer le crédit.`);
            onNewSaleSuccess();

        } catch (e) {
            alert(e.message);
        } finally {
            setLoading(false);
        }
    };


    return (
        <div className="modal show d-block" style={{ backgroundColor: 'rgba(0,0,0,0.5)' }}>
            <div className="modal-dialog modal-dialog-centered modal-xl"> 
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
                            {/* NOUVEL ONGLET : Compensation Manuelle */}
                            <li className="nav-item">
                                <button 
                                    className={`nav-link ${useType === 'compensate' ? 'active' : ''}`}
                                    onClick={() => setUseType('compensate')}
                                >
                                    <i className="bi bi-arrow-left-right me-2"></i> Solder les Dettes
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
                                    Enregistrez une nouvelle vente pour ce client. Le **crédit existant NE sera PAS appliqué automatiquement**. Vous devrez utiliser l'onglet "Solder les Dettes" après l'enregistrement pour effectuer la compensation manuelle.
                                </div>
                                
                                <SaleFormBody 
                                    data={newSaleFormData} 
                                    setData={setNewSaleFormData} 
                                    disabled={false}
                                /> 
                                
                                <div className="alert alert-warning small text-center mt-3">
                                    Montant de la nouvelle vente (Dette créée) : 
                                    <strong className="fs-5 ms-2">
                                        {money(Number(newSaleFormData.quantity || 0) * Number(newSaleFormData.unitPrice || 0))}
                                    </strong>
                                </div>

                                <div className="d-grid mt-4">
                                    <button type="submit" className="btn btn-secondary btn-lg" disabled={loading}>
                                        <i className={`bi ${loading ? "bi-hourglass-split" : "bi-check2-circle"} me-2`}></i>
                                        {loading ? "Traitement..." : "Confirmer la Création de Vente"}
                                    </button>
                                </div>
                            </form>
                        )}
                        
                        {/* Compensation Manuelle */}
                        {useType === 'compensate' && (
                            <ManualCompensationForm
                                creditSale={sale}
                                creditAvailable={creditAvailable}
                                setLoading={setLoading}
                                onCompensationSuccess={onManualCompensationSuccess}
                            />
                        )}
                    </div>
                </div>
            </div>
        </div>
    );
}

/** =====================================
 * SALES TABLE + ACTIONS (Mise à jour pour la modale)
 * ===================================== */
function SalesTable() {
// ... (logique de SalesTable inchangée)

  const [sales, setSales] = useState([]);
  const [filterType, setFilterType] = useState("");
  const [searchClient, setSearchClient] = useState("");
  const [loading, setLoading] = useState(true);
  const [openRow, setOpenRow] = useState(null);
  const [actionType, setActionType] = useState("");
  const [actionValue, setActionValue] = useState("");
  const [modalSale, setModalSale] = useState(null); 

  const load = async () => {
    setLoading(true);
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
    window.dispatchEvent(new Event("reload-sales")); 
  };

  const submitAction = async (sale) => {
    try {
      if (actionType === "deliver") {
        const qty = Number(actionValue || 0);
        if (qty <= 0) throw new Error("Quantité invalide.");

        const remainingToDeliver = Math.max(0, sale.quantity - (sale.delivered || 0));
        if (qty > remainingToDeliver) {
            throw new Error(`La quantité à livrer (${qty} kg) dépasse le reste à livrer (${remainingToDeliver} kg).`);
        }

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
          onManualCompensationSuccess={handleModalSuccess}
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
                          
                          {/* Utilise la modale pour le crédit */}
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

// ... (ChartsPanel, DueNotificationsPanel, SummaryCards, DebtsBoard, CreditsBoard, ClientReportPage inchangés)

/** =====================================
 * NOUVELLE PAGE : CLIENT ANALYSIS
 * ===================================== */
function ClientAnalysisPage() {
    const [clients, setClients] = useState([]);
    const [selectedClient, setSelectedClient] = useState("");
    const [endDate, setEndDate] = useState(new Date().toISOString().slice(0, 10));
    const [startDate, setStartDate] = useState(() => {
        const d = new Date();
        d.setFullYear(d.getFullYear() - 1); // Par défaut: 1 an
        return d.toISOString().slice(0, 10);
    });
    const [data, setData] = useState(null);
    const [loading, setLoading] = useState(false);
    const [error, setError] = useState('');

    // Charger la liste de tous les clients
    useEffect(() => {
        (async () => {
            try {
                const res = await apiFetch("/api/clients");
                const clientsList = await res.json();
                setClients(Array.isArray(clientsList) ? clientsList.sort() : []);
                if (clientsList.length > 0) {
                    setSelectedClient(clientsList[0]);
                }
            } catch (e) {
                setError("Erreur lors du chargement des clients.");
            }
        })();
    }, []);
    
    // Fonction pour charger les données spécifiques
    const loadClientData = async (client, start, end) => {
        if (!client) return;
        setLoading(true);
        setError('');
        setData(null);

        const qs = new URLSearchParams();
        if (start) qs.set('startDate', start);
        if (end) qs.set('endDate', end);

        try {
            const res = await apiFetch(`/api/client-analysis/${encodeURIComponent(client)}?${qs.toString()}`);
            const result = await res.json();
            if (!res.ok) throw new Error(result.error || "Erreur de chargement des données.");
            setData(result);
        } catch (e) {
            setError(e.message);
        } finally {
            setLoading(false);
        }
    };
    
    // Rechargement des données à chaque changement de filtre
    useEffect(() => {
        if (selectedClient) {
            loadClientData(selectedClient, startDate, endDate);
        }
    }, [selectedClient, startDate, endDate]);
    
    const summary = data?.summary;
    const totalDebt = data?.totalDebt || 0;
    const totalCredit = data?.totalCredit || 0;
    const recentSales = data?.recentSales || [];

    const dateRangeDisplay = `${startDate || 'Début'} au ${endDate || 'Aujourd\'hui'}`;


    return (
        <div className="card border-0 shadow rounded-4 mb-4 bg-white">
            <div className="card-header bg-dark text-white rounded-top-4 p-3 d-flex align-items-center">
                <i className="bi bi-search me-2 fs-5"></i>
                <h5 className="m-0">Analyse Détaillée Client et Période</h5>
            </div>
            <div className="card-body p-4">
                <div className="alert alert-info small text-center">
                    Sélectionnez un client et une période pour voir ses statistiques agrégées (solde net, ventes, quantités) et ses dernières opérations.
                </div>
                
                {/* Sélecteurs Client / Date */}
                <div className="row g-3 mb-4 p-3 bg-light rounded-3 border">
                    <div className="col-12 col-md-4">
                        <label className="form-label small fw-semibold">Client / Entreprise</label>
                        <select 
                            className="form-select form-select-lg"
                            value={selectedClient} 
                            onChange={(e) => setSelectedClient(e.target.value)}
                            disabled={loading || clients.length === 0}
                        >
                            <option value="">-- Sélectionner un client --</option>
                            {clients.map(client => (
                                <option key={client} value={client}>{client}</option>
                            ))}
                        </select>
                    </div>
                    <div className="col-6 col-md-4">
                        <label className="form-label small fw-semibold">Date de Début</label>
                        <input 
                            type="date" 
                            className="form-control form-control-lg"
                            value={startDate} 
                            onChange={(e) => setStartDate(e.target.value)}
                            disabled={loading}
                        />
                    </div>
                    <div className="col-6 col-md-4">
                        <label className="form-label small fw-semibold">Date de Fin</label>
                        <input 
                            type="date" 
                            className="form-control form-control-lg"
                            value={endDate} 
                            onChange={(e) => setEndDate(e.target.value)}
                            disabled={loading}
                        />
                    </div>
                </div>

                {loading && <div className="text-center py-5 text-muted"><i className="bi bi-arrow-clockwise spin me-2"></i>Chargement des données...</div>}
                {error && <div className="alert alert-danger text-center">{error}</div>}
                
                {data && !loading && selectedClient && (
                    <>
                        <h4 className="fw-bold mb-3">Synthèse pour {selectedClient} ({dateRangeDisplay})</h4>

                        {/* Cartes de Résumé Périodique */}
                        <div className="row g-4 mb-4">
                            {/* Total Ventes (Montant) */}
                            <div className="col-lg-3 col-md-6">
                                <div className="card bg-primary text-white bg-opacity-75 shadow h-100">
                                    <div className="card-body">
                                        <div className="small text-uppercase">Ventes Période</div>
                                        <h4 className="fw-bold m-0">{money(summary.totalAmount)}</h4>
                                        <div className="small opacity-75">{summary.numSales} ventes</div>
                                    </div>
                                </div>
                            </div>
                            {/* Total Encaissé */}
                            <div className="col-lg-3 col-md-6">
                                <div className="card bg-success text-white bg-opacity-75 shadow h-100">
                                    <div className="card-body">
                                        <div className="small text-uppercase">Règlement Période</div>
                                        <h4 className="fw-bold m-0">{money(summary.totalPayment)}</h4>
                                        <div className="small opacity-75">{summary.totalDelivered} kg livrés (sur {summary.totalQuantity} kg)</div>
                                    </div>
                                </div>
                            </div>
                            {/* Solde Net Actuel (Globale) */}
                            <div className="col-lg-3 col-md-6">
                                <div className={`card ${totalDebt > totalCredit ? 'bg-danger' : 'bg-success'} text-white bg-opacity-75 shadow h-100`}>
                                    <div className="card-body">
                                        <div className="small text-uppercase">Solde Net Global Actuel</div>
                                        <h4 className="fw-bold m-0">{money(Math.abs(totalDebt - totalCredit))}</h4>
                                        <div className="small opacity-75">
                                            {totalDebt > totalCredit ? 'Dette Client' : (totalCredit > totalDebt ? 'Crédit Entreprise' : 'Soldé')}
                                        </div>
                                    </div>
                                </div>
                            </div>
                            {/* Total Dettes / Crédits */}
                            <div className="col-lg-3 col-md-6">
                                <div className="card bg-warning text-dark bg-opacity-75 shadow h-100">
                                    <div className="card-body">
                                        <div className="small text-uppercase">Encours Total (Actuel)</div>
                                        <h6 className="m-0">Dettes: <strong className="text-danger">{money(totalDebt)}</strong></h6>
                                        <h6 className="m-0">Crédits: <strong className="text-success">{money(totalCredit)}</strong></h6>
                                    </div>
                                </div>
                            </div>
                        </div>

                        <h5 className="fw-bold mt-5 mb-3">10 Dernières Opérations dans la Période</h5>
                        <div className="table-responsive">
                            <table className="table table-striped align-middle">
                                <thead className="table-dark">
                                    <tr>
                                        <th>Date</th>
                                        <th>Poisson</th>
                                        <th>Qté (Kg)</th>
                                        <th>Montant</th>
                                        <th>Payé</th>
                                        <th>Solde</th>
                                    </tr>
                                </thead>
                                <tbody>
                                    {recentSales.map(s => (
                                        <tr key={s._id} className={s.balance > 0 ? 'table-danger-subtle' : (s.balance < 0 ? 'table-success-subtle' : '')}>
                                            <td>{new Date(s.date).toISOString().slice(0, 10)}</td>
                                            <td><BadgeFish type={s.fishType} /></td>
                                            <td>{s.quantity}</td>
                                            <td>{money(s.amount)}</td>
                                            <td>{money(s.payment)}</td>
                                            <td className={s.balance > 0 ? 'text-danger fw-bold' : (s.balance < 0 ? 'text-success fw-bold' : '')}>
                                                {money(Math.abs(s.balance))}
                                                {s.balance < 0 && <span className="small text-success"> (Crédit)</span>}
                                            </td>
                                        </tr>
                                    ))}
                                    {recentSales.length === 0 && (
                                        <tr><td colSpan="6" className="text-center text-muted">Aucune vente trouvée pour ce client dans la période sélectionnée.</td></tr>
                                    )}
                                </tbody>
                            </table>
                        </div>
                    </>
                )}
            </div>
        </div>
    );
}

// ... (ReloadableSalesTable inchangé)

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
      case "client-analysis": return "Analyse Client / Période 🔍";
      case "new-sale": return "Nouvelle Opération de Vente 📝";
      case "sales": return "Historique des Ventes & Actions 📋";
      case "debts": return "Vue Dettes Clients 💰";
      case "client-report": return "Bilan Financier Client / Export 📄"; 
      case "charts": return "Analyse Graphique 📈";
      default: return "Tableau de Bord";
    }
  };

  if (!authed) return <AuthView onAuth={() => setAuthed(true)} />;

  const renderPage = () => {
    switch (currentPage) {
      case "client-analysis": 
        return <ClientAnalysisPage />; 
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
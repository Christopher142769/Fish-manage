import React, { useEffect, useState } from "react";

const API_BASE = localStorage.getItem("API_BASE") || "http://localhost:4000";
const money = (n) => (n ?? 0).toLocaleString("fr-FR", { style: "currency", currency: "XOF" });

function apiFetch(path, options = {}) {
  const token = localStorage.getItem("token");
  const headers = { "Content-Type": "application/json", ...(options.headers || {}) };
  if (token) headers["Authorization"] = `Bearer ${token}`;
  return fetch(`${(localStorage.getItem("API_BASE") || API_BASE)}${path}`, { ...options, headers });
}

function BadgeFish({ type }) {
  const cls = type === "tilapia" ? "text-bg-primary" : "text-bg-success";
  return <span className={`badge ${cls}`}>{type === "tilapia" ? "Tilapia" : "Pangasius"}</span>;
}

/* -------- Auth -------- */
function AuthView({ onAuth }) {
  const [mode, setMode] = useState("login");
  const [companyName, setCompanyName] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [api, setApi] = useState(localStorage.getItem("API_BASE") || API_BASE);
  const [err, setErr] = useState("");

  const submit = async (e) => {
    e.preventDefault();
    setErr("");
    try {
      localStorage.setItem("API_BASE", api);
      const path = mode === "login" ? "/api/auth/login" : "/api/auth/register";
      const body = mode === "login" ? { email, password } : { companyName, email, password };
      const res = await fetch(`${api}${path}`, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(body) });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Erreur");
      localStorage.setItem("token", data.token);
      localStorage.setItem("companyName", data.companyName);
      onAuth();
    } catch (e) { setErr(e.message); }
  };

  return (
    <div className="container py-5" style={{ minHeight: "100vh" }}>
      <div className="row justify-content-center">
        <div className="col-lg-5">
          <div className="card border-0 shadow rounded-4">
            <div className="card-body p-4">
              <h3 className="mb-2 text-center">Rapport de Compte — Poissons</h3>
              <p className="text-center text-muted">Tilapia & Pangasius • Historique • Livraisons • Dettes • Export</p>
              <form onSubmit={submit} className="mt-3">
                <div className="mb-2">
                  <label className="form-label">URL API</label>
                  <input className="form-control" value={api} onChange={(e) => setApi(e.target.value)} />
                </div>
                {mode === "register" && (
                  <div className="mb-2">
                    <label className="form-label">Entreprise</label>
                    <input className="form-control" value={companyName} onChange={(e) => setCompanyName(e.target.value)} required />
                  </div>
                )}
                <div className="mb-2">
                  <label className="form-label">Email</label>
                  <input type="email" className="form-control" value={email} onChange={(e) => setEmail(e.target.value)} required />
                </div>
                <div className="mb-3">
                  <label className="form-label">Mot de passe</label>
                  <input type="password" className="form-control" value={password} onChange={(e) => setPassword(e.target.value)} required />
                </div>
                {err && <div className="alert alert-danger">{err}</div>}
                <div className="d-grid gap-2">
                  <button className="btn btn-primary rounded-pill" type="submit">
                    {mode === "login" ? "Connexion" : "Inscription"}
                  </button>
                  <button type="button" className="btn btn-outline-secondary rounded-pill" onClick={() => setMode(mode === "login" ? "register" : "login")}>
                    {mode === "login" ? "Créer un compte" : "J'ai déjà un compte"}
                  </button>
                </div>
              </form>
            </div>
          </div>
          <div className="text-center text-muted mt-3 small">
            Astuce : lance d’abord l’API <code>server.js</code> sur <code>{API_BASE}</code>.
          </div>
        </div>
      </div>
    </div>
  );
}

/* -------- Formulaire Vente (avec Quantité livrée) -------- */
function SaleForm({ onSaved }) {
  const [date, setDate] = useState(new Date().toISOString().slice(0, 10));
  const [clientName, setClient] = useState("");
  const [fishType, setFishType] = useState("tilapia"); // Sélection Tilapia ou Pangasius
  const [quantity, setQty] = useState("");
  const [delivered, setDelivered] = useState(""); // NEW
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
          delivered: Number(delivered || 0), // NEW
          unitPrice: Number(unitPrice),
          payment: Number(payment || 0),
          observation,
        }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Erreur");
      setClient(""); setQty(""); setDelivered(""); setUnit(""); setPay(""); setObs("");
      onSaved && onSaved(data);
    } catch (err) { alert(err.message); }
    finally { setLoading(false); }
  };

  return (
    <div className="card border-0 shadow rounded-4 mb-3">
      <div className="card-body">
        <h5 className="mb-3">Nouvelle vente</h5>
        <form onSubmit={save} className="row g-3">
          <div className="col-6 col-md-3">
            <label className="form-label">Date</label>
            <input type="date" className="form-control" value={date} onChange={(e) => setDate(e.target.value)} required />
          </div>
          <div className="col-md-5">
            <label className="form-label">Client</label>
            <input className="form-control" value={clientName} onChange={(e) => setClient(e.target.value)} required />
          </div>
          <div className="col-md-4">
            <label className="form-label">Poisson</label>
            <select className="form-select" value={fishType} onChange={(e) => setFishType(e.target.value)}>
              <option value="tilapia">Tilapia</option>
              <option value="pangasius">Pangasius</option>
            </select>
          </div>
          <div className="col-6 col-md-3">
            <label className="form-label">Quantité commandée</label>
            <input type="number" step="0.01" className="form-control" value={quantity} onChange={(e) => setQty(e.target.value)} required />
          </div>
          <div className="col-6 col-md-3">
            <label className="form-label">Quantité livrée</label>
            <input type="number" step="0.01" className="form-control" value={delivered} onChange={(e) => setDelivered(e.target.value)} />
          </div>
          <div className="col-6 col-md-3">
            <label className="form-label">Prix unitaire</label>
            <input type="number" step="0.01" className="form-control" value={unitPrice} onChange={(e) => setUnit(e.target.value)} required />
          </div>
          <div className="col-6 col-md-3">
            <label className="form-label">Règlement (payé)</label>
            <input type="number" step="0.01" className="form-control" value={payment} onChange={(e) => setPay(e.target.value)} />
          </div>
          <div className="col-md-12">
            <label className="form-label">Observation</label>
            <input className="form-control" value={observation} onChange={(e) => setObs(e.target.value)} placeholder="Notes..." />
          </div>
          <div className="col-12 d-flex gap-2 align-items-center">
            <span className="badge text-bg-secondary">Montant: {money(amount)}</span>
            <span className="badge text-bg-warning">Solde: {money(balance)}</span>
            <span className="badge text-bg-info">Reste à livrer: {remainingToDeliver}</span>
            <button className="btn btn-primary rounded-pill ms-auto" disabled={loading}>
              {loading ? "Enregistrement..." : "Enregistrer"}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}

/* -------- Tableau des ventes (Livrer / Régler partiels) -------- */
function SalesTable() {
  const [sales, setSales] = useState([]);
  const [filterType, setFilterType] = useState("");
  const [searchClient, setSearchClient] = useState("");
  const [loading, setLoading] = useState(true);
  const [openRow, setOpenRow] = useState(null);     // pour afficher l’UI d’action
  const [actionType, setActionType] = useState(""); // "deliver" | "pay"
  const [actionValue, setActionValue] = useState(""); // valeur saisie

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

  return (
    <div className="card border-0 shadow rounded-4">
      <div className="card-body">
        <div className="d-flex flex-wrap gap-2 align-items-center mb-2">
          <h5 className="m-0">Historique des ventes</h5>
          <div className="ms-auto d-flex gap-2">
            <input className="form-control" placeholder="Rechercher client..." value={searchClient} onChange={(e) => setSearchClient(e.target.value)} />
            <select className="form-select" value={filterType} onChange={(e) => setFilterType(e.target.value)}>
              <option value="">Tous</option>
              <option value="tilapia">Tilapia</option>
              <option value="pangasius">Pangasius</option>
            </select>
            <a
              className="btn btn-outline-success"
              href={`${(localStorage.getItem("API_BASE") || API_BASE)}/api/exports/sales.xlsx`}
              onClick={(e) => { if (!localStorage.getItem("token")) { e.preventDefault(); alert("Connectez-vous"); } }}
              target="_blank" rel="noreferrer"
            >
              Exporter Excel
            </a>
          </div>
        </div>

        <div className="table-responsive">
          <table className="table align-middle table-hover">
            <thead>
              <tr>
                <th>Date</th><th>Client</th><th>Poisson</th>
                <th>Qté</th><th>Livré</th><th>Reste à livrer</th>
                <th>PU</th><th>Montant</th><th>Payé</th><th>Solde</th>
                <th>Statut</th><th style={{width:220}}>Actions</th>
              </tr>
            </thead>
            <tbody>
              {loading && <tr><td colSpan="12" className="text-center py-4">Chargement...</td></tr>}
              {!loading && sales.length === 0 && <tr><td colSpan="12" className="text-center py-4">Aucune vente</td></tr>}

              {sales.map((s) => {
                const remainingToDeliver = Math.max(0, s.quantity - (s.delivered || 0));
                const remainingToPay = Math.max(0, s.amount - (s.payment || 0));
                return (
                  <React.Fragment key={s._id}>
                    <tr>
                      <td>{new Date(s.date).toISOString().slice(0, 10)}</td>
                      <td>{s.clientName}</td>
                      <td><BadgeFish type={s.fishType} /></td>
                      <td>{s.quantity}</td>
                      <td>{s.delivered || 0}</td>
                      <td className={remainingToDeliver>0 ? "text-warning fw-semibold" : ""}>{remainingToDeliver}</td>
                      <td>{money(s.unitPrice)}</td>
                      <td>{money(s.amount)}</td>
                      <td>{money(s.payment)}</td>
                      <td className={s.balance>0 ? "text-danger fw-bold": ""}>{money(s.balance)}</td>
                      <td>{s.settled ? <span className="badge text-bg-success">Soldé</span> : <span className="badge text-bg-warning">Non soldé</span>}</td>
                      <td>
                        <div className="d-flex flex-wrap gap-2">
                          {remainingToDeliver > 0 && (
                            <button className="btn btn-sm btn-outline-primary rounded-pill"
                              onClick={() => toggleAction(s._id, "deliver", remainingToDeliver)}>
                              Livrer
                            </button>
                          )}
                          {!s.settled && (
                            <>
                              <button className="btn btn-sm btn-outline-secondary rounded-pill"
                                onClick={() => toggleAction(s._id, "pay", remainingToPay)}>
                                Régler
                              </button>
                              <button className="btn btn-sm btn-outline-success rounded-pill"
                                onClick={() => settleAll(s._id)}>
                                Solder tout
                              </button>
                            </>
                          )}
                        </div>
                      </td>
                    </tr>

                    {openRow === s._id && (
                      <tr>
                        <td colSpan="12">
                          <div className="bg-light p-3 rounded-3">
                            {actionType === "deliver" ? (
                              <>
                                <div className="d-flex align-items-end gap-2 flex-wrap">
                                  <div className="me-auto">
                                    <div className="small text-muted mb-1">Livraison partielle</div>
                                    <div className="input-group">
                                      <span className="input-group-text">Qté à livrer</span>
                                      <input type="number" min="0" step="0.01" className="form-control"
                                        value={actionValue} onChange={(e)=>setActionValue(e.target.value)} />
                                      <button className="btn btn-outline-primary"
                                        onClick={()=>setActionValue(Math.max(0, s.quantity - (s.delivered||0)))}>
                                        Livrer tout le reste
                                      </button>
                                    </div>
                                  </div>
                                  <button className="btn btn-primary"
                                    onClick={()=>submitAction(s)}>Valider la livraison</button>
                                  <button className="btn btn-link" onClick={()=>{ setOpenRow(null); setActionType(""); }}>Annuler</button>
                                </div>
                              </>
                            ) : (
                              <>
                                <div className="d-flex align-items-end gap-2 flex-wrap">
                                  <div className="me-auto">
                                    <div className="small text-muted mb-1">Règlement partiel</div>
                                    <div className="input-group">
                                      <span className="input-group-text">Montant</span>
                                      <input type="number" min="0" step="0.01" className="form-control"
                                        value={actionValue} onChange={(e)=>setActionValue(e.target.value)} />
                                      <button className="btn btn-outline-secondary"
                                        onClick={()=>setActionValue(Math.max(0, s.amount - (s.payment||0)))}>
                                        Régler le solde
                                      </button>
                                    </div>
                                  </div>
                                  <button className="btn btn-secondary"
                                    onClick={()=>submitAction(s)}>Valider le règlement</button>
                                  <button className="btn btn-link" onClick={()=>{ setOpenRow(null); setActionType(""); }}>Annuler</button>
                                </div>
                              </>
                            )}
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

/* -------- Dashboard dettes -------- */
function DebtsBoard() {
  const [debts, setDebts] = useState([]);
  useEffect(() => { (async () => {
    const res = await apiFetch("/api/dashboard/debts"); const data = await res.json();
    setDebts(Array.isArray(data) ? data : []);
  })(); }, []);
  const total = debts.reduce((sum, d) => sum + d.totalDebt, 0);

  return (
    <div className="card border-0 shadow rounded-4 mb-3">
      <div className="card-body">
        <div className="d-flex align-items-center mb-2">
          <h5 className="m-0">Dashboard des dettes par client</h5>
          <span className="ms-auto badge text-bg-danger">Encours total: {money(total)}</span>
        </div>
        <div className="table-responsive">
          <table className="table align-middle">
            <thead><tr><th>Client</th><th>Nombre d’opérations</th><th>Dette</th></tr></thead>
            <tbody>
              {debts.length === 0 && <tr><td colSpan="3" className="text-center py-3">Aucune dette en cours</td></tr>}
              {debts.map((d) => (
                <tr key={d.clientName}>
                  <td className="fw-semibold">{d.clientName}</td>
                  <td>{d.count}</td>
                  <td className="text-danger fw-bold">{money(d.totalDebt)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}

/* -------- Résumé global -------- */
function SummaryCards() {
  const [sum, setSum] = useState(null);
  useEffect(() => { (async () => {
    const res = await apiFetch("/api/summary"); const data = await res.json(); setSum(data);
  })(); }, []);
  if (!sum) return null;

  const byTilapia = sum.byFish?.find((f) => f.fishType === "tilapia") || { amount: 0, payment: 0, balance: 0 };
  const byPanga = sum.byFish?.find((f) => f.fishType === "pangasius") || { amount: 0, payment: 0, balance: 0 };

  const Card = ({ title, amount, foot }) => (
    <div className="col-md-4">
      <div className="card border-0 shadow rounded-4 mb-3">
        <div className="card-body">
          <div className="text-muted">{title}</div>
          <div className="h4 m-0">{money(amount)}</div>
          {foot && <div className="text-muted small mt-2">{foot}</div>}
        </div>
      </div>
    </div>
  );

  return (
    <div className="row">
      <Card title="Montant total ventes" amount={sum.totalAmount} foot="Somme de tous les montants" />
      <Card title="Total payé" amount={sum.totalPayment} foot="Somme des règlements" />
      <Card title="Encours (solde total)" amount={sum.totalBalance} foot="Montant restant à recouvrer" />
      <div className="col-md-6">
        <div className="card border-0 shadow rounded-4 mb-3">
          <div className="card-body">
            <div className="d-flex justify-content-between"><h6 className="m-0">Par type — Tilapia</h6><BadgeFish type="tilapia" /></div>
            <div className="small text-muted mt-2">Montant: {money(byTilapia.amount)} • Payé: {money(byTilapia.payment)} • Solde: {money(byTilapia.balance)}</div>
          </div>
        </div>
      </div>
      <div className="col-md-6">
        <div className="card border-0 shadow rounded-4 mb-3">
          <div className="card-body">
            <div className="d-flex justify-content-between"><h6 className="m-0">Par type — Pangasius</h6><BadgeFish type="pangasius" /></div>
            <div className="small text-muted mt-2">Montant: {money(byPanga.amount)} • Payé: {money(byPanga.payment)} • Solde: {money(byPanga.balance)}</div>
          </div>
        </div>
      </div>
    </div>
  );
}

/* -------- App -------- */
export default function App() {
  const [authed, setAuthed] = useState(!!localStorage.getItem("token"));
  const companyName = localStorage.getItem("companyName") || "";

  if (!authed) return <AuthView onAuth={() => setAuthed(true)} />;

  return (
    <div className="container py-4" style={{ background: "#f7f7fb", minHeight: "100vh" }}>
      <div className="d-flex align-items-center mb-3">
        <h4 className="me-auto m-0">Espace — {companyName}</h4>
        <button className="btn btn-outline-secondary btn-sm rounded-pill"
          onClick={() => { localStorage.removeItem("token"); window.location.reload(); }}>
          Se déconnecter
        </button>
      </div>

      <SummaryCards />

      <div className="row g-3">
        <div className="col-lg-4">
          <SaleForm onSaved={() => window.dispatchEvent(new Event("reload-sales"))} />
          <DebtsBoard />
        </div>
        <div className="col-lg-8">
          <ReloadableSalesTable />
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

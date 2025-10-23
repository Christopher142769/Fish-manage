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

// FONCTION pour valider le nom de client (MAJUSCULES SANS ESPACE)
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
 * SALES TABLE + RELOAD WRAPPER
 * ===================================== */
function SalesTable() {
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
 * MODALES & FORMS (Ajoutés pour éviter le "is not defined")
 * ===================================== */

// Corps de formulaire de vente (déjà défini ci-dessus)
// function SaleFormBody(...) { ... }

// Formulaire de vente (déjà défini ci-dessus)
// function SaleForm(...) { ... }

// Modales de Crédit (déjà définies ci-dessus)
// function ManualCompensationForm(...) { ... }
// function CreditUseModal(...) { ... }


/** =====================================
 * CHARTS (Adapté pour être utilisé à la fois dans le Dashboard filtré et la page Charts)
 * ===================================== */
function ChartsPanel({ globalData, clientData, clientSelected }) {
    const chartReady = useChartJs();
    
    // Déterminer la source de données
    const isGlobal = !clientSelected && globalData;
    const isClient = clientSelected && clientData;
    const dataToUse = isClient ? clientData : globalData;

    if (!chartReady || !dataToUse) {
        return (
            <div className="col-12 text-center text-muted py-5">
                {clientSelected ? "Sélectionnez une période pour charger les analyses graphiques." : "Chargement des données graphiques globales..."}
            </div>
        );
    }

    const salesRef = useRef(null);
    const debtsRef = useRef(null);
    const typeRef = useRef(null);
    const salesChart = useRef(null);
    const debtsChart = useRef(null);
    const typeChart = useRef(null);

    const chartConfig = useMemo(() => {
        let labels, amounts, balances, tilapiaAmount, pangasiusAmount;

        if (isClient) {
            // Logique Client Analysis Page (agrégat périodique)
            labels = ["Synthèse Période"];
            amounts = [dataToUse.summary.totalAmount];
            balances = [dataToUse.summary.totalBalance]; 
            
            tilapiaAmount = dataToUse.recentSales.filter(s => s.fishType === 'tilapia').reduce((sum, s) => sum + s.amount, 0);
            pangasiusAmount = dataToUse.recentSales.filter(s => s.fishType === 'pangasius').reduce((sum, s) => sum + s.amount, 0);
        } else if (isGlobal) {
            // Logique Globale (basée sur l'ancienne implémentation de ChartsPanel)
            const monthlyMap = new Map();
            dataToUse.sales.forEach((s) => {
                const d = new Date(s.date);
                const k = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}`;
                const curr = monthlyMap.get(k) || { amount: 0, balance: 0 };
                curr.amount += Number(s.amount || 0);
                curr.balance += Math.max(0, Number(s.balance || 0)); 
                monthlyMap.set(k, curr);
            });
            
            labels = Array.from(monthlyMap.keys()).sort();
            amounts = labels.map((k) => monthlyMap.get(k).amount);
            balances = labels.map((k) => monthlyMap.get(k).balance);
            
            tilapiaAmount = dataToUse.totalTilapiaAmount;
            pangasiusAmount = dataToUse.totalPangasiusAmount;
        } else {
             // Cas non chargé
             return null;
        }

        return { labels, amounts, balances, tilapiaAmount, pangasiusAmount, isClient };
    }, [dataToUse, isClient, isGlobal]);
    
    if (!chartConfig) return null;

    useEffect(() => {
        if (!chartReady) return;
        const Chart = window.Chart;
        [salesChart, debtsChart, typeChart].forEach((chart) => chart.current?.destroy?.());

        // Graphique Ventes 
        salesChart.current = new Chart(salesRef.current, {
            type: "bar",
            data: {
                labels: chartConfig.labels,
                datasets: [{
                    label: "Ventes (XOF)",
                    data: chartConfig.amounts,
                    backgroundColor: "rgba(0, 123, 255, 0.8)",
                    borderRadius: 5,
                    barThickness: chartConfig.isClient ? 50 : 'flex',
                }],
            },
            options: { responsive: true, maintainAspectRatio: false, scales: { y: { beginAtZero: true } } },
        });

        // Graphique Dettes/Solde 
        debtsChart.current = new Chart(debtsRef.current, {
            type: chartConfig.isClient ? "bar" : "line", 
            data: {
                labels: chartConfig.labels,
                datasets: [{
                    label: chartConfig.isClient ? "Solde Net Période" : "Dettes Cumulées (Solde XOF)",
                    data: chartConfig.balances,
                    borderColor: chartConfig.isClient ? null : "rgb(220, 53, 69)",
                    backgroundColor: chartConfig.isClient ? (chartConfig.balances[0] > 0 ? "rgba(220, 53, 69, 0.8)" : "rgba(25, 135, 84, 0.8)") : "rgba(220, 53, 69, 0.1)",
                    fill: !chartConfig.isClient,
                    tension: chartConfig.isClient ? 0 : 0.4,
                    pointRadius: chartConfig.isClient ? 0 : 3,
                }],
            },
            options: { responsive: true, maintainAspectRatio: false, scales: { y: { beginAtZero: true } } },
        });

        // Graphique Ventes par Espèce (Donut)
        typeChart.current = new Chart(typeRef.current, {
            type: "doughnut",
            data: {
                labels: ["Tilapia", "Pangasius"],
                datasets: [{ 
                    data: [chartConfig.tilapiaAmount, chartConfig.pangasiusAmount], 
                    backgroundColor: ["#007bff", "#198754"], hoverOffset: 4 
                }],
            },
            options: { responsive: true, maintainAspectRatio: false, plugins: { legend: { position: "bottom" } } },
        });
        
        return () => {
            salesChart.current?.destroy();
            debtsChart.current?.destroy();
            typeChart.current?.destroy();
        };
    }, [chartReady, chartConfig]);

    return (
        <div className="row g-4 mb-4">
            <div className="col-lg-6 col-xl-4">
                <div className="card border-0 shadow-sm rounded-4 h-100">
                    <div className="card-body">
                        <h5 className="fw-bold text-dark mb-3"><i className="bi bi-bar-chart-fill me-2 text-primary"></i>Volume des Ventes ({chartConfig.isClient ? 'Période' : 'Global'})</h5>
                        <div style={{ height: 300 }} className="chart-container">
                        <canvas ref={salesRef} />
                        </div>
                    </div>
                </div>
            </div>
            <div className="col-lg-6 col-xl-4">
                <div className="card border-0 shadow-sm rounded-4 h-100">
                    <div className="card-body">
                        <h5 className="fw-bold text-dark mb-3"><i className="bi bi-file-earmark-bar-graph-fill me-2 text-danger"></i>{chartConfig.isClient ? 'Solde Net (Période)' : 'Évolution des Dettes'}</h5>
                        <div style={{ height: 300 }} className="chart-container">
                        <canvas ref={debtsRef} />
                        </div>
                    </div>
                </div>
            </div>
            <div className="col-lg-12 col-xl-4">
                <div className="card border-0 shadow-sm rounded-4 h-100">
                    <div className="card-body">
                        <h5 className="fw-bold text-dark mb-3"><i className="bi bi-pie-chart-fill me-2 text-info"></i>Ventes par Espèce ({chartConfig.isClient ? 'Période' : 'Global'})</h5>
                        <div style={{ height: 300 }} className="d-flex align-items-center justify-content-center chart-container">
                        <canvas ref={typeRef} style={{ maxHeight: "250px" }} />
                        </div>
                    </div>
                </div>
            </div>
        </div>
    );
}

/** =====================================
 * NOTIFS D'ÉCHÉANCE (Simplifié pour le dashboard filtré)
 * ===================================== */
function DueNotificationsPanel({ clientSelected }) {
  const [sales, setSales] = useState([]);
  const [thresholdDays, setThresholdDays] = useState(Number(localStorage.getItem("due_threshold_days") || 30));
  const [perm, setPerm] = useState(typeof Notification !== "undefined" ? Notification?.permission : "default");

  useEffect(() => { 
    const loadData = async () => {
        const res = await apiFetch("/api/sales");
        const data = await res.json();
        setSales(Array.isArray(data) ? data : []);
    };
    loadData();
    const handler = () => loadData();
    window.addEventListener("reload-sales", handler);
    return () => window.removeEventListener("reload-sales", handler);
  }, []);

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

  if (clientSelected) {
      return (
        <div className="card border-0 shadow rounded-4 mb-4 bg-white">
          <div className="card-body p-4">
            <div className="d-flex align-items-center mb-4 pb-2 border-bottom flex-wrap gap-3">
              <h5 className="m-0 fw-bold"><i className="bi bi-bell-fill me-2 text-warning"></i>Échéances (Global)</h5>
            </div>
            
            <p className="text-muted text-center">
                *Alerte de retard globale : ce panneau est conservé pour la vue "Dettes Clients" ou "Rapport Global" mais pas filtrable par client/période.
            </p>
          </div>
        </div>
      );
  }

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
 * SUMMARY CARDS (Adapté pour être utilisé à la fois dans le Dashboard filtré et la page Charts)
 * ===================================== */
function SummaryCards({ globalData, clientData, clientSelected, dateRangeDisplay }) {
    
    const isClient = clientSelected && clientData;
    const dataToUse = isClient ? clientData : globalData;

    if (!dataToUse) return null; // Ne rien afficher si les données ne sont pas chargées (e.g. chargement initial du DashboardPage)

    let totalAmount, totalPayment, totalBalance, totalDebt, totalCredit;

    if (isClient) {
        // Synthèse Client (DashboardPage)
        totalAmount = dataToUse.summary.totalAmount;
        totalPayment = dataToUse.summary.totalPayment;
        totalBalance = dataToUse.summary.totalBalance; // Balance périodique
        totalDebt = dataToUse.totalDebt; // Dette globale actuelle
        totalCredit = dataToUse.totalCredit; // Crédit global actuel
    } else {
        // Synthèse Globale (GlobalReportPage et ChartsPage)
        totalAmount = dataToUse.totalAmount;
        totalPayment = dataToUse.totalPayment;
        totalBalance = dataToUse.totalBalance;
        // Pour les totaux globaux, on utilise la balance globale pour l'encours net.
        totalDebt = dataToUse.totalDebt || 0; // Ces valeurs sont calculées dans GlobalReportPage
        totalCredit = dataToUse.totalCredit || 0;
    }
    
    // Calcul de l'encours net
    const totalBalanceAbs = Math.abs(totalDebt - totalCredit);
    const totalBalanceIsCredit = totalCredit > totalDebt;

    const Card = ({ title, amount, iconClass, cardClass, isCredit, subtitle = '' }) => (
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
                    {subtitle && <div className="small opacity-75">{subtitle}</div>}
                </div>
                </div>
            </div>
        </div>
    );

    return (
        <>
            <h4 className="fw-bold mb-3">{isClient ? `Synthèse pour ${dataToUse.selectedClientName} (${dateRangeDisplay})` : 'Synthèse Financière Globale'}</h4>

            <div className="row g-4 mb-4">
                <Card 
                    title={isClient ? "Ventes Période" : "Total Ventes"} 
                    amount={totalAmount} 
                    iconClass="bi-graph-up-arrow text-primary" 
                    cardClass="bg-primary text-white bg-opacity-75"
                    subtitle={isClient ? `${dataToUse.summary.numSales} ventes | ${dataToUse.summary.totalQuantity} kg` : null}
                />
                <Card 
                    title={isClient ? "Règlement Période" : "Total Encaissé"} 
                    amount={totalPayment} 
                    iconClass="bi-check-circle-fill text-success" 
                    cardClass="bg-success text-white bg-opacity-75" 
                    subtitle={isClient ? `${dataToUse.summary.totalDelivered} kg livrés` : null}
                />
                <Card 
                    title={totalBalanceIsCredit ? "Crédit Net Global" : "Dette Nette Globale"} 
                    amount={totalBalanceAbs} 
                    isCredit={totalBalanceIsCredit}
                    iconClass={totalBalanceIsCredit ? "bi-arrow-down-circle-fill text-success" : "bi-currency-exchange text-danger"} 
                    cardClass={totalBalanceIsCredit ? "bg-success text-white bg-opacity-75" : "bg-danger text-white bg-opacity-75"} 
                    subtitle={`Dette: ${money(totalDebt)} / Crédit: ${money(totalCredit)}`}
                />
            </div>
        </>
    );
}


/** =====================================
 * DEBTS BOARD (Adapté pour le dashboard filtré)
 * ===================================== */
function DebtsBoard({ totalDebt, clientSelected, isGlobal }) {
    // Si Global (pour la page Debts Clients), on utilise l'API DebtsBoard classique
    if (isGlobal) {
        const [debts, setDebts] = useState([]);
        const loadDebts = useMemo(() => async () => {
            const res = await apiFetch("/api/dashboard/debts");
            setDebts(Array.isArray(data) ? data : []);
        }, []); 
        useEffect(() => { loadDebts(); }, [loadDebts]); 
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
                            {debts.map((d) => (<tr key={d.clientName} className="align-middle"><td className="fw-semibold">{d.clientName}</td><td className="small text-muted">{d.count}</td><td className="text-danger fw-bolder">{money(d.totalDebt)}</td></tr>))}
                            {debts.length === 0 && <tr><td colSpan="3" className="text-center py-3 text-muted">Aucune dette en cours.</td></tr>}
                            </tbody>
                        </table>
                    </div>
                </div>
            </div>
        );
    }
    
    // Si Dashboard Filtré (Client sélectionné)
    if (!clientSelected || totalDebt === 0) return null;

    const data = [{ clientName: clientSelected, totalDebt: totalDebt, count: 1 }];

    return (
        <div className="card border-0 shadow rounded-4 bg-white">
          <div className="card-body p-4">
            <div className="d-flex align-items-center mb-4 pb-2 border-bottom">
              <h5 className="m-0 fw-bold"><i className="bi bi-person-lines-fill me-2 text-danger"></i>Dette Actuelle: {clientSelected}</h5>
              <span className="ms-auto badge text-bg-danger p-2 fs-6">Dette Totale: {money(totalDebt)}</span>
            </div>
            <div className="table-responsive" style={{ maxHeight: 300, overflowY: "auto" }}>
              <table className="table align-middle table-sm table-hover">
                <thead>
                  <tr className="table-light"><th>Client</th><th># Opérations</th><th>Dette</th></tr>
                </thead>
                <tbody>
                  {data.map((d) => (
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
 * CREDITS BOARD (Adapté pour le dashboard filtré)
 * ===================================== */
function CreditsBoard({ totalCredit, clientSelected, isGlobal }) {
    // Si Global (pour la page Debts Clients), on utilise l'API CreditsBoard classique
    if (isGlobal) {
        const [credits, setCredits] = useState([]);
        const loadCredits = useMemo(() => async () => {
            const res = await apiFetch("/api/dashboard/credits");
            setCredits(Array.isArray(data) ? data : []);
        }, []);
        useEffect(() => { loadCredits(); }, [loadCredits]); 
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
                            {credits.map((d) => (<tr key={d.clientName} className="align-middle"><td className="fw-semibold">{d.clientName}</td><td className="small text-muted">{d.count}</td><td className="text-success fw-bolder">{money(d.totalCredit)}</td></tr>))}
                            {credits.length === 0 && <tr><td colSpan="3" className="text-center py-3 text-muted">Aucun crédit client en cours.</td></tr>}
                            </tbody>
                        </table>
                    </div>
                </div>
            </div>
        );
    }
    
    // Si Dashboard Filtré (Client sélectionné)
    if (!clientSelected || totalCredit === 0) return null;

    const data = [{ clientName: clientSelected, totalCredit: totalCredit, count: 1 }];

    return (
        <div className="card border-0 shadow rounded-4 bg-white">
          <div className="card-body p-4">
            <div className="d-flex align-items-center mb-4 pb-2 border-bottom">
              <h5 className="m-0 fw-bold"><i className="bi bi-person-check-fill me-2 text-success"></i>Crédit Actuel: {clientSelected}</h5>
              <span className="ms-auto badge text-bg-success p-2 fs-6">Crédit Total: {money(totalCredit)}</span>
            </div>
            <div className="table-responsive" style={{ maxHeight: 300, overflowY: "auto" }}>
              <table className="table align-middle table-sm table-hover">
                <thead>
                  <tr className="table-light"><th>Client</th><th># Opérations</th><th>Crédit</th></tr>
                </thead>
                <tbody>
                  {data.map((d) => (
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
 * RAPPORT GLOBAL (Totaux de l'Entreprise)
 * ===================================== */
function GlobalReportPage() {
    const [globalData, setGlobalData] = useState(null);

    const loadGlobalData = async () => {
        try {
            const [summaryRes, debtsRes, creditsRes, salesRes] = await Promise.all([
                apiFetch("/api/summary"),
                apiFetch("/api/dashboard/debts"),
                apiFetch("/api/dashboard/credits"),
                apiFetch("/api/sales") // Pour les graphiques
            ]);

            const summaryData = await summaryRes.json();
            const debtsData = await debtsRes.json();
            const creditsData = await creditsRes.json();
            const salesData = await salesRes.json();

            const totalDebt = debtsData.reduce((s, d) => s + d.totalDebt, 0);
            const totalCredit = creditsData.reduce((s, c) => s + c.totalCredit, 0);
            
            const totalTilapiaAmount = summaryData.byFish?.find((f) => f.fishType === "tilapia")?.amount || 0;
            const totalPangasiusAmount = summaryData.byFish?.find((f) => f.fishType === "pangasius")?.amount || 0;

            setGlobalData({
                ...summaryData,
                totalDebt,
                totalCredit,
                sales: salesData,
                totalTilapiaAmount,
                totalPangasiusAmount
            });
        } catch (e) {
            console.error("Erreur de chargement des données globales:", e);
        }
    };

    useEffect(() => { 
        loadGlobalData(); 
        const handler = () => loadGlobalData();
        window.addEventListener("reload-sales", handler);
        return () => window.removeEventListener("reload-sales", handler);
    }, []);
    
    if (!globalData) return <div className="text-center py-5 text-muted"><i className="bi bi-arrow-clockwise spin me-2"></i>Chargement du rapport global...</div>;


    return (
        <div className="card border-0 shadow rounded-4 mb-4 bg-white">
            <div className="card-header bg-dark text-white rounded-top-4 p-3 d-flex align-items-center">
                <i className="bi bi-file-earmark-bar-graph-fill me-2 fs-5"></i>
                <h5 className="m-0">Rapport Global (Totaux de l'Entreprise)</h5>
            </div>
            <div className="card-body p-4">
                
                <SummaryCards 
                    globalData={globalData} 
                    clientSelected={false} 
                />

                <ChartsPanel 
                    globalData={globalData} 
                    clientSelected={false} 
                />

                <div className="row g-4">
                    {/* Dettes globales */}
                    <div className="col-lg-6">
                        <DebtsBoard isGlobal={true} />
                    </div>

                    {/* Crédits globaux */}
                    <div className="col-lg-6">
                        <CreditsBoard isGlobal={true} />
                    </div>
                </div>
            </div>
        </div>
    );
}

/** =====================================
 * DASHBOARD (Synthèse Client / Période)
 * ===================================== */
function DashboardPage() {
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
            } catch (e) {
                setError("Erreur lors du chargement des clients.");
            }
        })();
    }, []);
    
    // Fonction pour charger les données spécifiques
    const loadClientData = async (client, start, end) => {
        if (!client) {
            setData(null);
            return;
        }
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
            
            // Calcul des ventes par poisson dans la période
            const recentSales = result.recentSales; // Ceci est déjà filtré par période dans le backend
            
            setData({ ...result, recentSales, selectedClientName: client });
        } catch (e) {
            setError(e.message);
        } finally {
            setLoading(false);
        }
    };
    
    // Rechargement des données à chaque changement de filtre
    useEffect(() => {
        loadClientData(selectedClient, startDate, endDate);
    }, [selectedClient, startDate, endDate]);
    
    const clientSelected = selectedClient !== "";

    const dateRangeDisplay = `${startDate || 'Début'} au ${endDate || 'Aujourd\'hui'}`;
    
    // Contenu principal du dashboard
    return (
        <div className="card border-0 shadow rounded-4 mb-4 bg-white">
            <div className="card-header bg-dark text-white rounded-top-4 p-3 d-flex align-items-center">
                <i className="bi bi-search me-2 fs-5"></i>
                <h5 className="m-0">Synthèse Client / Période</h5>
            </div>
            <div className="card-body p-4">
                
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
                        <input type="date" className="form-control form-control-lg" value={startDate} onChange={(e) => setStartDate(e.target.value)} disabled={loading} />
                    </div>
                    <div className="col-6 col-md-4">
                        <label className="form-label small fw-semibold">Date de Fin</label>
                        <input type="date" className="form-control form-control-lg" value={endDate} onChange={(e) => setEndDate(e.target.value)} disabled={loading} />
                    </div>
                </div>

                {loading && <div className="text-center py-5 text-muted"><i className="bi bi-arrow-clockwise spin me-2"></i>Chargement des données...</div>}
                {error && <div className="alert alert-danger text-center">{error}</div>}
                
                {!clientSelected && !loading && (
                    <div className="alert alert-warning text-center">
                        Veuillez sélectionner un **Client** pour charger les données.
                    </div>
                )}

                {data && !loading && clientSelected ? (
                    <>
                        <SummaryCards 
                            clientData={data} 
                            totalDebt={data.totalDebt}
                            totalCredit={data.totalCredit}
                            clientSelected={selectedClient} 
                            dateRangeDisplay={dateRangeDisplay}
                        />

                        <ChartsPanel 
                            clientData={data} 
                            clientSelected={selectedClient} 
                        />
                        
                        <div className="row g-4 mt-1">
                            <div className="col-lg-6">
                                <DebtsBoard totalDebt={data.totalDebt} clientSelected={selectedClient} isGlobal={false} />
                            </div>
                            <div className="col-lg-6">
                                <CreditsBoard totalCredit={data.totalCredit} clientSelected={selectedClient} isGlobal={false} />
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
                                    {data.recentSales.map(s => (
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
                                    {data.recentSales.length === 0 && (
                                        <tr><td colSpan="6" className="text-center text-muted">Aucune vente trouvée pour ce client dans la période sélectionnée.</td></tr>
                                    )}
                                </tbody>
                            </table>
                        </div>
                    </>
                ) : (
                    // Afficher les cartes à 0 si le client n'est pas sélectionné
                    <SummaryCards summary={{totalAmount:0, totalPayment:0, numSales:0, totalQuantity:0, totalDelivered:0}} totalDebt={0} totalCredit={0} clientSelected={false} />
                )}
            </div>
        </div>
    );
}

/** =====================================
 * APP PRINCIPALE
 * ===================================== */
export default function App() {
  const { isMdUp } = useViewport();
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const [authed, setAuthed] = useState(!!(typeof window !== "undefined" && localStorage.getItem("token")));
  const companyName = (typeof window !== "undefined" && localStorage.getItem("companyName")) || "Mon Entreprise";
  // 🚨 Dashboard est la vue par défaut, c'est le nouveau DashboardPage (filtré)
  const [currentPage, setCurrentPage] = useState("dashboard"); 

  const handleLogout = () => {
    localStorage.removeItem("token");
    localStorage.removeItem("companyName");
    setAuthed(false);
  };

  const getPageTitle = (page) => {
    switch (page) {
      case "dashboard": return "Synthèse Client / Période 🔍";
      case "new-sale": return "Nouvelle Opération de Vente 📝";
      case "sales": return "Historique des Ventes & Actions 📋";
      case "debts": return "Vue Dettes Clients 💰";
      case "global-report": return "Rapport Global d'Entreprise 📈"; 
      case "charts": return "Analyse Graphique 📈";
      case "client-report": return "Bilan Client / Export 📄"; 
      default: return "Synthèse Client / Période";
    }
  };

  if (!authed) return <AuthView onAuth={() => setAuthed(true)} />;

  const renderPage = () => {
    switch (currentPage) {
      case "dashboard": 
        return <DashboardPage />; 
      case "new-sale":
        return <SaleForm onSaved={() => setCurrentPage("sales")} />;
      case "sales":
        return <ReloadableSalesTable />;
      case "debts":
        return (
          <>
            <div className="row g-4 mb-4">
              {/* Ces composants sont forcés à charger les données globales (isGlobal=true) */}
              <div className="col-lg-6"><DebtsBoard isGlobal={true} clientSelected={null} totalDebt={0} /></div>
              <div className="col-lg-6"><CreditsBoard isGlobal={true} clientSelected={null} totalCredit={0} /></div>
            </div>
            <DueNotificationsPanel clientSelected={false} />
            <ReloadableSalesTable />
          </>
        );
      case "global-report": 
        return <GlobalReportPage />;
      case "charts":
        // La page Charts est conservée, affichant les totaux globaux (comme son ancienne fonction)
        return (
          <>
            {/* ChartsPanel et SummaryCards pour la vue globale (non filtrée par client/période ici) */}
            <ChartsPanel globalData={{sales:[], totalTilapiaAmount:0, totalPangasiusAmount:0}} clientSelected={false} />
            <SummaryCards globalData={{totalAmount:0, totalPayment:0, totalBalance:0}} clientSelected={false} />
          </>
        );
      case "client-report": 
        // L'ancienne page ClientReport reste l'export Excel
        return <ClientReportPage />;
      default:
        return <DashboardPage />;
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
import React, { useState } from 'react';
import { ChevronRight, Menu, Home, DollarSign, FileText, AlertTriangle, BarChart3, X, Check, Eye } from 'lucide-react';

const WireframeViewer = () => {
  const [activeScreen, setActiveScreen] = useState('login');
  const [showAnnotations, setShowAnnotations] = useState(true);

  const screens = {
    login: { name: 'Login Screen', icon: '🔐' },
    dashboard: { name: 'Dashboard', icon: '📊' },
    newSale: { name: 'New Sale Form', icon: '📝' },
    salesHistory: { name: 'Sales History', icon: '📋' },
    debts: { name: 'Debts View', icon: '💰' },
    mobile: { name: 'Mobile Layout', icon: '📱' }
  };

  const Annotation = ({ text, position = 'right', color = 'blue' }) => {
    if (!showAnnotations) return null;
    return (
      <div className={`absolute ${position === 'right' ? 'left-full ml-2' : 'right-full mr-2'} top-0 bg-${color}-50 border-2 border-${color}-500 rounded-lg px-3 py-1.5 text-xs whitespace-nowrap shadow-lg`}>
        <div className={`absolute top-2 ${position === 'right' ? 'right-full' : 'left-full'}`}>
          <div className={`w-0 h-0 border-t-4 border-b-4 border-transparent ${position === 'right' ? 'border-r-4 border-r-blue-500' : 'border-l-4 border-l-blue-500'}`}></div>
        </div>
        {text}
      </div>
    );
  };

  const LoginWireframe = () => (
    <div className="w-full h-full bg-gray-100 flex items-center justify-center p-8">
      <div className="bg-white rounded-lg shadow-2xl p-8 w-96 relative">
        <Annotation text="Centered card design" position="right" />
        <div className="text-center mb-6 relative">
          <div className="w-16 h-16 bg-blue-200 rounded-full mx-auto mb-3 flex items-center justify-center">
            <span className="text-2xl">🐟</span>
          </div>
          <Annotation text="Logo & branding" position="left" />
          <h2 className="text-2xl font-bold">Fish Manage</h2>
          <p className="text-gray-500 text-sm">Connexion au Dashboard</p>
        </div>
        
        <div className="space-y-4 relative">
          <Annotation text="Email input field" position="right" />
          <div>
            <label className="block text-sm font-semibold mb-1">Email</label>
            <div className="border-2 border-gray-300 rounded-lg h-12 bg-gray-50"></div>
          </div>
          
          <div className="relative">
            <Annotation text="Password field" position="right" />
            <label className="block text-sm font-semibold mb-1">Mot de passe</label>
            <div className="border-2 border-gray-300 rounded-lg h-12 bg-gray-50"></div>
          </div>
          
          <div className="relative">
            <Annotation text="Primary CTA button" position="left" />
            <button className="w-full bg-blue-500 text-white h-12 rounded-full font-semibold shadow-lg hover:bg-blue-600">
              Connexion
            </button>
          </div>
          
          <div className="text-center">
            <button className="text-blue-500 text-sm underline">Créer un compte</button>
          </div>
        </div>
      </div>
    </div>
  );

  const DashboardWireframe = () => (
    <div className="w-full h-full flex bg-gray-50">
      {/* Sidebar */}
      <div className="w-64 bg-gray-900 text-white p-4 relative">
        <Annotation text="Fixed sidebar navigation" position="right" />
        <div className="mb-6">
          <div className="flex items-center gap-2 mb-4">
            <div className="w-8 h-8 bg-blue-400 rounded"></div>
            <span className="font-bold">Fish Manage</span>
          </div>
        </div>
        
        <div className="space-y-2">
          {[
            { icon: Home, label: 'Dashboard', active: true },
            { icon: DollarSign, label: 'Nouvelle Vente' },
            { icon: FileText, label: 'Historique' },
            { icon: AlertTriangle, label: 'Dettes' },
            { icon: BarChart3, label: 'Analyse' }
          ].map((item, i) => (
            <div key={i} className={`flex items-center gap-2 p-3 rounded-lg ${item.active ? 'bg-blue-600' : 'bg-gray-800'}`}>
              <item.icon size={18} />
              <span className="text-sm">{item.label}</span>
            </div>
          ))}
        </div>
      </div>

      {/* Main Content */}
      <div className="flex-1 p-6 overflow-auto">
        <div className="mb-6 relative">
          <h1 className="text-2xl font-bold text-gray-800">Tableau de Bord 📊</h1>
          <Annotation text="Page header" position="left" />
        </div>

        {/* Summary Cards */}
        <div className="grid grid-cols-3 gap-4 mb-6 relative">
          <Annotation text="KPI cards with icons" position="right" />
          {['Total Ventes', 'Total Encaissé', 'Solde/Encours'].map((title, i) => (
            <div key={i} className="bg-white rounded-lg shadow p-4 border-2 border-gray-200">
              <div className="flex items-center gap-3">
                <div className={`w-12 h-12 rounded-full ${i === 0 ? 'bg-blue-100' : i === 1 ? 'bg-green-100' : 'bg-red-100'}`}></div>
                <div>
                  <p className="text-xs text-gray-500 uppercase">{title}</p>
                  <p className="text-xl font-bold">XXX,XXX XOF</p>
                </div>
              </div>
            </div>
          ))}
        </div>

        {/* Charts Section */}
        <div className="grid grid-cols-2 gap-4 mb-6 relative">
          <Annotation text="Data visualization area" position="right" />
          <div className="bg-white rounded-lg shadow p-4 border-2 border-gray-200">
            <h3 className="font-bold mb-3">Volume des Ventes</h3>
            <div className="h-48 bg-gradient-to-t from-blue-100 to-transparent rounded flex items-end justify-around gap-2 p-4">
              {[60, 80, 70, 90, 75].map((h, i) => (
                <div key={i} className="bg-blue-500 rounded-t w-full" style={{height: `${h}%`}}></div>
              ))}
            </div>
          </div>
          
          <div className="bg-white rounded-lg shadow p-4 border-2 border-gray-200">
            <h3 className="font-bold mb-3">Évolution des Dettes</h3>
            <div className="h-48 relative">
              <svg className="w-full h-full" viewBox="0 0 200 100">
                <polyline points="0,50 40,40 80,30 120,45 160,35 200,40" fill="none" stroke="#dc2626" strokeWidth="2"/>
                <polyline points="0,100 0,50 40,40 80,30 120,45 160,35 200,40 200,100" fill="rgba(220, 38, 38, 0.1)"/>
              </svg>
            </div>
          </div>
        </div>

        {/* Table Preview */}
        <div className="bg-white rounded-lg shadow p-4 border-2 border-gray-200 relative">
          <Annotation text="Data table with actions" position="right" />
          <div className="flex justify-between items-center mb-4">
            <h3 className="font-bold">Historique des Opérations</h3>
            <div className="flex gap-2">
              <div className="w-32 h-8 border-2 border-gray-300 rounded"></div>
              <div className="w-24 h-8 bg-green-500 rounded"></div>
            </div>
          </div>
          <div className="space-y-2">
            {[1,2,3].map(i => (
              <div key={i} className="flex items-center gap-4 p-3 border-2 border-gray-200 rounded">
                <div className="w-20 h-4 bg-gray-200 rounded"></div>
                <div className="w-32 h-4 bg-gray-200 rounded"></div>
                <div className="w-16 h-6 bg-blue-100 rounded-full"></div>
                <div className="flex-1"></div>
                <div className="flex gap-2">
                  <div className="w-8 h-8 bg-blue-500 rounded-full"></div>
                  <div className="w-8 h-8 bg-gray-400 rounded-full"></div>
                </div>
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  );

  const NewSaleWireframe = () => (
    <div className="w-full h-full flex bg-gray-50">
      <div className="w-64 bg-gray-900"></div>
      <div className="flex-1 p-6">
        <h1 className="text-2xl font-bold mb-6">Nouvelle Opération de Vente 📝</h1>
        
        <div className="bg-white rounded-lg shadow-lg p-6 max-w-3xl border-2 border-gray-200 relative">
          <Annotation text="Form card container" position="right" />
          <div className="border-b-2 border-blue-500 pb-3 mb-6">
            <h2 className="text-lg font-bold flex items-center gap-2">
              <span className="text-blue-500">+</span> Nouvelle Vente Rapide
            </h2>
          </div>
          
          <div className="grid grid-cols-2 gap-4 relative">
            <Annotation text="Two-column form layout" position="left" />
            <div className="col-span-2">
              <label className="block text-sm font-semibold mb-1">Client / Entreprise</label>
              <div className="border-2 border-gray-300 rounded-lg h-10 bg-gray-50"></div>
            </div>
            
            <div>
              <label className="block text-sm font-semibold mb-1">Date</label>
              <div className="border-2 border-gray-300 rounded-lg h-10 bg-gray-50"></div>
            </div>
            
            <div className="relative">
              <Annotation text="Select dropdown" position="right" />
              <label className="block text-sm font-semibold mb-1">Poisson</label>
              <div className="border-2 border-gray-300 rounded-lg h-10 bg-gray-50"></div>
            </div>
            
            <div>
              <label className="block text-sm font-semibold mb-1">Qté Commandée (kg)</label>
              <div className="border-2 border-gray-300 rounded-lg h-10 bg-gray-50"></div>
            </div>
            
            <div>
              <label className="block text-sm font-semibold mb-1">Prix Unitaire (XOF)</label>
              <div className="border-2 border-gray-300 rounded-lg h-10 bg-gray-50"></div>
            </div>
            
            <div>
              <label className="block text-sm font-semibold mb-1">Qté Livrée (kg)</label>
              <div className="border-2 border-gray-300 rounded-lg h-10 bg-gray-50"></div>
            </div>
            
            <div>
              <label className="block text-sm font-semibold mb-1">Règlement Payé (XOF)</label>
              <div className="border-2 border-gray-300 rounded-lg h-10 bg-gray-50"></div>
            </div>
            
            <div className="col-span-2">
              <label className="block text-sm font-semibold mb-1">Observation</label>
              <div className="border-2 border-gray-300 rounded-lg h-10 bg-gray-50"></div>
            </div>
            
            <div className="col-span-2 relative">
              <Annotation text="Primary action button" position="left" />
              <button className="w-full bg-blue-500 text-white h-12 rounded-full font-semibold shadow-lg">
                ✓ Enregistrer la Vente
              </button>
            </div>
            
            <div className="col-span-2 flex justify-between pt-4 border-t-2 relative">
              <Annotation text="Real-time calculations" position="right" />
              <span className="bg-gray-200 px-3 py-1 rounded text-sm">Montant: XXX XOF</span>
              <span className="bg-yellow-200 px-3 py-1 rounded text-sm">Reste à livrer: XX kg</span>
              <span className="bg-red-200 px-3 py-1 rounded text-sm">Solde: XXX XOF</span>
            </div>
          </div>
        </div>
      </div>
    </div>
  );

  const SalesHistoryWireframe = () => (
    <div className="w-full h-full flex bg-gray-50">
      <div className="w-64 bg-gray-900"></div>
      <div className="flex-1 p-6">
        <h1 className="text-2xl font-bold mb-6">Historique des Ventes & Actions 📋</h1>
        
        <div className="bg-white rounded-lg shadow-lg p-6 border-2 border-gray-200 relative">
          <Annotation text="Filters & search bar" position="right" />
          <div className="flex gap-3 mb-4 pb-4 border-b-2">
            <div className="flex-1 border-2 border-gray-300 rounded-lg h-10 bg-gray-50 flex items-center px-3">
              <span className="text-gray-400 text-sm">🔍 Rechercher client...</span>
            </div>
            <div className="w-32 border-2 border-gray-300 rounded-lg h-10 bg-gray-50"></div>
            <button className="bg-green-500 text-white px-4 rounded-full text-sm font-semibold">
              📊 Exporter
            </button>
          </div>
          
          <div className="overflow-hidden relative">
            <Annotation text="Expandable row actions" position="left" />
            {/* Table Header */}
            <div className="grid grid-cols-8 gap-2 bg-gray-900 text-white p-3 rounded-t-lg text-xs font-semibold">
              <div>Date</div>
              <div>Client</div>
              <div>Poisson</div>
              <div>Qté (Kg)</div>
              <div>Livré (Kg)</div>
              <div>Reste</div>
              <div>Solde Dû</div>
              <div>Actions</div>
            </div>
            
            {/* Table Rows */}
            {[1,2,3].map((row, i) => (
              <div key={i}>
                <div className={`grid grid-cols-8 gap-2 p-3 border-b-2 items-center ${i === 0 ? 'bg-red-50 border-l-4 border-red-500' : ''}`}>
                  <div className="text-xs">2025-10-15</div>
                  <div className="text-xs font-semibold">Client {row}</div>
                  <div><span className="bg-blue-100 text-blue-800 px-2 py-1 rounded-full text-xs">Tilapia</span></div>
                  <div className="text-xs">500</div>
                  <div className="text-xs">400</div>
                  <div className="text-xs text-yellow-600 font-bold">100</div>
                  <div className="text-xs text-red-600 font-bold">50,000</div>
                  <div className="flex gap-1">
                    <div className="w-8 h-8 bg-blue-500 rounded-full flex items-center justify-center text-white">🚚</div>
                    <div className="w-8 h-8 bg-gray-400 rounded-full flex items-center justify-center text-white">💰</div>
                  </div>
                </div>
                
                {i === 0 && (
                  <div className="bg-gray-100 p-3 border-b-2">
                    <div className="flex items-center gap-3">
                      <span className="text-xs text-gray-600">Action: Livraison</span>
                      <div className="flex-1 flex gap-2">
                        <div className="flex-1 border-2 border-gray-300 rounded h-8 bg-white"></div>
                        <button className="bg-gray-300 px-3 rounded text-xs">Max</button>
                      </div>
                      <button className="bg-blue-500 text-white px-4 py-1 rounded text-xs">Valider</button>
                      <button className="text-red-500 text-xs underline">Annuler</button>
                    </div>
                  </div>
                )}
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  );

  const DebtsWireframe = () => (
    <div className="w-full h-full flex bg-gray-50">
      <div className="w-64 bg-gray-900"></div>
      <div className="flex-1 p-6">
        <h1 className="text-2xl font-bold mb-6">Vue Dettes Clients 💰</h1>
        
        <div className="grid grid-cols-3 gap-4 mb-6">
          <div className="bg-white rounded-lg shadow-lg p-4 border-2 border-gray-200 col-span-1 relative">
            <Annotation text="Top debtors list" position="right" />
            <div className="flex justify-between items-center mb-4 pb-2 border-b-2">
              <h3 className="font-bold text-sm">Top Dettes Clients</h3>
              <span className="bg-red-500 text-white px-2 py-1 rounded text-xs">Total: XXX XOF</span>
            </div>
            <div className="space-y-2">
              {[1,2,3,4].map(i => (
                <div key={i} className="flex justify-between items-center p-2 border-b">
                  <span className="text-sm font-semibold">Client {i}</span>
                  <span className="text-red-600 font-bold text-sm">XX,XXX</span>
                </div>
              ))}
            </div>
          </div>
          
          <div className="bg-white rounded-lg shadow-lg p-4 border-2 border-gray-200 col-span-2 relative">
            <Annotation text="Overdue notifications" position="left" />
            <div className="flex justify-between items-center mb-4">
              <h3 className="font-bold">Clients en Retard (Alerte)</h3>
              <div className="flex gap-2 items-center">
                <div className="text-xs flex items-center gap-1 border-2 border-gray-300 rounded px-2 py-1">
                  <span>Retard ≥</span>
                  <div className="w-12 h-6 border border-gray-300 rounded bg-white"></div>
                  <span>jours</span>
                </div>
                <button className="bg-yellow-400 text-black px-3 py-1 rounded-full text-xs font-semibold">
                  🔔 Activer alertes
                </button>
              </div>
            </div>
            
            <div className="overflow-hidden">
              <div className="grid grid-cols-4 gap-2 bg-gray-100 p-2 rounded text-xs font-semibold">
                <div>Client</div>
                <div>Date Op.</div>
                <div>Jours Retard</div>
                <div>Solde Dû</div>
              </div>
              {[1,2,3].map(i => (
                <div key={i} className="grid grid-cols-4 gap-2 p-2 border-b bg-yellow-50 text-xs">
                  <div className="font-semibold">Client {i}</div>
                  <div>2025-09-15</div>
                  <div className="text-red-600 font-bold">{30+i*5}</div>
                  <div className="text-red-600 font-bold">XX,XXX XOF</div>
                </div>
              ))}
            </div>
          </div>
        </div>
      </div>
    </div>
  );

  const MobileWireframe = () => (
    <div className="w-full h-full bg-gray-50 flex justify-center items-center p-4">
      <div className="w-80 h-[600px] bg-white rounded-3xl shadow-2xl border-8 border-gray-800 overflow-hidden relative">
        <Annotation text="Mobile responsive design" position="right" />
        {/* Mobile Header */}
        <div className="bg-gray-900 text-white p-4 flex items-center gap-3">
          <Menu size={24} />
          <span className="font-bold">Dashboard 📊</span>
        </div>
        
        {/* Mobile Content */}
        <div className="p-4 space-y-4 overflow-auto h-[520px]">
          <div className="relative">
            <Annotation text="Stacked layout for mobile" position="left" />
          </div>
          {/* Summary Cards - Stacked */}
          <div className="bg-blue-500 rounded-lg p-4 text-white">
            <p className="text-xs opacity-75">TOTAL VENTES</p>
            <p className="text-2xl font-bold">XXX,XXX XOF</p>
          </div>
          
          <div className="bg-green-500 rounded-lg p-4 text-white">
            <p className="text-xs opacity-75">TOTAL ENCAISSÉ</p>
            <p className="text-2xl font-bold">XXX,XXX XOF</p>
          </div>
          
          <div className="bg-red-500 rounded-lg p-4 text-white">
            <p className="text-xs opacity-75">SOLDE/ENCOURS</p>
            <p className="text-2xl font-bold">XXX,XXX XOF</p>
          </div>
          
          {/* Chart Preview */}
          <div className="bg-white border-2 rounded-lg p-3">
            <h3 className="text-sm font-bold mb-2">Volume des Ventes</h3>
            <div className="h-32 bg-gradient-to-t from-blue-100 to-transparent rounded"></div>
          </div>
          
          {/* Mobile Table */}
          <div className="bg-white border-2 rounded-lg p-3">
            <h3 className="text-sm font-bold mb-2">Dernières Ventes</h3>
            <div className="space-y-2">
              {[1,2].map(i => (
                <div key={i} className="border-2 rounded p-2 text-xs">
                  <div className="flex justify-between mb-1">
                    <span className="font-bold">Client {i}</span>
                    <span className="bg-blue-100 px-2 rounded-full">Tilapia</span>
                  </div>
                  <div className="flex justify-between text-gray-600">
                    <span>500 kg</span>
                    <span className="text-red-600 font-bold">50,000 XOF</span>
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>
      </div>
    </div>
  );

  return (
    <div className="w-full h-screen bg-gray-900 flex flex-col">
      {/* Header */}
      <div className="bg-gray-800 border-b border-gray-700 p-4">
        <div className="max-w-7xl mx-auto flex items-center justify-between">
          <div>
            <h1 className="text-2xl font-bold text-white mb-1">Fish Manage - UI/UX Wireframes</h1>
            <p className="text-gray-400 text-sm">Interactive wireframe documentation</p>
          </div>
          <button
            onClick={() => setShowAnnotations(!showAnnotations)}
            className="flex items-center gap-2 bg-blue-600 hover:bg-blue-700 text-white px-4 py-2 rounded-lg transition-colors"
          >
            <Eye size={18} />
            {showAnnotations ? 'Hide' : 'Show'} Annotations
          </button>
        </div>
      </div>

      {/* Navigation */}
      <div className="bg-gray-800 border-b border-gray-700 px-4 py-2">
        <div className="max-w-7xl mx-auto flex gap-2 overflow-x-auto">
          {Object.entries(screens).map(([key, { name, icon }]) => (
            <button
              key={key}
              onClick={() => setActiveScreen(key)}
              className={`px-4 py-2 rounded-lg whitespace-nowrap transition-colors ${
                activeScreen === key
                  ? 'bg-blue-600 text-white'
                  : 'bg-gray-700 text-gray-300 hover:bg-gray-600'
              }`}
            >
              {icon} {name}
            </button>
          ))}
        </div>
      </div>

      {/* Wireframe Display */}
      <div className="flex-1 overflow-auto p-6 bg-gray-900">
        <div className="max-w-7xl mx-auto bg-white rounded-lg shadow-2xl" style={{ minHeight: '700px' }}>
          {activeScreen === 'login' && <LoginWireframe />}
          {activeScreen === 'dashboard' && <DashboardWireframe />}
          {activeScreen === 'newSale' && <NewSaleWireframe />}
          {activeScreen === 'salesHistory' && <SalesHistoryWireframe />}
          {activeScreen === 'debts' && <DebtsWireframe />}
          {activeScreen === 'mobile' && <MobileWireframe />}
        </div>
      </div>

      {/* Legend */}
      <div className="bg-gray-800 border-t border-gray-700 p-4">
        <div className="max-w-7xl mx-auto flex flex-wrap gap-6 text-sm text-gray-400">
          <div className="flex items-center gap-2">
            <div className="w-4 h-4 bg-blue-500 rounded"></div>
            <span>Primary Actions</span>
          </div>
          <div className="flex items-center gap-2">
            <div className="w-4 h-4 bg-gray-300 border-2 border-gray-400 rounded"></div>
            <span>Input Fields</span>
          </div>
          <div className="flex items-center gap-2">
            <div className="w-4 h-4 bg-red-200 rounded"></div>
            <span>Critical Data (Debts)</span>
          </div>
          <div className="flex items-center gap-2">
            <div className="w-4 h-4 bg-green-200 rounded"></div>
            <span>Positive Data (Payments)</span>
          </div>
        </div>
      </div>
    </div>
  );
};

export default WireframeViewer;
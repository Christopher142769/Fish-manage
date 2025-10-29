// server.js (COMPLET AVEC GESTION MULTI-PRODUITS)
require('dotenv').config(); 

const express = require('express');
const mongoose = require('mongoose');
const cors = require('cors');
const bcrypt = require('bcrypt');
const jwt =require('jsonwebtoken');
const ExcelJS = require('exceljs');
const morgan = require('morgan');

const app = express();

/* ---------------- CORS (global) ---------------- */
const corsOptions = {
  origin: true, 
  methods: ['GET','POST','PATCH','PUT','DELETE','OPTIONS'],
  allowedHeaders: ['Content-Type','Authorization'],
  credentials: true,
};
app.use(cors(corsOptions));
app.use((req, res, next) => {
  if (req.method === 'OPTIONS') { return res.sendStatus(204); }
  next();
});

/* ---------------- Middleware communs ---------------- */
app.use(express.json({ limit: '1mb' }));
app.use(morgan('tiny'));

/* ---------------- Env & connexion Mongo ---------------- */
const JWT_SECRET = process.env.JWT_SECRET || 'change_this_secret';
const MONGO_URI  = process.env.MONGO_URI  || 'mongodb://localhost:27017/poisson';
const DB_NAME    = process.env.DB_NAME    || 'poisson';
const PORT       = Number(process.env.PORT) || 4000;

const SUPER_ADMIN_EMAIL = process.env.SUPER_ADMIN_EMAIL || 'super@admin.com';
const SUPER_ADMIN_PASS = process.env.SUPER_ADMIN_PASS || 'superadmin123';

mongoose.connect(MONGO_URI, { dbName: DB_NAME })
  .then(() => {
      console.log(`MongoDB connected (db: ${DB_NAME})`);
      // NOUVEAU: Seed initial products
      seedInitialProducts();
  })
  .catch(err => { console.error('MongoDB error:', err.message); process.exit(1); });

// NOUVEAU: Seeder function
async function seedInitialProducts() {
    try {
        const products = [
            { name: 'Tilapia', isGlobal: true },
            { name: 'Pangasius', isGlobal: true },
        ];
        // Utilise le modèle 'Product' qui sera défini ci-dessous
        for (const prod of products) {
            await Product.updateOne(
                { name: prod.name, isGlobal: true },
                { $setOnInsert: prod },
                { upsert: true }
            );
        }
        console.log('Global products seeded.');
    } catch (e) {
        console.error('Error seeding products:', e.message);
    }
}

app.get('/', (_req, res) => res.type('text/plain').send('OK'));

/* ---------------- Modèles ---------------- */
const userSchema = new mongoose.Schema({
  companyName: { type: String, required: true },
  email:       { type: String, required: true, unique: true, index: true },
  passwordHash:{ type: String, required: true },
}, { timestamps: true });

const saleSchema = new mongoose.Schema({
  owner:       { type: mongoose.Schema.Types.ObjectId, ref: 'User', index: true },
  date:        { type: Date, required: true },
  clientName:  { type: String, required: true, index: true },
  // MODIFIÉ: Enum supprimée pour permettre les produits personnalisés
  fishType:    { type: String, required: true, index: true },
  quantity:    { type: Number, required: true, min: 0 }, 
  delivered:   { type: Number, default: 0, min: 0 },     
  unitPrice:   { type: Number, required: true, min: 0 },
  amount:      { type: Number, required: true, min: 0 }, 
  payment:     { type: Number, default: 0, min: 0 },     
  balance:     { type: Number, required: true },
  observation: { type: String, default: '' },
  settled:     { type: Boolean, default: false },
}, { timestamps: true });

saleSchema.pre('validate', function(next){
  this.delivered = Math.max(0, this.delivered || 0);
  if (this.quantity && this.delivered > this.quantity) {
      this.delivered = this.quantity;
  }
  this.amount = (Number(this.quantity || 0) * Number(this.unitPrice || 0));
  const rawBalance = this.amount - Number(this.payment || 0);
  this.balance = Number(rawBalance.toFixed(2));
  this.settled = (this.amount > 0 && this.balance <= 0); 
  next();
});

const actionLogSchema = new mongoose.Schema({
    owner: { type: mongoose.Schema.Types.ObjectId, ref: 'User', index: true, required: true },
    companyName: { type: String, required: true }, 
    actionType: { type: String, enum: ['edit', 'delete'], required: true },
    motif: { type: String, required: true, trim: true },
    saleId: { type: mongoose.Schema.Types.ObjectId, required: true },
    saleData: { type: Object, required: true } 
}, { timestamps: true });

// NOUVEAU: Modèle Product
const productSchema = new mongoose.Schema({
  // Si isGlobal = true, owner est null.
  // Si isGlobal = false, owner est l'ID de l'admin/entreprise
  owner: { type: mongoose.Schema.Types.ObjectId, ref: 'User', index: true, sparse: true }, 
  name: { type: String, required: true, trim: true },
  isGlobal: { type: Boolean, default: false, index: true },
}, { timestamps: true });

// Unicité: Un admin ne peut pas avoir deux produits du même nom
productSchema.index({ owner: 1, name: 1 }, { unique: true, sparse: true }); 
// Unicité: Les produits globaux doivent avoir un nom unique
productSchema.index({ name: 1, isGlobal: 1 }, { unique: true, sparse: true, partialFilterExpression: { isGlobal: true } });


const User = mongoose.model('User', userSchema);
const Sale = mongoose.model('Sale', saleSchema);
const ActionLog = mongoose.model('ActionLog', actionLogSchema);
const Product = mongoose.model('Product', productSchema); // NOUVEAU

/* ---------------- Middlewares d'Authentification ---------------- */

// Middleware pour "Admin" (Utilisateur normal)
function auth(req,res,next){
  const header = req.headers.authorization || '';
  const token = header.startsWith('Bearer ')? header.slice(7): null;
  if(!token) return res.status(401).json({ error:'Token manquant' });
  try{
    req.user = jwt.verify(token, JWT_SECRET);
    next();
  }catch(e){ return res.status(401).json({ error:'Token invalide' }); }
}

// Middleware pour "Super Admin"
function authSuperAdmin(req, res, next) {
  const header = req.headers.authorization || '';
  const token = header.startsWith('Bearer ')? header.slice(7): null;
  if (!token) return res.status(401).json({ error: 'Token manquant' });
  try {
    req.user = jwt.verify(token, JWT_SECRET);
    if (req.user.role !== 'superadmin') throw new Error('Accès non autorisé');
    next();
  } catch (e) {
    return res.status(401).json({ error: 'Token invalide ou non autorisé' });
  }
}

/* ---------------- Routes AUTH (Admin / Utilisateur) ---------------- */
app.post('/api/auth/register', async (req,res)=>{
  try{
    const { companyName, email, password } = req.body;
    if(!companyName || !email || !password) return res.status(400).json({ error:'Champs requis manquants' });
    if(await User.findOne({ email })) return res.status(409).json({ error:'Email déjà utilisé' });
    const user = await User.create({ companyName, email, passwordHash: await bcrypt.hash(password,10) });
    const token = jwt.sign({ uid:user._id, companyName:user.companyName, email:user.email }, JWT_SECRET, { expiresIn:'7d' });
    res.json({ token, companyName:user.companyName, email:user.email });
  }catch(e){ res.status(500).json({ error:e.message }); }
});

app.post('/api/auth/login', async (req,res)=>{
  try{
    const { email, password } = req.body;
    const user = await User.findOne({ email });
    if(!user || !(await bcrypt.compare(password, user.passwordHash))) return res.status(401).json({ error:'Identifiants invalides' });
    const token = jwt.sign({ uid:user._id, companyName:user.companyName, email:user.email }, JWT_SECRET, { expiresIn:'7d' });
    res.json({ token, companyName:user.companyName, email:user.email });
  }catch(e){ res.status(500).json({ error:e.message }); }
});

/* ---------------- NOUVELLES ROUTES SUPER ADMIN ---------------- */

// Login Super Admin
app.post('/api/admin/login', async (req, res) => {
    try {
        const { email, password } = req.body;
        if (email === SUPER_ADMIN_EMAIL && password === SUPER_ADMIN_PASS) {
            const token = jwt.sign({ email: email, role: 'superadmin' }, JWT_SECRET, { expiresIn: '1d' });
            return res.json({ token });
        }
        return res.status(401).json({ error: 'Identifiants Super Admin invalides' });
    } catch(e) {
        res.status(500).json({ error: e.message });
    }
});

// CRUD pour les "Admins" (Comptes User)
app.get('/api/admin/users', authSuperAdmin, async (req, res) => {
    const users = await User.find().select('companyName email createdAt').sort({ createdAt: -1 });
    res.json(users);
});

app.post('/api/admin/users', authSuperAdmin, async (req, res) => {
    try {
        const { companyName, email, password } = req.body;
        if(!companyName || !email || !password) return res.status(400).json({ error:'Champs requis manquants' });
        if(await User.findOne({ email })) return res.status(409).json({ error:'Email déjà utilisé' });
        const user = await User.create({ companyName, email, passwordHash: await bcrypt.hash(password,10) });
        res.status(201).json(user);
    } catch(e) {
        res.status(500).json({ error: e.message });
    }
});

app.put('/api/admin/users/:id', authSuperAdmin, async (req, res) => {
    try {
        const { companyName, password } = req.body;
        const user = await User.findById(req.params.id);
        if (!user) return res.status(404).json({ error: 'Utilisateur introuvable' });

        if (companyName) user.companyName = companyName;
        if (password) {
            user.passwordHash = await bcrypt.hash(password, 10);
        }
        await user.save();
        res.json(user);
    } catch(e) {
        res.status(500).json({ error: e.message });
    }
});

app.delete('/api/admin/users/:id', authSuperAdmin, async (req, res) => {
    const session = await mongoose.startSession();
    session.startTransaction();
    try {
        const userId = req.params.id;
        // Suppression en cascade
        await Sale.deleteMany({ owner: userId }).session(session);
        await ActionLog.deleteMany({ owner: userId }).session(session);
        await Product.deleteMany({ owner: userId }).session(session); // NOUVEAU: Supprimer les produits de l'admin
        const deletedUser = await User.findByIdAndDelete(userId).session(session);
        
        if (!deletedUser) {
            await session.abortTransaction();
            return res.status(404).json({ error: 'Utilisateur introuvable' });
        }

        await session.commitTransaction();
        res.json({ message: 'Utilisateur et toutes ses données associées supprimés' });
    } catch(e) {
        await session.abortTransaction();
        res.status(500).json({ error: e.message });
    } finally {
        session.endSession();
    }
});

// NOUVEAU: CRUD pour les "Produits" par Super Admin
app.get('/api/admin/products', authSuperAdmin, async (req, res) => {
    // Renvoie tous les produits, en peuplant le propriétaire pour l'affichage
    const products = await Product.find().populate('owner', 'companyName email').sort({ isGlobal: -1, name: 1 });
    res.json(products);
});

app.get('/api/admin/products/user/:userId', authSuperAdmin, async (req, res) => {
    // Renvoie les produits disponibles pour un utilisateur spécifique (globaux + les siens)
    const products = await Product.find({
        $or: [
            { isGlobal: true },
            { owner: req.params.userId }
        ]
    }).sort({ name: 1 });
    res.json(products.map(p => p.name));
});

app.post('/api/admin/products', authSuperAdmin, async (req, res) => {
    try {
        const { name, ownerId, isGlobal } = req.body;
        if (!name) return res.status(400).json({ error: 'Nom requis' });

        const newProductData = { name: name.trim(), isGlobal: !!isGlobal };
        
        if (isGlobal) {
            newProductData.owner = undefined; // Les produits globaux n'ont pas de propriétaire
        } else if (ownerId) {
            newProductData.owner = ownerId; // Produit spécifique à un admin
        } else {
            return res.status(400).json({ error: 'Un propriétaire (ownerId) est requis pour un produit non-global.' });
        }

        const newProduct = await Product.create(newProductData);
        res.status(201).json(newProduct);
    } catch(e) { 
        if (e.code === 11000) return res.status(409).json({ error: 'Ce nom de produit existe déjà (soit globalement, soit pour cet utilisateur).' });
        res.status(400).json({ error: e.message }); 
    }
});

app.put('/api/admin/products/:id', authSuperAdmin, async (req, res) => {
     try {
        const { name } = req.body; // Le Super Admin ne devrait changer que le nom
        const product = await Product.findById(req.params.id);
        if (!product) return res.status(404).json({ error: 'Produit introuvable' });

        const oldName = product.name;
        const newName = name.trim();
        
        if (oldName === newName) return res.json(product); // Aucun changement

        // Mettre à jour le nom dans le document Product
        product.name = newName;
        await product.save();
        
        // IMPORTANT: Mettre à jour le nom dans toutes les ventes existantes
        await Sale.updateMany(
            { fishType: oldName, ...(product.owner && { owner: product.owner }) }, // Cible les ventes du bon propriétaire
            { $set: { fishType: newName } }
        );
        
        res.json(product);
     } catch(e) { 
         if (e.code === 11000) return res.status(409).json({ error: 'Ce nom de produit existe déjà.' });
         res.status(400).json({ error: e.message }); 
    }
});

app.delete('/api/admin/products/:id', authSuperAdmin, async (req, res) => {
    try {
        const product = await Product.findById(req.params.id);
        if (!product) return res.status(404).json({ error: 'Produit introuvable' });
        
        // Vérifier si le produit est utilisé dans une vente
        const sale = await Sale.findOne({ fishType: product.name });
        if (sale) return res.status(400).json({ error: 'Impossible de supprimer, ce produit est utilisé dans au moins une vente.' });
        
        await Product.deleteOne({ _id: req.params.id });
        res.json({ message: 'Produit supprimé.' });
    } catch(e) { res.status(500).json({ error: e.message }); }
});


// Routes "Vue" Super Admin
// MODIFIÉ: Ajout de 'byFish' pour le bilan dynamique
app.get('/api/admin/summary-for-user/:userId', authSuperAdmin, async (req, res) => {
    try {
        const { startDate, endDate } = req.query;
        const ownerId = new mongoose.Types.ObjectId(req.params.userId);

        const q = { owner: ownerId };
        if (startDate) q.date = { ...q.date, $gte: new Date(startDate) };
        if (endDate) {
            const end = new Date(endDate); end.setDate(end.getDate() + 1); 
            q.date = { ...q.date, $lt: end };
        }
        
        const [totals] = await Sale.aggregate([
            { $match: q }, 
            { $group: { _id:null, totalAmount:{ $sum:"$amount" }, totalPayment:{ $sum:"$payment" } } }
        ]);

        // NOUVEAU: Logique byFish pour Super Admin
        // 1. Get all products for this user
        const allProducts = await Product.find({ $or: [{ isGlobal: true }, { owner: ownerId }] }).select('name').lean();
        
        // 2. Get sales summary for this user (in the period)
        const byFishSales = await Sale.aggregate([ 
            { $match: q }, 
            { $group: { _id:"$fishType", amount:{ $sum:"$amount" }, payment:{ $sum:"$payment" }, balance:{ $sum:"$balance" } } }, 
            { $project: { fishType:"$_id", amount:1, payment:1, balance:1, _id:0 } } 
        ]);
        const salesMap = new Map(byFishSales.map(s => [s.fishType, s]));

        // 3. Merge (on inclut tous les produits, même ceux à 0)
        const byFishResult = allProducts.map(p => {
            const salesData = salesMap.get(p.name) || { amount: 0, payment: 0, balance: 0 };
            return {
                fishType: p.name,
                amount: salesData.amount,
                payment: salesData.payment,
                balance: salesData.balance
            };
        });
        // Fin de la logique byFish
        
        const [totalDebtResult] = await Sale.aggregate([
            { $match: { owner: ownerId, balance: { $gt: 0 } } }, // Dette totale (non périodique)
            { $group: { _id: null, totalDebt: { $sum: "$balance" } } }
        ]);

        const [totalCreditResult] = await Sale.aggregate([
            { $match: { owner: ownerId, balance: { $lt: 0 } } }, // Crédit total (non périodique)
            { $group: { _id: null, totalCredit: { $sum: "$balance" } } }
        ]);

        res.json({
            totalAmount: (totals && totals.totalAmount) || 0,
            totalPayment: (totals && totals.totalPayment) || 0,
            totalDebt: (totalDebtResult && totalDebtResult.totalDebt) || 0,
            totalCredit: (totalCreditResult && Math.abs(totalCreditResult.totalCredit)) || 0,
            byFish: byFishResult.map(f => ({ ...f, amount: Number(f.amount.toFixed(2)), payment: Number(f.payment.toFixed(2)), balance: Number(f.balance.toFixed(2)), })) // NOUVEAU: Envoi du byFish
        });
    } catch(e) {
        res.status(500).json({ error: e.message });
    }
});

app.get('/api/admin/sales-for-user/:userId', authSuperAdmin, async (req, res) => {
    try {
        const { startDate, endDate } = req.query;
        const q = { owner: req.params.userId };
        
        if (startDate || endDate) {
            q.date = q.date || {};
            if (startDate) q.date.$gte = new Date(startDate);
            if (endDate) {
                const end = new Date(endDate); end.setDate(end.getDate() + 1); 
                q.date.$lt = end;
            }
        }
        const sales = await Sale.find(q).sort({ date:-1, createdAt:-1 });
        res.json(sales);
    } catch(e) {
        res.status(500).json({ error: e.message });
    }
});

app.get('/api/admin/logs-for-user/:userId', authSuperAdmin, async (req, res) => {
  try {
      const { startDate, endDate } = req.query;
      const ownerId = req.params.userId;

      let logs = await ActionLog.find({ owner: ownerId }).sort({ createdAt: -1 });

      if (startDate || endDate) {
          const start = startDate ? new Date(startDate) : null;
          const end = endDate ? new Date(endDate) : null;
          if (end) { end.setDate(end.getDate() + 1); }

          logs = logs.filter(log => {
              if (!log.saleData || !log.saleData.date) return false; 
              try {
                  const saleDate = new Date(log.saleData.date);
                  const matchStart = start ? saleDate >= start : true;
                  const matchEnd = end ? saleDate < end : true;
                  return matchStart && matchEnd;
              } catch (e) {
                  console.error(`Error parsing saleData.date for log ${log._id}:`, log.saleData.date, e);
                  return false;
              }
          });
      }
      res.json(logs);
  } catch(e) {
      console.error("Error fetching admin logs:", e); 
      res.status(500).json({ error: e.message });
  }
});

// MODIFIÉ: Export Super Admin (Ventes et Logs) - Ajout filtre fishType
app.get('/api/admin/export/:userId', authSuperAdmin, async (req, res) => {
    try {
        const { startDate, endDate, fishType } = req.query; // MODIFIÉ
        const userId = req.params.userId;

        const user = await User.findById(userId);
        if (!user) return res.status(404).json({ error: 'Utilisateur introuvable' });

        const qSales = { owner: userId };
        const qLogs = { owner: userId };
        
        if (startDate) {
            qSales.date = { ...qSales.date, $gte: new Date(startDate) };
            qLogs.createdAt = { ...qLogs.createdAt, $gte: new Date(startDate) };
        }
        if (endDate) {
            const end = new Date(endDate); end.setDate(end.getDate() + 1);
            qSales.date = { ...qSales.date, $lt: end };
            qLogs.createdAt = { ...qLogs.createdAt, $lt: end };
        }
        if (fishType) { // MODIFIÉ
            qSales.fishType = fishType;
        }

        const sales = await Sale.find(qSales).sort({ date: -1 });
        const logs = await ActionLog.find(qLogs).sort({ createdAt: -1 });
        
        const wb = new ExcelJS.Workbook();
        
        const wsVentes = wb.addWorksheet('Ventes');
        wsVentes.columns = [
            { header: 'Date', key: 'date', width: 15 },
            { header: 'Client', key: 'clientName', width: 25 },
            { header: 'Produit', key: 'fishType', width: 15 }, // MODIFIÉ
            { header: 'Qté (Kg)', key: 'quantity', width: 15 },
            { header: 'PU', key: 'unitPrice', width: 14 },
            { header: 'Montant', key: 'amount', width: 15 },
            { header: 'Payé', key: 'payment', width: 18 },
            { header: 'Balance', key: 'balance', width: 15 },
            { header: 'Statut', key: 'settled', width: 10 },
        ];
        sales.forEach(s => wsVentes.addRow({
            date: new Date(s.date).toISOString().slice(0, 10),
            clientName: s.clientName, fishType: s.fishType, quantity: s.quantity,
            unitPrice: s.unitPrice, amount: s.amount, payment: s.payment,
            balance: s.balance, settled: s.settled ? 'Oui' : 'Non',
        }));

        const wsLogs = wb.addWorksheet('Historique Actions');
        wsLogs.columns = [
            { header: 'Date Action', key: 'createdAt', width: 20 },
            { header: 'Type', key: 'actionType', width: 12 },
            { header: 'Motif', key: 'motif', width: 40 },
            { header: 'Vente ID', key: 'saleId', width: 25 },
            { header: 'Vente (Client)', key: 'saleClient', width: 20 },
            { header: 'Vente (Montant)', key: 'saleAmount', width: 15 },
        ];
        logs.forEach(l => wsLogs.addRow({
            createdAt: l.createdAt.toLocaleString('fr-FR'),
            actionType: l.actionType === 'edit' ? 'Modifié' : 'Supprimé',
            motif: l.motif,
            saleId: l.saleId.toString(),
            saleClient: l.saleData?.clientName || 'N/A',
            saleAmount: l.saleData?.amount || 0,
        }));

        res.setHeader('Content-Type','application/vnd.openxmlformats-officedocument.spreadsheetml.sheet');
        res.setHeader('Content-Disposition',`attachment; filename="Export_SuperAdmin_${user.companyName.replace(/\s/g, '_')}.xlsx"`);
        await wb.xlsx.write(res);
        res.end();

    } catch (e) {
        console.error("Erreur export super admin:", e);
        res.status(500).json({ error: e.message });
    }
});

// MODIFIÉ: Export Bilan Soldes Clients (Super Admin) - Ajout filtre fishType
app.get('/api/admin/export-balances/:userId', authSuperAdmin, async (req, res) => {
  try {
    const { fishType } = req.query; // MODIFIÉ
    const ownerId = new mongoose.Types.ObjectId(req.params.userId);
    
    const matchQuery = { owner: ownerId }; // MODIFIÉ
    if (fishType) { // MODIFIÉ
        matchQuery.fishType = fishType;
    }
    
    const balances = await Sale.aggregate([
      { $match: matchQuery }, // MODIFIÉ
      { 
        $group: { 
          _id: "$clientName", 
          totalClientDebt: { $sum: { $cond: { if: { $gt: ["$balance", 0] }, then: "$balance", else: 0 } } },
          totalClientCredit: { $sum: { $cond: { if: { $lt: ["$balance", 0] }, then: "$balance", else: 0 } } }
        } 
      },
      {
        $project: {
          _id: 0,
          clientName: "$_id",
          totalDebt: { $round: ["$totalClientDebt", 2] },
          totalCredit: { $abs: { $round: ["$totalClientCredit", 2] } }, 
          totalBalance: { $round: [{ $add: ["$totalClientDebt", "$totalClientCredit"] }, 2] }
        }
      },
      { $match: { $or: [{ totalDebt: { $ne: 0 } }, { totalCredit: { $ne: 0 } }] } },
      { $sort: { clientName: 1 } } 
    ]);

    const wb = new ExcelJS.Workbook();
    const user = await User.findById(req.params.userId);
    const ws = wb.addWorksheet(`Soldes Clients de ${user?.companyName || 'Admin'}`);
    
    ws.columns = [
      { header: 'Client', key: 'clientName', width: 30 },
      { header: 'Dette Totale (Le client doit)', key: 'totalDebt', width: 25, style: { numFmt: '#,##0.00 "XOF"' } },
      { header: 'Crédit Totale (Nous devons au client)', key: 'totalCredit', width: 30, style: { numFmt: '#,##0.00 "XOF"' } },
      { header: 'Solde Net (Positif = Dette Client)', key: 'totalBalance', width: 45, style: { numFmt: '#,##0.00 "XOF"' } },
    ];
    
    ws.getRow(1).font = { bold: true };
    balances.forEach(b => ws.addRow(b));

    res.setHeader('Content-Type','application/vnd.openxmlformats-officedocument.spreadsheetml.sheet');
    res.setHeader('Content-Disposition',`attachment; filename="Soldes_Clients_${user?.companyName.replace(/\s/g, '_')}_${new Date().toISOString().slice(0,10)}.xlsx"`);
    await wb.xlsx.write(res);
    res.end();

  } catch (e) {
    console.error("Erreur lors de l'export des soldes clients (Super Admin):", e);
    res.status(500).json({ error: e.message });
  }
});


/* ---------------- NOUVELLES Routes GESTION PRODUITS (Admin) ---------------- */

// Obtenir la liste des noms de produits (globaux + personnels)
// Utilisé pour peupler le dropdown de Nouvelle Vente
app.get('/api/products', auth, async (req, res) => {
    try {
        const products = await Product.find({
            $or: [
                { isGlobal: true },
                { owner: req.user.uid }
            ]
        }).sort({ name: 1 });
        // Renvoie une simple liste de noms pour le dropdown
        res.json(products.map(p => p.name)); 
    } catch(e) { res.status(500).json({ error: e.message }); }
});

// Obtenir la liste des objets produits (pour la page de gestion)
app.get('/api/products/manage', auth, async (req, res) => {
    try {
        const products = await Product.find({
            $or: [
                { isGlobal: true },
                { owner: req.user.uid }
            ]
        }).sort({ isGlobal: -1, name: 1 });
        res.json(products);
    } catch(e) { res.status(500).json({ error: e.message }); }
});


// Ajouter un nouveau produit personnel
app.post('/api/products', auth, async (req, res) => {
    try {
        const { name } = req.body;
        if (!name || name.trim() === '') return res.status(400).json({ error: 'Le nom du produit est requis.' });
        
        const productName = name.trim();
        
        // Vérifier si un produit global ou personnel existe déjà avec ce nom
        const existing = await Product.findOne({
            name: productName,
            $or: [
                { isGlobal: true },
                { owner: req.user.uid }
            ]
        });
        if (existing) return res.status(409).json({ error: `Le produit '${productName}' existe déjà.` });

        const newProduct = await Product.create({
            name: productName,
            owner: req.user.uid,
            isGlobal: false
        });
        res.status(201).json(newProduct);
    } catch(e) { 
        if (e.code === 11000) return res.status(409).json({ error: 'Ce nom de produit existe déjà.' });
        res.status(500).json({ error: e.message }); 
    }
});

// Supprimer un produit personnel (par ID)
app.delete('/api/products/:id', auth, async (req, res) => {
    try {
        const product = await Product.findOne({
            _id: req.params.id,
            owner: req.user.uid, // Ne peut supprimer que ses propres produits
            isGlobal: false      // Ne peut pas supprimer un produit global
        });

        if (!product) return res.status(404).json({ error: 'Produit personnel introuvable ou non autorisé.' });

        // Vérifier si le produit est utilisé dans une vente
        const sale = await Sale.findOne({ owner: req.user.uid, fishType: product.name });
        if (sale) return res.status(400).json({ error: 'Impossible de supprimer, ce produit est utilisé dans une vente.' });
        
        await Product.deleteOne({ _id: req.params.id });
        res.json({ message: 'Produit supprimé.' });
    } catch(e) { res.status(500).json({ error: e.message }); }
});


/* ---------------- Routes "ADMIN" (Utilisateur normal) ---------------- */

// Routes GESTION CLIENTS (inchangées)
app.get('/api/clients-management/balances', auth, async (req, res) => {
    try {
        const ownerId = new mongoose.Types.ObjectId(req.user.uid);
        const agg = await Sale.aggregate([
            { $match: { owner: ownerId, balance: { $ne: 0 } } },
            { 
                $group: { 
                    _id: "$clientName", 
                    totalDebt: { $sum: { $cond: { if: { $gt: ["$balance", 0] }, then: "$balance", else: 0 } } },
                    totalCredit: { $sum: { $cond: { if: { $lt: ["$balance", 0] }, then: "$balance", else: 0 } } }
                } 
            },
            { 
                $project: { 
                    clientName: "$_id", 
                    totalDebt: { $round: ["$totalDebt", 2] }, 
                    totalCredit: { $abs: { $round: ["$totalCredit", 2] } },
                    _id: 0 
                } 
            },
            { $sort: { clientName: 1 } }
        ]);

        const allClients = await Sale.distinct('clientName', { owner: ownerId });
        const clientMap = new Map(agg.map(c => [c.clientName, c]));
        
        const results = allClients.map(name => {
            const balanceData = clientMap.get(name) || { totalDebt: 0, totalCredit: 0 };
            return { 
                clientName: name, 
                totalDebt: balanceData.totalDebt, 
                totalCredit: balanceData.totalCredit 
            };
        });

        res.json(results);
    } catch(e) { 
        console.error("Erreur chargement clients management:", e);
        res.status(500).json({ error: e.message }); 
    }
});

app.patch('/api/clients-management/:oldName', auth, async (req, res) => {
    const session = await mongoose.startSession();
    session.startTransaction();
    try {
        const { newName, motif } = req.body;
        const oldName = req.params.oldName;
        const ownerId = req.user.uid;

        if (!newName || !motif || newName.trim() === '' || motif.trim() === '') {
            await session.abortTransaction();
            return res.status(400).json({ error: 'Nouveau nom de client et motif requis' });
        }
        
        const newNameUpper = newName.toUpperCase().replace(/\s/g, '');
        const oldNameUpper = oldName.toUpperCase().replace(/\s/g, '');

        if (!/^[A-Z0-9]+$/.test(newNameUpper)) {
            await session.abortTransaction();
            return res.status(400).json({ error: "Le nouveau nom doit être en MAJUSCULES (A-Z, 0-9) sans espace." });
        }
        if (newNameUpper === oldNameUpper) {
             await session.abortTransaction();
             return res.status(400).json({ error: "Le nouveau nom est identique à l'ancien." });
        }

        const existingSale = await Sale.findOne({ owner: ownerId, clientName: newNameUpper }).session(session);
        if (existingSale && existingSale.clientName !== oldNameUpper) {
            await session.abortTransaction();
            return res.status(409).json({ error: `Le nom de client ${newNameUpper} est déjà utilisé.` });
        }
        
        await ActionLog.create([{
            owner: ownerId, companyName: req.user.companyName,
            actionType: 'edit', 
            motif: `Renommage client ${oldNameUpper} -> ${newNameUpper}. Motif: ${motif}`,
            saleId: new mongoose.Types.ObjectId(), 
            saleData: { message: `Renommage client: ${oldNameUpper} -> ${newNameUpper}` } 
        }], { session });

        const updateResult = await Sale.updateMany(
            { owner: ownerId, clientName: oldNameUpper },
            { $set: { clientName: newNameUpper } }
        ).session(session);

        if (updateResult.modifiedCount === 0) {
            await session.abortTransaction();
             return res.status(404).json({ error: 'Client introuvable ou aucune vente associée à mettre à jour.' });
        }

        await session.commitTransaction();
        res.json({ message: `Client ${oldNameUpper} renommé en ${newNameUpper} dans ${updateResult.modifiedCount} ventes.` });
    } catch(e) {
        await session.abortTransaction();
        res.status(400).json({ error: e.message });
    } finally {
        session.endSession();
    }
});


// Routes Ventes (Sales) et Actions
app.get('/api/action-logs', auth, async (req, res) => {
    try {
        const logs = await ActionLog.find({ owner: req.user.uid }).sort({ createdAt: -1 });
        res.json(logs);
    } catch(e) { res.status(500).json({ error: e.message }); }
});

app.post('/api/sales', auth, async (req,res)=>{
  const session = await mongoose.startSession(); session.startTransaction();
  try{
    const { date, clientName, fishType, quantity, delivered=0, unitPrice, payment=0, observation='' } = req.body;
    
    // Vérifier si le produit est valide pour cet utilisateur
    const validProduct = await Product.findOne({
        name: fishType,
        $or: [{ isGlobal: true }, { owner: req.user.uid }]
    });
    if (!validProduct) {
        throw new Error(`Produit non valide : ${fishType}`);
    }
    
    const [newSale] = await Sale.create([{ 
      owner: req.user.uid, date: date ? new Date(date) : new Date(),
      clientName, fishType, quantity:Number(quantity), delivered:Number(delivered),
      unitPrice:Number(unitPrice), payment:Number(payment), observation
    }], { session }); 
    
    await session.commitTransaction();
    res.json(newSale); 
  }catch(e){ await session.abortTransaction(); res.status(400).json({ error:e.message }); }
  finally { session.endSession(); }
});

app.put('/api/sales/:id', auth, async (req, res) => {
    const session = await mongoose.startSession(); session.startTransaction();
    try {
        const { saleData, motif } = req.body;
        if (!motif || motif.trim() === '') throw new Error("Le motif de l'édition est obligatoire.");
        const sale = await Sale.findOne({ _id: req.params.id, owner: req.user.uid }).session(session);
        if (!sale) { await session.abortTransaction(); return res.status(404).json({ error: 'Vente introuvable' }); }
        
        // Vérifier si le nouveau produit est valide
        if (saleData.fishType && saleData.fishType !== sale.fishType) {
            const validProduct = await Product.findOne({
                name: saleData.fishType,
                $or: [{ isGlobal: true }, { owner: req.user.uid }]
            });
            if (!validProduct) throw new Error(`Produit non valide : ${saleData.fishType}`);
        }
        
        await ActionLog.create([{
            owner: req.user.uid, companyName: req.user.companyName,
            actionType: 'edit', motif: motif, saleId: sale._id,
            saleData: sale.toObject() 
        }], { session });

        sale.date = saleData.date || sale.date;
        sale.clientName = saleData.clientName || sale.clientName;
        sale.fishType = saleData.fishType || sale.fishType;
        sale.quantity = Number(saleData.quantity);
        sale.delivered = Number(saleData.delivered);
        sale.unitPrice = Number(saleData.unitPrice);
        sale.payment = Number(saleData.payment);
        sale.observation = saleData.observation;

        await sale.validate();
        const updatedSale = await sale.save({ session });
        await session.commitTransaction();
        res.json(updatedSale);
    } catch(e) { await session.abortTransaction(); res.status(400).json({ error: e.message }); }
    finally { session.endSession(); }
});

app.delete('/api/sales/:id', auth, async (req, res) => {
    const session = await mongoose.startSession(); session.startTransaction();
    try {
        const { motif } = req.body;
        if (!motif || motif.trim() === '') throw new Error("Le motif de la suppression est obligatoire.");
        const sale = await Sale.findOne({ _id: req.params.id, owner: req.user.uid }).session(session);
        if (!sale) { await session.abortTransaction(); return res.status(404).json({ error: 'Vente introuvable' }); }

        await ActionLog.create([{
            owner: req.user.uid, companyName: req.user.companyName,
            actionType: 'delete', motif: motif, saleId: sale._id,
            saleData: sale.toObject() 
        }], { session });
        
        await Sale.deleteOne({ _id: req.params.id, owner: req.user.uid }).session(session);
        await session.commitTransaction();
        res.json({ message: "Vente supprimée et journalisée." });
    } catch(e) { await session.abortTransaction(); res.status(400).json({ error: e.message }); }
    finally { session.endSession(); }
});

app.get('/api/sales', auth, async (req,res)=>{
  try{
    const { fishType, client, settled, startDate, endDate } = req.query;
    const q = { owner: req.user.uid };
    if (fishType) q.fishType = fishType;
    if (client) q.clientName = new RegExp(client, 'i');
    if (settled === 'true') q.settled = true; if (settled === 'false') q.settled = false;
    if (startDate || endDate) {
        q.date = q.date || {};
        if (startDate) q.date.$gte = new Date(startDate);
        if (endDate) { const end = new Date(endDate); end.setDate(end.getDate() + 1); q.date.$lt = end; }
    }
    const sales = await Sale.find(q).sort({ date:-1, createdAt:-1 });
    res.json(sales);
  }catch(e){ res.status(500).json({ error:e.message }); }
});

app.patch('/api/sales/:id/pay', auth, async (req,res)=>{
  const session = await mongoose.startSession(); session.startTransaction();
  try{
    const { amount } = req.body;
    const paymentAmount = Math.max(0, Number(amount||0));
    const sale = await Sale.findOne({ _id:req.params.id, owner:req.user.uid }).session(session);
    if(!sale) { await session.abortTransaction(); return res.status(404).json({ error:'Vente introuvable' }); }
    if (paymentAmount === 0) { await session.commitTransaction(); return res.json(sale); }
    sale.payment += paymentAmount;
    await sale.validate();
    await sale.save({ session }); 
    await session.commitTransaction();
    const updatedSale = await Sale.findById(sale._id);
    res.json(updatedSale);
  }catch(e){ await session.abortTransaction(); res.status(400).json({ error:e.message }); }
  finally { session.endSession(); }
});

app.patch('/api/sales/:id/refund', auth, async (req,res)=>{
  const session = await mongoose.startSession(); session.startTransaction();
  try{
    const { amount } = req.body;
    const sale = await Sale.findOne({ _id:req.params.id, owner:req.user.uid }).session(session);
    if(!sale) { await session.abortTransaction(); return res.status(404).json({ error:'Vente introuvable' }); }
    const dec = Math.max(0, Number(amount||0));
    const maxRefund = Math.abs(sale.balance); 
    sale.payment -= Math.min(dec, maxRefund);
    await sale.validate();
    await sale.save({ session });
    await session.commitTransaction();
    const updatedSale = await Sale.findById(sale._id); 
    res.json(updatedSale);
  }catch(e){ await session.abortTransaction(); res.status(400).json({ error:e.message }); }
  finally { session.endSession(); }
});

app.patch('/api/sales/:id/settle', auth, async (req,res)=>{
  const session = await mongoose.startSession(); session.startTransaction();
  try{
    const sale = await Sale.findOne({ _id:req.params.id, owner:req.user.uid }).session(session);
    if(!sale) { await session.abortTransaction(); return res.status(404).json({ error:'Vente introuvable' }); }
    sale.payment += Math.max(0, sale.amount - sale.payment);
    await sale.validate();
    await sale.save({ session });
    await session.commitTransaction();
    const updatedSale = await Sale.findById(sale._id); 
    res.json(updatedSale);
  }catch(e){ await session.abortTransaction(); res.status(500).json({ error:e.message }); }
  finally { session.endSession(); }
});

app.patch('/api/sales/:id/deliver', auth, async (req,res)=>{
  try{
    const { qty } = req.body;
    const sale = await Sale.findOne({ _id:req.params.id, owner:req.user.uid });
    if(!sale) return res.status(404).json({ error:'Vente introuvable' });
    const inc = Math.max(0, Number(qty||0));
    const remaining = Math.max(0, sale.quantity - sale.delivered);
    sale.delivered += Math.min(inc, remaining);
    await sale.validate();
    await sale.save();
    res.json(sale);
  }catch(e){ res.status(400).json({ error:e.message }); }
});

async function applyCompensation(debtId, creditId, amountToUse, ownerId, session) {
    const amount = Number(amountToUse);
    if (amount <= 0) throw new Error("Montant de compensation invalide.");
    const debtSale = await Sale.findOne({ _id: debtId, owner: ownerId, balance: { $gt: 0 } }).session(session);
    const creditSale = await Sale.findOne({ _id: creditId, owner: ownerId, balance: { $lt: 0 } }).session(session);
    if (!debtSale || !creditSale) throw new Error("Vente(s) introuvable(s) ou solde(s) incompatible(s).");
    const maxDebtPayment = debtSale.balance;
    const maxCreditUse = Math.abs(creditSale.balance);
    const actualAmount = Math.min(amount, maxDebtPayment, maxCreditUse);
    if (actualAmount <= 0) throw new Error("Aucune compensation possible avec ce montant.");
    debtSale.payment += actualAmount;
    await debtSale.validate(); 
    creditSale.payment -= actualAmount;
    await creditSale.validate(); 
    await Promise.all([debtSale.save({ session }), creditSale.save({ session })]);
    return actualAmount;
}

app.patch('/api/sales/compensate-manual', auth, async (req, res) => {
    const session = await mongoose.startSession(); session.startTransaction();
    try {
        const { debtId, creditId, amountToUse } = req.body;
        const compensatedAmount = await applyCompensation(debtId, creditId, amountToUse, req.user.uid, session);
        await session.commitTransaction();
        res.json({ message: "Compensation effectuée", compensatedAmount });
    } catch(e) { await session.abortTransaction(); res.status(400).json({ error: e.message }); }
    finally { session.endSession(); }
});

app.get('/api/sales/client-balances/:clientName', auth, async (req, res) => {
    try {
        const clientName = req.params.clientName;
        const sales = await Sale.find({ owner: req.user.uid, clientName: clientName, balance: { $ne: 0 } })
            .select('date balance settled amount payment fishType'); 
        const debts = sales.filter(s => s.balance > 0).map(s => ({
            _id: s._id, date: s.date.toISOString().slice(0, 10),
            balance: s.balance, isCredit: false
        })).sort((a, b) => new Date(a.date) - new Date(b.date)); 
        const credits = sales.filter(s => s.balance < 0).map(s => ({
            _id: s._id, date: s.date.toISOString().slice(0, 10),
            balance: Math.abs(s.balance), isCredit: true
        })).sort((a, b) => new Date(a.date) - new Date(b.date)); 
        res.json({ debts, credits });
    } catch(e) { res.status(500).json({ error: e.message }); }
});

app.get('/api/client-analysis/:clientName', auth, async (req, res) => {
    try {
        const { clientName } = req.params;
        const { startDate, endDate } = req.query;
        const matchQuery = { owner: new mongoose.Types.ObjectId(req.user.uid), clientName: clientName };
        if (startDate) matchQuery.date = { ...matchQuery.date, $gte: new Date(startDate) };
        if (endDate) { const end = new Date(endDate); end.setDate(end.getDate() + 1); matchQuery.date = { ...matchQuery.date, $lt: end }; }
        
        const [summary] = await Sale.aggregate([
            { $match: matchQuery },
            { $group: { _id: null, totalAmount: { $sum: "$amount" }, totalPayment: { $sum: "$payment" },
                totalBalance: { $sum: "$balance" }, totalQuantity: { $sum: "$quantity" },
                totalDelivered: { $sum: "$delivered" }, numSales: { $sum: 1 } } },
            { $project: { _id: 0 } }
        ]);
        const [debts] = await Sale.aggregate([
            { $match: { owner: new mongoose.Types.ObjectId(req.user.uid), clientName: clientName, balance: { $gt: 0 } } },
            { $group: { _id: null, totalDebt: { $sum: "$balance" } } },
            { $project: { totalDebt: 1, _id: 0 } }
        ]);
        const [credits] = await Sale.aggregate([
            { $match: { owner: new mongoose.Types.ObjectId(req.user.uid), clientName: clientName, balance: { $lt: 0 } } },
            { $group: { _id: null, totalCredit: { $sum: "$balance" } } },
            { $project: { totalCredit: { $abs: "$totalCredit" }, _id: 0 } }
        ]);
        const recentSales = await Sale.find(matchQuery).sort({ date: -1 }).limit(10).select('date fishType quantity amount payment balance');
        res.json({
            summary: summary || { totalAmount: 0, totalPayment: 0, totalBalance: 0, totalQuantity: 0, totalDelivered: 0, numSales: 0 },
            totalDebt: (debts && debts.totalDebt) || 0,
            totalCredit: (credits && credits.totalCredit) || 0,
            recentSales
        });
    } catch(e) { res.status(500).json({ error: e.message }); }
});

// MODIFIÉ: Logique 'byFish' dynamique
app.get('/api/summary', auth, async (req,res)=>{
  try{
    const { clientName, startDate, endDate, isGlobal } = req.query; 
    const ownerId = new mongoose.Types.ObjectId(req.user.uid);
    const q = { owner: ownerId };
    
    if (clientName) q.clientName = clientName;
    if (startDate) q.date = { ...q.date, $gte: new Date(startDate) };
    if (endDate) { const end = new Date(endDate); end.setDate(end.getDate() + 1); q.date = { ...q.date, $lt: end }; }
    
    // 1. Calculs des totaux (période)
    const [totals] = await Sale.aggregate([ { $match: q }, { $group: { _id:null, totalAmount:{ $sum:"$amount" }, totalPayment:{ $sum:"$payment" }, totalBalance:{ $sum:"$balance" } } } ]);
    const finalTotals = totals || { totalAmount: 0, totalPayment: 0, totalBalance: 0 };
    
    // 2. Calculs des dettes/crédits actuels (non-périodique, mais filtré par client si fourni)
    const q_current_balance = { owner: ownerId };
    if (clientName) q_current_balance.clientName = clientName; 
    const [totalDebtResult] = await Sale.aggregate([ { $match: { ...q_current_balance, balance: { $gt: 0 } } }, { $group: { _id: null, totalDebt: { $sum: "$balance" } } } ]);
    const [totalCreditResult] = await Sale.aggregate([ { $match: { ...q_current_balance, balance: { $lt: 0 } } }, { $group: { _id: null, totalCredit: { $sum: "$balance" } } } ]);
    
    // 3. Logique 'byFish'
    let byFishResult;
    // Définir la query pour les ventes byFish
    // Si c'est 'isGlobal' (page Bilan Global), on prend TOUTES les ventes de l'admin, sans filtre de date
    const byFishQuery = isGlobal ? { owner: ownerId } : q;

    // 1. Get all products for this user
    const allProducts = await Product.find({ $or: [{ isGlobal: true }, { owner: ownerId }] }).select('name').lean();
    
    // 2. Get sales summary (période 'byFishQuery')
    const byFishSales = await Sale.aggregate([ 
        { $match: byFishQuery }, 
        { $group: { _id:"$fishType", amount:{ $sum:"$amount" }, payment:{ $sum:"$payment" }, balance:{ $sum:"$balance" } } }, 
        { $project: { fishType:"$_id", amount:1, payment:1, balance:1, _id:0 } } 
    ]);
    const salesMap = new Map(byFishSales.map(s => [s.fishType, s]));

    // 3. Merge (on inclut tous les produits, même ceux à 0)
    byFishResult = allProducts.map(p => {
        const salesData = salesMap.get(p.name) || { amount: 0, payment: 0, balance: 0 };
        return {
            fishType: p.name,
            amount: salesData.amount,
            payment: salesData.payment,
            balance: salesData.balance
        };
    });
    
    // Si ce n'est PAS la page Bilan (isGlobal), on filtre les produits n'ayant aucune activité dans la période
    if (!isGlobal) {
        byFishResult = byFishResult.filter(p => p.amount > 0 || p.payment > 0 || p.balance !== 0);
    }
    
    res.json({
      totalAmount: Number(finalTotals.totalAmount.toFixed(2)), totalPayment: Number(finalTotals.totalPayment.toFixed(2)),
      totalBalance: Number(finalTotals.totalBalance.toFixed(2)),
      totalDebt: (totalDebtResult && totalDebtResult.totalDebt) || 0,
      totalCredit: (totalCreditResult && Math.abs(totalCreditResult.totalCredit)) || 0,
      byFish: byFishResult.map(f => ({ ...f, amount: Number(f.amount.toFixed(2)), payment: Number(f.payment.toFixed(2)), balance: Number(f.balance.toFixed(2)), }))
    });
  }catch(e){ res.status(500).json({ error:e.message }); }
});


app.get('/api/dashboard/debts', auth, async (req,res)=>{
  try{
    const agg = await Sale.aggregate([
      { $match: { owner: new mongoose.Types.ObjectId(req.user.uid), balance: { $gt: 0 } } },
      { $group: { _id:"$clientName", totalDebt:{ $sum:"$balance" }, count:{ $sum:1 } } },
      { $project: { clientName:"$_id", totalDebt:{ $round:["$totalDebt",2] }, count:1, _id:0 } },
      { $sort: { totalDebt:-1 } }
    ]); res.json(agg);
  }catch(e){ res.status(500).json({ error:e.message }); }
});

app.get('/api/dashboard/credits', auth, async (req,res)=>{
  try{
    const agg = await Sale.aggregate([
      { $match: { owner: new mongoose.Types.ObjectId(req.user.uid), balance: { $lt: 0 } } },
      { $group: { _id:"$clientName", totalCredit:{ $sum:"$balance" }, count:{ $sum:1 } } },
      { $project: { clientName:"$_id", totalCredit:{ $abs:"$totalCredit" }, count:1, _id:0 } }, 
      { $sort: { totalCredit:-1 } }
    ]); res.json(agg);
  }catch(e){ res.status(500).json({ error:e.message }); }
});

// Cette route est utilisée par l'ancien hook 'useClients'
app.get('/api/clients', auth, async (req, res) => {
  try {
    const clients = await Sale.distinct('clientName', { owner: req.user.uid });
    res.json(clients.sort());
  } catch(e) { res.status(500).json({ error: e.message }); }
});

// MODIFIÉ: Export Bilan Client - Ajout filtre fishType
app.get('/api/exports/client-report.xlsx', auth, async (req, res) => {
  try {
    const { clientName, fishType } = req.query; // MODIFIÉ
    const q = { owner: req.user.uid };
    if (clientName && clientName !== 'all') q.clientName = clientName;
    if (fishType) q.fishType = fishType; // MODIFIÉ
    
    const sales = await Sale.find(q).sort({ clientName: 1, date: -1, createdAt: -1 });
    const wb = new ExcelJS.Workbook();
    const ws = wb.addWorksheet(clientName && clientName !== 'all' ? `Bilan_${clientName}` : 'Bilan_Global');
    ws.columns = [
      { header: 'Client', key: 'clientName', width: 25 }, { header: 'Date', key: 'date', width: 15 },
      { header: 'Produit', key: 'fishType', width: 15 }, { header: 'Quantité (Kg)', key: 'quantity', width: 15 }, // MODIFIÉ
      { header: 'Prix Unitaire', key: 'unitPrice', width: 14 }, { header: 'Montant Total', key: 'amount', width: 15 },
      { header: 'Règlement Cumulé', key: 'payment', width: 18 }, { header: 'Balance', key: 'balance', width: 15 },
      { header: 'Type de Solde', key: 'balanceType', width: 15 }, { header: 'Livré (Kg)', key: 'delivered', width: 12 },
      { header: 'Statut', key: 'settled', width: 10 }, { header: 'Observation', key: 'observation', width: 30 },
    ];
    sales.forEach(s => ws.addRow({
        clientName: s.clientName, date: new Date(s.date).toISOString().slice(0, 10),
        fishType: s.fishType, quantity: s.quantity, unitPrice: s.unitPrice, amount: s.amount,
        payment: s.payment, balance: s.balance,
        balanceType: s.balance > 0 ? 'Dette Client' : (s.balance < 0 ? 'Crédit Entreprise' : 'Soldé'),
        delivered: s.delivered, settled: s.settled?'Oui':'Non', observation: s.observation||''
    }));
    res.setHeader('Content-Type','application/vnd.openxmlformats-officedocument.spreadsheetml.sheet');
    res.setHeader('Content-Disposition',`attachment; filename="${clientName && clientName !== 'all' ? `bilan_${clientName.replace(/\s/g, '_')}` : 'bilan_global'}.xlsx"`);
    await wb.xlsx.write(res); res.end();
  } catch (e) { res.status(500).json({ error: e.message }); }
});

// MODIFIÉ: Export Historique Ventes - Ajout filtre fishType
app.get('/api/exports/sales.xlsx', auth, async (req,res)=>{
  try{
    const { fishType } = req.query; // MODIFIÉ
    const q = { owner:req.user.uid };
    if (fishType) q.fishType = fishType; // MODIFIÉ
    
    const sales = await Sale.find(q).sort({ date:-1, createdAt:-1 });
    const wb = new ExcelJS.Workbook();
    const ws = wb.addWorksheet('Historique ventes');
    ws.columns = [
      { header:'Date', key:'date', width:15 }, { header:'Client', key:'clientName', width:25 },
      { header:'Produit', key:'fishType', width:15 }, { header:'Quantité', key: 'quantity', width:12 }, // MODIFIÉ
      { header:'Livré', key:'delivered', width:12 }, { header:'Reste à livrer', key:'remaining', width:14 },
      { header:'Prix Unitaire', key:'unitPrice', width:14 }, { header:'Montant', key:'amount', width:12 },
      { header:'Règlement', key:'payment', width:12 }, { header:'Solde', key:'balance', width:12 },
      { header:'Soldé', key:'settled', width:10 }, { header:'Observation', key:'observation', width:30 },
    ];
    sales.forEach(s=>{
      const remaining = Math.max(0, s.quantity - s.delivered);
      ws.addRow({
        date:new Date(s.date).toISOString().slice(0,10), clientName:s.clientName, fishType:s.fishType,
        quantity:s.quantity, delivered:s.delivered, remaining, unitPrice:s.unitPrice,
        amount:s.amount, payment:s.payment, balance:s.balance, settled:s.settled?'Oui':'Non',
        observation:s.observation||''
      });
    });
    res.setHeader('Content-Type','application/vnd.openxmlformats-officedocument.spreadsheetml.sheet');
    res.setHeader('Content-Disposition','attachment; filename="historique_ventes.xlsx"');
    await wb.xlsx.write(res); res.end();
  }catch(e){ res.status(500).json({ error:e.message }); }
});

// MODIFIÉ: Export Bilan Soldes Clients - Ajout filtre fishType
app.get('/api/exports/client-balances.xlsx', auth, async (req, res) => {
  try {
    const { fishType } = req.query; // MODIFIÉ
    const ownerId = new mongoose.Types.ObjectId(req.user.uid);
    
    const matchQuery = { owner: ownerId }; // MODIFIÉ
    if (fishType) { // MODIFIÉ
        matchQuery.fishType = fishType;
    }
    
    const balances = await Sale.aggregate([
      { $match: matchQuery }, // MODIFIÉ
      { 
        $group: { 
          _id: "$clientName", 
          totalClientDebt: { $sum: { $cond: { if: { $gt: ["$balance", 0] }, then: "$balance", else: 0 } } },
          totalClientCredit: { $sum: { $cond: { if: { $lt: ["$balance", 0] }, then: "$balance", else: 0 } } }
        } 
      },
      {
        $project: {
          _id: 0,
          clientName: "$_id",
          totalDebt: { $round: ["$totalClientDebt", 2] },
          totalCredit: { $abs: { $round: ["$totalClientCredit", 2] } }, 
          totalBalance: { $round: [{ $add: ["$totalClientDebt", "$totalClientCredit"] }, 2] }
        }
      },
      { $sort: { clientName: 1 } } 
    ]);

    const wb = new ExcelJS.Workbook();
    const ws = wb.addWorksheet('Bilan Soldes Clients');
    
    ws.columns = [
      { header: 'Client', key: 'clientName', width: 30 },
      { header: 'Dette Totale (Le client doit)', key: 'totalDebt', width: 25, style: { numFmt: '#,##0.00 "XOF"' } },
      { header: 'Crédit Total (Nous devons au client)', key: 'totalCredit', width: 30, style: { numFmt: '#,##0.00 "XOF"' } },
      { header: 'Solde Net', key: 'totalBalance', width: 20, style: { numFmt: '#,##0.00 "XOF"' } },
    ];
    
    ws.getRow(1).font = { bold: true };

    balances.forEach(b => {
      if (b.totalBalance !== 0 || b.totalDebt !== 0 || b.totalCredit !== 0) {
        ws.addRow({
          clientName: b.clientName,
          totalDebt: b.totalDebt,
          totalCredit: b.totalCredit,
          totalBalance: b.totalBalance
        });
      }
    });

    res.setHeader('Content-Type','application/vnd.openxmlformats-officedocument.spreadsheetml.sheet');
    res.setHeader('Content-Disposition','attachment; filename="bilan_solde_clients.xlsx"');
    await wb.xlsx.write(res); res.end();

  } catch (e) {
    console.error("Erreur lors de l'export des soldes clients (corrigé):", e);
    res.status(500).json({ error: e.message });
  }
});


/* ---------------- Lancement ---------------- */
app.listen(PORT, ()=>console.log(`API running on http://localhost:${PORT}`));
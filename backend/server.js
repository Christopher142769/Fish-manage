// server.js (MIS À JOUR AVEC SUPER ADMIN)
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

// NOUVEAU: Identifiants Super Admin (à mettre dans .env en production)
const SUPER_ADMIN_EMAIL = process.env.SUPER_ADMIN_EMAIL || 'super@admin.com';
const SUPER_ADMIN_PASS = process.env.SUPER_ADMIN_PASS || 'superadmin123';

mongoose.connect(MONGO_URI, { dbName: DB_NAME })
  .then(() => console.log(`MongoDB connected (db: ${DB_NAME})`))
  .catch(err => { console.error('MongoDB error:', err.message); process.exit(1); });

app.get('/', (_req, res) => res.type('text/plain').send('OK'));

/* ---------------- Modèles (inchangés) ---------------- */
const userSchema = new mongoose.Schema({
  companyName: { type: String, required: true },
  email:       { type: String, required: true, unique: true, index: true },
  passwordHash:{ type: String, required: true },
}, { timestamps: true });

const saleSchema = new mongoose.Schema({
  owner:       { type: mongoose.Schema.Types.ObjectId, ref: 'User', index: true },
  date:        { type: Date, required: true },
  clientName:  { type: String, required: true, index: true },
  fishType:    { type: String, enum: ['tilapia', 'pangasius'], required: true, index: true },
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

const User = mongoose.model('User', userSchema);
const Sale = mongoose.model('Sale', saleSchema);
const ActionLog = mongoose.model('ActionLog', actionLogSchema);

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

// NOUVEAU: Middleware pour "Super Admin"
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

// NOUVEAU: Login Super Admin
app.post('/api/admin/login', async (req, res) => {
    try {
        const { email, password } = req.body;
        // Vérification des identifiants hardcodés
        if (email === SUPER_ADMIN_EMAIL && password === SUPER_ADMIN_PASS) {
            const token = jwt.sign({ email: email, role: 'superadmin' }, JWT_SECRET, { expiresIn: '1d' });
            return res.json({ token });
        }
        return res.status(401).json({ error: 'Identifiants Super Admin invalides' });
    } catch(e) {
        res.status(500).json({ error: e.message });
    }
});

// NOUVEAU: CRUD pour les "Admins" (Comptes User)
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

// NOUVEAU: Routes "Vue" Super Admin
// (Reprise des routes normales, mais en ciblant un userId)

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
        const q = { owner: req.params.userId };
        
        if (startDate || endDate) {
            q.createdAt = q.createdAt || {}; // Filtrer sur la date de l'action
            if (startDate) q.createdAt.$gte = new Date(startDate);
            if (endDate) {
                const end = new Date(endDate); end.setDate(end.getDate() + 1); 
                q.createdAt.$lt = end;
            }
        }
        const logs = await ActionLog.find(q).sort({ createdAt: -1 });
        res.json(logs);
    } catch(e) {
        res.status(500).json({ error: e.message });
    }
});

// NOUVEAU: Export Excel Super Admin
app.get('/api/admin/export/:userId', authSuperAdmin, async (req, res) => {
    try {
        const { startDate, endDate } = req.query;
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

        const sales = await Sale.find(qSales).sort({ date: -1 });
        const logs = await ActionLog.find(qLogs).sort({ createdAt: -1 });
        
        const wb = new ExcelJS.Workbook();
        
        // Feuille 1: Ventes
        const wsVentes = wb.addWorksheet('Ventes');
        wsVentes.columns = [
            { header: 'Date', key: 'date', width: 15 },
            { header: 'Client', key: 'clientName', width: 25 },
            { header: 'Poisson', key: 'fishType', width: 12 },
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

        // Feuille 2: Logs d'Actions
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


/* ---------------- Routes "ADMIN" (Utilisateur normal) ---------------- */
// (Toutes les routes ci-dessous sont inchangées et utilisent le middleware 'auth' normal)

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

app.get('/api/summary', auth, async (req,res)=>{
  try{
    const { clientName, startDate, endDate } = req.query; 
    const q = { owner: new mongoose.Types.ObjectId(req.user.uid) };
    if (clientName) q.clientName = clientName;
    if (startDate) q.date = { ...q.date, $gte: new Date(startDate) };
    if (endDate) { const end = new Date(endDate); end.setDate(end.getDate() + 1); q.date = { ...q.date, $lt: end }; }
    
    const [totals] = await Sale.aggregate([ { $match: q }, { $group: { _id:null, totalAmount:{ $sum:"$amount" }, totalPayment:{ $sum:"$payment" }, totalBalance:{ $sum:"$balance" } } } ]);
    const byFish = await Sale.aggregate([ { $match: q }, { $group: { _id:"$fishType", amount:{ $sum:"$amount" }, payment:{ $sum:"$payment" }, balance:{ $sum:"$balance" } } }, { $project: { fishType:"$_id", amount:1, payment:1, balance:1, _id:0 } } ]);
    const finalTotals = totals || { totalAmount: 0, totalPayment: 0, totalBalance: 0 };
    const q_current_balance = { owner: new mongoose.Types.ObjectId(req.user.uid) };
    if (clientName) q_current_balance.clientName = clientName; 
    const [totalDebtResult] = await Sale.aggregate([ { $match: { ...q_current_balance, balance: { $gt: 0 } } }, { $group: { _id: null, totalDebt: { $sum: "$balance" } } } ]);
    const [totalCreditResult] = await Sale.aggregate([ { $match: { ...q_current_balance, balance: { $lt: 0 } } }, { $group: { _id: null, totalCredit: { $sum: "$balance" } } } ]);
    res.json({
      totalAmount: Number(finalTotals.totalAmount.toFixed(2)), totalPayment: Number(finalTotals.totalPayment.toFixed(2)),
      totalBalance: Number(finalTotals.totalBalance.toFixed(2)),
      totalDebt: (totalDebtResult && totalDebtResult.totalDebt) || 0,
      totalCredit: (totalCreditResult && totalCreditResult.totalCredit) || 0,
      byFish: byFish.map(f => ({ ...f, amount: Number(f.amount.toFixed(2)), payment: Number(f.payment.toFixed(2)), balance: Number(f.balance.toFixed(2)), }))
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

app.get('/api/clients', auth, async (req, res) => {
  try {
    const clients = await Sale.distinct('clientName', { owner: req.user.uid });
    res.json(clients.sort());
  } catch(e) { res.status(500).json({ error: e.message }); }
});

app.get('/api/exports/client-report.xlsx', auth, async (req, res) => {
  try {
    const { clientName } = req.query;
    const q = { owner: req.user.uid };
    if (clientName && clientName !== 'all') q.clientName = clientName;
    const sales = await Sale.find(q).sort({ clientName: 1, date: -1, createdAt: -1 });
    const wb = new ExcelJS.Workbook();
    const ws = wb.addWorksheet(clientName && clientName !== 'all' ? `Bilan_${clientName}` : 'Bilan_Global');
    ws.columns = [
      { header: 'Client', key: 'clientName', width: 25 }, { header: 'Date', key: 'date', width: 15 },
      { header: 'Poisson', key: 'fishType', width: 12 }, { header: 'Quantité (Kg)', key: 'quantity', width: 15 },
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

app.get('/api/exports/sales.xlsx', auth, async (req,res)=>{
  try{
    const sales = await Sale.find({ owner:req.user.uid }).sort({ date:-1, createdAt:-1 });
    const wb = new ExcelJS.Workbook();
    const ws = wb.addWorksheet('Historique ventes');
    ws.columns = [
      { header:'Date', key:'date', width:15 }, { header:'Client', key:'clientName', width:25 },
      { header:'Poisson', key:'fishType', width:12 }, { header:'Quantité', key: 'quantity', width:12 },
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

/* ---------------- Lancement ---------------- */
app.listen(PORT, ()=>console.log(`API running on http://localhost:${PORT}`));
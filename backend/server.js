// server.js
require('dotenv').config(); // charge .env en premier

const express = require('express');
const mongoose = require('mongoose');
const cors = require('cors');
const bcrypt = require('bcrypt');
const jwt = require('jsonwebtoken');
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

/* --- Préflight universel (sans app.options('*', ...)) --- */
app.use((req, res, next) => {
  if (req.method === 'OPTIONS') {
    return res.sendStatus(204);
  }
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

mongoose.connect(MONGO_URI, { dbName: DB_NAME })
  .then(() => console.log(`MongoDB connected (db: ${DB_NAME})`))
  .catch(err => { console.error('MongoDB error:', err.message); process.exit(1); });

app.get('/', (_req, res) => res.type('text/plain').send('OK'));

/* ---------------- Modèles (Inclut la gestion du solde négatif) ---------------- */
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
  this.delivered = Math.max(0, Math.min(this.delivered || 0, this.quantity || 0));
  this.amount = (Number(this.quantity || 0) * Number(this.unitPrice || 0));
  const rawBalance = this.amount - Number(this.payment || 0);
  
  this.balance = Number(rawBalance.toFixed(2));
  this.settled = (this.amount > 0 && this.balance <= 0); // Soldé si amount > 0 et balance <= 0
  next();
});

const User = mongoose.model('User', userSchema);
const Sale = mongoose.model('Sale', saleSchema);

/* ---------------- Compensation Globale ---------------- */

/**
 * Tente de compenser toutes les dettes non soldées d'un client 
 * en utilisant l'excédent de paiement (crédit) disponible sur ses ventes.
 * @param {string} clientName - Nom du client.
 * @param {mongoose.Types.ObjectId} ownerId - ID du propriétaire.
 * @param {mongoose.ClientSession} session - Session de transaction.
 * @returns {number} Le crédit net total (négatif) restant après compensation.
 */
async function compensateClientDebts(clientName, ownerId, session) {
    // 1. Trouver toutes les ventes (dettes & crédits) du client
    const allSales = await Sale.find({ 
        owner: ownerId,
        clientName: clientName, 
    }).sort({ date: 1, createdAt: 1 }).session(session);

    let totalCreditAvailable = allSales
        .filter(s => s.balance < 0)
        .reduce((sum, s) => sum + Math.abs(s.balance), 0);
    
    // Trier les dettes par ancienneté pour les solder en premier
    let debtsToSettle = allSales
        .filter(s => s.balance > 0)
        .sort((a, b) => new Date(a.date) - new Date(b.date)); 

    let remainingCredit = totalCreditAvailable;
    let compensationUsed = 0;

    // 2. Compenser les dettes avec le crédit disponible
    for (const debtSale of debtsToSettle) {
        if (remainingCredit <= 0) break;
        
        const due = debtSale.balance; // Balance de la dette (positive)
        
        if (due > 0) {
            const compensation = Math.min(remainingCredit, due);
            
            // Calculer le nouveau paiement total sur cette dette
            const newPayment = debtSale.payment + compensation;

            await Sale.findByIdAndUpdate(debtSale._id, {
                $set: { 
                    payment: newPayment,
                    // 'balance' et 'settled' seront recalculés par pre('validate')
                }
            }, { 
                new: true, 
                runValidators: true, 
                session: session 
            });
            
            remainingCredit -= compensation;
            compensationUsed += compensation;
        }
    }

    // 3. Ajuster les lignes de crédit originales (les ventes avec balance < 0)
    if (compensationUsed > 0) {
        let compensationLeftToDistribute = compensationUsed;
        
        // On distribue la compensation sur les crédits les plus anciens en premier
        const creditSales = allSales
            .filter(s => s.balance < 0)
            .sort((a, b) => new Date(a.date) - new Date(b.date)); 
        
        for (const creditSale of creditSales) {
            if (compensationLeftToDistribute <= 0) break;
            
            // Le crédit disponible sur cette ligne (valeur absolue)
            const availableCredit = Math.abs(creditSale.balance);
            
            // Le montant à retirer de ce crédit
            const amountToApply = Math.min(compensationLeftToDistribute, availableCredit);
            
            // Nouveau paiement = Paiement initial - montant de l'utilisation
            // Si la ligne de crédit a un paiement de 700k pour amount 100k (crédit de 600k), 
            // et qu'on utilise 100k, le nouveau paiement devient 600k (crédit de 500k).
            const newPayment = creditSale.payment - amountToApply; 
            
            await Sale.findByIdAndUpdate(creditSale._id, {
                $set: { 
                    payment: newPayment,
                }
            }, { 
                new: true, 
                runValidators: true, 
                session: session 
            });
            
            compensationLeftToDistribute -= amountToApply;
        }
    }
    
    // 4. Calculer le nouveau crédit net après compensation
    const newCredit = await Sale.aggregate([
      { $match: { owner: ownerId, clientName: clientName, balance: { $lt: 0 } } },
      { $group: { _id: null, totalCredit: { $sum: "$balance" } } }
    ]).session(session);

    return newCredit.length > 0 ? newCredit[0].totalCredit : 0;
}

// ROUTE : Compensation Globale (pour le front-end)
app.patch('/api/sales/compensate-client/:clientName', auth, async (req, res) => {
    const session = await mongoose.startSession();
    session.startTransaction();
    try {
        const clientName = req.params.clientName;
        await compensateClientDebts(clientName, req.user.uid, session);
        await session.commitTransaction();
        res.json({ clientName, message: "Compensation effectuée" });
    } catch(e) {
        await session.abortTransaction();
        console.error("Erreur de compensation:", e);
        res.status(500).json({ error: e.message });
    } finally {
        session.endSession();
    }
});


/* ---------------- Auth middleware ---------------- */
function auth(req,res,next){
  const header = req.headers.authorization || '';
  const token = header.startsWith('Bearer ')? header.slice(7): null;
  if(!token) return res.status(401).json({ error:'Token manquant' });
  try{
    req.user = jwt.verify(token, JWT_SECRET);
    next();
  }catch(e){ return res.status(401).json({ error:'Token invalide' }); }
}

/* ---------------- Routes AUTH (inchangées) ---------------- */
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

/* ---------------- Routes VENTES ---------------- */
// Créer une vente (CORRECTION MAJEURE: Ajout transaction + compensation immédiate)
app.post('/api/sales', auth, async (req,res)=>{
  const session = await mongoose.startSession();
  session.startTransaction();
  try{
    const { date, clientName, fishType, quantity, delivered=0, unitPrice, payment=0, observation='' } = req.body;
    
    // Création en tableau pour utiliser la session, et on récupère le premier (et seul) élément créé.
    const [newSale] = await Sale.create([{ 
      owner: req.user.uid,
      date: date ? new Date(date) : new Date(),
      clientName, fishType,
      quantity:Number(quantity), delivered:Number(delivered),
      unitPrice:Number(unitPrice),
      payment:Number(payment),
      observation
    }], { session }); 
    
    // Déclenchement de la compensation globale pour le client (si nouveau crédit/dette)
    await compensateClientDebts(clientName, req.user.uid, session);
    
    await session.commitTransaction();
    
    // Recharger la vente (maintenant que la compensation a eu lieu) pour renvoyer le dernier état
    const updatedSale = await Sale.findById(newSale._id);
    res.json(updatedSale); 
  }catch(e){ 
    await session.abortTransaction();
    res.status(400).json({ error:e.message }); 
  }finally {
    session.endSession();
  }
});

// Lister ventes (inchangé)
app.get('/api/sales', auth, async (req,res)=>{
  try{
    const { fishType, client, settled } = req.query;
    const q = { owner: req.user.uid };
    if (fishType) q.fishType = fishType;
    if (client) q.clientName = new RegExp(client, 'i');
    if (settled === 'true') q.settled = true;
    if (settled === 'false') q.settled = false;
    const sales = await Sale.find(q).sort({ date:-1, createdAt:-1 });
    res.json(sales);
  }catch(e){ res.status(500).json({ error:e.message }); }
});

// Payer une partie (inchangé, contient déjà la compensation)
app.patch('/api/sales/:id/pay', auth, async (req,res)=>{
  const session = await mongoose.startSession();
  session.startTransaction();
  try{
    const { amount } = req.body;
    const paymentAmount = Math.max(0, Number(amount||0));

    // 1. Trouver la vente initiale
    const sale = await Sale.findOne({ _id:req.params.id, owner:req.user.uid }).session(session);
    if(!sale) { await session.abortTransaction(); return res.status(404).json({ error:'Vente introuvable' }); }
    
    // Si aucun montant n'est fourni, ne rien faire
    if (paymentAmount === 0) {
        await session.commitTransaction();
        return res.json(sale);
    }
    
    // Augmenter le paiement de la vente initiale
    sale.payment += paymentAmount;
    await sale.validate();
    
    // Sauvegarde de l'état de la vente (potentiellement avec le nouveau crédit)
    await sale.save({ session }); 

    // Déclenchement de la compensation globale
    await compensateClientDebts(sale.clientName, req.user.uid, session);
    
    await session.commitTransaction();
    // Recharger la vente initiale pour s'assurer que le dernier état est renvoyé
    const updatedSale = await Sale.findById(sale._id);
    res.json(updatedSale);
  }catch(e){ 
    await session.abortTransaction();
    res.status(400).json({ error:e.message }); 
  }finally {
    session.endSession();
  }
});


// Rembourser une partie du crédit client (inchangé, contient déjà la compensation)
app.patch('/api/sales/:id/refund', auth, async (req,res)=>{
  const session = await mongoose.startSession();
  session.startTransaction();
  try{
    const { amount } = req.body;
    const sale = await Sale.findOne({ _id:req.params.id, owner:req.user.uid }).session(session);
    if(!sale) { await session.abortTransaction(); return res.status(404).json({ error:'Vente introuvable' }); }
    
    const dec = Math.max(0, Number(amount||0));
    
    // Le montant remboursable est le surplus payé (crédit disponible)
    const maxRefund = Math.abs(sale.balance); // Utiliser Math.abs(sale.balance) pour le crédit disponible
    
    // Diminuer le paiement total enregistré de la vente, plafonné au crédit max
    sale.payment -= Math.min(dec, maxRefund);
    
    await sale.validate();
    await sale.save({ session });
    
    // Appel à la compensation après ajustement du crédit
    await compensateClientDebts(sale.clientName, req.user.uid, session);

    await session.commitTransaction();
    
    // Recharger pour renvoyer le dernier état
    const updatedSale = await Sale.findById(sale._id); 
    res.json(updatedSale);
  }catch(e){ 
    await session.abortTransaction();
    res.status(400).json({ error:e.message }); 
  }finally {
    session.endSession();
  }
});

// Solder tout (inchangé, contient déjà la compensation)
app.patch('/api/sales/:id/settle', auth, async (req,res)=>{
  const session = await mongoose.startSession();
  session.startTransaction();
  try{
    const sale = await Sale.findOne({ _id:req.params.id, owner:req.user.uid }).session(session);
    if(!sale) { await session.abortTransaction(); return res.status(404).json({ error:'Vente introuvable' }); }
    
    // Ajouter le montant exact qui manque pour atteindre amount, sans surplus
    sale.payment += Math.max(0, sale.amount - sale.payment);
    
    await sale.validate();
    await sale.save({ session });

    // Appel à la compensation après règlement
    await compensateClientDebts(sale.clientName, req.user.uid, session);
    
    await session.commitTransaction();
    
    // Recharger pour renvoyer le dernier état
    const updatedSale = await Sale.findById(sale._id); 
    res.json(updatedSale);
  }catch(e){ 
    await session.abortTransaction();
    res.status(500).json({ error:e.message }); 
  }finally {
    session.endSession();
  }
});

// Livrer une quantité (inchangé)
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

// Dashboard dettes clients (inchangé)
app.get('/api/dashboard/debts', auth, async (req,res)=>{
  try{
    const agg = await Sale.aggregate([
      { $match: { owner: new mongoose.Types.ObjectId(req.user.uid), balance: { $gt: 0 } } },
      { $group: { _id:"$clientName", totalDebt:{ $sum:"$balance" }, count:{ $sum:1 } } },
      { $project: { clientName:"$_id", totalDebt:{ $round:["$totalDebt",2] }, count:1, _id:0 } },
      { $sort: { totalDebt:-1 } }
    ]);
    res.json(agg);
  }catch(e){ res.status(500).json({ error:e.message }); }
});

// Dashboard crédits clients (inchangé)
app.get('/api/dashboard/credits', auth, async (req,res)=>{
  try{
    const agg = await Sale.aggregate([
      { $match: { owner: new mongoose.Types.ObjectId(req.user.uid), balance: { $lt: 0 } } },
      { $group: { _id:"$clientName", totalCredit:{ $sum:"$balance" }, count:{ $sum:1 } } },
      { $project: { clientName:"$_id", totalCredit:{ $abs:"$totalCredit" }, count:1, _id:0 } }, 
      { $sort: { totalCredit:-1 } }
    ]);
    res.json(agg);
  }catch(e){ res.status(500).json({ error:e.message }); }
});

// NOUVELLE ROUTE : Liste de tous les clients pour le bilan (inchangé)
app.get('/api/clients', auth, async (req, res) => {
  try {
    const clients = await Sale.distinct('clientName', { owner: req.user.uid });
    res.json(clients.sort());
  } catch(e) {
    res.status(500).json({ error: e.message });
  }
});


// NOUVELLE ROUTE : Export Excel du bilan client (ou de tous) (inchangé)
app.get('/api/exports/client-report.xlsx', auth, async (req, res) => {
  try {
    const { clientName } = req.query;
    const q = { owner: req.user.uid };
    
    if (clientName && clientName !== 'all') {
        q.clientName = clientName;
    }

    const sales = await Sale.find(q).sort({ clientName: 1, date: -1, createdAt: -1 });

    const wb = new ExcelJS.Workbook();
    const ws = wb.addWorksheet(clientName && clientName !== 'all' ? `Bilan_${clientName}` : 'Bilan_Global');

    ws.columns = [
      { header: 'Client', key: 'clientName', width: 25 },
      { header: 'Date', key: 'date', width: 15 },
      { header: 'Poisson', key: 'fishType', width: 12 },
      { header: 'Quantité (Kg)', key: 'quantity', width: 15 },
      { header: 'Prix Unitaire', key: 'unitPrice', width: 14 },
      { header: 'Montant Total', key: 'amount', width: 15 },
      { header: 'Règlement Cumulé', key: 'payment', width: 18 },
      { header: 'Balance', key: 'balance', width: 15 },
      { header: 'Type de Solde', key: 'balanceType', width: 15 },
      { header: 'Livré (Kg)', key: 'delivered', width: 12 },
      { header: 'Statut', key: 'settled', width: 10 },
      { header: 'Observation', key: 'observation', width: 30 },
    ];

    sales.forEach(s => {
      ws.addRow({
        clientName: s.clientName,
        date: new Date(s.date).toISOString().slice(0, 10),
        fishType: s.fishType,
        quantity: s.quantity,
        unitPrice: s.unitPrice,
        amount: s.amount,
        payment: s.payment,
        balance: s.balance,
        balanceType: s.balance > 0 ? 'Dette Client' : (s.balance < 0 ? 'Crédit Entreprise' : 'Soldé'),
        delivered: s.delivered,
        settled: s.settled?'Oui':'Non',
        observation: s.observation||''
      });
    });

    res.setHeader('Content-Type','application/vnd.openxmlformats-officedocument.spreadsheetml.sheet');
    res.setHeader('Content-Disposition',`attachment; filename="${clientName && clientName !== 'all' ? `bilan_${clientName.replace(/\s/g, '_')}` : 'bilan_global'}.xlsx"`);
    await wb.xlsx.write(res);
    res.end();

  } catch (e) {
    res.status(500).json({ error: e.message });
  }
});


// Sommaire (inchangé)
app.get('/api/summary', auth, async (req,res)=>{
  try{
    const [totals] = await Sale.aggregate([
      { $match: { owner: new mongoose.Types.ObjectId(req.user.uid) } },
      { $group: { _id:null, totalAmount:{ $sum:"$amount" }, totalPayment:{ $sum:"$payment" }, totalBalance:{ $sum:"$balance" } } }
    ]);
    const byFish = await Sale.aggregate([
      { $match: { owner: new mongoose.Types.ObjectId(req.user.uid) } },
      { $group: { _id:"$fishType", amount:{ $sum:"$amount" }, payment:{ $sum:"$payment" }, balance:{ $sum:"$balance" } } },
      { $project: { fishType:"$_id", amount:1, payment:1, balance:1, _id:0 } }
    ]);

    const defaultTotals = { totalAmount: 0, totalPayment: 0, totalBalance: 0 };
    const finalTotals = totals || defaultTotals;

    res.json({
      totalAmount: Number(finalTotals.totalAmount.toFixed(2)), 
      totalPayment: Number(finalTotals.totalPayment.toFixed(2)),
      totalBalance: Number(finalTotals.totalBalance.toFixed(2)),
      byFish: byFish.map(f => ({
        ...f,
        amount: Number(f.amount.toFixed(2)),
        payment: Number(f.payment.toFixed(2)),
        balance: Number(f.balance.toFixed(2)),
      }))
    });
  }catch(e){ res.status(500).json({ error:e.message }); }
});

// Export Excel général (inchangé)
app.get('/api/exports/sales.xlsx', auth, async (req,res)=>{
  try{
    const sales = await Sale.find({ owner:req.user.uid }).sort({ date:-1, createdAt:-1 });
    const wb = new ExcelJS.Workbook();
    const ws = wb.addWorksheet('Historique ventes');

    ws.columns = [
      { header:'Date', key:'date', width:15 },
      { header:'Client', key:'clientName', width:25 },
      { header:'Poisson', key:'fishType', width:12 },
      { header:'Quantité', key:'quantity', width:12 },
      { header:'Livré', key:'delivered', width:12 },
      { header:'Reste à livrer', key:'remaining', width:14 },
      { header:'Prix Unitaire', key:'unitPrice', width:14 },
      { header:'Montant', key:'amount', width:12 },
      { header:'Règlement', key:'payment', width:12 },
      { header:'Solde', key:'balance', width:12 },
      { header:'Soldé', key:'settled', width:10 },
      { header:'Observation', key:'observation', width:30 },
    ];

    sales.forEach(s=>{
      const remaining = Math.max(0, s.quantity - s.delivered);
      ws.addRow({
        date:new Date(s.date).toISOString().slice(0,10),
        clientName:s.clientName,
        fishType:s.fishType,
        quantity:s.quantity,
        delivered:s.delivered,
        remaining,
        unitPrice:s.unitPrice,
        amount:s.amount,
        payment:s.payment,
        balance:s.balance,
        settled:s.settled?'Oui':'Non',
        observation:s.observation||''
      });
    });

    res.setHeader('Content-Type','application/vnd.openxmlformats-officedocument.spreadsheetml.sheet');
    res.setHeader('Content-Disposition','attachment; filename="historique_ventes.xlsx"');
    await wb.xlsx.write(res);
    res.end();
  }catch(e){ res.status(500).json({ error:e.message }); }
});

/* ---------------- Lancement ---------------- */
app.listen(PORT, ()=>console.log(`API running on http://localhost:${PORT}`));
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
  origin: true, // en prod, mets l'URL de ton front (ex: 'https://ton-front.com')
  methods: ['GET','POST','PATCH','PUT','DELETE','OPTIONS'],
  allowedHeaders: ['Content-Type','Authorization'],
  credentials: true,
};
app.use(cors(corsOptions));

/* --- Préflight universel (sans app.options('*', ...)) --- */
app.use((req, res, next) => {
  if (req.method === 'OPTIONS') {
    // Laisser CORS ajouter les headers, puis répondre 204
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

/* ---------------- Health check (évite 404 sur "/") ---------------- */
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
  fishType:    { type: String, enum: ['tilapia', 'pangasius'], required: true, index: true },
  quantity:    { type: Number, required: true, min: 0 }, // commandé
  delivered:   { type: Number, default: 0, min: 0 },     // cumulé livré
  unitPrice:   { type: Number, required: true, min: 0 },
  amount:      { type: Number, required: true, min: 0 }, // quantity * unitPrice
  payment:     { type: Number, default: 0, min: 0 },     // cumulé payé
  // 🚨 MODIFICATION : balance peut être négatif (crédit client)
  balance:     { type: Number, required: true },
  observation: { type: String, default: '' },
  settled:     { type: Boolean, default: false },
}, { timestamps: true });

saleSchema.pre('validate', function(next){
  this.delivered = Math.max(0, Math.min(this.delivered || 0, this.quantity || 0));
  this.amount = (Number(this.quantity || 0) * Number(this.unitPrice || 0));
  const rawBalance = this.amount - Number(this.payment || 0);
  
  // 🚨 MODIFICATION : Enlever Math.max(0, ...) pour permettre les soldes négatifs (crédits)
  this.balance = Number(rawBalance.toFixed(2));
  
  // 🚨 MODIFICATION : Settled si la balance est inférieure ou égale à zéro
  this.settled = (this.amount > 0 && this.balance <= 0);
  next();
});

const User = mongoose.model('User', userSchema);
const Sale = mongoose.model('Sale', saleSchema);

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

/* ---------------- Routes AUTH ---------------- */
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
// Créer une vente
app.post('/api/sales', auth, async (req,res)=>{
  try{
    const { date, clientName, fishType, quantity, delivered=0, unitPrice, payment=0, observation='' } = req.body;
    const sale = await Sale.create({
      owner: req.user.uid,
      date: date ? new Date(date) : new Date(),
      clientName, fishType,
      quantity:Number(quantity), delivered:Number(delivered),
      unitPrice:Number(unitPrice),
      payment:Number(payment),
      observation
    });
    res.json(sale);
  }catch(e){ res.status(400).json({ error:e.message }); }
});

// Lister ventes
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

// Payer une partie
app.patch('/api/sales/:id/pay', auth, async (req,res)=>{
  try{
    const { amount } = req.body;
    const sale = await Sale.findOne({ _id:req.params.id, owner:req.user.uid });
    if(!sale) return res.status(404).json({ error:'Vente introuvable' });
    const inc = Math.max(0, Number(amount||0));
    
    // 🚨 MODIFICATION : Ajouter le montant directement, même s'il dépasse le solde
    sale.payment += inc;
    
    // L'ancienne logique de plafonnement (maxAdd) est supprimée
    
    await sale.validate();
    await sale.save();
    res.json(sale);
  }catch(e){ res.status(400).json({ error:e.message }); }
});

// Solder tout
app.patch('/api/sales/:id/settle', auth, async (req,res)=>{
  try{
    const sale = await Sale.findOne({ _id:req.params.id, owner:req.user.uid });
    if(!sale) return res.status(404).json({ error:'Vente introuvable' });
    
    // 🚨 MODIFICATION : Ajouter le montant exact qui manque pour atteindre le montant de la vente
    sale.payment += Math.max(0, sale.amount - sale.payment);
    
    // L'ancienne logique (sale.payment = sale.amount) est remplacée
    
    await sale.validate(); // La validation va ajuster settled à true et balance à 0 (ou négatif si surplus)
    await sale.save();
    res.json(sale);
  }catch(e){ res.status(500).json({ error:e.message }); }
});

// Livrer une quantité
app.patch('/api/sales/:id/deliver', auth, async (req,res)=>{
  try{
    const { qty } = req.body;
    const sale = await Sale.findOne({ _id:req.params.id, owner:req.user.uid });
    if(!sale) return res.status(404).json({ error:'Vente introuvable' });
    const inc = Math.max(0, Number(qty||0));
    const remaining = Math.max(0, sale.quantity - sale.delivered);
    // Logique conservée car la livraison ne doit jamais dépasser la quantité commandée
    sale.delivered += Math.min(inc, remaining);
    await sale.validate();
    await sale.save();
    res.json(sale);
  }catch(e){ res.status(400).json({ error:e.message }); }
});

// Dashboard dettes clients (client doit à l'entreprise, balance > 0)
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

// 🚨 NOUVELLE ROUTE : Dashboard crédits clients (entreprise doit au client, balance < 0)
app.get('/api/dashboard/credits', auth, async (req,res)=>{
  try{
    const agg = await Sale.aggregate([
      { $match: { owner: new mongoose.Types.ObjectId(req.user.uid), balance: { $lt: 0 } } },
      // Grouper et calculer le crédit total (somme des balances négatives)
      { $group: { _id:"$clientName", totalCredit:{ $sum:"$balance" }, count:{ $sum:1 } } },
      // Utiliser $abs pour afficher un montant positif représentant le crédit
      { $project: { clientName:"$_id", totalCredit:{ $abs:"$totalCredit" }, count:1, _id:0 } }, 
      { $sort: { totalCredit:-1 } }
    ]);
    res.json(agg);
  }catch(e){ res.status(500).json({ error:e.message }); }
});

// Sommaire
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
// Export Excel
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
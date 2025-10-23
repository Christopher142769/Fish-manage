// server.js
// Démarrage : npm init -y && npm i express mongoose cors bcrypt jsonwebtoken exceljs morgan
// Lancez : node server.js
// MONGO_URI : mongodb://localhost:27017/poisson

const express = require('express');
const mongoose = require('mongoose');
const cors = require('cors');
const bcrypt = require('bcrypt');
const jwt = require('jsonwebtoken');
const ExcelJS = require('exceljs');
const morgan = require('morgan');

const app = express();
app.use(cors());
app.use(express.json({ limit: '1mb' }));
app.use(morgan('tiny'));

const JWT_SECRET = process.env.JWT_SECRET || 'change_this_secret';
const MONGO_URI = process.env.MONGO_URI || 'mongodb://localhost:27017/poisson';
const PORT = process.env.PORT || 4000;

mongoose.connect(MONGO_URI).then(()=>console.log('MongoDB connected')).catch(err=>{console.error(err);process.exit(1);});

// ======= MODELES =======
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
  amount:      { type: Number, required: true, min: 0 }, // calculé = quantity * unitPrice
  payment:     { type: Number, default: 0, min: 0 },     // cumulé payé
  balance:     { type: Number, required: true, min: 0 }, // calculé = max(amount - payment, 0)
  observation: { type: String, default: '' },
  settled:     { type: Boolean, default: false },
}, { timestamps: true });

saleSchema.pre('validate', function(next){
  // clamp delivered <= quantity
  this.delivered = Math.max(0, Math.min(this.delivered || 0, this.quantity || 0));
  this.amount = (Number(this.quantity || 0) * Number(this.unitPrice || 0));
  const rawBalance = this.amount - Number(this.payment || 0);
  this.balance = Math.max(0, Number(rawBalance.toFixed(2)));
  this.settled = (this.amount > 0 && this.balance === 0);
  next();
});

const User = mongoose.model('User', userSchema);
const Sale = mongoose.model('Sale', saleSchema);

// ======= AUTH MIDDLEWARE =======
function auth(req,res,next){
  const header = req.headers.authorization || '';
  const token = header.startsWith('Bearer ')? header.slice(7): null;
  if(!token) return res.status(401).json({ error:'Token manquant' });
  try{
    req.user = jwt.verify(token, JWT_SECRET);
    next();
  }catch(e){ return res.status(401).json({ error:'Token invalide' }); }
}

// ======= ROUTES AUTH =======
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

// ======= ROUTES VENTES =======

// Créer une vente (peut inclure une quantité déjà livrée)
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

// Payer une partie (ou tout) du solde
app.patch('/api/sales/:id/pay', auth, async (req,res)=>{
  try{
    const { amount } = req.body; // montant à ajouter au paiement
    const sale = await Sale.findOne({ _id:req.params.id, owner:req.user.uid });
    if(!sale) return res.status(404).json({ error:'Vente introuvable' });
    const inc = Math.max(0, Number(amount||0));
    const maxAdd = Math.max(0, sale.amount - sale.payment);
    sale.payment += Math.min(inc, maxAdd);
    await sale.validate();
    await sale.save();
    res.json(sale);
  }catch(e){ res.status(400).json({ error:e.message }); }
});

// Payer tout le solde (solder)
app.patch('/api/sales/:id/settle', auth, async (req,res)=>{
  try{
    const sale = await Sale.findOne({ _id:req.params.id, owner:req.user.uid });
    if(!sale) return res.status(404).json({ error:'Vente introuvable' });
    sale.payment = sale.amount;
    await sale.validate();
    sale.settled = true;
    sale.balance = 0;
    await sale.save();
    res.json(sale);
  }catch(e){ res.status(500).json({ error:e.message }); }
});

// Livrer une quantité (partielle ou totale restante)
app.patch('/api/sales/:id/deliver', auth, async (req,res)=>{
  try{
    const { qty } = req.body; // quantité à livrer en plus
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

// Dashboard dettes par client
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
    res.json({
      totalAmount:Number((totals?.totalAmount||0).toFixed(2)),
      totalPayment:Number((totals?.totalPayment||0).toFixed(2)),
      totalBalance:Number((totals?.totalBalance||0).toFixed(2)),
      byFish
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

app.listen(PORT, ()=>console.log(`API running on http://localhost:${PORT}`));

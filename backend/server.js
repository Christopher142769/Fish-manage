// server.js (MIS À JOUR AVEC EXPORT BILAN CLIENTS)
require('dotenv').config(); 

const express = require('express');
const mongoose = require('mongoose');
const cors = require('cors');
const bcrypt = require('bcrypt');
const jwt =require('jsonwebtoken');
const ExcelJS = require('exceljs'); // Nécessaire pour l'export Excel
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
const SUPER_ADMIN_PASS  = process.env.SUPER_ADMIN_PASS  || 'superadmin123';
const SUPER_ADMIN_UID   = 'super_admin_fixed_id';


mongoose.connect(MONGO_URI, { dbName: DB_NAME })
    .then(() => console.log('Connecté à MongoDB'))
    .catch(err => console.error('Erreur de connexion MongoDB:', err));


/* ---------------- Schémas Mongoose ---------------- */
const UserSchema = new mongoose.Schema({
    companyName: { type: String, required: true },
    email: { type: String, required: true, unique: true },
    password: { type: String, required: true },
    isAdmin: { type: Boolean, default: false }, // Pourrait être utilisé pour distinguer un admin d'un utilisateur normal
    isSuperAdmin: { type: Boolean, default: false },
    creationDate: { type: Date, default: Date.now },
});

const FishSchema = new mongoose.Schema({
    owner: { type: mongoose.Schema.Types.ObjectId, required: true, index: true },
    fishType: { type: String, required: true, enum: ['tilapia', 'pangasius'] },
    unitPrice: { type: Number, required: true },
    stock: { type: Number, required: true, default: 0 },
    creationDate: { type: Date, default: Date.now },
});

const SaleSchema = new mongoose.Schema({
    owner: { type: mongoose.Schema.Types.ObjectId, required: true, index: true },
    fishType: { type: String, required: true, enum: ['tilapia', 'pangasius'] },
    date: { type: Date, required: true, index: true },
    clientName: { type: String, required: true, index: true },
    quantity: { type: Number, required: true }, // Quantité totale vendue
    delivered: { type: Number, required: true, default: 0 }, // Quantité livrée
    unitPrice: { type: Number, required: true },
    amount: { type: Number, required: true }, // Montant total de la vente (Q * P.U)
    payment: { type: Number, required: true, default: 0 }, // Montant total payé
    balance: { type: Number, required: true }, // Solde (Montant - Règlement)
    settled: { type: Boolean, default: false, index: true }, // Vente totalement soldée (balance = 0)
    observation: { type: String },
    creationDate: { type: Date, default: Date.now },
});

// Post-save hook pour mettre à jour le stock et le statut 'settled'
SaleSchema.post('save', async function() {
    // 1. Mise à jour du statut 'settled' si la balance est à 0
    if (this.balance === 0 && !this.settled) {
        await Sale.updateOne({ _id: this._id }, { $set: { settled: true } });
    } else if (this.balance !== 0 && this.settled) {
         await Sale.updateOne({ _id: this._id }, { $set: { settled: false } });
    }

    // 2. Mise à jour du stock (non implémentée ici mais ce serait l'endroit)
});


// Index pour une recherche rapide
SaleSchema.index({ clientName: 1, fishType: 1, date: -1 });

const User = mongoose.model('User', UserSchema);
const Fish = mongoose.model('Fish', FishSchema);
const Sale = mongoose.model('Sale', SaleSchema);


/* ---------------- Middleware d'Authentification ---------------- */
const auth = (req, res, next) => {
    try {
        const token = req.headers.authorization.split(' ')[1];
        const decodedToken = jwt.verify(token, JWT_SECRET);
        req.user = { uid: decodedToken.uid, companyName: decodedToken.companyName, isAdmin: decodedToken.isAdmin, isSuperAdmin: decodedToken.isSuperAdmin };
        next();
    } catch (e) {
        return res.status(401).json({ error: 'Token invalide ou manquant.' });
    }
};

const superAdminAuth = (req, res, next) => {
    auth(req, res, () => {
        if (req.user.isSuperAdmin) {
            next();
        } else {
            return res.status(403).json({ error: 'Accès réservé au Super Admin.' });
        }
    });
};


/* ---------------- HELPER: Création du Super Admin au démarrage ---------------- */
async function createSuperAdmin() {
    try {
        const superAdminExists = await User.findOne({ email: SUPER_ADMIN_EMAIL });
        if (!superAdminExists) {
            const hashedPassword = await bcrypt.hash(SUPER_ADMIN_PASS, 10);
            await User.create({
                _id: SUPER_ADMIN_UID, // Utiliser un ID fixe
                companyName: 'SuperAdmin Company',
                email: SUPER_ADMIN_EMAIL,
                password: hashedPassword,
                isSuperAdmin: true,
                isAdmin: true, // Un Super Admin est aussi un Admin
            });
            console.log('Compte Super Admin créé avec succès.');
        }
    } catch (e) {
        // Ignorer l'erreur si l'ID fixe existe déjà
        if (e.code !== 11000) { // Code 11000 est pour la clé dupliquée (ID ou email)
            console.error('Erreur lors de la création du Super Admin:', e);
        }
    }
}
createSuperAdmin();


/* #####################################################################################
 * #####################################################################################
 * ###                                                                               ###
 * ###                           ROUTES SUPER ADMIN                                  ###
 * ###                                                                               ###
 * #####################################################################################
 * ##################################################################################### */

// ... (Routes Super Admin inchangées)

/* ---------------- Route Super Admin Login ---------------- */
app.post('/api/admin-login', async (req, res) => {
    try {
        const { email, password } = req.body;
        
        // Gérer le cas du Super Admin
        if (email === SUPER_ADMIN_EMAIL) {
            const isPasswordValid = await bcrypt.compare(password, (await User.findById(SUPER_ADMIN_UID)).password);
            if (!isPasswordValid) return res.status(401).json({ error: 'Identifiants invalides.' });

            const token = jwt.sign({ uid: SUPER_ADMIN_UID, companyName: 'SuperAdmin Company', isAdmin: true, isSuperAdmin: true }, JWT_SECRET, { expiresIn: '24h' });
            return res.json({ token, companyName: 'SuperAdmin Company', isAdmin: true, isSuperAdmin: true });
        }

        // Gérer le cas des Admins normaux
        const user = await User.findOne({ email });
        if (!user || !user.isAdmin) return res.status(401).json({ error: 'Identifiants invalides ou non-admin.' });
        
        const isPasswordValid = await bcrypt.compare(password, user.password);
        if (!isPasswordValid) return res.status(401).json({ error: 'Identifiants invalides.' });

        const token = jwt.sign({ uid: user._id, companyName: user.companyName, isAdmin: true, isSuperAdmin: false }, JWT_SECRET, { expiresIn: '24h' });
        res.json({ token, companyName: user.companyName, isAdmin: true, isSuperAdmin: false });

    } catch (e) {
        res.status(500).json({ error: e.message });
    }
});


/* ---------------- Route Super Admin: Liste des Utilisateurs (Owners) ---------------- */
app.get('/api/admin/users', superAdminAuth, async (req, res) => {
    try {
        const users = await User.find({ isSuperAdmin: false }, '-password').sort({ creationDate: -1 });
        res.json(users);
    } catch (e) {
        res.status(500).json({ error: e.message });
    }
});

/* ---------------- Route Super Admin: Création d'un nouvel Utilisateur (Owner) ---------------- */
app.post('/api/admin/users', superAdminAuth, async (req, res) => {
    try {
        const { companyName, email, password } = req.body;
        const hashedPassword = await bcrypt.hash(password, 10);
        const newUser = new User({ companyName, email, password: hashedPassword, isAdmin: true }); // Crée un nouvel Owner/Admin
        await newUser.save();

        // Crée des prix par défaut pour cet Owner
        const ownerId = newUser._id;
        await Fish.create([
            { owner: ownerId, fishType: 'tilapia', unitPrice: 1500, stock: 0 },
            { owner: ownerId, fishType: 'pangasius', unitPrice: 1000, stock: 0 },
        ]);

        res.status(201).json({ message: 'Owner et prix par défaut créés avec succès.' });
    } catch (e) {
        if (e.code === 11000) return res.status(400).json({ error: 'Cet email est déjà utilisé.' });
        res.status(500).json({ error: e.message });
    }
});


/* ---------------- Route Super Admin: Suppression d'un Utilisateur (Owner) ---------------- */
app.delete('/api/admin/users/:userId', superAdminAuth, async (req, res) => {
    try {
        const userId = req.params.userId;
        const user = await User.findById(userId);
        if (!user || user.isSuperAdmin) return res.status(404).json({ error: 'Utilisateur non trouvé ou non autorisé.' });

        // Supprimer toutes les données associées (Fish et Sales)
        await Fish.deleteMany({ owner: userId });
        await Sale.deleteMany({ owner: userId });
        await User.deleteOne({ _id: userId });

        res.json({ message: 'Utilisateur et toutes les données associées supprimés.' });
    } catch (e) {
        res.status(500).json({ error: e.message });
    }
});


/* #####################################################################################
 * #####################################################################################
 * ###                                                                               ###
 * ###                           ROUTES UTILISATEUR NORMAL                           ###
 * ###                                                                               ###
 * #####################################################################################
 * ##################################################################################### */


/* ---------------- Route Login ---------------- */
app.post('/api/login', async (req, res) => {
    try {
        const { email, password } = req.body;
        const user = await User.findOne({ email, isSuperAdmin: false });

        if (!user) return res.status(401).json({ error: 'Identifiants invalides.' });

        const isPasswordValid = await bcrypt.compare(password, user.password);
        if (!isPasswordValid) return res.status(401).json({ error: 'Identifiants invalides.' });

        const token = jwt.sign({ uid: user._id, companyName: user.companyName, isAdmin: user.isAdmin, isSuperAdmin: user.isSuperAdmin }, JWT_SECRET, { expiresIn: '24h' });
        res.json({ token, companyName: user.companyName, isAdmin: user.isAdmin, isSuperAdmin: user.isSuperAdmin });

    } catch (e) {
        res.status(500).json({ error: e.message });
    }
});

/* ---------------- Route Get Fish Prices ---------------- */
app.get('/api/fish', auth, async (req, res) => {
    try {
        const ownerId = req.user.uid;
        const fish = await Fish.find({ owner: ownerId });
        res.json(fish);
    } catch (e) {
        res.status(500).json({ error: e.message });
    }
});

/* ---------------- Route Update Fish Prices ---------------- */
app.patch('/api/fish/:id', auth, async (req, res) => {
    try {
        const fishId = req.params.id;
        const ownerId = req.user.uid;
        const { unitPrice } = req.body;

        if (unitPrice <= 0) return res.status(400).json({ error: 'Le prix unitaire doit être positif.' });

        const fish = await Fish.findOneAndUpdate(
            { _id: fishId, owner: ownerId },
            { $set: { unitPrice } },
            { new: true }
        );

        if (!fish) return res.status(404).json({ error: 'Poisson non trouvé.' });

        res.json(fish);
    } catch (e) {
        res.status(500).json({ error: e.message });
    }
});


/* ---------------- Route Get Sales ---------------- */
app.get('/api/sales', auth, async (req, res) => {
    try {
        const ownerId = req.user.uid;
        // La pagination et le filtre par client sont gérés par le front-end via les paramètres de requête
        const { clientName, page = 1, limit = 10, fishType } = req.query;
        const skip = (parseInt(page) - 1) * parseInt(limit);
        const query = { owner: ownerId };

        if (clientName) query.clientName = new RegExp(clientName, 'i'); // Recherche insensible à la casse
        if (fishType) query.fishType = fishType;
        
        // Sortir les ventes les plus récentes en premier
        const sales = await Sale.find(query).sort({ date: -1, creationDate: -1 }).skip(skip).limit(parseInt(limit));
        const totalCount = await Sale.countDocuments(query);
        const totalPages = Math.ceil(totalCount / parseInt(limit));
        
        res.json({ sales, totalCount, totalPages });
    } catch (e) {
        res.status(500).json({ error: e.message });
    }
});

/* ---------------- Route Get Sale by ID ---------------- */
app.get('/api/sales/:id', auth, async (req, res) => {
    try {
        const ownerId = req.user.uid;
        const saleId = req.params.id;
        const sale = await Sale.findOne({ _id: saleId, owner: ownerId });

        if (!sale) return res.status(404).json({ error: 'Vente non trouvée.' });

        res.json(sale);
    } catch (e) {
        res.status(500).json({ error: e.message });
    }
});


/* ---------------- Route Add Sale ---------------- */
app.post('/api/sales', auth, async (req, res) => {
    try {
        const ownerId = req.user.uid;
        let { fishType, date, clientName, quantity, delivered, unitPrice, payment, observation } = req.body;

        quantity = Number(quantity);
        delivered = Number(delivered);
        unitPrice = Number(unitPrice);
        payment = Number(payment);
        
        if (quantity <= 0 || unitPrice <= 0) {
            return res.status(400).json({ error: 'La quantité et le prix unitaire doivent être positifs.' });
        }
        if (delivered > quantity) {
            return res.status(400).json({ error: 'La quantité livrée ne peut pas dépasser la quantité vendue.' });
        }

        const amount = quantity * unitPrice;
        const balance = amount - payment;
        const settled = balance === 0;

        const newSale = new Sale({
            owner: ownerId, fishType, date: new Date(date), clientName, quantity, delivered, unitPrice, amount, payment, balance, settled, observation
        });

        await newSale.save();
        res.status(201).json(newSale);

    } catch (e) {
        console.error("Erreur ajout de vente:", e);
        res.status(500).json({ error: e.message });
    }
});


/* ---------------- Route Update Sale ---------------- */
app.patch('/api/sales/:id', auth, async (req, res) => {
    try {
        const ownerId = req.user.uid;
        const saleId = req.params.id;
        let update = req.body;
        
        // Recalculer balance et settled si amount, payment, quantity ou delivered sont modifiés
        const existingSale = await Sale.findOne({ _id: saleId, owner: ownerId });
        if (!existingSale) return res.status(404).json({ error: 'Vente non trouvée.' });

        // Appliquer les mises à jour et recalculer
        const quantity = Number(update.quantity || existingSale.quantity);
        const unitPrice = Number(update.unitPrice || existingSale.unitPrice);
        const payment = Number(update.payment || existingSale.payment);
        const delivered = Number(update.delivered || existingSale.delivered);

        if (quantity <= 0 || unitPrice <= 0) return res.status(400).json({ error: 'La quantité et le prix unitaire doivent être positifs.' });
        if (delivered > quantity) return res.status(400).json({ error: 'La quantité livrée ne peut pas dépasser la quantité vendue.' });

        update.amount = quantity * unitPrice;
        update.balance = update.amount - payment;
        update.settled = update.balance === 0;
        update.quantity = quantity; // S'assurer que les nombres sont stockés comme tels
        update.unitPrice = unitPrice;
        update.payment = payment;
        update.delivered = delivered;


        // Mise à jour finale
        const updatedSale = await Sale.findOneAndUpdate(
            { _id: saleId, owner: ownerId },
            { $set: update },
            { new: true, runValidators: true }
        );

        if (!updatedSale) return res.status(404).json({ error: 'Vente non trouvée.' });

        res.json(updatedSale);

    } catch (e) {
        console.error("Erreur mise à jour de vente:", e);
        res.status(500).json({ error: e.message });
    }
});


/* ---------------- Route Delete Sale ---------------- */
app.delete('/api/sales/:id', auth, async (req, res) => {
    try {
        const ownerId = req.user.uid;
        const saleId = req.params.id;

        const result = await Sale.deleteOne({ _id: saleId, owner: ownerId });

        if (result.deletedCount === 0) return res.status(404).json({ error: 'Vente non trouvée.' });

        res.json({ message: 'Vente supprimée avec succès.' });

    } catch (e) {
        res.status(500).json({ error: e.message });
    }
});

/* ---------------- Route Liste Clients ---------------- */
app.get('/api/clients', auth, async (req, res) => {
    try {
        const ownerId = new mongoose.Types.ObjectId(req.user.uid);
        
        // Utiliser l'agrégation pour obtenir la liste unique de clients
        const clients = await Sale.aggregate([
            { $match: { owner: ownerId } },
            { $group: { _id: "$clientName", lastSaleDate: { $max: "$date" } } },
            { $sort: { _id: 1 } },
            { $project: { _id: 0, clientName: "$_id", lastSaleDate: 1 } }
        ]);

        res.json(clients);
    } catch (e) {
        res.status(500).json({ error: e.message });
    }
});


/* ---------------- Route Bilan Ventes Global (Summary) ---------------- */
app.get('/api/summary', auth, async (req, res) => {
    try {
        const ownerId = new mongoose.Types.ObjectId(req.user.uid);
        
        const summary = await Sale.aggregate([
            { $match: { owner: ownerId } },
            { $group: { 
                _id: null, // Grouper tous les documents
                totalAmount: { $sum: "$amount" },
                totalPayment: { $sum: "$payment" },
                totalBalance: { $sum: "$balance" },
                totalDebt: { $sum: { $cond: [{ $gt: ["$balance", 0] }, "$balance", 0] } },
                totalCredit: { $sum: { $cond: [{ $lt: ["$balance", 0] }, "$balance", 0] } }
            } },
            { $project: {
                _id: 0,
                totalAmount: { $round: ["$totalAmount", 2] },
                totalPayment: { $round: ["$totalPayment", 2] },
                totalBalance: { $round: ["$totalBalance", 2] },
                totalDebt: { $round: ["$totalDebt", 2] },
                totalCredit: { $round: ["$totalCredit", 2] }
            } }
        ]);
        
        const byFish = await Sale.aggregate([
            { $match: { owner: ownerId } },
            { $group: { 
                _id: "$fishType", 
                amount: { $sum: "$amount" },
                payment: { $sum: "$payment" },
                balance: { $sum: "$balance" }
            } },
            { $project: {
                _id: 0,
                fishType: "$_id",
                amount: { $round: ["$amount", 2] },
                payment: { $round: ["$payment", 2] },
                balance: { $round: ["$balance", 2] }
            } }
        ]);

        const totalSummary = summary[0] || { totalAmount: 0, totalPayment: 0, totalBalance: 0, totalDebt: 0, totalCredit: 0 };
        res.json({ ...totalSummary, byFish });
        
    } catch (e) {
        res.status(500).json({ error: e.message });
    }
});


/* ---------------- Route Export Ventes (Excel) ---------------- */
app.get('/api/exports/sales.xlsx', auth, async (req, res) => {
    try {
        const ownerId = req.user.uid;
        const sales = await Sale.find({ owner: ownerId }).sort({ date: 1 });

        const wb = new ExcelJS.Workbook();
        const ws = wb.addWorksheet('Ventes');

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
        res.setHeader('Content-Disposition',`attachment; filename="ventes_${req.user.companyName.replace(/\s/g, '_')}.xlsx"`);
        await wb.xlsx.write(res);
        res.end();

    } catch (e) {
        console.error("Erreur export ventes:", e);
        res.status(500).json({ error: e.message });
    }
});


/* ---------------- NOUVEAU: Route Export Bilan Dettes/Crédits Clients (Excel) ---------------- */
app.get('/api/exports/client-balances.xlsx', auth, async (req, res) => {
    try {
        const ownerId = new mongoose.Types.ObjectId(req.user.uid);

        // 1. Agrégation pour obtenir le total des dettes et crédits par client (solde actuel)
        const clientBalances = await Sale.aggregate([
            // Ne considérer que les transactions avec un solde non nul
            { $match: { owner: ownerId, balance: { $ne: 0 } } },
            { $group: { 
                _id: "$clientName", 
                totalBalance: { $sum: "$balance" }, // Somme des balances pour obtenir le solde net
                // Calcule le total de la dette (balances positives)
                totalDebt: { $sum: { $cond: [{ $gt: ["$balance", 0] }, "$balance", 0] } },
                // Calcule le total du crédit (balances négatives)
                totalCredit: { $sum: { $cond: [{ $lt: ["$balance", 0] }, "$balance", 0] } },
                numSalesDebt: { $sum: { $cond: [{ $gt: ["$balance", 0] }, 1, 0] } },
                numSalesCredit: { $sum: { $cond: [{ $lt: ["$balance", 0] }, 1, 0] } }
            } },
            { $project: {
                clientName: "$_id",
                totalBalance: { $round: ["$totalBalance", 2] },
                totalDebt: { $round: ["$totalDebt", 2] },
                totalCredit: { $round: [{ $abs: "$totalCredit" }, 2] }, // Montant du crédit en positif
                numSalesDebt: 1,
                numSalesCredit: 1,
            } },
            { $sort: { clientName: 1 } }
        ]);

        // Filtrer pour les dettes et les crédits pour les deux feuilles distinctes
        const debts = clientBalances.filter(c => c.totalDebt > 0);
        const credits = clientBalances.filter(c => c.totalCredit > 0);

        const wb = new ExcelJS.Workbook();
        
        // Feuille 1: Dettes Clients
        const wsDettes = wb.addWorksheet('Dettes Clients');
        wsDettes.columns = [
            { header: 'Client', key: 'clientName', width: 30 },
            { header: 'Dette Totale Due', key: 'totalDebt', width: 20 },
            { header: 'Nb Ventes en Dette', key: 'numSalesDebt', width: 20 },
            { header: 'Solde Net Client', key: 'totalBalance', width: 20 },
        ];
        debts.forEach(c => wsDettes.addRow({
            clientName: c.clientName,
            totalDebt: c.totalDebt,
            numSalesDebt: c.numSalesDebt,
            totalBalance: c.totalBalance,
        }));
        
        // Ajouter un total pour les dettes
        if (debts.length > 0) {
            const totalRow = wsDettes.addRow({});
            totalRow.getCell('A').value = 'TOTAL DES DETTES :';
            totalRow.getCell('B').value = { formula: `SUM(B2:B${wsDettes.rowCount - 1})` };
            totalRow.font = { bold: true };
            // Style Excel
            totalRow.getCell('B').numFmt = '#,##0.00';
            wsDettes.getCell('B1').numFmt = '#,##0.00'; 
            totalRow.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FFFFC7CE' } }; // Light Red fill
            totalRow.border = { top: { style: 'thick' } };
        }

        // Feuille 2: Crédits Clients
        const wsCredits = wb.addWorksheet('Crédits Dûs');
        wsCredits.columns = [
            { header: 'Client', key: 'clientName', width: 30 },
            { header: 'Crédit Total Dû (à rembourser/utiliser)', key: 'totalCredit', width: 20 },
            { header: 'Nb Ventes en Crédit', key: 'numSalesCredit', width: 20 },
            { header: 'Solde Net Client', key: 'totalBalance', width: 20 },
        ];
        credits.forEach(c => wsCredits.addRow({
            clientName: c.clientName,
            totalCredit: c.totalCredit,
            numSalesCredit: c.numSalesCredit,
            totalBalance: c.totalBalance,
        }));
        
        // Ajouter un total pour les crédits
        if (credits.length > 0) {
            const totalRow = wsCredits.addRow({});
            totalRow.getCell('A').value = 'TOTAL DES CRÉDITS DÛS :';
            totalRow.getCell('B').value = { formula: `SUM(B2:B${wsCredits.rowCount - 1})` };
            totalRow.font = { bold: true };
            // Style Excel
            totalRow.getCell('B').numFmt = '#,##0.00';
            wsCredits.getCell('B1').numFmt = '#,##0.00'; 
            totalRow.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FFC6EFCE' } }; // Light Green fill
            totalRow.border = { top: { style: 'thick' } };
        }
        
        // Application du format monétaire aux colonnes de montant
        wsDettes.getColumn('B').numFmt = '#,##0.00';
        wsDettes.getColumn('D').numFmt = '#,##0.00';
        wsCredits.getColumn('B').numFmt = '#,##0.00';
        wsCredits.getColumn('D').numFmt = '#,##0.00';
        // Style de l'en-tête
        [wsDettes, wsCredits].forEach(ws => {
            ws.getRow(1).font = { bold: true, color: { argb: 'FFFFFFFF' } };
            ws.getRow(1).fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FF4F81BD' } };
            ws.views = [{ state: 'frozen', ySplit: 1 }]; // Figer l'en-tête
        });

        res.setHeader('Content-Type','application/vnd.openxmlformats-officedocument.spreadsheetml.sheet');
        res.setHeader('Content-Disposition',`attachment; filename="bilan_solde_clients_${req.user.companyName.replace(/\s/g, '_')}_${new Date().toISOString().slice(0,10)}.xlsx"`);
        await wb.xlsx.write(res);
        res.end();

    } catch (e) {
        console.error("Erreur export solde clients:", e);
        res.status(500).json({ error: e.message });
    }
});


/* ---------------- Route par défaut ---------------- */
app.get('/', (req, res) => {
    res.send('API Fish Manager en cours d\'exécution.');
});

/* ---------------- Lancement du serveur ---------------- */
app.listen(PORT, () => {
    console.log(`Serveur démarré sur le port ${PORT}`);
});
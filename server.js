
const express = require('express');
const http = require('http');
const { Server } = require('socket.io');
const session = require('express-session');
const mongoose = require('mongoose');
const path = require('path');
const multer = require('multer');
const cloudinary = require('cloudinary').v2;
const { CloudinaryStorage } = require('multer-storage-cloudinary');

// --- KONFIGURASI CORE (HARDCODED) ---
const MONGO_URI = "mongodb+srv://dafanation1313_db_user:hAMuQVA4A1QjeUWo@cluster0.d28log3.mongodb.net/?appName=Cluster0";
const CLOUDINARY_CONFIG = {
    cloud_name: 'dnb0q2s2h',
    api_key: '838368993294916',
    api_secret: 'N9U1eFJGKjJ-A8Eo4BTtSCl720c'
};

const app = express();
const server = http.createServer(app);
const io = new Server(server);

// --- DATABASE CONNECTION ---
const connectDB = async () => {
    if (mongoose.connection.readyState >= 1) return;
    try {
        await mongoose.connect(MONGO_URI);
        console.log("Connected to Cyber Database");
    } catch (err) {
        console.error("DB Connection Error:", err);
    }
};

// --- MODELS ---
const Project = mongoose.model('Project', new mongoose.Schema({
    name: String,
    language: String,
    type: { type: String, enum: ['CODE', 'FILE'] },
    content: String,
    notes: String,
    previewUrl: String,
    likes: { type: Number, default: 0 },
    downloads: { type: Number, default: 0 },
    authorName: String,
    createdAt: { type: Date, default: Date.now }
}));

const Admin = mongoose.model('Admin', new mongoose.Schema({
    username: String,
    name: String,
    quote: String,
    hashtags: [String],
    photoUrl: String,
    role: String
}));

// --- CLOUDINARY & MULTER CONFIG ---
cloudinary.config(CLOUDINARY_CONFIG);
const storage = new CloudinaryStorage({
    cloudinary: cloudinary,
    params: { folder: 'sourcecodehub', allowed_formats: ['jpg', 'png', 'zip', 'rar', 'txt'] }
});
const upload = multer({ storage: storage });

// --- MIDDLEWARE ---
app.set('view engine', 'ejs');
app.set('views', path.join(__dirname, 'views'));
app.use(express.static(path.join(__dirname, 'public')));
app.use(express.urlencoded({ extended: true }));
app.use(express.json());
app.use(session({
    secret: 'cyber-hold-secret',
    resave: false,
    saveUninitialized: true
}));

// Auto-connect DB on every request for Serverless
app.use(async (req, res, next) => {
    await connectDB();
    next();
});

// --- PUBLIC ROUTES ---

app.get('/', async (req, res) => {
    const projects = await Project.find().sort({ createdAt: -1 });
    res.render('home', { projects });
});

app.get('/project/:id', async (req, res) => {
    const project = await Project.findById(req.params.id);
    if (!project) return res.redirect('/');
    res.render('project-detail', { project });
});

app.get('/profile', async (req, res) => {
    const totalProjects = await Project.countDocuments();
    const all = await Project.find();
    const totalLikes = all.reduce((a, b) => a + (b.likes || 0), 0);
    
    // Data Profile Hardcoded sesuai permintaan
    const adminData = {
        silver: {
            name: "SilverHold Official",
            quote: "Jangan lupa sholat walaupun kamu seorang pendosa, Allah lebih suka orang pendosa yang sering bertaubat daripada orang yang merasa suci",
            hashtags: ["#bismillahcalonustad"],
            photoUrl: "https://res.cloudinary.com/dnb0q2s2h/image/upload/v1/profiles/silver"
        },
        brayn: {
            name: "Brayn Official",
            quote: "Tidak Semua Orang Suka Kita Berkembang Pesat!",
            hashtags: ["#backenddev", "#frontenddev", "#BraynOfficial"],
            photoUrl: "https://res.cloudinary.com/dnb0q2s2h/image/upload/v1/profiles/brayn"
        }
    };
    res.render('profile', { admin: adminData.silver, owner: adminData.brayn, totalProjects, totalLikes, isOwnerSession: !!req.session.adminId });
});

// --- ADMIN SYSTEM ROUTES ---

app.get('/login', (req, res) => res.render('login'));

app.post('/login', (req, res) => {
    const { username, password } = req.body;
    // Hardcoded credentials
    if ((username === 'Silverhold' && password === 'Rian') || 
        (username === 'BraynOfficial' && password === 'Plerr321')) {
        req.session.adminId = username;
        return res.redirect('/admin/dashboard');
    }
    res.redirect('/login');
});

app.get('/admin/dashboard', async (req, res) => {
    if (!req.session.adminId) return res.redirect('/login');
    const projects = await Project.find({ authorName: req.session.adminId });
    res.render('admin-dashboard', { user: { name: req.session.adminId }, projects });
});

app.post('/admin/upload', upload.single('file'), async (req, res) => {
    if (!req.session.adminId) return res.status(403).send("Unauthorized");
    
    const { name, language, type, content, notes } = req.body;
    const previewUrl = req.file ? req.file.path : '';

    await Project.create({
        name, language, type, content, notes,
        previewUrl: previewUrl,
        authorName: req.session.adminId,
        downloads: 0, likes: 0
    });
    res.redirect('/admin/dashboard');
});

app.post('/admin/delete/:id', async (req, res) => {
    if (!req.session.adminId) return res.status(403).send("Unauthorized");
    await Project.findByIdAndDelete(req.params.id);
    res.redirect('/admin/dashboard');
});

app.get('/logout', (req, res) => {
    req.session.destroy();
    res.redirect('/');
});

// --- REAL-TIME FEATURES (SOCKET.IO) ---
io.on('connection', (socket) => {
    socket.on('send-chat', (data) => {
        io.emit('receive-chat', data);
        // Simulasi Auto-Reply
        setTimeout(() => {
            socket.emit('receive-chat', { 
                user: 'SYSTEM', 
                msg: `Pesan terkirim ke ${data.target}. Admin sedang online.` 
            });
        }, 1500);
    });

    socket.on('like-project', async (id) => {
        const p = await Project.findByIdAndUpdate(id, { $inc: { likes: 1 } }, { new: true });
        if (p) io.emit('update-stats', { id: p._id, likes: p.likes });
    });
});

// --- VERCEL EXPORT ---
const PORT = process.env.PORT || 3000;
if (process.env.NODE_ENV !== 'production') {
    server.listen(PORT, () => console.log(`Server running on http://localhost:${PORT}`));
}

module.exports = server;

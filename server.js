
const express = require('express');
const http = require('http');
const { Server } = require('socket.io');
const session = require('express-session');
const mongoose = require('mongoose');
const path = require('path');
const multer = require('multer');
const cloudinary = require('cloudinary').v2;
const { CloudinaryStorage } = require('multer-storage-cloudinary');

// ==========================================
// 1. CONFIGURATION
// ==========================================
const MONGO_URI = "mongodb+srv://dafanation1313_db_user:hAMuQVA4A1QjeUWo@cluster0.d28log3.mongodb.net/?appName=Cluster0";
const CLOUDINARY_CONFIG = {
    cloud_name: 'dnb0q2s2h',
    api_key: '838368993294916',
    api_secret: 'N9U1eFJGKjJ-A8Eo4BTtSCl720c'
};

const app = express();
const server = http.createServer(app);

// Optimasi Socket.io untuk Vercel (mencegah unhandled rejection)
const io = new Server(server, {
    cors: { origin: "*" },
    connectionStateRecovery: {}
});

// ==========================================
// 2. DATABASE CONNECTION
// ==========================================
const connectDB = async () => {
    if (mongoose.connection.readyState >= 1) return;
    try {
        await mongoose.connect(MONGO_URI);
    } catch (err) {
        console.error("MongoDB Error:", err.message);
    }
};

// ==========================================
// 3. MODELS
// ==========================================
const Project = mongoose.models.Project || mongoose.model('Project', new mongoose.Schema({
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

// ==========================================
// 4. CLOUDINARY & MULTER CONFIG
// ==========================================
cloudinary.config(CLOUDINARY_CONFIG);

const storage = new CloudinaryStorage({
    cloudinary: cloudinary,
    params: async (req, file) => {
        return {
            folder: 'sourcecodehub',
            resource_type: 'auto', // PENTING: Mendukung zip, rar, dll
            public_id: file.originalname.split('.')[0] + '-' + Date.now(),
        };
    },
});

const upload = multer({ 
    storage: storage,
    limits: { fileSize: 4 * 1024 * 1024 } // Batasi 4MB karena limit Vercel adalah 4.5MB
});

// ==========================================
// 5. MIDDLEWARES
// ==========================================
app.set('view engine', 'ejs');
app.set('views', path.join(__dirname, 'views'));
app.use(express.static(path.join(__dirname, 'public')));
app.use(express.urlencoded({ extended: true }));
app.use(express.json());
app.use(session({
    secret: 'cyber-hold-secret-key-brayn-silver',
    resave: false,
    saveUninitialized: true
}));

app.use(async (req, res, next) => {
    await connectDB();
    next();
});

// ==========================================
// 6. PUBLIC ROUTES
// ==========================================

app.get('/', async (req, res) => {
    try {
        const projects = await Project.find().sort({ createdAt: -1 });
        res.render('home', { projects });
    } catch (e) { res.send("Error"); }
});

app.get('/project/:id', async (req, res) => {
    try {
        const project = await Project.findById(req.params.id);
        res.render('project-detail', { project });
    } catch (e) { res.redirect('/'); }
});

app.get('/download/:id', async (req, res) => {
    try {
        const project = await Project.findById(req.params.id);
        if (!project) return res.send("Not Found");
        project.downloads += 1;
        await project.save();

        if (project.type === 'CODE') {
            const fileName = `${project.name.replace(/\s+/g, '_')}.txt`;
            res.setHeader('Content-disposition', 'attachment; filename=' + fileName);
            res.setHeader('Content-type', 'text/plain');
            return res.send(project.content || "");
        } 
        res.redirect(project.previewUrl);
    } catch (err) { res.status(500).send("Error"); }
});

app.get('/profile', async (req, res) => {
    const totalProjects = await Project.countDocuments();
    const adminData = {
        silver: { name: "SilverHold Official", quote: "Jangan lupa sholat...", hashtags: ["#bismillahcalonustad"], photoUrl: "https://via.placeholder.com/150" },
        brayn: { name: "Brayn Official", quote: "Tidak Semua Orang Suka...", hashtags: ["#backenddev"], photoUrl: "https://via.placeholder.com/150" }
    };
    res.render('profile', { admin: adminData.silver, owner: adminData.brayn, totalProjects, totalLikes: 0, isOwnerSession: !!req.session.adminId });
});

// ==========================================
// 7. ADMIN SYSTEM (FIXED UPLOAD LOGIC)
// ==========================================

app.get('/login', (req, res) => res.render('login'));

app.post('/login', (req, res) => {
    const { username, password } = req.body;
    if ((username === 'Silverhold' && password === 'Rian') || (username === 'BraynOfficial' && password === 'Plerr321')) {
        req.session.adminId = username;
        return res.redirect('/admin/dashboard');
    }
    res.redirect('/login');
});

app.get('/admin/dashboard', async (req, res) => {
    if (!req.session.adminId) return res.redirect('/login');
    const projects = await Project.find({ authorName: req.session.adminId }).sort({ createdAt: -1 });
    res.render('admin-dashboard', { user: { name: req.session.adminId }, projects });
});

// --- FIXED UPLOAD HANDLER ---
app.post('/admin/upload', (req, res) => {
    if (!req.session.adminId) return res.status(403).send("Unauthorized");

    // Gunakan fungsi multer secara manual untuk menangkap error Cloudinary/Size
    upload.single('file')(req, res, async (err) => {
        if (err) {
            console.error("MULTER ERROR:", err);
            return res.status(500).send(`Upload Error: ${err.message}. Pastikan file < 4MB.`);
        }

        try {
            const { name, language, type, content, notes } = req.body;
            const fileUrl = req.file ? req.file.path : '';

            await Project.create({
                name, language, type, 
                content: content || "", 
                notes: notes || "",
                previewUrl: fileUrl,
                authorName: req.session.adminId
            });

            res.redirect('/admin/dashboard');
        } catch (dbErr) {
            console.error("DB ERROR:", dbErr);
            res.status(500).send("Gagal menyimpan ke Database.");
        }
    });
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

// ==========================================
// 8. REAL-TIME
// ==========================================
io.on('connection', (socket) => {
    socket.on('send-chat', (data) => io.emit('receive-chat', data));
    socket.on('like-project', async (id) => {
        const p = await Project.findByIdAndUpdate(id, { $inc: { likes: 1 } }, { new: true });
        if (p) io.emit('update-stats', { id: p._id, likes: p.likes });
    });
});

// ==========================================
// 9. EXPORT FOR VERCEL
// ==========================================
const PORT = process.env.PORT || 3000;
if (process.env.NODE_ENV !== 'production') {
    server.listen(PORT, () => console.log(`>>> Hub Online: http://localhost:${PORT}`));
}

module.exports = server;

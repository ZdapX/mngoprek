
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
const io = new Server(server);

// ==========================================
// 2. DATABASE CONNECTION
// ==========================================
const connectDB = async () => {
    if (mongoose.connection.readyState >= 1) return;
    try {
        await mongoose.connect(MONGO_URI);
        console.log(">>> Cyber Database Linked");
    } catch (err) {
        console.error("!!! DB Connection Error:", err);
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
// 4. CLOUDINARY & MULTER (FIXED FOR ALL FILES)
// ==========================================
cloudinary.config(CLOUDINARY_CONFIG);

const storage = new CloudinaryStorage({
    cloudinary: cloudinary,
    params: { 
        folder: 'sourcecodehub',
        resource_type: 'auto', // PENTING: Agar bisa upload ZIP, RAR, PDF, dll.
        allowed_formats: ['jpg', 'png', 'jpeg', 'zip', 'rar', 'pdf', 'txt', 'html', 'js']
    }
});

const upload = multer({ 
    storage: storage,
    limits: { fileSize: 10 * 1024 * 1024 } // Limit 10MB (Vercel max body is ~4.5MB)
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
    secret: 'cyber-hold-secret-key-99',
    resave: false,
    saveUninitialized: true
}));

app.use(async (req, res, next) => {
    await connectDB();
    next();
});

// ==========================================
// 6. ROUTES
// ==========================================

app.get('/', async (req, res) => {
    const projects = await Project.find().sort({ createdAt: -1 });
    res.render('home', { projects });
});

app.get('/project/:id', async (req, res) => {
    const project = await Project.findById(req.params.id);
    if (!project) return res.redirect('/');
    res.render('project-detail', { project });
});

app.get('/download/:id', async (req, res) => {
    try {
        const project = await Project.findById(req.params.id);
        if (!project) return res.status(404).send("Not Found");

        project.downloads += 1;
        await project.save();

        if (project.type === 'CODE') {
            const fileName = `${project.name.replace(/\s+/g, '_')}_code.txt`;
            res.setHeader('Content-disposition', 'attachment; filename=' + fileName);
            res.setHeader('Content-type', 'text/plain');
            res.write(project.content || "");
            res.end();
        } else {
            if (project.previewUrl) {
                res.redirect(project.previewUrl);
            } else {
                res.status(404).send("File tidak tersedia");
            }
        }
    } catch (err) {
        res.status(500).send("Error");
    }
});

app.get('/profile', async (req, res) => {
    const totalProjects = await Project.countDocuments();
    const all = await Project.find();
    const totalLikes = all.reduce((a, b) => a + (b.likes || 0), 0);
    const adminData = {
        silver: { name: "SilverHold Official", quote: "Jangan lupa sholat...", hashtags: ["#bismillahcalonustad"], photoUrl: "https://via.placeholder.com/150" },
        brayn: { name: "Brayn Official", quote: "Tidak Semua Orang Suka...", hashtags: ["#backenddev"], photoUrl: "https://via.placeholder.com/150" }
    };
    res.render('profile', { admin: adminData.silver, owner: adminData.brayn, totalProjects, totalLikes, isOwnerSession: !!req.session.adminId });
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

// PROSES UPLOAD DENGAN TRY-CATCH KUAT
app.post('/admin/upload', upload.single('file'), async (req, res) => {
    if (!req.session.adminId) return res.status(403).send("Unauthorized");
    
    try {
        const { name, language, type, content, notes } = req.body;
        
        // Ambil URL dari Cloudinary jika ada file yang diupload
        let fileUrl = "";
        if (req.file) {
            fileUrl = req.file.path;
        }

        await Project.create({
            name, 
            language, 
            type, 
            content: content || "", 
            notes: notes || "",
            previewUrl: fileUrl,
            authorName: req.session.adminId,
            downloads: 0, 
            likes: 0
        });

        res.redirect('/admin/dashboard');
    } catch (err) {
        console.error("UPLOAD ERROR DETAIL:", err);
        res.status(500).send("Upload Gagal: " + err.message);
    }
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
    socket.on('send-chat', (data) => {
        io.emit('receive-chat', data);
    });
    socket.on('like-project', async (id) => {
        const p = await Project.findByIdAndUpdate(id, { $inc: { likes: 1 } }, { new: true });
        if (p) io.emit('update-stats', { id: p._id, likes: p.likes });
    });
});

// ==========================================
// 9. EXPORT
// ==========================================
const PORT = process.env.PORT || 3000;
if (process.env.NODE_ENV !== 'production') {
    server.listen(PORT, () => console.log(`>>> Hub Online: http://localhost:${PORT}`));
}

module.exports = server;

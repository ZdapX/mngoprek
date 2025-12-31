
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
// 1. CONFIGURATION (HARDCODED)
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
const ProjectSchema = new mongoose.Schema({
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
});

// Gunakan model yang sudah ada atau buat baru (Penting untuk Vercel Hot Reload)
const Project = mongoose.models.Project || mongoose.model('Project', ProjectSchema);

// ==========================================
// 4. CLOUDINARY & MULTER
// ==========================================
cloudinary.config(CLOUDINARY_CONFIG);
const storage = new CloudinaryStorage({
    cloudinary: cloudinary,
    params: { 
        folder: 'sourcecodehub', 
        allowed_formats: ['jpg', 'png', 'zip', 'rar', 'txt', 'pdf'] 
    }
});
const upload = multer({ storage: storage });

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
    saveUninitialized: true,
    cookie: { maxAge: 24 * 60 * 60 * 1000 } // 24 Jam
}));

// Connect DB on every request (Serverless stability)
app.use(async (req, res, next) => {
    await connectDB();
    next();
});

// ==========================================
// 6. PUBLIC ROUTES
// ==========================================

// Home - List Projects
app.get('/', async (req, res) => {
    try {
        const projects = await Project.find().sort({ createdAt: -1 });
        res.render('home', { projects });
    } catch (err) {
        res.status(500).send("System Error");
    }
});

// Detail Project
app.get('/project/:id', async (req, res) => {
    try {
        const project = await Project.findById(req.params.id);
        if (!project) return res.redirect('/');
        res.render('project-detail', { project });
    } catch (err) {
        res.redirect('/');
    }
});

// Download Logic (FIXED)
app.get('/download/:id', async (req, res) => {
    try {
        const project = await Project.findById(req.params.id);
        if (!project) return res.status(404).send("Not Found");

        // Increment Download Count
        project.downloads += 1;
        await project.save();

        if (project.type === 'CODE') {
            // Download as .txt
            const fileName = `${project.name.replace(/\s+/g, '_')}_code.txt`;
            res.setHeader('Content-disposition', 'attachment; filename=' + fileName);
            res.setHeader('Content-type', 'text/plain');
            res.write(project.content);
            res.end();
        } else {
            // Redirect to Cloudinary URL for FILE
            if (project.previewUrl) {
                res.redirect(project.previewUrl);
            } else {
                res.status(404).send("File tidak tersedia");
            }
        }
    } catch (err) {
        res.status(500).send("Download Error");
    }
});

// Profile Page
app.get('/profile', async (req, res) => {
    const totalProjects = await Project.countDocuments();
    const all = await Project.find();
    const totalLikes = all.reduce((a, b) => a + (b.likes || 0), 0);
    
    const adminData = {
        silver: {
            name: "SilverHold Official",
            quote: "Jangan lupa sholat walaupun kamu seorang pendosa, Allah lebih suka orang pendosa yang sering bertaubat daripada orang yang merasa suci",
            hashtags: ["#bismillahcalonustad"],
            photoUrl: "https://res.cloudinary.com/dnb0q2s2h/image/upload/v1700000000/profiles/silver.jpg"
        },
        brayn: {
            name: "Brayn Official",
            quote: "Tidak Semua Orang Suka Kita Berkembang Pesat!",
            hashtags: ["#backenddev", "#frontenddev", "#BraynOfficial"],
            photoUrl: "https://res.cloudinary.com/dnb0q2s2h/image/upload/v1700000000/profiles/brayn.jpg"
        }
    };
    res.render('profile', { 
        admin: adminData.silver, 
        owner: adminData.brayn, 
        totalProjects, 
        totalLikes, 
        isOwnerSession: !!req.session.adminId 
    });
});

// ==========================================
// 7. ADMIN SYSTEM ROUTES
// ==========================================

app.get('/login', (req, res) => res.render('login'));

app.post('/login', (req, res) => {
    const { username, password } = req.body;
    if ((username === 'Silverhold' && password === 'Rian') || 
        (username === 'BraynOfficial' && password === 'Plerr321')) {
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

app.post('/admin/upload', upload.single('file'), async (req, res) => {
    if (!req.session.adminId) return res.status(403).send("Unauthorized");
    
    const { name, language, type, content, notes } = req.body;
    const filePath = req.file ? req.file.path : '';

    await Project.create({
        name, language, type, content, notes,
        previewUrl: filePath,
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

// ==========================================
// 8. REAL-TIME (SOCKET.IO)
// ==========================================
io.on('connection', (socket) => {
    socket.on('send-chat', (data) => {
        io.emit('receive-chat', data);
        setTimeout(() => {
            socket.emit('receive-chat', { 
                user: 'SYSTEM', 
                msg: `Pesan diterima oleh ${data.target}.` 
            });
        }, 1500);
    });

    socket.on('like-project', async (id) => {
        const p = await Project.findByIdAndUpdate(id, { $inc: { likes: 1 } }, { new: true });
        if (p) io.emit('update-stats', { id: p._id, likes: p.likes });
    });
});

// ==========================================
// 9. VERCEL EXPORT
// ==========================================
const PORT = process.env.PORT || 3000;
if (process.env.NODE_ENV !== 'production') {
    server.listen(PORT, () => console.log(`>>> Hub Online: http://localhost:${PORT}`));
}

module.exports = server;


const express = require('express');
const http = require('http');
const { Server } = require('socket.io');
const session = require('express-session');
const path = require('path');
const connectDB = require('./config/db');
const Project = require('./models/Project');

const app = express();
const server = http.createServer(app);
const io = new Server(server);

// Hubungkan ke Database
connectDB();

// Konfigurasi View Engine untuk Vercel
app.set('view engine', 'ejs');
app.set('views', path.join(__dirname, 'views')); // FIX: Path Absolut

// Middleware
app.use(express.static(path.join(__dirname, 'public')));
app.use(express.json());
app.use(express.urlencoded({ extended: true }));
app.use(session({
    secret: 'cyber-secret-key-123',
    resave: false,
    saveUninitialized: true,
    cookie: { secure: false }
}));

// Mock Data Admin (Agar profile tetap muncul tanpa query berat)
const adminInfo = {
    silver: {
        name: "SilverHold Official",
        quote: "Jangan lupa sholat walaupun kamu seorang pendosa...",
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

// --- ROUTES ---

app.get('/', async (req, res) => {
    try {
        const projects = await Project.find().sort({ createdAt: -1 });
        res.render('home', { projects });
    } catch (err) {
        res.status(500).send("Database Error");
    }
});

app.get('/project/:id', async (req, res) => {
    try {
        const project = await Project.findById(req.params.id);
        if (!project) return res.redirect('/');
        res.render('project-detail', { project });
    } catch (err) {
        res.redirect('/');
    }
});

app.get('/profile', async (req, res) => {
    const totalProjects = await Project.countDocuments();
    const allProjects = await Project.find();
    const totalLikes = allProjects.reduce((acc, curr) => acc + (curr.likes || 0), 0);
    
    res.render('profile', { 
        admin: adminInfo.silver, 
        owner: adminInfo.brayn,
        totalProjects,
        totalLikes,
        isOwnerSession: req.session.adminId ? true : false
    });
});

app.get('/login', (req, res) => res.render('login'));

// Jalankan Server
const PORT = process.env.PORT || 3000;
server.listen(PORT, () => {
    console.log(`System Online on port ${PORT}`);
});

module.exports = app; // Penting untuk Vercel

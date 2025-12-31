
const express = require('express');
const http = require('http');
const { Server } = require('socket.io');
const session = require('express-session');
const connectDB = require('./config/db');
const Project = require('./models/Project');
const Admin = require('./models/Admin'); // Pastikan buat data awal admin di DB

const app = express();
const server = http.createServer(app);
const io = new Server(server);

connectDB();

app.set('view engine', 'ejs');
app.use(express.static('public'));
app.use(express.json());
app.use(express.urlencoded({ extended: true }));
app.use(session({ secret: 'cyberpunk-secret', resave: false, saveUninitialized: true }));

// --- ROUTES ---
app.get('/', async (req, res) => {
    const projects = await Project.find().sort({ createdAt: -1 });
    res.render('home', { projects });
});

app.get('/project/:id', async (req, res) => {
    const project = await Project.findById(req.params.id);
    res.render('project-detail', { project });
});

// Real-time Chat & Stats Logic
io.on('connection', (socket) => {
    socket.on('send-chat', (data) => {
        io.emit('receive-chat', data);
        setTimeout(() => {
            socket.emit('receive-chat', { 
                user: 'System Admin', 
                msg: 'Pesan diterima. Admin akan segera membalas.', 
                isAuto: true 
            });
        }, 2000);
    });

    socket.on('like-project', async (id) => {
        const p = await Project.findByIdAndUpdate(id, { $inc: { likes: 1 } }, { new: true });
        io.emit('update-stats', { id: p._id, likes: p.likes });
    });
});

server.listen(3000, () => console.log('Terminal Ready on port 3000'));

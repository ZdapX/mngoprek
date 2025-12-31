const socket = io();

// 1. Real-time Search
const searchInput = document.getElementById('searchInput');
if (searchInput) {
    searchInput.addEventListener('input', (e) => {
        const term = e.target.value.toLowerCase();
        const cards = document.querySelectorAll('.cyber-card');
        
        cards.forEach(card => {
            const title = card.querySelector('h3').innerText.toLowerCase();
            const lang = card.querySelector('.font-mono').innerText.toLowerCase();
            if (title.includes(term) || lang.includes(term)) {
                card.style.display = 'flex';
            } else {
                card.style.display = 'none';
            }
        });
    });
}

// 2. Real-time Like Update
function likeProject(id) {
    socket.emit('like-project', id);
}

socket.on('update-stats', (data) => {
    const likeCounter = document.getElementById(`like-${data.id}`);
    if (likeCounter) {
        likeCounter.innerText = data.likes;
        likeCounter.classList.add('text-red-600', 'scale-110');
        setTimeout(() => likeCounter.classList.remove('scale-110'), 200);
    }
});

// 3. Chat Simulation System
function openChat(target) {
    const msg = prompt(`Kirim pesan ke ${target}:`);
    if (msg) {
        const userTag = `USER${Math.floor(Math.random() * 1000)}`;
        socket.emit('send-chat', { user: userTag, msg: msg, target: target });
        alert("Pesan terkirim ke sistem real-time!");
    }
}

socket.on('receive-chat', (data) => {
    console.log(`[${data.user}]: ${data.msg}`);
    // Jika user sedang di halaman admin, munculkan notifikasi dashboard
});

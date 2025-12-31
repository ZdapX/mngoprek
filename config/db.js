
const mongoose = require('mongoose');

const connectDB = async () => {
    if (mongoose.connection.readyState >= 1) return;

    try {
        await mongoose.connect('mongodb+srv://dafanation1313_db_user:hAMuQVA4A1QjeUWo@cluster0.d28log3.mongodb.net/?retryWrites=true&w=majority', {
            useNewUrlParser: true,
            useUnifiedTopology: true,
            connectTimeoutMS: 10000, // 10 detik timeout
        });
        console.log('Cyberlink Established: MongoDB Connected');
    } catch (err) {
        console.error('Database Connection Error:', err.message);
        // Jangan biarkan aplikasi crash, tapi log errornya
    }
};

module.exports = connectDB;

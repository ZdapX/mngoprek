const mongoose = require('mongoose');
const connectDB = async () => {
    try {
        await mongoose.connect('mongodb+srv://dafanation1313_db_user:hAMuQVA4A1QjeUWo@cluster0.d28log3.mongodb.net/?appName=Cluster0');
        console.log('Cyberlink Established: MongoDB Connected');
    } catch (err) {
        console.error(err);
    }
};
module.exports = connectDB;

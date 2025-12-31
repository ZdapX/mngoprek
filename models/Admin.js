const mongoose = require('mongoose');

const AdminSchema = new mongoose.Schema({
    username: { type: String, required: true, unique: true },
    password: { type: String, required: true },
    name: String,
    role: { type: String, enum: ['Admin', 'Owner'] },
    quote: String,
    hashtags: [String],
    photoUrl: { type: String, default: 'https://via.placeholder.com/150' }
});

module.exports = mongoose.model('Admin', AdminSchema);

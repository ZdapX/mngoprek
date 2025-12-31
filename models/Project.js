const mongoose = require('mongoose');
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
module.exports = mongoose.model('Project', ProjectSchema);

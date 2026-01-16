const mongoose = require('mongoose');

const questionSchema = new mongoose.Schema({
    companyName: {
        type: String,
        required: true,
        trim: true,
        index: true // Indexed for fast lookup by company
    },
    job: {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'Job',
        required: true
    },
    question: {
        type: String,
        required: true,
        trim: true,
        minlength: 10
    },
    answer: {
        type: String,
        default: ''
    },
    askedBy: {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'User',
        required: true
    },
    answeredBy: {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'User'
    },
    answeredAt: Date,
    isDeleted: {
        type: Boolean,
        default: false
    }
}, {
    timestamps: true
});

module.exports = mongoose.model('Question', questionSchema);

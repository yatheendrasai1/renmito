const mongoose = require('mongoose');

const ticketQuerySchema = new mongoose.Schema({
  userId: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true, index: true },
  name:   { type: String, required: true, trim: true, maxlength: 80 },
  jql:    { type: String, required: true, maxlength: 2000 },
  isValid: { type: Boolean, default: false },
}, { timestamps: true });

module.exports = mongoose.model('TicketQuery', ticketQuerySchema, 'ticket_queries');

const mongoose = require('mongoose');

const foodInsightSchema = new mongoose.Schema(
  {
    userId:   { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
    logId:    { type: mongoose.Schema.Types.ObjectId, ref: 'TimeLog', required: true, unique: true },
    date:     { type: String, required: true },   // YYYY-MM-DD
    mealType: { type: String, required: true },   // breakfast / lunch / dinner / food intake
    status:   { type: String, enum: ['pending', 'done', 'error'], default: 'pending' },
    analysis: { type: String, default: '' },
    error:    { type: String, default: null },
  },
  { timestamps: true, collection: 'foodInsights' }
);

foodInsightSchema.index({ userId: 1, date: 1 });

module.exports = mongoose.model('FoodInsight', foodInsightSchema);

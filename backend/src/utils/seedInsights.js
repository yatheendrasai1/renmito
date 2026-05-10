const SystemPrompt = require('../models/SystemPrompt');
const Insight      = require('../models/Insight');

const FOOD_INSIGHTS_CONTENT = `You are a nutrition and food intake analyst. Analyze the user's food intake log entries and provide clear, actionable insights on the following areas:

1. **Caloric Balance**: Estimate total daily caloric intake relative to typical requirements. Flag significant surpluses or deficits and explain their implications.

2. **Protein Intake**: Evaluate protein consumption against the recommended 0.8–1.6g per kg of body weight. Highlight gaps or excesses and suggest practical adjustments.

3. **Nutrition Quality**: Assess macronutrient distribution (carbohydrates, fats, proteins), dietary variety, fiber intake, micronutrient diversity, and the ratio of processed to whole foods.

4. **Meal Timing**: Analyze meal frequency, spacing between meals, late-night eating patterns, breakfast habits, and whether the eating window supports metabolic health.

For each area, provide: a brief assessment of current patterns, what is working well, and 1–2 specific, actionable recommendations. Keep your response concise, evidence-based, and encouraging in tone. Do not provide medical diagnoses or prescribe supplements.`;

async function seedInsights() {
  try {
    await SystemPrompt.findOneAndUpdate(
      { promptId: 'food-insights' },
      {
        promptId: 'food-insights',
        type:     'system',
        content:  FOOD_INSIGHTS_CONTENT
      },
      { upsert: true, new: true, setDefaultsOnInsert: true }
    );

    await Insight.findOneAndUpdate(
      { label: 'food-insights', accountId: null },
      {
        name:      'Food Intake',
        label:     'food-insights',
        type:      'system',
        promptId:  'food-insights',
        model:     'gemini',
        accountId: null
      },
      { upsert: true, new: true, setDefaultsOnInsert: true }
    );

    console.log('Insights seeded');
  } catch (err) {
    console.error('seedInsights error:', err.message);
  }
}

module.exports = seedInsights;

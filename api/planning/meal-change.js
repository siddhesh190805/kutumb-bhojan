import { createPlanningState, proposeMealChange, MEAL_CHANGE_REASONS } from '../../sync.js';

export default async function handler(req, res) {
  if (req.method !== 'POST') {
    res.setHeader('Allow', ['POST']);
    return res.status(405).json({ error: 'Method Not Allowed' });
  }

  try {
    const body = typeof req.body === 'string' ? JSON.parse(req.body) : (req.body || {});
    const {
      currentMeal,
      reason = MEAL_CHANGE_REASONS.NOT_IN_MOOD,
      candidateRecipes = [],
      household = {},
      members = [],
      frequencyRules,
      unavailableIngredient,
      unavailableIngredients = [],
      customConstraint
    } = body;

    if (!currentMeal) {
      return res.status(400).json({ error: 'currentMeal is required' });
    }

    const state = createPlanningState({
      household,
      members,
      frequencyRules,
      startDate: currentMeal.date || new Date().toISOString().slice(0, 10)
    });

    const result = proposeMealChange(currentMeal, reason, state, candidateRecipes, {
      unavailableIngredient,
      unavailableIngredients,
      customConstraint
    });

    return res.status(200).json({
      success: true,
      reasonApplied: result.reasonApplied,
      alternatives: result.alternatives,
      recommendation: result.recommendation
    });
  } catch (err) {
    return res.status(500).json({
      success: false,
      error: err.message || 'Internal Meal Change Server Error'
    });
  }
}

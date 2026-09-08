import { createPlanningState, generatePlan } from '../../sync.js';

export default async function handler(req, res) {
  if (req.method !== 'POST') {
    res.setHeader('Allow', ['POST']);
    return res.status(405).json({ error: 'Method Not Allowed' });
  }

  try {
    const body = typeof req.body === 'string' ? JSON.parse(req.body) : (req.body || {});
    const {
      household = {},
      members = [],
      frequencyRules,
      candidateRecipes = [],
      startDate = new Date().toISOString().slice(0, 10),
      visibleDays = 7,
      evaluationDays = 30
    } = body;

    const state = createPlanningState({
      household,
      members,
      frequencyRules,
      startDate,
      visibleDays,
      evaluationDays
    });

    const result = generatePlan(state, candidateRecipes, {
      days: visibleDays,
      startDate
    });

    return res.status(200).json({
      success: result.success,
      plan: result.plan,
      warnings: result.warnings,
      evaluationSummary: {
        visibleDays,
        evaluationDays,
        totalMealsPlanned: result.plan.length,
        startDate
      }
    });
  } catch (err) {
    return res.status(500).json({
      success: false,
      error: err.message || 'Internal Planning Server Error'
    });
  }
}

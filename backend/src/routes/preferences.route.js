const express                = require('express');
const router                 = express.Router();
const preferencesController  = require('../controllers/preferences.controller');

router.get('/',          preferencesController.getPreferences);
router.put('/theme',     preferencesController.setTheme);
router.put('/active-log', preferencesController.startActiveLog);
router.delete('/active-log',       preferencesController.stopActiveLog);

router.put('/quick-shortcuts', preferencesController.updateQuickShortcuts);

// 1.83 — Day-level schedule preferences
router.put('/day-settings', preferencesController.updateDaySettings);

// User physical profile (DOB, weight, height, gender, activity level)
router.put('/user-profile', preferencesController.updateUserProfile);

// AI feature flags
router.put('/features', preferencesController.updateFeatures);

// ExpenseGuide settings (SMS listener, currency, notifications)
router.put('/expense-guide', preferencesController.updateExpenseGuide);

module.exports = router;

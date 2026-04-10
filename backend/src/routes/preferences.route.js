const express                = require('express');
const router                 = express.Router();
const preferencesController  = require('../controllers/preferences.controller');

router.get('/',                  preferencesController.getPreferences);
router.put('/palette',           preferencesController.upsertPalette);
router.delete('/palette',        preferencesController.clearPalette);
router.post('/presets',          preferencesController.addPreset);
router.delete('/presets/:name',  preferencesController.removePreset);

module.exports = router;

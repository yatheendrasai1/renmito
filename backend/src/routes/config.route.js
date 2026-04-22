const express = require('express');
const router  = express.Router();
const ctrl    = require('../controllers/config.controller');

router.get('/',            ctrl.getConfig);
router.post('/gemini-key', ctrl.saveGeminiKey);

module.exports = router;

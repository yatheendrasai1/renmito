const express = require('express');
const router  = express.Router();
const ctrl    = require('../controllers/ai.controller');

router.post('/parse-log', ctrl.parseLog);

module.exports = router;

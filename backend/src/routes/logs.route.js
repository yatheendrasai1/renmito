const express         = require('express');
const router          = express.Router();
const logsController  = require('../controllers/logs.controller');

// Month summary must be declared before /:date to avoid route collision
router.get('/month/:year/:month', logsController.getMonthSummary);
router.get('/:date',              logsController.getLogsByDate);
router.post('/:date',             logsController.createLog);
router.put('/:date/:id',          logsController.updateLog);
router.delete('/:date/:id',       logsController.deleteLog);

module.exports = router;

const express         = require('express');
const router          = express.Router();
const logsController  = require('../controllers/logs.controller');

// Literal routes must be declared before param routes to avoid collisions
router.get('/month/:year/:month', logsController.getMonthSummary);
router.get('/range',              logsController.getLogsByDateRange);
router.get('/:date',              logsController.getLogsByDate);
router.post('/:date',             logsController.createLog);
router.put('/:date/:id',          logsController.updateLog);
router.delete('/:date/:id',       logsController.deleteLog);
router.patch('/:id/report',       logsController.updateLogReport);

module.exports = router;

const express    = require('express');
const router     = express.Router();
const controller = require('../controllers/food-insights.controller');

router.get('/',                     controller.getByDate);
router.get('/:logId',               controller.getByLogId);
router.post('/:logId/generate',     controller.generate);

module.exports = router;

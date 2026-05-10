const express    = require('express');
const controller = require('../controllers/insights.controller');

const router = express.Router();

router.get('/',                         controller.getAll);
router.get('/:insightId',              controller.getById);
router.post('/',                       controller.createInsight);
router.patch('/:insightId',            controller.updateInsight);
router.post('/:insightId/analyze',     controller.analyzeInsight);

module.exports = router;

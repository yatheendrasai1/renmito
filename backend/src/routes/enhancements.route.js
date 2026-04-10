const express                 = require('express');
const router                  = express.Router();
const enhancementsController  = require('../controllers/enhancements.controller');

router.get('/',  enhancementsController.listEnhancements);
router.post('/', enhancementsController.createEnhancement);

module.exports = router;

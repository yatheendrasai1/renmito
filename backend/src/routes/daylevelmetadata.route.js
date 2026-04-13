const express    = require('express');
const router     = express.Router();
const controller = require('../controllers/daylevelmetadata.controller');

router.get('/month/:year/:month', controller.getMonthDayTypes);
router.get('/:date',              controller.getMetadata);
router.put('/:date/day-type',     controller.setDayType);
router.post('/:date/capture',     controller.capture);

module.exports = router;

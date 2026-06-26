const express    = require('express');
const router     = express.Router();
const controller = require('../controllers/locationLogs.controller');

router.post('/sync', controller.sync);
router.get('/',      controller.getAll);

module.exports = router;

const express              = require('express');
const router               = express.Router();
const logTypesController   = require('../controllers/logtypes.controller');

router.get('/',      logTypesController.getAllLogTypes);
router.post('/',     logTypesController.createLogType);
router.put('/:id',   logTypesController.renameLogType);
router.delete('/:id', logTypesController.deleteLogType);

module.exports = router;

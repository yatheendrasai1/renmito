const express = require('express');
const ctrl    = require('../controllers/ticketQuery.controller');

const router = express.Router();

router.get('/',             ctrl.list);
router.post('/',            ctrl.create);
router.put('/:id',          ctrl.update);
router.delete('/:id',       ctrl.remove);
router.post('/:id/clone',   ctrl.clone);

module.exports = router;

const express    = require('express');
const router     = express.Router();
const controller = require('../controllers/expenses.controller');

router.get('/',         controller.listExpenses);
router.get('/:id',      controller.getExpense);
router.post('/',        controller.createExpense);
router.post('/bulk',    controller.bulkCreateExpenses);
router.put('/:id',      controller.updateExpense);
router.delete('/:id',   controller.deleteExpense);

module.exports = router;

const express    = require('express');
const controller = require('../controllers/prompts.controller');

const router = express.Router();

router.post('/',    controller.createPrompt);
router.patch('/:id', controller.updatePrompt);

module.exports = router;

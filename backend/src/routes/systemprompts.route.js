const express    = require('express');
const controller = require('../controllers/systemprompts.controller');

const router = express.Router();

router.get('/:promptId', controller.getByPromptId);

module.exports = router;

const express = require('express');
const router = express.Router();
const jiraController = require('../controllers/jira.controller');

router.get('/config',    jiraController.getConfig);
router.put('/config',    jiraController.saveConfig);
router.delete('/config', jiraController.deleteConfig);
router.post('/test',     jiraController.testConnection);
router.post('/search',   jiraController.searchTickets);

module.exports = router;

const express        = require('express');
const router         = express.Router();
const ctrl           = require('../controllers/notifications.controller');
const authMiddleware = require('../middleware/authMiddleware');

// Public — no auth needed for cron trigger or VAPID key
router.get('/vapid-public-key', ctrl.getVapidPublicKey);
router.post('/cron',            ctrl.cronTrigger);

// Authenticated
router.post('/subscribe',   authMiddleware, ctrl.subscribe);
router.delete('/subscribe', authMiddleware, ctrl.unsubscribe);
router.post('/test',        authMiddleware, ctrl.testNotification);

module.exports = router;

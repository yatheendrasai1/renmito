const express          = require('express');
const router           = express.Router();
const authController   = require('../controllers/auth.controller');
const authMiddleware   = require('../middleware/authMiddleware');

router.post('/signup',          authController.signup);
router.post('/login',           authController.login);
router.post('/change-password', authMiddleware, authController.changePassword);

module.exports = router;

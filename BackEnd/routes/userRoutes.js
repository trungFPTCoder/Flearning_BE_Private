const express = require('express');
const router = express.Router();
const { setPassword, changePassword } = require('../controllers/userController');
const authorize = require('../middlewares/authMiddleware');

router.post('/set-password', authorize(), setPassword);
router.put('/change-password', authorize(), changePassword);

module.exports = router;
const express = require('express');
const { getUserProfile, getUserAttempts, updateUserProfile } = require('../controllers/userController');
const router = express.Router();

router.get('/profile', getUserProfile);
router.get('/attempts', getUserAttempts);
router.put('/profile', updateUserProfile);

module.exports = router;
const express = require('express');
const router = express.Router();
const chatController = require('../../controllers/chatController');
const { authenticate, authorize } = require('../../middlewares/auth');

router.use(authenticate, authorize('member', 'admin'));

router.get('/conversations', chatController.getConversations);
router.post('/conversations', chatController.getOrCreateConversation);
router.get('/conversations/:conversationId/messages', chatController.getMessages);
router.post('/conversations/:conversationId/messages', chatController.sendMessage);

module.exports = router;

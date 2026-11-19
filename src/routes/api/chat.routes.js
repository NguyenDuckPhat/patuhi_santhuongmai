const express = require('express');
const router = express.Router();
const chatController = require('../../controllers/chatController');
const { authenticate, authorize } = require('../../middlewares/auth');
const { uploadChatImage } = require('../../middlewares/upload');

router.use(authenticate, authorize('member', 'admin'));

router.get('/conversations', chatController.getConversations);
router.post('/conversations', chatController.getOrCreateConversation);
router.get('/conversations/:conversationId/read-status', chatController.getReadStatus);
router.get('/conversations/:conversationId/messages', chatController.getMessages);
router.post('/conversations/:conversationId/messages', uploadChatImage, chatController.sendMessage);
router.delete('/conversations/:conversationId/messages/:messageId', chatController.recallMessage);
router.patch('/conversations/:conversationId/messages/:messageId/recall', chatController.recallMessage);

module.exports = router;

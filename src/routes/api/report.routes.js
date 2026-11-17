const express = require('express');
const router = express.Router();
const reportController = require('../../controllers/reportController');
const { authenticate, authorize } = require('../../middlewares/auth');
const { reportRules, validate } = require('../../middlewares/validator');

router.use(authenticate, authorize('member', 'admin'));

router.post('/', reportRules, validate, reportController.createReport);
router.get('/my-reports', reportController.getMyReports);

module.exports = router;

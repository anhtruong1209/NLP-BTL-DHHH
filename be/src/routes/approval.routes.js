const express = require('express');
const approvalController = require('../controllers/approval.controller');
const authMiddleware = require('../middleware/auth.middleware');

const router = express.Router();

// Protect all routes - require authentication
router.use(authMiddleware.protect);

// Get pending approval count (available to both Admin and Mode)
router.get(
  '/count/pending',
  authMiddleware.restrictTo('admin', 'mode'),
  approvalController.getPendingCount
);

// Get all approvals (Admin can see all, Mode can see their own)
router.get(
  '/',
  authMiddleware.restrictTo('admin', 'mode'),
  approvalController.getAllApprovals
);

// Get approval by ID
router.get(
  '/:id',
  authMiddleware.restrictTo('admin', 'mode'),
  approvalController.getApprovalById
);

// Create approval request (Mode only)
router.post(
  '/',
  authMiddleware.restrictTo('mode'),
  approvalController.createApproval
);

// Review approval (Admin only)
router.patch(
  '/:id/review',
  authMiddleware.restrictTo('admin'),
  approvalController.reviewApproval
);

// Delete approval
router.delete(
  '/:id',
  authMiddleware.restrictTo('admin', 'mode'),
  approvalController.deleteApproval
);

module.exports = router; 
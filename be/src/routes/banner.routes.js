const express = require('express');
const router = express.Router();

const bannerController = require('../controllers/banner.controller');
const authMiddleware = require('../middleware/auth.middleware');

// Public routes (no authentication required)
router.get('/active', bannerController.getActiveBanners);

// Protected routes (authentication required)
router.use(authMiddleware.protect);

// Admin routes
router.get('/stats', bannerController.getBannerStats);
router.get('/', bannerController.getAllBanners);
router.get('/:id', bannerController.getBannerById);
router.post('/', bannerController.createBanner);
router.put('/:id', bannerController.updateBanner);
router.delete('/:id', bannerController.deleteBanner);

module.exports = router;
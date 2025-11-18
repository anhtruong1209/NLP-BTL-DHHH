const Banner = require('../models/banner.model');
const AppError = require('../utils/appError');
const catchAsync = require('../utils/catchAsync');
const fs = require('fs');
const path = require('path');

// Tạo banner mới
exports.createBanner = catchAsync(async (req, res, next) => {
  try {
    const { title, images } = req.body;

    if (!title) {
      return next(new AppError('Title is required', 400));
    }

    if (!images || !Array.isArray(images) || images.length === 0) {
      return next(new AppError('At least one image is required', 400));
    }

    // Validate base64 images
    const validImages = images.filter(img => {
      return typeof img === 'string' && img.startsWith('data:image/');
    });

    if (validImages.length === 0) {
      return next(new AppError('Invalid image format. Please provide valid base64 images.', 400));
    }

    const bannerData = {
      title,
      images: validImages
    };

    const banner = await Banner.create(bannerData);

    res.status(201).json({
      success: true,
      data: banner
    });
  } catch (error) {
    next(error);
  }
});

// Lấy tất cả banner
exports.getAllBanners = catchAsync(async (req, res, next) => {
  try {
    const { page = 1, limit = 10, search } = req.query;
    
    const result = await Banner.findAll({
      page: parseInt(page),
      limit: parseInt(limit),
      search
    });

    res.status(200).json({
      success: true,
      data: result.banners,
      pagination: {
        page: parseInt(page),
        limit: parseInt(limit),
        total: result.total,
        pages: Math.ceil(result.total / limit)
      }
    });
  } catch (error) {
    next(error);
  }
});

// Lấy banner theo ID
exports.getBannerById = catchAsync(async (req, res, next) => {
  try {
    const banner = await Banner.findById(req.params.id);

    if (!banner) {
      return next(new AppError('Banner not found', 404));
    }

    res.status(200).json({
      success: true,
      data: banner
    });
  } catch (error) {
    next(error);
  }
});

// Lấy tất cả banner cho slider
exports.getActiveBanners = catchAsync(async (req, res, next) => {
  try {
    const banners = await Banner.getAllBanners();

    res.status(200).json({
      success: true,
      data: banners
    });
  } catch (error) {
    next(error);
  }
});

// Cập nhật banner
exports.updateBanner = catchAsync(async (req, res, next) => {
  try {
    const banner = await Banner.findById(req.params.id);

    if (!banner) {
      return next(new AppError('Banner not found', 404));
    }

    const { title, images } = req.body;

    // Validate base64 images if provided
    let validImages = banner.images; // Keep existing images by default
    
    if (images && Array.isArray(images) && images.length > 0) {
      const filteredImages = images.filter(img => {
        return typeof img === 'string' && img.startsWith('data:image/');
      });
      
      if (filteredImages.length > 0) {
        validImages = filteredImages;
      }
    }

    const updateData = {
      title: title || banner.title,
      images: validImages
    };

    await banner.update(updateData);

    res.status(200).json({
      success: true,
      data: banner
    });
  } catch (error) {
    next(error);
  }
});

// Xóa banner
exports.deleteBanner = catchAsync(async (req, res, next) => {
  try {
    const banner = await Banner.findById(req.params.id);

    if (!banner) {
      return next(new AppError('Banner not found', 404));
    }

    // No need to delete files since we're using base64
    await banner.delete();

    res.status(200).json({
      success: true,
      message: 'Banner deleted successfully'
    });
  } catch (error) {
    next(error);
  }
});

// Lấy thống kê
exports.getBannerStats = catchAsync(async (req, res, next) => {
  try {
    const stats = await Banner.getStats();

    res.status(200).json({
      success: true,
      data: stats
    });
  } catch (error) {
    next(error);
  }
});
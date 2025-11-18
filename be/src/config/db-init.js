const fs = require('fs');
const path = require('path');
const { pool, sql } = require('./db');

/**
 * Kiểm tra và tạo cột content_html trong bảng course_details nếu chưa tồn tại
 */
async function ensureContentHtmlColumn() {
  try {
    
    // Kiểm tra xem cột content_html đã tồn tại chưa
    const checkResult = await pool.request().query(`
      SELECT * FROM INFORMATION_SCHEMA.COLUMNS 
      WHERE TABLE_NAME = 'course_details' AND COLUMN_NAME = 'content_html'
    `);
    
    if (checkResult.recordset.length === 0) {
      
      // Tạo cột content_html nếu chưa tồn tại
      await pool.request().query(`
        ALTER TABLE course_details
        ADD content_html NVARCHAR(MAX) NULL;
      `);
      
    } else {
    }
  } catch (error) {
    console.error('Error ensuring content_html column:', error);
  }
}

/**
 * Kiểm tra và tạo cột download_url trong bảng course_details nếu chưa tồn tại
 */
async function ensureDownloadUrlColumn() {
  try {
    
    // Kiểm tra xem cột download_url đã tồn tại chưa
    const checkResult = await pool.request().query(`
      SELECT * FROM INFORMATION_SCHEMA.COLUMNS 
      WHERE TABLE_NAME = 'course_details' AND COLUMN_NAME = 'download_url'
    `);
    
    if (checkResult.recordset.length === 0) {
      
      // Tạo cột download_url nếu chưa tồn tại
      await pool.request().query(`
        ALTER TABLE course_details
        ADD download_url NVARCHAR(4000) NULL;
      `);
      
      console.log('✅ Đã thêm cột download_url vào bảng course_details');
    } else {
      console.log('ℹ️ Cột download_url đã tồn tại trong bảng course_details');
    }
  } catch (error) {
    console.error('❌ Error ensuring download_url column:', error);
  }
}

/**
 * Kiểm tra và tạo bảng banners nếu chưa tồn tại
 */
async function ensureBannersTable() {
  try {
    
    // Kiểm tra xem bảng banners đã tồn tại chưa
    const checkResult = await pool.request().query(`
      SELECT * FROM INFORMATION_SCHEMA.TABLES 
      WHERE TABLE_NAME = 'banners'
    `);
    
    if (checkResult.recordset.length === 0) {
      
      // Tạo bảng banners
      await pool.request().query(`
        CREATE TABLE banners (
          id INT IDENTITY(1,1) PRIMARY KEY,
          title NVARCHAR(200) NOT NULL,
          images NVARCHAR(MAX) NOT NULL,
          createdAt DATETIME2 NOT NULL DEFAULT GETDATE(),
          updatedAt DATETIME2 NOT NULL DEFAULT GETDATE()
        );
      `);
      
      // Tạo indexes cho performance
      await pool.request().query(`
        CREATE INDEX IX_banners_createdAt ON banners (createdAt DESC);
      `);
      
    } else {
    }
  } catch (error) {
    console.error('Error ensuring banners table:', error);
  }
}

/**
 * Thực hiện tất cả các kiểm tra và cập nhật cấu trúc database cần thiết
 */
async function initializeDatabase() {
  try {
    // Đảm bảo kết nối tới database đã được thiết lập
    await pool.connect();
    
    // Kiểm tra và tạo các cột cần thiết
    await ensureContentHtmlColumn();
    await ensureDownloadUrlColumn();
    
    // Kiểm tra và tạo bảng banners
    await ensureBannersTable();
    
    // Có thể thêm các hàm kiểm tra khác ở đây trong tương lai
    
  } catch (error) {
    console.error('Error initializing database structure:', error);
  }
}

module.exports = {
  initializeDatabase
}; 
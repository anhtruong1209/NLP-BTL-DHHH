const { pool, sql, connectToDatabase } = require('../config/db');

class Banner {
  constructor(data = {}) {
    this.id = data.id;
    this.title = data.title;
    this.images = data.images ? (typeof data.images === 'string' ? JSON.parse(data.images) : data.images) : [];
    this.createdAt = data.createdAt;
    this.updatedAt = data.updatedAt;
  }

  // Tạo banner mới
  static async create(bannerData) {
    try {
      await connectToDatabase();
      const result = await pool.request()
        .input('title', sql.NVarChar(200), bannerData.title)
        .input('images', sql.NVarChar(sql.MAX), JSON.stringify(bannerData.images))
        .query(`
          INSERT INTO banners (title, images)
          OUTPUT INSERTED.*
          VALUES (@title, @images)
        `);

      return new Banner(result.recordset[0]);
    } catch (error) {
      throw error;
    }
  }

  // Lấy banner theo ID
  static async findById(id) {
    try {
      await connectToDatabase();
      const result = await pool.request()
        .input('id', sql.Int, id)
        .query('SELECT * FROM banners WHERE id = @id');

      return result.recordset.length > 0 ? new Banner(result.recordset[0]) : null;
    } catch (error) {
      throw error;
    }
  }

  // Lấy tất cả banner với filter và pagination
  static async findAll(options = {}) {
    try {
      await connectToDatabase();
      const {
        page = 1,
        limit = 10,
        search,
        sortBy = 'createdAt',
        sortOrder = 'DESC'
      } = options;

      let whereConditions = [];
      let parameters = {};

      if (search) {
        whereConditions.push('title LIKE @search');
        parameters.search = `%${search}%`;
      }

      const whereClause = whereConditions.length > 0 ? `WHERE ${whereConditions.join(' AND ')}` : '';
      const offset = (page - 1) * limit;

      let request = pool.request();
      Object.keys(parameters).forEach(key => {
        request.input(key, sql.NVarChar, parameters[key]);
      });
      request.input('offset', sql.Int, offset);
      request.input('limit', sql.Int, limit);

      const result = await request.query(`
        SELECT * FROM banners 
        ${whereClause}
        ORDER BY ${sortBy} ${sortOrder}
        OFFSET @offset ROWS
        FETCH NEXT @limit ROWS ONLY
      `);

      // Đếm tổng số records
      let countRequest = pool.request();
      Object.keys(parameters).forEach(key => {
        countRequest.input(key, sql.NVarChar, parameters[key]);
      });

      const countResult = await countRequest.query(`
        SELECT COUNT(*) as total FROM banners ${whereClause}
      `);

      return {
        banners: result.recordset.map(row => new Banner(row)),
        total: countResult.recordset[0].total
      };
    } catch (error) {
      throw error;
    }
  }

  // Lấy tất cả banner (cho slider)
  static async getAllBanners() {
    try {
      await connectToDatabase();
      const result = await pool.request().query(`
        SELECT * FROM banners 
        ORDER BY createdAt DESC
      `);

      return result.recordset.map(row => new Banner(row));
    } catch (error) {
      throw error;
    }
  }

  // Cập nhật banner
  async update(updateData) {
    try {
      await connectToDatabase();
      const setClause = [];
      const request = pool.request().input('id', sql.Int, this.id);

      Object.keys(updateData).forEach(key => {
        if (updateData[key] !== undefined && key !== 'id') {
          setClause.push(`${key} = @${key}`);
          if (key === 'images') {
            request.input(key, sql.NVarChar(sql.MAX), JSON.stringify(updateData[key]));
          } else {
            request.input(key, sql.NVarChar, updateData[key]);
          }
        }
      });

      if (setClause.length === 0) {
        return this;
      }

      setClause.push('updatedAt = @updatedAt');
      request.input('updatedAt', sql.DateTime2, new Date());

      const result = await request.query(`
        UPDATE banners 
        SET ${setClause.join(', ')}
        OUTPUT INSERTED.*
        WHERE id = @id
      `);

      if (result.recordset.length > 0) {
        Object.assign(this, result.recordset[0]);
        this.images = typeof this.images === 'string' ? JSON.parse(this.images) : this.images;
      }

      return this;
    } catch (error) {
      throw error;
    }
  }

  // Xóa banner
  async delete() {
    try {
      await connectToDatabase();
      await pool.request()
        .input('id', sql.Int, this.id)
        .query('DELETE FROM banners WHERE id = @id');
      
      return true;
    } catch (error) {
      throw error;
    }
  }

  // Lấy thống kê
  static async getStats() {
    try {
      await connectToDatabase();
      const result = await pool.request().query(`
        SELECT 
          COUNT(*) as totalBanners,
          COUNT(CASE WHEN images IS NOT NULL THEN 1 END) as bannersWithImages
        FROM banners 
      `);

      return {
        totalBanners: result.recordset[0].totalBanners,
        bannersWithImages: result.recordset[0].bannersWithImages
      };
    } catch (error) {
      throw error;
    }
  }
}

module.exports = Banner;
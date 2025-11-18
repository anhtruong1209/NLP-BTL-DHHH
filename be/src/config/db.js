const sql = require('mssql');
require('dotenv').config();

// Database configuration from environment variables
const config = {
  user: process.env.DB_USER || "thunghiem2", 
  password: process.env.DB_PASSWORD || "thunghiem4416",
  server: process.env.DB_SERVER || "10.0.0.50",
  port: parseInt(process.env.DB_PORT || "1434"), 
  database: process.env.DB_NAME || "ai_composer_db",
  options: {
    encrypt: process.env.DB_ENCRYPT === "true",
    trustServerCertificate: true,
    enableArithAbort: true
  },
  pool: {
    max: parseInt(process.env.DB_MAX_POOL || "10"),
    min: parseInt(process.env.DB_MIN_POOL || "0"),
    idleTimeoutMillis: parseInt(process.env.DB_IDLE_TIMEOUT || "30000")
  },
  connectionTimeout: parseInt(process.env.DB_CONN_TIMEOUT || "30000"),
  requestTimeout: parseInt(process.env.DB_REQUEST_TIMEOUT || "30000")
};


// Create connection pool
const pool = new sql.ConnectionPool(config);

// Variable to track connection status
let isConnected = false;

// Simple connection function
async function connectToDatabase() {
  try {
    if (!isConnected) {
      await pool.connect();
      isConnected = true;
      
      // Test query để chắc chắn kết nối hoạt động
      const result = await pool.request().query('SELECT TOP 1 * FROM INFORMATION_SCHEMA.TABLES');
    }
    return pool;
  } catch (err) {
    console.error('Error connecting to database:', err);
    console.error('Error details:', {
      code: err.code,
      message: err.message,
      stack: err.stack,
      originalError: err.originalError
    });
    isConnected = false;
    // Try to reconnect after a delay
    setTimeout(() => {
      connectToDatabase();
    }, 5000);
  }
}

// Initialize connection
connectToDatabase().catch(err => {
  console.error('Database connection failed:', err);
});

// Export pool and sql for use in application
module.exports = {
  pool,
  sql,
  connectToDatabase
};

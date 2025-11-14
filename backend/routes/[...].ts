import { defineEventHandler } from 'h3';
import { initMongoDB } from '../utils/mongodb-init';

// Khởi tạo MongoDB khi server start
initMongoDB().catch(console.error);

export default defineEventHandler(() => {
  return ``;
});

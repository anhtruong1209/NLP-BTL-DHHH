import { defineEventHandler } from 'h3';
import { initMongoDB } from '~/utils/mongodb-init';

// Khởi tạo MongoDB khi server start
initMongoDB().catch(console.error);

export default defineEventHandler(() => {
  return `
<h1>Hello ChatBot-NLP-VMU Admin</h1>
<h2>Mock service is starting</h2>
<ul>
<li><a href="/api/user">/api/user/info</a></li>
<li><a href="/api/menu">/api/menu/all</a></li>
<li><a href="/api/auth/codes">/api/auth/codes</a></li>
<li><a href="/api/auth/login">/api/auth/login</a></li>
<li><a href="/api/upload">/api/upload</a></li>
<li><a href="/api/system/user/list">/api/system/user/list</a></li>
</ul>
<p><strong>Default accounts:</strong></p>
<ul>
<li>Username: <code>admin</code>, Password: <code>admin@123</code></li>
<li>Username: <code>user</code>, Password: <code>user@123</code></li>
</ul>
`;
});

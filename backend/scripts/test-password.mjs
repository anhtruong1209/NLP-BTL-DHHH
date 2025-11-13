import bcrypt from 'bcryptjs';

const storedHash = '$2a$10$bSRJ3Sndd9vryVAqBQOEM.Xi00Ahkyvjw0dh49Xdtp1H7b7D2Bmn2';
const testPasswords = ['admin@123', 'abc@123', 'user@123'];

console.log('Testing password hash...\n');
console.log('Stored hash:', storedHash);
console.log('');

for (const pwd of testPasswords) {
  const match = await bcrypt.compare(pwd, storedHash);
  console.log(`Password: ${pwd}`);
  console.log(`Match: ${match}`);
  
  // Generate new hash for comparison
  const newHash = await bcrypt.hash(pwd, 10);
  console.log(`New hash: ${newHash.substring(0, 30)}...`);
  console.log('');
}


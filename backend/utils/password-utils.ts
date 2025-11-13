import bcrypt from 'bcryptjs';

const SALT_ROUNDS = 10;

/**
 * Hash password using bcrypt
 */
export async function hashPassword(password: string): Promise<string> {
  try {
    return await bcrypt.hash(password, SALT_ROUNDS);
  } catch (error) {
    console.error('❌ Error hashing password:', error);
    throw error;
  }
}

/**
 * Compare plain password with hashed password
 */
export async function comparePassword(
  plainPassword: string,
  hashedPassword: string,
): Promise<boolean> {
  try {
    return await bcrypt.compare(plainPassword, hashedPassword);
  } catch (error) {
    console.error('❌ Error comparing password:', error);
    throw error;
  }
}

/**
 * Check if a password string is already hashed
 * Bcrypt hashes always start with $2a$, $2b$, or $2y$
 */
export function isPasswordHashed(password: string): boolean {
  return /^\$2[ayb]\$.{56}$/.test(password);
}


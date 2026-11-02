import { hash, verify, Algorithm } from '@node-rs/argon2';
import jwt, { type SignOptions } from 'jsonwebtoken';
import crypto from 'crypto';
import { type JwtPayload, JwtPayloadSchema } from '@docsage/shared';

const jwtSecret =
  process.env['JWT_SECRET'] ?? 'default_insecure_jwt_secret_for_scaffold_testing_only_32_chars';
const accessTokenExpiresIn: NonNullable<SignOptions['expiresIn']> = '15m';

export async function hashPassword(password: string): Promise<string> {
  return hash(password, {
    memoryCost: 65536,
    timeCost: 3,
    outputLen: 32,
    parallelism: 4,
    algorithm: Algorithm.Argon2id,
  });
}

export async function verifyPassword(
  passwordHash: string,
  passwordAttempt: string,
): Promise<boolean> {
  return verify(passwordHash, passwordAttempt);
}

export function hashToken(token: string): string {
  return crypto.createHash('sha256').update(token).digest('hex');
}

export function createAccessToken(payload: JwtPayload): string {
  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  const { exp, iat, ...cleanPayload } = payload;
  return jwt.sign(cleanPayload, jwtSecret, { expiresIn: accessTokenExpiresIn });
}

export function verifyAccessToken(token: string): JwtPayload {
  const decoded = jwt.verify(token, jwtSecret);
  return JwtPayloadSchema.parse(decoded);
}

export function generateRefreshToken(): {
  token: string;
  tokenHash: string;
  expiresAt: Date;
} {
  const token = crypto.randomBytes(40).toString('hex');
  const tokenHash = hashToken(token);
  // Default 7 days
  const expiresAt = new Date(Date.now() + 7 * 24 * 60 * 60 * 1000);
  return { token, tokenHash, expiresAt };
}

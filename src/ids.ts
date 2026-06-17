import { randomBytes } from 'node:crypto';

export function createPublicId(): string {
  return randomBytes(16).toString('base64url');
}

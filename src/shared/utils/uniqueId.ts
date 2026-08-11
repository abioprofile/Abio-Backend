import crypto from 'node:crypto';
import { customAlphabet } from "nanoid";

export const generateUniqueId = (length: number = 10): string => {
  const alphabet = "0123456789";
  const nanoid = customAlphabet(alphabet, length);
  return nanoid();
};

export function generateRandomBase32() {
  const chars = "ABCDEFGHIJKLMNOPQRSTUVWXYZ234567";
  const bytes = crypto.randomBytes(20);
  let secret = "";

  // Process 5 bits at a time from the random bytes
  let buffer = 0,
    bitsLeft = 0;
  for (const byte of bytes) {
    buffer = (buffer << 8) | byte;
    bitsLeft += 8;
    while (bitsLeft >= 5) {
      bitsLeft -= 5;
      secret += chars[(buffer >> bitsLeft) & 31];
    }
  }

  return secret; // → "JBSWY3DPEHPK3PXP..."
}
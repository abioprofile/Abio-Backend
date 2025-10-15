import { customAlphabet } from "nanoid";


export const generateUniqueId = (length: number = 10): string => {
  const alphabet = "0123456789";
  const nanoid = customAlphabet(alphabet, length);
  return nanoid();
};

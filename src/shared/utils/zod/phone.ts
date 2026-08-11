import parsePhoneNumberFromString from "libphonenumber-js";
import { z } from "zod";

// Normalizes to E.164 when valid. Open to all countries (no default country).
export const zPhone = z.string().transform((arg, ctx) => {
  const phone = parsePhoneNumberFromString(
    arg,
    {
      // Require the whole string to be a phone number
      extract: false,
    } as any
  );

  if (phone && phone.isValid()) {
    return phone.number; // E.164 format
  }

  ctx.addIssue({
    code: z.ZodIssueCode.custom,
    message: "Invalid phone number. Use international format, e.g. +14155552671",
  });
  return z.NEVER;
});



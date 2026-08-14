import crypto from "crypto";
import { prisma } from "@/shared/config/database";
import passport, { PassportStatic } from "passport";
import {
  Profile,
  Strategy as GoogleStrategy,
  VerifyCallback,
} from "passport-google-oauth20";

/** Mark first-time Google signups so the controller can enqueue welcome email. */
export type GoogleAuthUser = {
  id: string;
  email: string;
  name: string;
  [key: string]: unknown;
  __isNewGoogleSignup?: boolean;
};

const setupPassport = (passportInstance: PassportStatic) => {
  passportInstance.use(
    new GoogleStrategy(
      {
        clientID: process.env.GOOGLE_OAUTH_CLIENT_ID!,
        clientSecret: process.env.GOOGLE_OAUTH_CLIENT_SECRET!,
        callbackURL: process.env.GOOGLE_OAUTH_CALLBACK_URL!,
      },
      async (
        _accessToken: string,
        _refreshToken: string,
        profile: Profile,
        done: VerifyCallback
      ) => {
        try {
          const email = profile.emails?.[0]?.value;
          if (!email) {
            return done(null, false, { message: "GOOGLE_EMAIL_MISSING" });
          }

          // Returning Google user (same Google account)
          const byGoogleId = await prisma.user.findFirst({
            where: { googleId: profile.id },
          });
          if (byGoogleId) {
            return done(null, byGoogleId as GoogleAuthUser);
          }

          const byEmail = await prisma.user.findUnique({
            where: { email },
          });

          // Email already used by password (or other) signup — do not merge
          if (byEmail) {
            return done(null, false, { message: "EMAIL_ALREADY_REGISTERED" });
          }

          // First-time Google signup
          const user = await prisma.user.create({
            data: {
              email,
              name: profile.displayName || email.split("@")[0],
              active: true,
              isEmailVerified: true,
              // Unusable random password — Google users must not log in with ""
              password: crypto.randomBytes(32).toString("hex"),
              googleId: profile.id,
              profile: {
                create: {
                  avatarUrl: profile.photos?.[0]?.value,
                  isPublic: true,
                },
              },
            },
          });

          const authUser = user as GoogleAuthUser;
          authUser.__isNewGoogleSignup = true;
          return done(null, authUser);
        } catch (error) {
          return done(error as Error);
        }
      }
    )
  );

  return passportInstance;
};

export default setupPassport;

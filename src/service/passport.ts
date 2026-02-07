import { prisma } from "@/server";
import { UserService } from "@/service/user.service";
import passport, { PassportStatic } from "passport";
import { Profile, Strategy as GoogleStrategy, VerifyCallback } from "passport-google-oauth20";

const setupPassport = (passport: PassportStatic) => {
    passport.use(
      new GoogleStrategy(
        {
          clientID: process.env.GOOGLE_OAUTH_CLIENT_ID!,
          clientSecret: process.env.GOOGLE_OAUTH_CLIENT_SECRET!,
          callbackURL: process.env.GOOGLE_OAUTH_CALLBACK_URL!,
        },
        async (accessToken: string, refreshToken: string, profile: Profile, done: VerifyCallback) => {
            const email = profile.emails![0].value;
            let user = await (new UserService).findByEmail(email);

            if (!user) {
                user = await prisma.user.create({
                    data: {
                        email: email,
                        name: profile.displayName,
                        active: true,
                        isEmailVerified: true,
                        password: "",
                        googleId: profile.id,
                    }
                });

                await prisma.profile.create({
                    data: {
                        userId: user.id,
                        avatarUrl: profile.photos![0].value,
                        isPublic: true,
                    }
                })
            } else {
                await prisma.user.update({
                    where: {
                        email: email,
                    },
                    data: {
                        googleId: profile.id,
                    }
                })
            }

            done(null, user);
        },
      ),
    );
    
    return passport;
}


export default setupPassport;
import NextAuth from "next-auth";
import Credentials from "next-auth/providers/credentials";
import { eq } from "drizzle-orm";
import bcrypt from "bcryptjs";
import { redirect } from "next/navigation";

import { db } from "@/lib/db";
import { users } from "@/db/schema";
import { loginSchema } from "@/lib/validations/auth";
import { log } from "@/lib/logger";

// Session/JWT lifetime: 15 min rolling, refresh on activity.
// Password reset sets users.password_changed_at; tokens issued before then
// are rejected in the jwt callback, forcing re-login across devices within
// the window.
const SESSION_MAX_AGE = 15 * 60;
const SESSION_UPDATE_AGE = 5 * 60;

// Clock-skew fudge for passwordChangedAt vs JWT iat comparison (2s).
const CLOCK_SKEW_MS = 2000;

export const { handlers, auth, signIn, signOut } = NextAuth({
  session: {
    strategy: "jwt",
    maxAge: SESSION_MAX_AGE,
    updateAge: SESSION_UPDATE_AGE,
  },
  pages: {
    signIn: "/auth/login",
  },
  providers: [
    Credentials({
      name: "credentials",
      credentials: {
        email: { label: "E-post", type: "email" },
        password: { label: "Lösenord", type: "password" },
      },
      async authorize(credentials) {
        const parsed = loginSchema.safeParse(credentials);
        if (!parsed.success) {
          log.warn("auth: invalid credentials shape");
          return null;
        }

        const { email, password } = parsed.data;

        const user = await db.query.users.findFirst({
          where: eq(users.email, email),
        });

        if (!user) {
          log.info("auth: login failed — unknown email", { email });
          return null;
        }
        if (!user.emailVerified) {
          log.info("auth: login blocked — email not verified", { email });
          return null;
        }
        if (user.isBanned) {
          log.warn("auth: login blocked — user is banned", { userId: user.id });
          return null;
        }

        const passwordMatch = await bcrypt.compare(password, user.passwordHash);
        if (!passwordMatch) {
          log.info("auth: login failed — bad password", { email });
          return null;
        }

        log.info("auth: login success", { userId: user.id });
        return {
          id: user.id,
          email: user.email,
          name: user.displayName,
          image: user.avatarUrl,
          passwordChangedAt: user.passwordChangedAt
            ? user.passwordChangedAt.getTime()
            : null,
        };
      },
    }),
  ],
  callbacks: {
    async jwt({ token, user }) {
      if (user) {
        token.id = (user as { id: string }).id;
        const pca = (user as { passwordChangedAt?: number | null })
          .passwordChangedAt;
        if (typeof pca === "number") {
          token.passwordChangedAt = pca;
        }
      }

      // Session invalidation after password reset. iat is in seconds; the
      // passwordChangedAt claim is in ms. A 2s skew buffer prevents the
      // session that TRIGGERED the reset from logging itself out mid-request.
      // If this token predates the recorded change, null out the identity
      // so the session callback rejects it.
      if (typeof token.iat === "number" && token.passwordChangedAt) {
        const iatMs = token.iat * 1000;
        const changedMs = token.passwordChangedAt as number;
        if (iatMs + CLOCK_SKEW_MS < changedMs) {
          token.id = undefined;
        }
      }

      return token;
    },
    async session({ session, token }) {
      if (session.user && token?.id) {
        session.user.id = token.id as string;
      } else if (session.user && !token?.id) {
        session.user = undefined as unknown as typeof session.user;
      }
      return session;
    },
  },
});

export async function requireAuth() {
  const session = await auth();
  if (!session?.user?.id) {
    redirect("/auth/login");
  }
  return session.user as { id: string; email: string; name?: string | null; image?: string | null };
}

export async function requireAdmin() {
  const user = await requireAuth();
  const profile = await db.query.users.findFirst({
    where: eq(users.id, user.id),
  });

  if (!profile?.isAdmin || profile.isBanned) {
    throw new Error("Åtkomst nekad");
  }

  return { user, profile };
}

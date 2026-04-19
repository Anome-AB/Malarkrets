import NextAuth from "next-auth";
import Credentials from "next-auth/providers/credentials";
import { eq } from "drizzle-orm";
import bcrypt from "bcryptjs";
import { redirect } from "next/navigation";

import { db } from "@/lib/db";
import { users } from "@/db/schema";
import { loginSchema } from "@/lib/validations/auth";
import { log } from "@/lib/logger";

export const { handlers, auth, signIn, signOut } = NextAuth({
  session: { strategy: "jwt" },
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
        };
      },
    }),
  ],
  callbacks: {
    async jwt({ token, user }) {
      if (user) {
        token.id = user.id;
      }
      return token;
    },
    async session({ session, token }) {
      if (session.user && token.id) {
        session.user.id = token.id as string;
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

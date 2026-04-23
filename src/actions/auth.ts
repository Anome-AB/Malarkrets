"use server";

import { eq } from "drizzle-orm";
import bcrypt from "bcryptjs";
import { headers } from "next/headers";

import { signOut } from "@/lib/auth";
import { db } from "@/lib/db";
import { users } from "@/db/schema";
import { registerSchema } from "@/lib/validations/auth";
import { sendVerificationEmail } from "@/lib/email";
import { createToken, consumeToken, getClientIp } from "@/lib/tokens";
import { log, errAttrs } from "@/lib/logger";

export async function register(formData: FormData) {
  const raw = {
    email: formData.get("email") as string,
    password: formData.get("password") as string,
    confirmPassword: formData.get("confirmPassword") as string,
  };

  const parsed = registerSchema.safeParse(raw);
  if (!parsed.success) {
    return { error: parsed.error.flatten().fieldErrors };
  }

  const { email, password } = parsed.data;

  const existingUser = await db.query.users.findFirst({
    where: eq(users.email, email),
  });

  if (existingUser) {
    return { error: { email: ["En användare med denna e-postadress finns redan"] } };
  }

  const passwordHash = await bcrypt.hash(password, 12);

  const [inserted] = await db
    .insert(users)
    .values({
      email,
      passwordHash,
      emailVerified: false,
    })
    .returning({ id: users.id });

  const hdrs = await headers();
  const ip = getClientIp(hdrs);

  const { rawToken } = await createToken({
    userId: inserted.id,
    email,
    ip,
    type: "verify_email",
  });

  try {
    await sendVerificationEmail(email, rawToken);
  } catch (err) {
    log.error("sendVerificationEmail failed", { ...errAttrs(err), email });
  }

  return { success: true };
}

export async function logOut() {
  await signOut({ redirectTo: "/" });
}

export async function checkBanStatus(email: string) {
  const user = await db.query.users.findFirst({
    where: eq(users.email, email),
    columns: { isBanned: true, banReason: true },
  });

  if (!user || !user.isBanned) {
    return { banned: false };
  }

  return { banned: true, reason: user.banReason ?? undefined };
}

export async function verifyEmail(token: string) {
  const result = await consumeToken(token, "verify_email");

  if (!result.ok) {
    return { error: "Ogiltig eller utgången verifieringslänk" };
  }

  if (!result.token.userId) {
    return { error: "Ogiltig eller utgången verifieringslänk" };
  }

  await db
    .update(users)
    .set({ emailVerified: true })
    .where(eq(users.id, result.token.userId));

  return { success: true };
}

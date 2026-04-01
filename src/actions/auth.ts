"use server";

import { eq } from "drizzle-orm";
import bcrypt from "bcryptjs";
import crypto from "crypto";

import { db } from "@/lib/db";
import { users } from "@/db/schema";
import { registerSchema } from "@/lib/validations/auth";

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
  const emailVerificationToken = crypto.randomUUID();

  await db.insert(users).values({
    email,
    passwordHash,
    emailVerificationToken,
    emailVerified: false,
  });

  return { success: true };
}

export async function verifyEmail(token: string) {
  const user = await db.query.users.findFirst({
    where: eq(users.emailVerificationToken, token),
  });

  if (!user) {
    return { error: "Ogiltig eller utgången verifieringslänk" };
  }

  await db
    .update(users)
    .set({
      emailVerified: true,
      emailVerificationToken: null,
    })
    .where(eq(users.id, user.id));

  return { success: true };
}

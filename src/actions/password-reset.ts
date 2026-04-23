"use server";

import { eq } from "drizzle-orm";
import bcrypt from "bcryptjs";
import { headers } from "next/headers";

import { db } from "@/lib/db";
import { users } from "@/db/schema";
import {
  forgotPasswordSchema,
  resetPasswordSchema,
} from "@/lib/validations/auth";
import { sendPasswordResetEmail } from "@/lib/email";
import {
  createToken,
  consumeToken,
  hashEmail,
  getClientIp,
} from "@/lib/tokens";
import { checkTokenRateLimit } from "@/lib/rate-limit";
import { log, errAttrs } from "@/lib/logger";

const RATE_LIMIT_WINDOW_MINUTES = 15;
const RATE_LIMIT_MAX = 5;

const NEUTRAL_MESSAGE =
  "Om adressen finns hos oss har vi skickat en återställningslänk till den. Kolla inkorgen.";

async function jitter() {
  const ms = 100 + Math.floor(Math.random() * 200);
  await new Promise((r) => setTimeout(r, ms));
}

type ForgotPasswordResult =
  | { success: true; message: string }
  | { success: false; error: string };

export async function forgotPassword(
  formData: FormData,
): Promise<ForgotPasswordResult> {
  const raw = { email: formData.get("email") as string };
  const parsed = forgotPasswordSchema.safeParse(raw);

  if (!parsed.success) {
    const firstError =
      parsed.error.flatten().fieldErrors.email?.[0] ??
      "Ogiltig e-postadress";
    return { success: false, error: firstError };
  }

  const email = parsed.data.email.toLowerCase().trim();
  const emailH = hashEmail(email);

  const hdrs = await headers();
  const ip = getClientIp(hdrs);

  const { allowed } = await checkTokenRateLimit({
    emailHash: emailH,
    ip,
    type: "reset_password",
    windowMinutes: RATE_LIMIT_WINDOW_MINUTES,
    max: RATE_LIMIT_MAX,
  });

  if (!allowed) {
    log.warn("password-reset: rate limit exceeded", { emailH, ip });
    await jitter();
    return { success: true, message: NEUTRAL_MESSAGE };
  }

  try {
    const user = await db.query.users.findFirst({
      where: eq(users.email, email),
      columns: { id: true, email: true, isBanned: true, emailVerified: true },
    });

    if (user && !user.isBanned && user.emailVerified) {
      const { rawToken } = await createToken({
        userId: user.id,
        email,
        ip,
        type: "reset_password",
      });

      try {
        await sendPasswordResetEmail(user.email, rawToken);
        log.info("password-reset: email sent", { userId: user.id });
      } catch (err) {
        log.error("password-reset: sendPasswordResetEmail failed", {
          ...errAttrs(err),
          userId: user.id,
        });
      }
    } else if (user) {
      log.info("password-reset: skipped (banned or unverified)", {
        userId: user.id,
      });
    } else {
      log.info("password-reset: unknown email");
    }
  } catch (err) {
    log.error("password-reset: forgotPassword failed", errAttrs(err));
  }

  await jitter();
  return { success: true, message: NEUTRAL_MESSAGE };
}

type ResetPasswordResult =
  | { success: true }
  | { success: false; error: string };

export async function resetPassword(
  formData: FormData,
): Promise<ResetPasswordResult> {
  const raw = {
    token: formData.get("token") as string,
    password: formData.get("password") as string,
    confirmPassword: formData.get("confirmPassword") as string,
  };

  const parsed = resetPasswordSchema.safeParse(raw);
  if (!parsed.success) {
    const flat = parsed.error.flatten().fieldErrors;
    const firstError =
      flat.password?.[0] ??
      flat.confirmPassword?.[0] ??
      flat.token?.[0] ??
      "Ogiltiga uppgifter";
    return { success: false, error: firstError };
  }

  const { token, password } = parsed.data;

  const result = await consumeToken(token, "reset_password");
  if (!result.ok) {
    log.info("password-reset: token consume failed", { reason: result.reason });
    return {
      success: false,
      error: "Länken är ogiltig eller har gått ut. Begär en ny.",
    };
  }

  if (!result.token.userId) {
    log.warn("password-reset: token has no userId");
    return { success: false, error: "Länken är ogiltig. Begär en ny." };
  }

  const user = await db.query.users.findFirst({
    where: eq(users.id, result.token.userId),
    columns: { id: true, isBanned: true },
  });

  if (!user) {
    log.warn("password-reset: user missing for token", {
      tokenId: result.token.id,
    });
    return { success: false, error: "Länken är ogiltig. Begär en ny." };
  }

  if (user.isBanned) {
    log.warn("password-reset: banned user attempted reset", {
      userId: user.id,
    });
    return {
      success: false,
      error: "Kontot är spärrat. Kontakta support.",
    };
  }

  const passwordHash = await bcrypt.hash(password, 12);
  const now = new Date();

  await db
    .update(users)
    .set({ passwordHash, passwordChangedAt: now })
    .where(eq(users.id, user.id));

  log.info("password-reset: password updated", { userId: user.id });

  return { success: true };
}

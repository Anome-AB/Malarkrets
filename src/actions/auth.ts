"use server";

import { eq } from "drizzle-orm";
import bcrypt from "bcryptjs";
import { headers } from "next/headers";

import { signOut } from "@/lib/auth";
import { db } from "@/lib/db";
import { users } from "@/db/schema";
import {
  registerSchema,
  resendVerificationSchema,
} from "@/lib/validations/auth";
import { sendVerificationEmail } from "@/lib/email";
import {
  createToken,
  consumeToken,
  getClientIp,
  hashEmail,
} from "@/lib/tokens";
import { checkTokenRateLimit } from "@/lib/rate-limit";
import { log, errAttrs } from "@/lib/logger";

const RESEND_RATE_LIMIT_WINDOW_MINUTES = 15;
const RESEND_RATE_LIMIT_MAX = 3;

// Samma neutrala svar oavsett om adressen finns, är bannad eller redan är
// verifierad, så formuläret inte går att använda för att kartlägga vilka
// adresser som har konto. Samma resonemang som i forgotPassword.
const RESEND_NEUTRAL_MESSAGE =
  "Om adressen finns hos oss och inte är bekräftad än har vi skickat en ny länk till den. Kolla inkorgen.";

async function jitter() {
  const ms = 100 + Math.floor(Math.random() * 200);
  await new Promise((r) => setTimeout(r, ms));
}

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

  // Ett misslyckat utskick får inte riva registreringen - kontot finns redan
  // och token är skapad, så användaren ska kunna begära en ny länk istället.
  // Men vi påstår inte att mailet gick iväg när det inte gjorde det:
  // emailSent styr vad kvittot säger.
  let emailSent = true;
  try {
    await sendVerificationEmail(email, rawToken);
  } catch (err) {
    emailSent = false;
    log.error("sendVerificationEmail failed", { ...errAttrs(err), email });
  }

  return { success: true, emailSent };
}

type ResendVerificationResult =
  | { success: true; message: string }
  | { success: false; error: string };

/**
 * Skickar en ny verifieringslänk till en adress som registrerats men aldrig
 * bekräftats. Utan den här vägen fastnar kontot: inloggning kräver
 * emailVerified, och lösenordsåterställning gör det också, så en adress vars
 * första mail aldrig kom fram går inte att rädda utan DB-access.
 *
 * createToken ogiltigförklarar tidigare oanvända verify_email-tokens för
 * samma användare, så den gamla länken slutar fungera när en ny skickas.
 */
export async function resendVerificationEmail(
  formData: FormData,
): Promise<ResendVerificationResult> {
  const parsed = resendVerificationSchema.safeParse({
    email: formData.get("email") as string,
  });

  if (!parsed.success) {
    const firstError =
      parsed.error.flatten().fieldErrors.email?.[0] ?? "Ogiltig e-postadress";
    return { success: false, error: firstError };
  }

  const email = parsed.data.email.toLowerCase().trim();
  const emailH = hashEmail(email);

  const hdrs = await headers();
  const ip = getClientIp(hdrs);

  const { allowed } = await checkTokenRateLimit({
    emailHash: emailH,
    ip,
    type: "verify_email",
    windowMinutes: RESEND_RATE_LIMIT_WINDOW_MINUTES,
    max: RESEND_RATE_LIMIT_MAX,
  });

  if (!allowed) {
    log.warn("verify-resend: rate limit exceeded", { emailH, ip });
    await jitter();
    return { success: true, message: RESEND_NEUTRAL_MESSAGE };
  }

  try {
    const user = await db.query.users.findFirst({
      where: eq(users.email, email),
      columns: { id: true, email: true, isBanned: true, emailVerified: true },
    });

    if (user && !user.isBanned && !user.emailVerified) {
      const { rawToken } = await createToken({
        userId: user.id,
        email,
        ip,
        type: "verify_email",
      });

      try {
        await sendVerificationEmail(user.email, rawToken);
        log.info("verify-resend: email sent", { userId: user.id });
      } catch (err) {
        log.error("verify-resend: sendVerificationEmail failed", {
          ...errAttrs(err),
          userId: user.id,
        });
      }
    } else if (user) {
      log.info("verify-resend: skipped (banned or already verified)", {
        userId: user.id,
      });
    } else {
      log.info("verify-resend: unknown email");
    }
  } catch (err) {
    log.error("verify-resend: resendVerificationEmail failed", errAttrs(err));
  }

  await jitter();
  return { success: true, message: RESEND_NEUTRAL_MESSAGE };
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

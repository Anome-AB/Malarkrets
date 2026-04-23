import { Resend } from "resend";

let client: Resend | null = null;

function getClient(): Resend {
  if (!client) {
    const key = process.env.RESEND_API_KEY;
    if (!key) {
      throw new Error("RESEND_API_KEY is not set");
    }
    client = new Resend(key);
  }
  return client;
}

function getFrom(): string {
  return process.env.EMAIL_FROM ?? "noreply@malarkrets.se";
}

function getBaseUrl(): string {
  return process.env.AUTH_URL ?? "http://localhost:3000";
}

type AuthEmailInput = {
  to: string;
  subject: string;
  heading: string;
  paragraph: string;
  ctaLabel: string;
  link: string;
  footer?: string;
};

async function sendAuthEmail(input: AuthEmailInput): Promise<void> {
  const { to, subject, heading, paragraph, ctaLabel, link, footer } = input;
  const footerText =
    footer ?? "Om du inte begärde detta kan du ignorera meddelandet.";

  const html = `
    <div style="font-family: system-ui, -apple-system, sans-serif; max-width: 480px; margin: 0 auto; padding: 24px;">
      <h1 style="font-size: 20px; margin: 0 0 16px;">${heading}</h1>
      <p style="font-size: 14px; line-height: 1.5; color: #333;">${paragraph}</p>
      <p style="margin: 24px 0;">
        <a href="${link}" style="display: inline-block; background: #c4956a; color: white; padding: 10px 20px; border-radius: 6px; text-decoration: none; font-size: 14px;">${ctaLabel}</a>
      </p>
      <p style="font-size: 13px; color: #666; word-break: break-all;">
        Eller öppna länken direkt: <br />
        <a href="${link}">${link}</a>
      </p>
      <p style="font-size: 12px; color: #888; margin-top: 32px;">${footerText}</p>
    </div>
  `;

  const text = `${heading}\n\n${paragraph}\n\n${ctaLabel}: ${link}\n\n${footerText}`;

  const { error } = await getClient().emails.send({
    from: getFrom(),
    to,
    subject,
    html,
    text,
  });

  if (error) {
    throw new Error(`Resend failed: ${error.message}`);
  }
}

export async function sendVerificationEmail(
  email: string,
  token: string,
): Promise<void> {
  const link = `${getBaseUrl()}/auth/verify?token=${token}`;
  await sendAuthEmail({
    to: email,
    subject: "Bekräfta din e-postadress",
    heading: "Välkommen till Mälarkrets",
    paragraph:
      "Tack för att du registrerat dig. Klicka på knappen för att bekräfta din e-postadress så kommer du igång.",
    ctaLabel: "Bekräfta e-post",
    link,
    footer: "Om du inte skapade ett konto kan du ignorera detta meddelande.",
  });
}

export async function sendPasswordResetEmail(
  email: string,
  token: string,
): Promise<void> {
  const link = `${getBaseUrl()}/auth/reset-password?token=${token}`;
  await sendAuthEmail({
    to: email,
    subject: "Återställ ditt lösenord",
    heading: "Återställ ditt lösenord",
    paragraph:
      "Vi tog emot en begäran om att återställa lösenordet för ditt konto. Klicka på knappen för att välja ett nytt lösenord. Länken är giltig i en timme.",
    ctaLabel: "Välj nytt lösenord",
    link,
    footer:
      "Om du inte begärde återställning kan du ignorera detta meddelande. Ditt nuvarande lösenord fortsätter gälla.",
  });
}

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

export async function sendVerificationEmail(
  email: string,
  token: string,
): Promise<void> {
  const link = `${getBaseUrl()}/auth/verify?token=${token}`;
  const { error } = await getClient().emails.send({
    from: getFrom(),
    to: email,
    subject: "Bekräfta din e-postadress",
    html: `
      <p>Hej!</p>
      <p>Tack för att du registrerat dig på Mälarkrets. Klicka på länken nedan för att bekräfta din e-postadress:</p>
      <p><a href="${link}">${link}</a></p>
      <p>Om du inte skapade ett konto kan du ignorera detta meddelande.</p>
    `,
    text: `Hej!\n\nTack för att du registrerat dig på Mälarkrets. Öppna länken nedan för att bekräfta din e-postadress:\n\n${link}\n\nOm du inte skapade ett konto kan du ignorera detta meddelande.`,
  });
  if (error) {
    throw new Error(`Resend failed: ${error.message}`);
  }
}

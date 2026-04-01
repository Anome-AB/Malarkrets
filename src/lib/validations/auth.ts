import { z } from "zod";

export const registerSchema = z.object({
  email: z.string().email("Ogiltig e-postadress"),
  password: z.string().min(12, "Lösenordet måste vara minst 12 tecken"),
  confirmPassword: z.string(),
}).refine((data) => data.password === data.confirmPassword, {
  message: "Lösenorden matchar inte",
  path: ["confirmPassword"],
});

export const loginSchema = z.object({
  email: z.string().email("Ogiltig e-postadress"),
  password: z.string().min(1, "Ange ditt lösenord"),
});

export type RegisterInput = z.infer<typeof registerSchema>;
export type LoginInput = z.infer<typeof loginSchema>;

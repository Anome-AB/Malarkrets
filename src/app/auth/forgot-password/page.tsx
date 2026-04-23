"use client";

import { useState } from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import Link from "next/link";

import {
  forgotPasswordSchema,
  type ForgotPasswordInput,
} from "@/lib/validations/auth";
import { forgotPassword } from "@/actions/password-reset";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";

export default function ForgotPasswordPage() {
  const [submitted, setSubmitted] = useState<string | null>(null);
  const [formError, setFormError] = useState<string | null>(null);

  const {
    register,
    handleSubmit,
    formState: { errors, isSubmitting },
  } = useForm<ForgotPasswordInput>({
    resolver: zodResolver(forgotPasswordSchema),
  });

  async function onSubmit(data: ForgotPasswordInput) {
    setFormError(null);

    const fd = new FormData();
    fd.append("email", data.email);

    const result = await forgotPassword(fd);

    if (result.success) {
      setSubmitted(result.message);
      return;
    }

    setFormError(result.error);
  }

  if (submitted) {
    return (
      <div className="w-full max-w-md rounded-card bg-white p-8 shadow">
        <div className="text-center">
          <h1 className="text-2xl font-bold text-primary">Mälarkrets</h1>
          <p className="mt-4 text-sm text-heading">{submitted}</p>
          <p className="mt-2 text-xs text-secondary">
            Hittar du inte mailet? Kolla skräpposten. Länken är giltig i en
            timme.
          </p>
          <Link
            href="/auth/login"
            className="mt-6 inline-block text-sm font-medium text-primary hover:underline"
          >
            Tillbaka till inloggning
          </Link>
        </div>
      </div>
    );
  }

  return (
    <div className="w-full max-w-md rounded-card bg-white p-8 shadow">
      <div className="mb-8 text-center">
        <h1 className="text-2xl font-bold text-primary">Mälarkrets</h1>
        <p className="mt-1 text-sm text-secondary">Återställ ditt lösenord</p>
      </div>

      <form onSubmit={handleSubmit(onSubmit)} className="flex flex-col gap-4">
        <p className="text-sm text-heading">
          Ange e-postadressen du registrerade dig med. Om den finns hos oss
          skickar vi en länk för att välja nytt lösenord.
        </p>

        <Input
          label="E-post"
          type="email"
          autoComplete="email"
          placeholder="namn@exempel.se"
          error={errors.email?.message}
          {...register("email")}
        />

        {formError && (
          <p className="text-sm text-error" role="alert">
            {formError}
          </p>
        )}

        <Button type="submit" loading={isSubmitting} className="mt-2 w-full">
          Skicka återställningslänk
        </Button>
      </form>

      <p className="mt-6 text-center text-sm text-secondary">
        Kom du på lösenordet?{" "}
        <Link
          href="/auth/login"
          className="font-medium text-primary hover:underline"
        >
          Logga in
        </Link>
      </p>
    </div>
  );
}

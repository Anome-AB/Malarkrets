"use client";

import { useState } from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import Link from "next/link";

import {
  resendVerificationSchema,
  type ResendVerificationInput,
} from "@/lib/validations/auth";
import { resendVerificationEmail } from "@/actions/auth";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";

export default function VerifyResendPage() {
  const [submitted, setSubmitted] = useState<string | null>(null);
  const [formError, setFormError] = useState<string | null>(null);

  const {
    register,
    handleSubmit,
    formState: { errors, isSubmitting },
  } = useForm<ResendVerificationInput>({
    resolver: zodResolver(resendVerificationSchema),
  });

  async function onSubmit(data: ResendVerificationInput) {
    setFormError(null);

    const fd = new FormData();
    fd.append("email", data.email);

    const result = await resendVerificationEmail(fd);

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
          <h1 className="text-2xl font-bold text-primary">Vänliga Västerås</h1>
          <p className="mt-4 text-sm text-heading">{submitted}</p>
          <p className="mt-2 text-xs text-secondary">
            Hittar du inte mailet? Kolla skräpposten. Länken är giltig i ett
            dygn, och den ersätter eventuella tidigare länkar.
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
        <h1 className="text-2xl font-bold text-primary">Vänliga Västerås</h1>
        <p className="mt-1 text-sm text-secondary">
          Skicka en ny bekräftelselänk
        </p>
      </div>

      <form onSubmit={handleSubmit(onSubmit)} className="flex flex-col gap-4">
        <p className="text-sm text-heading">
          Ange e-postadressen du registrerade dig med. Har du inte bekräftat
          den än skickar vi en ny länk.
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
          Skicka ny länk
        </Button>
      </form>

      <p className="mt-6 text-center text-sm text-secondary">
        Redan bekräftad?{" "}
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

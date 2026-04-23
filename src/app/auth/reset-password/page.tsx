"use client";

import { Suspense, useState } from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { useRouter, useSearchParams } from "next/navigation";
import Link from "next/link";

import {
  resetPasswordSchema,
  type ResetPasswordInput,
} from "@/lib/validations/auth";
import { resetPassword } from "@/actions/password-reset";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";

function ResetPasswordForm() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const token = searchParams.get("token") ?? "";
  const [formError, setFormError] = useState<string | null>(null);
  const [done, setDone] = useState(false);

  const {
    register,
    handleSubmit,
    formState: { errors, isSubmitting },
  } = useForm<ResetPasswordInput>({
    resolver: zodResolver(resetPasswordSchema),
    defaultValues: { token },
  });

  async function onSubmit(data: ResetPasswordInput) {
    setFormError(null);

    const fd = new FormData();
    fd.append("token", data.token);
    fd.append("password", data.password);
    fd.append("confirmPassword", data.confirmPassword);

    const result = await resetPassword(fd);

    if (result.success) {
      setDone(true);
      setTimeout(() => router.push("/auth/login"), 2500);
      return;
    }

    setFormError(result.error);
  }

  if (!token) {
    return (
      <div className="w-full max-w-md rounded-card bg-white p-8 shadow">
        <div className="text-center">
          <h1 className="text-2xl font-bold text-primary">Mälarkrets</h1>
          <p className="mt-4 text-sm text-error">
            Länken saknar token. Begär en ny återställningslänk.
          </p>
          <Link
            href="/auth/forgot-password"
            className="mt-4 inline-block text-sm font-medium text-primary hover:underline"
          >
            Begär ny länk
          </Link>
        </div>
      </div>
    );
  }

  if (done) {
    return (
      <div className="w-full max-w-md rounded-card bg-white p-8 shadow">
        <div className="text-center">
          <h1 className="text-2xl font-bold text-primary">Mälarkrets</h1>
          <p className="mt-4 text-sm text-heading">
            Lösenordet är uppdaterat. Du kan logga in med det nya lösenordet.
          </p>
          <Link
            href="/auth/login"
            className="mt-4 inline-block text-sm font-medium text-primary hover:underline"
          >
            Gå till inloggning
          </Link>
        </div>
      </div>
    );
  }

  return (
    <div className="w-full max-w-md rounded-card bg-white p-8 shadow">
      <div className="mb-8 text-center">
        <h1 className="text-2xl font-bold text-primary">Mälarkrets</h1>
        <p className="mt-1 text-sm text-secondary">Välj ett nytt lösenord</p>
      </div>

      <form onSubmit={handleSubmit(onSubmit)} className="flex flex-col gap-4">
        <input type="hidden" {...register("token")} />

        <Input
          label="Nytt lösenord"
          type="password"
          autoComplete="new-password"
          placeholder="Minst 12 tecken"
          error={errors.password?.message}
          {...register("password")}
        />

        <Input
          label="Bekräfta lösenord"
          type="password"
          autoComplete="new-password"
          placeholder="Upprepa lösenordet"
          error={errors.confirmPassword?.message}
          {...register("confirmPassword")}
        />

        {formError && (
          <p className="text-sm text-error" role="alert">
            {formError}
          </p>
        )}

        <Button type="submit" loading={isSubmitting} className="mt-2 w-full">
          Spara nytt lösenord
        </Button>
      </form>

      <p className="mt-6 text-center text-sm text-secondary">
        <Link
          href="/auth/login"
          className="font-medium text-primary hover:underline"
        >
          Tillbaka till inloggning
        </Link>
      </p>
    </div>
  );
}

export default function ResetPasswordPage() {
  return (
    <Suspense
      fallback={
        <div className="w-full max-w-md rounded-card bg-white p-8 shadow animate-pulse h-96" />
      }
    >
      <ResetPasswordForm />
    </Suspense>
  );
}

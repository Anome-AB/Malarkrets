"use client";

import { Suspense, useState } from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { signIn } from "next-auth/react";
import { useRouter, useSearchParams } from "next/navigation";
import Link from "next/link";

import { loginSchema, type LoginInput } from "@/lib/validations/auth";
import { checkBanStatus } from "@/actions/auth";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";

function LoginForm() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const callbackUrl = searchParams.get("callbackUrl") || "/";
  const [error, setError] = useState<string | null>(null);
  const [banInfo, setBanInfo] = useState<{ reason?: string } | null>(null);

  const {
    register,
    handleSubmit,
    formState: { errors, isSubmitting },
  } = useForm<LoginInput>({
    resolver: zodResolver(loginSchema),
  });

  async function onSubmit(data: LoginInput) {
    setError(null);
    setBanInfo(null);

    const result = await signIn("credentials", {
      email: data.email,
      password: data.password,
      redirect: false,
    });

    if (result?.error) {
      // Check if user is banned
      const ban = await checkBanStatus(data.email);
      if (ban.banned) {
        setBanInfo({ reason: ban.reason });
        return;
      }
      setError("Felaktig e-post eller lösenord");
      return;
    }

    router.push(callbackUrl);
  }

  return (
    <div className="w-full max-w-md rounded-[10px] bg-white p-8 shadow">
      <div className="mb-8 text-center">
        <h1 className="text-2xl font-bold text-primary">Mälarkrets</h1>
        <p className="mt-1 text-sm text-secondary">Logga in på ditt konto</p>
      </div>

      <form onSubmit={handleSubmit(onSubmit)} className="flex flex-col gap-4">
        <Input
          label="E-post"
          type="email"
          autoComplete="email"
          placeholder="namn@exempel.se"
          error={errors.email?.message}
          {...register("email")}
        />

        <Input
          label="Lösenord"
          type="password"
          autoComplete="current-password"
          placeholder="Ange ditt lösenord"
          error={errors.password?.message}
          {...register("password")}
        />

        {banInfo && (
          <div className="rounded-[8px] border border-error/30 bg-red-50 p-4" role="alert">
            <p className="text-sm font-semibold text-error mb-1">
              Ditt konto har blockerats av en administratör
            </p>
            {banInfo.reason && (
              <p className="text-sm text-secondary">
                Anledning: {banInfo.reason}
              </p>
            )}
          </div>
        )}

        {error && (
          <p className="text-sm text-error" role="alert">
            {error}
          </p>
        )}

        <Button type="submit" loading={isSubmitting} className="mt-2 w-full">
          Logga in
        </Button>
      </form>

      <p className="mt-6 text-center text-sm text-secondary">
        Inget konto?{" "}
        <Link
          href="/auth/register"
          className="font-medium text-primary hover:underline"
        >
          Registrera dig
        </Link>
      </p>
    </div>
  );
}

export default function LoginPage() {
  return (
    <Suspense fallback={<div className="w-full max-w-md rounded-[10px] bg-white p-8 shadow animate-pulse h-96" />}>
      <LoginForm />
    </Suspense>
  );
}

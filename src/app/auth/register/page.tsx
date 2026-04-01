"use client";

import { useState } from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { useRouter } from "next/navigation";
import Link from "next/link";

import { registerSchema, type RegisterInput } from "@/lib/validations/auth";
import { register as registerAction } from "@/actions/auth";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";

export default function RegisterPage() {
  const router = useRouter();
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState(false);

  const {
    register,
    handleSubmit,
    formState: { errors, isSubmitting },
  } = useForm<RegisterInput>({
    resolver: zodResolver(registerSchema),
  });

  async function onSubmit(data: RegisterInput) {
    setError(null);

    const formData = new FormData();
    formData.append("email", data.email);
    formData.append("password", data.password);
    formData.append("confirmPassword", data.confirmPassword);

    const result = await registerAction(formData);

    if (result.error) {
      const errorObj = result.error as Record<string, string[]>;
      const firstError = Object.values(errorObj).flat()[0];
      setError(firstError || "Något gick fel. Försök igen.");
      return;
    }

    setSuccess(true);
    setTimeout(() => {
      router.push("/auth/login");
    }, 3000);
  }

  if (success) {
    return (
      <div className="w-full max-w-md rounded-[10px] bg-white p-8 shadow">
        <div className="text-center">
          <h1 className="text-2xl font-bold text-[#3d6b5e]">Mälarkrets</h1>
          <p className="mt-4 text-sm text-[#2d2d2d]">
            Konto skapat! Kolla din e-post för verifiering.
          </p>
          <Link
            href="/auth/login"
            className="mt-4 inline-block text-sm font-medium text-[#3d6b5e] hover:underline"
          >
            Gå till inloggning
          </Link>
        </div>
      </div>
    );
  }

  return (
    <div className="w-full max-w-md rounded-[10px] bg-white p-8 shadow">
      <div className="mb-8 text-center">
        <h1 className="text-2xl font-bold text-[#3d6b5e]">Mälarkrets</h1>
        <p className="mt-1 text-sm text-[#666666]">Skapa ett nytt konto</p>
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

        {error && (
          <p className="text-sm text-[#dc3545]" role="alert">
            {error}
          </p>
        )}

        <Button type="submit" loading={isSubmitting} className="mt-2 w-full">
          Registrera
        </Button>
      </form>

      <p className="mt-6 text-center text-sm text-[#666666]">
        Redan medlem?{" "}
        <Link
          href="/auth/login"
          className="font-medium text-[#3d6b5e] hover:underline"
        >
          Logga in
        </Link>
      </p>
    </div>
  );
}

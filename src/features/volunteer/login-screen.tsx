import { useState } from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { useMutation } from "@tanstack/react-query";
import { Link, useNavigate } from "@tanstack/react-router";
import { Eye, EyeOff, Info, Loader2 } from "lucide-react";
import { DEMO_PASSWORD, signIn } from "@/api/mock-api";
import { Brand } from "@/components/shared/common";
import { Button } from "@/components/ui/button";

const loginSchema = z.object({
  email: z
    .string()
    .trim()
    .min(1, "Enter your email address")
    .email("Enter an email address like name@example.com"),
  password: z.string().min(1, "Enter your password").min(8, "Passwords are at least 8 characters"),
});
type LoginValues = z.infer<typeof loginSchema>;

/** Volunteer sign-in. A demo: it checks the mock data, there's no real account system. */
export function LoginScreen() {
  const navigate = useNavigate();
  const [showPassword, setShowPassword] = useState(false);
  const { register, handleSubmit, formState } = useForm<LoginValues>({
    resolver: zodResolver(loginSchema),
    defaultValues: { email: "", password: "" },
    mode: "onTouched",
  });
  const { errors } = formState;
  const login = useMutation({
    mutationFn: ({ email, password }: LoginValues) => signIn(email, password),
  });

  // A wrong password is shown from login.error, so don't let it escape as an unhandled rejection.
  const onSubmit = handleSubmit((values) =>
    login.mutate(values, { onSuccess: () => navigate({ to: "/volunteer" }) }),
  );

  return (
    <div className="login-screen">
      <Brand />
      <h1>Welcome back</h1>
      <p className="muted">Sign in to see requests that fit you.</p>

      <form className="login-form" onSubmit={onSubmit} noValidate>
        {login.isError && (
          <p className="pref-alert" role="alert">
            {login.error.message}
          </p>
        )}
        <label className="cred-field">
          <span>Email address</span>
          <input
            type="email"
            autoComplete="email"
            inputMode="email"
            aria-invalid={Boolean(errors.email)}
            aria-describedby={errors.email ? "login-email-error" : undefined}
            {...register("email")}
          />
          {errors.email && (
            <span className="pref-error" id="login-email-error">
              {errors.email.message}
            </span>
          )}
        </label>
        <label className="cred-field">
          <span>Password</span>
          <span className="password-field">
            <input
              type={showPassword ? "text" : "password"}
              autoComplete="current-password"
              aria-invalid={Boolean(errors.password)}
              aria-describedby={errors.password ? "login-password-error" : undefined}
              {...register("password")}
            />
            <button
              type="button"
              onClick={() => setShowPassword((s) => !s)}
              aria-label={showPassword ? "Hide password" : "Show password"}
            >
              {showPassword ? <EyeOff /> : <Eye />}
            </button>
          </span>
          {errors.password && (
            <span className="pref-error" id="login-password-error">
              {errors.password.message}
            </span>
          )}
        </label>
        <Button type="submit" size="lg" className="w-full" disabled={login.isPending}>
          {login.isPending && <Loader2 className="animate-spin" />} Sign in
        </Button>
      </form>

      <p className="demo-hint">
        <Info aria-hidden="true" />
        <span>
          Demo account: <strong>isla@example.test</strong> with password{" "}
          <strong>{DEMO_PASSWORD}</strong>
        </span>
      </p>
      <Link to="/" className="login-back">
        Back to role selection
      </Link>
    </div>
  );
}

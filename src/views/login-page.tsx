"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useState } from "react";
import { BrandLockup, BrandMark } from "@/components/brand";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";

type FormMode = "signin" | "signup";

export function LoginPage() {
  const router = useRouter();
  const [mode, setMode] = useState<FormMode>("signin");
  const [fullName, setFullName] = useState("");
  const [centreName, setCentreName] = useState("");
  const [email, setEmail] = useState("");
  const [phone, setPhone] = useState("");
  const [city, setCity] = useState("");
  const [state, setState] = useState("");
  const [address, setAddress] = useState("");
  const [academicYear, setAcademicYear] = useState("2026-27");
  const [password, setPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [loading, setLoading] = useState(false);
  const [confirmationPending, setConfirmationPending] = useState(false);

  const submit = async (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    setLoading(true);
    try {
      if (mode === "signup") {
        if (password !== confirmPassword) {
          toast.error("Passwords do not match");
          return;
        }

        const { error } = await supabase.auth.signUp({
          email: email.trim(),
          password,
          options: {
            emailRedirectTo: window.location.origin,
            data: {
              full_name: fullName.trim(),
              phone: phone.trim(),
              centre_name: centreName.trim(),
              city: city.trim(),
              state: state.trim(),
              address: address.trim(),
              academic_year: academicYear,
            },
          },
        });
        if (error) throw error;

        setConfirmationPending(true);
        setMode("signin");
        toast.success("Account created. Check your email to confirm your address before signing in.");
        return;
      }

      const { data, error } = await supabase.auth.signInWithPassword({
        email: email.trim(),
        password,
      });
      if (error) throw error;

      const { data: memberships, error: membershipError } = await supabase
        .from("memberships")
        .select("role,school_id,master_franchise_id,franchise_id")
        .eq("user_id", data.user.id);
      if (membershipError) throw membershipError;

      const requestedPath = new URLSearchParams(window.location.search).get("next");
      const safePath = requestedPath?.startsWith("/") && !requestedPath.startsWith("//") ? requestedPath : null;
      if (safePath) router.replace(safePath);
      else if (memberships?.some((membership) => membership.role === "central_super_admin" || membership.role === "central_ops_admin")) router.replace("/dashboard");
      else if (memberships?.some((membership) => membership.role === "franchise_owner" && membership.master_franchise_id)) router.replace("/master/dashboard");
      else if (memberships?.some((membership) => membership.role === "franchise_owner")) router.replace("/franchise/dashboard");
      else if (memberships?.some((membership) => membership.role === "school_principal")) router.replace("/principal");
      else if (memberships?.some((membership) => membership.role === "teacher")) router.replace("/teacher");
      else if (memberships?.some((membership) => membership.role === "student")) router.replace("/student");
      else router.replace("/dashboard");
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Unable to complete your request. Please try again.");
    } finally {
      setLoading(false);
    }
  };

  const sendConfirmationAgain = async () => {
    if (!email.trim()) {
      toast.error("Enter your email address first");
      return;
    }
    setLoading(true);
    try {
      const { error } = await supabase.auth.resend({ type: "signup", email: email.trim() });
      if (error) throw error;
      toast.success("A new confirmation link has been sent.");
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Unable to resend the confirmation email.");
    } finally {
      setLoading(false);
    }
  };

  const sendPasswordReset = async () => {
    if (!email.trim()) {
      toast.error("Enter your email address first");
      return;
    }
    setLoading(true);
    try {
      const { error } = await supabase.auth.resetPasswordForEmail(email.trim(), {
        redirectTo: `${window.location.origin}/reset-password`,
      });
      if (error) throw error;
      toast.success("If an account exists for that address, a password reset link is on its way.");
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Unable to send the reset email.");
    } finally {
      setLoading(false);
    }
  };

  const switchMode = (nextMode: FormMode) => {
    setConfirmationPending(false);
    setMode(nextMode);
  };

  return (
    <div className="grid min-h-screen lg:grid-cols-[1.05fr_0.95fr]">
      <div className="navy-gradient hidden flex-col justify-between p-12 text-primary-foreground lg:flex">
        <BrandLockup invert subtitle="Digital Operating Platform" />
        <div>
          <h1 className="max-w-md font-display text-4xl font-semibold leading-[1.15]">
            Your School. Your Operations. One Digital Ecosystem.
          </h1>
          <p className="mt-6 max-w-lg text-sm leading-relaxed text-primary-foreground/70">
            Secure access for Centennial School centre owners and invited staff.
          </p>
        </div>
        <p className="text-xs text-primary-foreground/50">One account for your school workspace.</p>
      </div>

      <div className="flex flex-col items-center justify-center bg-background px-5 py-10">
        <div className="w-full max-w-lg">
          <div className="mb-8 flex justify-center lg:hidden">
            <BrandMark className="h-14 w-14" />
          </div>

          <div className="surface-panel p-6 sm:p-8">
            <div className="mb-6 flex gap-2 border-b border-border">
              <Button
                type="button"
                variant={mode === "signin" ? "default" : "ghost"}
                className="rounded-b-none"
                onClick={() => switchMode("signin")}
              >
                Sign in
              </Button>
              <Button
                type="button"
                variant={mode === "signup" ? "default" : "ghost"}
                className="rounded-b-none"
                onClick={() => switchMode("signup")}
              >
                Create account
              </Button>
            </div>

            <h2 className="font-display text-xl font-semibold">
              {mode === "signin" ? "Welcome back" : "Register a school centre"}
            </h2>
            <p className="mt-1 text-sm text-muted-foreground">
              {mode === "signin"
                ? "Use the email address and password linked to your account."
                : "Tell us about you and your centre. Your school gets a fresh workspace."}
            </p>

            {confirmationPending && (
              <div className="mt-4 rounded-md border border-border bg-secondary/50 p-3 text-sm">
                <p>Confirm your email using the link we sent before signing in.</p>
                <Button type="button" variant="link" className="h-auto px-0 pt-2" onClick={sendConfirmationAgain} disabled={loading}>
                  Resend confirmation email
                </Button>
              </div>
            )}

            <form className="mt-6 space-y-4" onSubmit={submit}>
              {mode === "signup" && (
                <>
                  <div className="grid gap-4 sm:grid-cols-2">
                    <Field id="full-name" label="Your full name">
                      <Input id="full-name" autoComplete="name" value={fullName} onChange={(event) => setFullName(event.target.value)} required />
                    </Field>
                    <Field id="centre-name" label="School / centre name">
                      <Input id="centre-name" autoComplete="organization" value={centreName} onChange={(event) => setCentreName(event.target.value)} required />
                    </Field>
                  </div>
                </>
              )}

              <div className="grid gap-4 sm:grid-cols-2">
                <Field id="email" label="Email address">
                  <Input id="email" type="email" autoComplete="email" value={email} onChange={(event) => setEmail(event.target.value)} required />
                </Field>
                {mode === "signup" && (
                  <Field id="phone" label="Phone number">
                    <Input id="phone" type="tel" autoComplete="tel" value={phone} onChange={(event) => setPhone(event.target.value)} required />
                  </Field>
                )}
              </div>

              {mode === "signup" && (
                <>
                  <div className="grid gap-4 sm:grid-cols-2">
                    <Field id="city" label="City">
                      <Input id="city" autoComplete="address-level2" value={city} onChange={(event) => setCity(event.target.value)} required />
                    </Field>
                    <Field id="state" label="State / region">
                      <Input id="state" autoComplete="address-level1" value={state} onChange={(event) => setState(event.target.value)} required />
                    </Field>
                  </div>
                  <Field id="address" label="Centre address">
                    <Input id="address" autoComplete="street-address" value={address} onChange={(event) => setAddress(event.target.value)} required />
                  </Field>
                  <Field id="academic-year" label="Academic year">
                    <select
                      id="academic-year"
                      value={academicYear}
                      onChange={(event) => setAcademicYear(event.target.value)}
                      className="flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm ring-offset-background focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
                    >
                      <option value="2026-27">2026–27</option>
                      <option value="2027-28">2027–28</option>
                      <option value="2028-29">2028–29</option>
                    </select>
                  </Field>
                </>
              )}

              <Field id="password" label="Password">
                <Input
                  id="password"
                  type="password"
                  autoComplete={mode === "signin" ? "current-password" : "new-password"}
                  minLength={8}
                  value={password}
                  onChange={(event) => setPassword(event.target.value)}
                  required
                />
              </Field>

              {mode === "signup" && (
                <Field id="confirm-password" label="Confirm password">
                  <Input
                    id="confirm-password"
                    type="password"
                    autoComplete="new-password"
                    minLength={8}
                    value={confirmPassword}
                    onChange={(event) => setConfirmPassword(event.target.value)}
                    required
                  />
                </Field>
              )}

              {mode === "signin" && (
                <div className="flex justify-end">
                  <Button type="button" variant="link" className="h-auto px-0" onClick={sendPasswordReset} disabled={loading}>
                    Forgot password?
                  </Button>
                </div>
              )}

              <Button type="submit" className="w-full" size="lg" disabled={loading}>
                {loading ? "Please wait…" : mode === "signin" ? "Sign in" : "Create centre account"}
              </Button>
            </form>

            {mode === "signup" && (
              <p className="mt-4 text-xs leading-relaxed text-muted-foreground">
                Centre owners create a new school workspace. Staff, including teachers, should register with the email address their school invited; access is assigned from that invitation.
              </p>
            )}
          </div>

          <p className="mt-6 text-center text-xs text-muted-foreground">
            <Link href="/" className="hover:underline">Back to welcome page</Link>
          </p>
        </div>
      </div>
    </div>
  );
}

function Field({ id, label, children }: { id: string; label: string; children: React.ReactNode }) {
  return (
    <div className="space-y-1.5">
      <Label htmlFor={id}>{label}</Label>
      {children}
    </div>
  );
}

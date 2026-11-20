"use client";

import { useRouter } from "next/navigation";
import { useEffect, useState } from "react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { supabase } from "@/integrations/supabase/client";

export function ResetPage() {
  const router = useRouter();
  const [pw, setPw] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [recoveryReady, setRecoveryReady] = useState(false);
  const [inviteLink, setInviteLink] = useState(false);
  const [checkingRecovery, setCheckingRecovery] = useState(true);
  const [recoveryError, setRecoveryError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    const type = new URLSearchParams(window.location.hash.slice(1)).get("type");
    const recoveryLink = type === "recovery" || type === "invite";
    setInviteLink(type === "invite");
    if (!recoveryLink) {
      setCheckingRecovery(false);
      return;
    }
    void supabase.auth.getSession().then(({ data, error }) => {
      setRecoveryReady(!!data.session && !error);
      setRecoveryError(error?.message ?? null);
      setCheckingRecovery(false);
    }).catch((cause: unknown) => {
      setRecoveryError(cause instanceof Error ? cause.message : "Unable to verify this recovery link.");
      setCheckingRecovery(false);
    });
  }, []);

  return (
    <div className="flex min-h-screen items-center justify-center bg-background px-5">
      <form
        className="surface-panel w-full max-w-sm space-y-4 p-7"
        onSubmit={async (e) => {
          e.preventDefault();
          if (!recoveryReady) { toast.error("Open the password reset link from your email first."); return; }
          if (pw !== confirmPassword) { toast.error("Passwords do not match"); return; }
          setLoading(true);
          try {
            const { error } = await supabase.auth.updateUser({ password: pw });
            if (error) throw error;
            toast.success("Password updated. You can now sign in with your new password.");
            await supabase.auth.signOut();
            router.replace("/login");
          } catch (error) {
            toast.error(error instanceof Error ? error.message : "Unable to update your password.");
          } finally {
            setLoading(false);
          }
        }}
      >
        <h1 className="font-display text-xl font-semibold">{inviteLink ? "Set your password" : "Set a new password"}</h1>
        {checkingRecovery && <p className="text-sm text-muted-foreground">Checking your recovery link…</p>}
        {!checkingRecovery && !recoveryReady && <p className="text-sm text-muted-foreground">This password link is missing, expired, or invalid. Request a new password reset email or invitation and open its link in this browser.</p>}
        {recoveryError && <p className="break-words text-xs text-destructive">{recoveryError}</p>}
        <Input type="password" minLength={8} autoComplete="new-password" required value={pw} onChange={(e) => setPw(e.target.value)} placeholder="New password" disabled={!recoveryReady} />
        <Input type="password" minLength={8} autoComplete="new-password" required value={confirmPassword} onChange={(e) => setConfirmPassword(e.target.value)} placeholder="Confirm new password" disabled={!recoveryReady} />
        <Button type="submit" className="w-full" disabled={!recoveryReady || loading}>{loading ? "Please wait…" : inviteLink ? "Set password" : "Update password"}</Button>
      </form>
    </div>
  );
}

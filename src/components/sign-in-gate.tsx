import Link from "next/link";
import { Lock } from "lucide-react";
import type { ReactNode } from "react";
import { Button } from "@/components/ui/button";
import { useSessionUser } from "@/hooks/use-session";

export function SignInGate({ children }: { children: ReactNode }) {
  const { user, ready } = useSessionUser();
  if (!ready) return <div className="surface-panel h-40 animate-pulse" />;
  if (!user)
    return (
      <div className="surface-panel flex flex-col items-center px-6 py-12 text-center">
        <Lock className="h-6 w-6 text-primary" />
        <p className="mt-3 font-display font-semibold">Sign in to see your saved records</p>
        <p className="mt-1 text-sm text-muted-foreground">These records are stored securely for your centre account.</p>
        <Button className="mt-5" asChild>
          <Link href="/login">Sign in</Link>
        </Button>
      </div>
    );
  return <>{children}</>;
}

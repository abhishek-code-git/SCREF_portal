import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useSessionUser } from "@/hooks/use-session";

export type UserProfile = { full_name: string; phone: string };

export function useWorkspace() {
  const { user, ready: sessionReady, error: sessionError } = useSessionUser();
  const profileQuery = useQuery<UserProfile | null, Error>({
    queryKey: ["profile", user?.id],
    enabled: sessionReady && !!user,
    queryFn: async () => {
      if (!user) return null;
      const { data, error } = await supabase.from("profiles").select("full_name,phone").eq("user_id", user.id).maybeSingle();
      if (error) throw error;
      if (!data || !data.full_name?.trim()) throw new Error("Your profile is missing a display name.");
      return { full_name: data.full_name.trim(), phone: data.phone };
    },
  });
  return {
    user,
    ready: sessionReady && (!user || !profileQuery.isPending),
    error: sessionError ?? profileQuery.error?.message ?? null,
    profile: profileQuery.data ?? null,
  };
}

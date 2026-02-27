import { createClient } from "@/lib/supabase/client";

export async function getMyRole() {
  const supabase = createClient();

  const { data: auth } = await supabase.auth.getUser();
  const user = auth.user;
  if (!user) return { user: null, role: null as null | "sales" | "boss" };

  const { data: profile, error } = await supabase
    .from("profiles")
    .select("role")
    .eq("user_id", user.id)
    .single();

  if (error) return { user, role: null as null | "sales" | "boss" };

  return { user, role: profile.role as "sales" | "boss" };
}
"use client";

import { useEffect } from "react";
import { useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase/client";

export default function AppGate() {
  const router = useRouter();
  const supabase = createClient();

  useEffect(() => {
    async function run() {
      const { data: auth } = await supabase.auth.getUser();
      if (!auth.user) {
        router.replace("/login");
        return;
      }

      const { data: profile, error } = await supabase
        .from("profiles")
        .select("role")
        .eq("user_id", auth.user.id)
        .single();

      if (error) {
        // profile missing usually means trigger not created or user created before trigger
        router.replace("/login");
        return;
      }

      router.replace(profile.role === "boss" ? "/boss" : "/sales");
    }

    run();
  }, [router, supabase]);

  return (
    <div className="min-h-screen flex items-center justify-center text-neutral-300">
      Loading...
    </div>
  );
}
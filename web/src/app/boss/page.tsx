"use client";

import { useEffect, useMemo, useState } from "react";
import { createClient } from "@/lib/supabase/client";
import { STAGES, type Stage } from "@/lib/stages";
import { BossRaceLanes } from "./BossRaceLanes";
import { useRouter } from "next/navigation";
import { getMyRole } from "@/lib/authz";

type Project = {
  id: string;
  created_at: string;
  owner_user_id: string;
  date: string | null;
  customer_detail: string | null;
  project_info: string | null;
  stage: Stage;
};

export default function BossPage() {
  const supabase = createClient();

  const [projects, setProjects] = useState<Project[]>([]);
  const [loading, setLoading] = useState(true);
  const [err, setErr] = useState<string | null>(null);
  const [ownerNameMap, setOwnerNameMap] = useState<Record<string, string>>({});

  const router = useRouter();

  async function load() {
    setLoading(true);
    setErr(null);
  
    const { data, error } = await supabase
      .from("projects")
      .select("id, created_at, owner_user_id, date, customer_detail, project_info, stage")
      .is("deleted_at", null)
      .order("created_at", { ascending: false });
  
    if (error) {
      setErr(error.message);
      setLoading(false);
      return;
    }
  
    const projects = (data ?? []) as Project[];
    setProjects(projects);
  
    // Fetch display names for lanes
    const ownerIds = Array.from(new Set(projects.map((p) => p.owner_user_id)));
  
    const { data: profilesData, error: profilesError } = await supabase
      .from("profiles")
      .select("user_id, display_name")
      .in("user_id", ownerIds);
  
    if (profilesError) {
      setErr(profilesError.message);
      setLoading(false);
      return;
    }
  
    const map: Record<string, string> = {};
    for (const p of profilesData ?? []) {
      map[p.user_id] = p.display_name ?? `sales-${p.user_id.slice(0, 8)}`;
    }
    setOwnerNameMap(map);
  
    setLoading(false);
  }

  useEffect(() => {
    async function guard() {
      const { user, role } = await getMyRole();
  
      if (!user) {
        router.replace("/login");
        return;
      }
  
      if (role !== "boss") {
        router.replace("/sales");
        return;
      }
  
      // ✅ 只有是 boss 才加载数据
      load();
    }
  
    guard();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const summary = useMemo(() => {
    const map: Record<Stage, number> = {
      "Lead": 0,
      "Qualification": 0,
      "Solution Design": 0,
      "Proposal": 0,
      "Negotiation": 0,
      "Contract Review": 0,
      "Closing": 0,
    };
    for (const p of projects) map[p.stage]++;
    return map;
  }, [projects]);

  async function signOut() {
    await supabase.auth.signOut();
    window.location.href = "/login";
  }

  return (
    <div className="min-h-screen p-6 space-y-6">
      <div className="flex items-center justify-between">
        {/* 左侧 */}
        <h1 className="text-2xl font-semibold">
          Boss Dashboard
        </h1>

        {/* 右侧整体 */}
        <div className="flex items-center gap-4">
          <div className="flex items-center gap-2">
            <button
              onClick={() => router.push("/trash")}
              className="text-sm px-3 py-1 border border-white/20 rounded-md hover:bg-white/10 transition"
            >
              ♻ Recycle Bin
            </button>

            <button
              onClick={signOut}
              className="text-sm px-3 py-1 border border-white/20 rounded-md hover:bg-white/10 transition"
            >
              Sign out
            </button>
          </div>
        </div>
      </div>

      {err ? <div className="text-sm text-red-500">{err}</div> : null}
      {loading ? <div className="text-neutral-300">Loading...</div> : null}

      {/* Stage summary */}
      <div
        className="grid gap-3"
        style={{ gridTemplateColumns: "200px repeat(7, minmax(0, 1fr))" }}
      >
        {/* spacer for the Sales (Lane) column */}
        <div />

        {STAGES.map((stage) => (
          <div key={stage} className="rounded-xl border p-4 text-center">
            <div className="text-xs text-neutral-500">{stage}</div>
            <div className="text-2xl font-bold">{summary[stage]}</div>
          </div>
        ))}
      </div>

      {/* Race lanes by sales */}
      <BossRaceLanes projects={projects} ownerNameMap={ownerNameMap} /> 
    </div>
  );
}
"use client";

import { useEffect, useMemo, useState } from "react";
import { createClient } from "@/lib/supabase/client";
import { STAGES, type Stage } from "@/lib/stages";
import { RaceTrack } from "./RaceTrack";
import { useRouter } from "next/navigation";
import { getMyRole } from "@/lib/authz";
import { HorseRaceLine } from "./HorseRaceLine";
import { HorseRaceLineV2 } from "./HorseRaceLineV2";

type Project = {
  id: string;
  created_at: string;
  owner_user_id: string;
  date: string | null;
  customer_detail: string | null;
  project_info: string | null;
  stage: Stage;
};

export default function SalesPage() {
  const supabase = createClient();

  const [loading, setLoading] = useState(true);
  const [projects, setProjects] = useState<Project[]>([]);
  const [err, setErr] = useState<string | null>(null);

  // new project form
  const [date, setDate] = useState("");
  const [customerDetail, setCustomerDetail] = useState("");
  const [projectInfo, setProjectInfo] = useState("");
  const [meEmail, setMeEmail] = useState<string>("");

  const router = useRouter();

  const [deleteTarget, setDeleteTarget] = useState<string | null>(null);

  const handleDeleteRequest = (id: string) => {
    setDeleteTarget(id);
  };

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

    setProjects((data ?? []) as Project[]);
    setLoading(false);
  }

  async function confirmDelete() {
    if (!deleteTarget) return;

    const { data: auth } = await supabase.auth.getUser();
  
    await supabase
      .from("projects")
      .update({
        deleted_at: new Date().toISOString(),
        deleted_by: auth.user?.id,
      })
      .eq("id", deleteTarget);
  
    setDeleteTarget(null);
    await load(); // 重新加载项目
  }

  useEffect(() => {
    async function init() {
      const { user, role } = await getMyRole();
  
      if (!user) {
        router.replace("/login");
        return;
      }
  
      if (role === "boss") {
        router.replace("/boss");
        return;
      }
  
      // ✅ 只有是 sales 才继续加载
      const { data: auth } = await supabase.auth.getUser();
      setMeEmail(auth.user?.email ?? "");
  
      await load();
    }
  
    init();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const byStage = useMemo(() => {
    const map: Record<Stage, Project[]> = {
      "Lead": [] as Project[],
      "Qualification": [] as Project[],
      "Solution Design": [] as Project[],
      "Proposal": [] as Project[],
      "Negotiation": [] as Project[],
      "Contract Review": [] as Project[],
      "Closing": [] as Project[],
    };
  
    for (const p of projects) {
      map[p.stage].push(p);
    }
  
    return map;
  }, [projects]);

  async function createProject(e: React.FormEvent) {
    e.preventDefault();
    setErr(null);

    const { data: auth } = await supabase.auth.getUser();
    const user = auth.user;
    if (!user) {
      setErr("Not signed in");
      return;
    }

    const { error } = await supabase.from("projects").insert({
      owner_user_id: user.id,
      date: date || null,
      customer_detail: customerDetail || null,
      project_info: projectInfo || null,
      stage: "Lead",
    });

    if (error) {
      setErr(error.message);
      return;
    }

    setDate("");
    setCustomerDetail("");
    setProjectInfo("");
    await load();
  }

  async function moveStage(projectId: string, nextStage: Stage) {
    setErr(null);
    const { error } = await supabase
      .from("projects")
      .update({ stage: nextStage })
      .eq("id", projectId);

    if (error) {
      setErr(error.message);
      return;
    }

    // optimistic update
    setProjects((prev) =>
      prev.map((p) => (p.id === projectId ? { ...p, stage: nextStage } : p))
    );
  }

  async function signOut() {
    await supabase.auth.signOut();
    window.location.href = "/login";
  }

  return (
    <div className="min-h-screen p-6 space-y-6">
      <div className="flex items-center justify-between">
        {/* 左侧 */}
        <h1 className="text-2xl font-semibold">
          Sales Dashboard
        </h1>

        {/* 右侧整体 */}
        <div className="flex items-center gap-4">
          <div className="text-sm opacity-70">
            {meEmail}
          </div>

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

      <form onSubmit={createProject} className="rounded-xl border p-4 space-y-3">
        <div className="font-medium">Create a new horse (project)</div>

        <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
          <div className="space-y-1">
            <div className="text-sm text-neutral-300">Date</div>
            <input
              className="w-full rounded-md border bg-transparent px-3 py-2"
              type="date"
              value={date}
              onChange={(e) => setDate(e.target.value)}
            />
          </div>

          <div className="space-y-1">
            <div className="text-sm text-neutral-300">Customer detail</div>
            <input
              className="w-full rounded-md border bg-transparent px-3 py-2"
              value={customerDetail}
              onChange={(e) => setCustomerDetail(e.target.value)}
              placeholder="Name / company / contact..."
            />
          </div>

          <div className="space-y-1">
            <div className="text-sm text-neutral-300">Project info</div>
            <input
              className="w-full rounded-md border bg-transparent px-3 py-2"
              value={projectInfo}
              onChange={(e) => setProjectInfo(e.target.value)}
              placeholder="What is this project about?"
            />
          </div>
        </div>

        <button className="rounded-md bg-white text-black px-4 py-2 text-sm font-medium">
          Create
        </button>
      </form>

      {err ? <div className="text-sm text-red-500">{err}</div> : null}
      {loading ? <div className="text-neutral-300">Loading...</div> : null}
    {/* <RaceTrack projects={projects} onMove={moveStage} /> */}
    <HorseRaceLineV2 projects={projects} onMove={moveStage} onDelete={handleDeleteRequest} />

    {deleteTarget && (
      <div className="fixed inset-0 bg-black/60 flex items-center justify-center z-50">
        <div className="bg-black border border-white/20 rounded-xl p-6 w-80">
          <div className="text-sm">
            Are you sure you want to delete this horse?
          </div>

          <div className="mt-4 flex justify-end gap-3">
            <button
              onClick={() => setDeleteTarget(null)}
              className="text-xs px-3 py-1 border rounded-md"
            >
              Cancel
            </button>

            <button
              onClick={confirmDelete}
              className="text-xs px-3 py-1 border border-red-500 text-red-400 rounded-md"
            >
              Delete
            </button>
          </div>
        </div>
      </div>
    )}
    </div>
  );
}
"use client";

import { useEffect, useMemo, useState } from "react";
import { createClient } from "@/lib/supabase/client";
import { STAGES, type Stage } from "@/lib/stages";
import { BossRaceLanes } from "./BossRaceLanes";
import { useRouter } from "next/navigation";
import { getMyRole } from "@/lib/authz";

type CloseStatus = "won" | "lost" | null;

type Project = {
  id: string;
  created_at: string;
  owner_user_id: string;
  date: string | null;
  customer_detail: string | null;
  project_info: string | null;
  stage: Stage;

  amount?: number | null;
  close_status?: CloseStatus;
  lost_reason?: string | null;
};

function fmtMoney(n: number) {
  try {
    return new Intl.NumberFormat("en-US", {
      style: "currency",
      currency: "USD",
      maximumFractionDigits: 0,
    }).format(n);
  } catch {
    return `$${n}`;
  }
}

function makeStageNumberMap(): Record<Stage, number> {
  return {
    Lead: 0,
    Qualification: 0,
    "Solution Design": 0,
    Proposal: 0,
    Negotiation: 0,
    "Contract Review": 0,
    Closing: 0,
  };
}

function calcStats(projects: Project[]) {
  let total = 0;
  let active = 0;
  let won = 0;
  let lost = 0;
  let amountTotal = 0;

  const byStage = makeStageNumberMap();

  for (const p of projects) {
    total++;
    byStage[p.stage]++;

    const isFinal =
      p.stage === "Closing" && (p.close_status === "won" || p.close_status === "lost");

    if (!isFinal) active++;
    if (p.close_status === "won") won++;
    if (p.close_status === "lost") lost++;

    if (p.amount != null && Number(p.amount) > 0) {
      amountTotal += Number(p.amount);
    }
  }

  return { total, active, won, lost, amountTotal, byStage };
}

function StatChip({
  label,
  value,
  tone = "default",
}: {
  label: string;
  value: React.ReactNode;
  tone?: "default" | "good" | "bad" | "info";
}) {
  const toneCls =
    tone === "good"
      ? "border-emerald-400/20 bg-emerald-400/10 text-emerald-200"
      : tone === "bad"
      ? "border-red-400/20 bg-red-400/10 text-red-200"
      : tone === "info"
      ? "border-sky-400/20 bg-sky-400/10 text-sky-200"
      : "border-white/15 bg-white/5 text-neutral-200";

  return (
    <div
      className={`inline-flex items-center gap-2 rounded-full border px-3 py-1 text-xs ${toneCls}`}
    >
      <span className="opacity-80">{label}</span>
      <span className="font-semibold">{value}</span>
    </div>
  );
}

export default function BossPage() {
  const supabase = createClient();

  const [projects, setProjects] = useState<Project[]>([]);
  const [loading, setLoading] = useState(true);
  const [err, setErr] = useState<string | null>(null);
  const [ownerNameMap, setOwnerNameMap] = useState<Record<string, string>>({});

  const router = useRouter();

  // ✅ 用同一套 gridTemplateColumns 让 “summary 表格” 和 “lanes 表格”对齐
  const LANE_COL_PX = 200;
  const GRID_COLS = `${LANE_COL_PX}px repeat(${STAGES.length}, minmax(120px, 1fr))`;

  async function load() {
    setLoading(true);
    setErr(null);

    const { data, error } = await supabase
      .from("projects")
      .select(
        "id, created_at, owner_user_id, date, customer_detail, project_info, stage, amount, close_status, lost_reason"
      )
      .is("deleted_at", null)
      .order("created_at", { ascending: false });

    if (error) {
      setErr(error.message);
      setLoading(false);
      return;
    }

    const list = (data ?? []) as Project[];
    setProjects(list);

    // Fetch display names for lanes
    const ownerIds = Array.from(new Set(list.map((p) => p.owner_user_id)));

    if (ownerIds.length === 0) {
      setOwnerNameMap({});
      setLoading(false);
      return;
    }

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
    for (const row of profilesData ?? []) {
      map[row.user_id] = row.display_name ?? `sales-${row.user_id.slice(0, 8)}`;
    }
    // 兜底：没 profile 的也给个名字
    for (const id of ownerIds) {
      if (!map[id]) map[id] = `sales-${id.slice(0, 8)}`;
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

      await load();
    }

    guard();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const globalStats = useMemo(() => calcStats(projects), [projects]);

  const groups = useMemo(() => {
    const byOwner: Record<string, Project[]> = {};
    for (const p of projects) {
      (byOwner[p.owner_user_id] ??= []).push(p);
    }

    const items = Object.entries(byOwner).map(([ownerId, list]) => {
      const name = ownerNameMap[ownerId] ?? `sales-${ownerId.slice(0, 8)}`;
      const stats = calcStats(list);
      return { ownerId, name, projects: list, stats };
    });

    // 让列表稳定、好看：按 name 排序
    items.sort((a, b) => a.name.localeCompare(b.name));
    return items;
  }, [projects, ownerNameMap]);

  async function signOut() {
    await supabase.auth.signOut();
    window.location.href = "/login";
  }

  return (
    <div className="min-h-screen p-6 space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-semibold">Boss Dashboard</h1>

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

      {err ? <div className="text-sm text-red-500">{err}</div> : null}
      {loading ? <div className="text-neutral-300">Loading...</div> : null}

      {/* =========================
          Global Summary (bar)
         ========================= */}
      <div className="rounded-2xl border border-white/10 bg-black/20 px-5 py-4">
        <div className="text-sm font-semibold">Global summary</div>
        {/* <div className="text-xs text-neutral-400 mt-1">
          Total {globalStats.total} · Active {globalStats.active} · Won {globalStats.won} · Lost{" "}
          {globalStats.lost} · Amount {fmtMoney(globalStats.amountTotal)}
        </div> */}
        <div className="mt-2 text-[11px] text-neutral-500">
          Pipeline overview
        </div>
        <div className="flex flex-wrap items-center gap-2 mt-2">
          <StatChip label="Total" value={globalStats.total} />
          <StatChip label="Active" value={globalStats.active} tone="info" />
          <StatChip label="Won" value={globalStats.won} tone="good" />
          <StatChip label="Lost" value={globalStats.lost} tone="bad" />
          <StatChip label="Amount" value={fmtMoney(globalStats.amountTotal)} />
        </div>

        {/* Global stage counts aligned */}
        <div className="mt-4 grid gap-3" style={{ gridTemplateColumns: GRID_COLS }}>
          <div className="text-xs text-neutral-500 flex items-center">All sales</div>

          {STAGES.map((stage) => (
            <div
              key={stage}
              className="rounded-xl border border-white/10 bg-black/30 px-4 py-3 text-center"
            >
              <div className="text-xs text-neutral-500">{stage}</div>
              <div className="text-2xl font-bold">{globalStats.byStage[stage]}</div>
            </div>
          ))}
        </div>
      </div>

      {/* =========================
          Sales sections: summary + lanes (one by one)
         ========================= */}
      <div className="space-y-6">
        {groups.map((g) => {
          const oneOwnerNameMap: Record<string, string> = { [g.ownerId]: g.name };

          return (
            <div key={g.ownerId} className="rounded-2xl border border-white/10 bg-black/20 p-5">
              {/* Sales summary bar */}
              <div className="flex items-start justify-between gap-4">
                <div>
                  <div className="text-sm font-semibold">{g.name}</div>
                  {/* <div className="text-xs text-neutral-400 mt-1">
                    Total {g.stats.total} · Active {g.stats.active} · Won {g.stats.won} · Lost{" "}
                    {g.stats.lost} · Amount {fmtMoney(g.stats.amountTotal)}
                  </div> */}
                  <div className="flex flex-wrap items-center gap-2 mt-2">
                    <StatChip label="Total" value={g.stats.total} />
                    <StatChip label="Active" value={g.stats.active} tone="info" />
                    <StatChip label="Won" value={g.stats.won} tone="good" />
                    <StatChip label="Lost" value={g.stats.lost} tone="bad" />
                    <StatChip label="Amount" value={fmtMoney(g.stats.amountTotal)} />
                  </div>
                </div>
              </div>

              {/* Sales stage counts aligned */}
              <div className="mt-4 grid gap-3" style={{ gridTemplateColumns: GRID_COLS }}>
                <div className="text-xs text-neutral-500 flex items-center">Stage counts</div>

                {STAGES.map((stage) => (
                  <div
                    key={stage}
                    className="rounded-xl border border-white/10 bg-black/30 px-4 py-3 text-center"
                  >
                    <div className="text-xs text-neutral-500">{stage}</div>
                    <div className="text-2xl font-bold">{g.stats.byStage[stage]}</div>
                  </div>
                ))}
              </div>

              {/* Sales lanes (only this owner) */}
              <div className="mt-5">
                <BossRaceLanes projects={g.projects} ownerNameMap={oneOwnerNameMap} />
              </div>
            </div>
          );
        })}

        {groups.length === 0 && !loading ? (
          <div className="text-sm text-neutral-500">No projects yet.</div>
        ) : null}
      </div>
    </div>
  );
}
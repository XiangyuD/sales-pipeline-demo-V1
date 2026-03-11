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

// =========================
// Theme helpers (A: Graphite + Neon Accent)
// =========================
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
  let activeProposalAmount = 0;
  let closingWonAmount = 0;
  let closingLostAmount = 0;

  const byStage = makeStageNumberMap();

  for (const p of projects) {
    total++;
    byStage[p.stage]++;

    const amount = p.amount != null && Number(p.amount) > 0 ? Number(p.amount) : 0;

    const isWon = p.stage === "Closing" && p.close_status === "won";
    const isLost = p.stage === "Closing" && p.close_status === "lost";
    const isFinal = isWon || isLost;

    if (!isFinal) active++;
    if (isWon) won++;
    if (isLost) lost++;

    if (amount > 0) {
      amountTotal += amount;

      // Active pipeline amount after proposal
      if (
        p.stage === "Proposal" ||
        p.stage === "Negotiation" ||
        p.stage === "Contract Review"
      ) {
        activeProposalAmount += amount;
      }

      // Closing won/lost amount
      if (isWon) {
        closingWonAmount += amount;
      }

      if (isLost) {
        closingLostAmount += amount;
      }
    }
  }

  return {
    total,
    active,
    won,
    lost,
    amountTotal,
    activeProposalAmount,
    closingWonAmount,
    closingLostAmount,
    byStage,
  };
}

function StatChip({
  label,
  value,
  tone = "default",
}: {
  label: string;
  value: React.ReactNode;
  tone?: "default" | "active" | "won" | "lost" | "amount";
}) {
  const toneClass =
    tone === "active"
      ? "border-cyan-400/25 bg-cyan-400/10 text-cyan-200"
      : tone === "won"
      ? "border-emerald-400/25 bg-emerald-400/10 text-emerald-200"
      : tone === "lost"
      ? "border-rose-400/25 bg-rose-400/10 text-rose-200"
      : tone === "amount"
      ? "border-blue-400/25 bg-blue-400/10 text-blue-200"
      : "border-white/10 bg-white/[0.04] text-white/85";

  return (
    <div
      className={`inline-flex items-center gap-2 rounded-full border px-3 py-1 text-xs ${toneClass}`}
    >
      <span className="opacity-80">{label}</span>
      <span className="font-semibold">{value}</span>
    </div>
  );
}

function StageCountCell({
  label,
  value,
}: {
  label: string;
  value: number;
}) {
  return (
    <div className="rounded-xl border border-white/10 bg-white/[0.03] backdrop-blur-md px-4 py-3 text-center shadow-[0_8px_24px_rgba(0,0,0,0.25)] hover:bg-white/[0.05] transition">
      <div className="text-xs text-white/45">{label}</div>
      <div className="text-2xl font-semibold text-white">{value}</div>
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

  // ✅ Use the same grid columns as lanes (align summary + lanes)
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

    items.sort((a, b) => a.name.localeCompare(b.name));
    return items;
  }, [projects, ownerNameMap]);

  async function signOut() {
    await supabase.auth.signOut();
    window.location.href = "/login";
  }

  return (
    <div className="min-h-screen p-6 space-y-6 bg-gradient-to-b from-[#070A0F] via-[#0A0F1A] to-[#0B1020] text-white">
      {/* Header */}
      <div className="flex items-center justify-between">
        <h1 className="text-3xl font-semibold tracking-tight">Boss Dashboard</h1>

        <div className="flex items-center gap-2">
          <button
            onClick={() => router.push("/trash")}
            className="text-sm px-3 py-1.5 rounded-md border border-white/15 bg-white/[0.03] hover:bg-white/[0.08] transition"
          >
            ♻ Recycle Bin
          </button>

          <button
            onClick={signOut}
            className="text-sm px-3 py-1.5 rounded-md border border-white/15 bg-white/[0.03] hover:bg-white/[0.08] transition"
          >
            Sign out
          </button>
        </div>
      </div>

      {err ? <div className="text-sm text-rose-300">{err}</div> : null}
      {loading ? <div className="text-white/60">Loading...</div> : null}

      {/* =========================
          Global Summary
         ========================= */}
      <div className="rounded-2xl border border-white/10 bg-white/[0.03] backdrop-blur-md px-5 py-4 shadow-[0_8px_30px_rgba(0,0,0,0.35)]">
        <div className="text-lg font-semibold text-white">Global summary</div>
        <div className="mt-1 text-sm text-white/55">Pipeline overview</div>

        <StatChip label="Total" value={globalStats.total} />
        <StatChip label="Active" value={globalStats.active} tone="active" />
        <StatChip label="Won" value={globalStats.won} tone="won" />
        <StatChip label="Lost" value={globalStats.lost} tone="lost" />
        <StatChip label="Total Amount" value={fmtMoney(globalStats.amountTotal)} tone="amount" />
        <StatChip label="Active Proposal" value={fmtMoney(globalStats.activeProposalAmount)} tone="active" />
        <StatChip label="Won Amount" value={fmtMoney(globalStats.closingWonAmount)} tone="won" />
        <StatChip label="Lost Amount" value={fmtMoney(globalStats.closingLostAmount)} tone="lost" />

        {/* Global stage counts aligned */}
        <div className="mt-5 grid gap-3" style={{ gridTemplateColumns: GRID_COLS }}>
          <div className="text-xs text-white/45 flex items-center">
            All sales
          </div>

          {STAGES.map((stage) => (
            <StageCountCell
              key={stage}
              label={stage}
              value={globalStats.byStage[stage]}
            />
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
            <div
              key={g.ownerId}
              className="rounded-2xl border border-white/10 bg-white/[0.03] backdrop-blur-md p-5 shadow-[0_8px_30px_rgba(0,0,0,0.35)]"
            >
              {/* Sales summary bar */}
              <div className="flex items-start justify-between gap-4">
                <div>
                  <div className="text-lg font-semibold text-white">{g.name}</div>

                  <div className="flex flex-wrap items-center gap-2 mt-3">
                  <StatChip label="Total" value={g.stats.total} />
                  <StatChip label="Active" value={g.stats.active} tone="active" />
                  <StatChip label="Won" value={g.stats.won} tone="won" />
                  <StatChip label="Lost" value={g.stats.lost} tone="lost" />
                  <StatChip label="Total Amount" value={fmtMoney(g.stats.amountTotal)} tone="amount" />
                  <StatChip label="Active Proposal" value={fmtMoney(g.stats.activeProposalAmount)} tone="active" />
                  <StatChip label="Won Amount" value={fmtMoney(g.stats.closingWonAmount)} tone="won" />
                  <StatChip label="Lost Amount" value={fmtMoney(g.stats.closingLostAmount)} tone="lost" />
                  </div>
                </div>
              </div>

              {/* Sales stage counts aligned */}
              <div className="mt-5 grid gap-3" style={{ gridTemplateColumns: GRID_COLS }}>
                <div className="text-xs text-white/45 flex items-center">
                  Stage counts
                </div>

                {STAGES.map((stage) => (
                  <StageCountCell
                    key={stage}
                    label={stage}
                    value={g.stats.byStage[stage]}
                  />
                ))}
              </div>

              {/* Sales lanes (only this owner) */}
              <div className="mt-5 rounded-2xl border border-white/10 bg-white/[0.02] p-4">
                <BossRaceLanes projects={g.projects} ownerNameMap={oneOwnerNameMap} />
              </div>
            </div>
          );
        })}

        {groups.length === 0 && !loading ? (
          <div className="text-sm text-white/50">No projects yet.</div>
        ) : null}
      </div>
    </div>
  );
}
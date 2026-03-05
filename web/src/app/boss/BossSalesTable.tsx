"use client";

import { STAGES, type Stage } from "@/lib/stages";

type CloseStatus = "won" | "lost" | null;

type Project = {
  id: string;
  owner_user_id: string;
  stage: Stage;
  customer_detail: string | null;
  project_info: string | null;
  amount?: number | null;
  close_status?: CloseStatus;
};

const fmtMoney = (n: number) => {
  try {
    return new Intl.NumberFormat("en-US", {
      style: "currency",
      currency: "USD",
      maximumFractionDigits: 0,
    }).format(n);
  } catch {
    return `$${n}`;
  }
};

function calcStats(list: Project[]) {
  let total = 0,
    active = 0,
    won = 0,
    lost = 0,
    amountTotal = 0;

  const stageCount: Record<Stage, number> = Object.fromEntries(
    STAGES.map((s) => [s, 0])
  ) as Record<Stage, number>;

  for (const p of list) {
    total += 1;
    stageCount[p.stage] += 1;

    const isFinal =
      p.stage === "Closing" && (p.close_status === "won" || p.close_status === "lost");

    if (!isFinal) active += 1;
    if (p.close_status === "won") won += 1;
    if (p.close_status === "lost") lost += 1;
    if (p.amount && Number(p.amount) > 0) amountTotal += Number(p.amount);
  }

  return { total, active, won, lost, amountTotal, stageCount };
}

export function BossSalesTable({
  groups,
  laneColPx = 220,
}: {
  groups: Array<{
    ownerId: string;
    name: string;
    projects: Project[];
  }>;
  laneColPx?: number;
}) {
  const gridCols = `${laneColPx}px repeat(${STAGES.length}, minmax(0, 1fr))`;

  return (
    <div className="rounded-2xl border border-white/10 bg-black/20 overflow-hidden">
      {/* header row */}
      <div
        className="grid gap-2 px-4 py-3 border-b border-white/10 bg-black/30"
        style={{ gridTemplateColumns: gridCols }}
      >
        <div className="text-sm font-semibold">Sales (Lane)</div>
        {STAGES.map((s, idx) => (
          <div key={s} className="text-sm font-semibold text-center">
            <div className="text-[11px] text-neutral-500">Stage {idx + 1}</div>
            <div>{s}</div>
          </div>
        ))}
      </div>

      {/* body rows */}
      <div className="divide-y divide-white/10">
        {groups.map((g) => {
          const stats = calcStats(g.projects);

          // group projects by stage
          const byStage = STAGES.reduce((acc, s) => {
            acc[s] = [];
            return acc;
          }, {} as Record<Stage, Project[]>);
          for (const p of g.projects) byStage[p.stage].push(p);

          return (
            <div
              key={g.ownerId}
              className="grid gap-2 px-4 py-4"
              style={{ gridTemplateColumns: gridCols }}
            >
              {/* left cell */}
              <div className="rounded-xl border border-white/10 bg-black/30 p-3">
                <div className="text-sm font-semibold truncate">{g.name}</div>
                <div className="mt-1 text-[11px] text-neutral-400">
                  Total {stats.total} · Active {stats.active} · Won {stats.won} · Lost{" "}
                  {stats.lost}
                </div>
                <div className="mt-1 text-[11px] text-neutral-400">
                  Amount {fmtMoney(stats.amountTotal)}
                </div>
              </div>

              {/* stage cells */}
              {STAGES.map((stage) => {
                const list = byStage[stage];
                return (
                  <div
                    key={stage}
                    className="rounded-xl border border-white/10 bg-black/10 p-3 min-h-[92px]"
                  >
                    {list.length === 0 ? (
                      <div className="text-xs text-neutral-600">—</div>
                    ) : (
                      <div className="space-y-2">
                        {/* 先用数量 + 简短列表（更像表格） */}
                        <div className="text-xs text-neutral-400">
                          {list.length} item(s)
                        </div>

                        {/* 展示最多2个，避免撑爆表格 */}
                        {list.slice(0, 2).map((p) => (
                          <div
                            key={p.id}
                            className="text-xs rounded-lg border border-white/10 bg-black/30 px-2 py-1"
                            title={`${p.customer_detail ?? "No customer"} - ${
                              p.project_info ?? "No info"
                            }`}
                          >
                            <div className="truncate">
                              🐎 {p.customer_detail ?? "No customer"}
                            </div>
                          </div>
                        ))}

                        {list.length > 2 ? (
                          <div className="text-[11px] text-neutral-500">
                            +{list.length - 2} more
                          </div>
                        ) : null}
                      </div>
                    )}
                  </div>
                );
              })}
            </div>
          );
        })}
      </div>
    </div>
  );
}
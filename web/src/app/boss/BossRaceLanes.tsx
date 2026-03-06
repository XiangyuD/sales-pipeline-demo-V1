"use client";

import { STAGES, type Stage } from "@/lib/stages";
import { useEffect, useMemo, useState } from "react";
import { createPortal } from "react-dom";

type CloseStatus = "won" | "lost" | null;

type Project = {
  id: string;
  date: string | null;
  customer_detail: string | null;
  project_info: string | null;
  stage: Stage;
  owner_user_id: string;

  amount?: number | null;
  close_status?: CloseStatus;
  lost_reason?: string | null;
};

const SHOW_AMOUNT_STAGES: Stage[] = [
  "Proposal",
  "Negotiation",
  "Contract Review",
  "Closing",
];

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

export function BossRaceLanes(props: {
  projects: Project[];
  ownerNameMap: Record<string, string>;
}) {
  const { projects, ownerNameMap } = props;

  // ✅ Reason modal state (boss read-only)
  const [reasonTarget, setReasonTarget] = useState<Project | null>(null);

  const[mounted, setMounted] = useState(false);
  
  useEffect(() => {
    setMounted(true);
  }, []);

  const reasonText = useMemo(() => {
    return (reasonTarget?.lost_reason ?? "").trim();
  }, [reasonTarget]);

  // Group projects by owner_user_id (each owner = one lane)
  const owners = Array.from(new Set(projects.map((p) => p.owner_user_id)));
  owners.sort((a, b) => a.localeCompare(b));

  // Build a lookup: owner -> stage -> projects[]
  const laneMap: Record<string, Record<Stage, Project[]>> = {};
  for (const owner of owners) {
    laneMap[owner] = {
      Lead: [],
      Qualification: [],
      "Solution Design": [],
      Proposal: [],
      Negotiation: [],
      "Contract Review": [],
      Closing: [],
    };
  }

  for (const p of projects) {
    laneMap[p.owner_user_id]?.[p.stage].push(p);
  }

  return (
    <>
      <div className="rounded-2xl border border-white/10 bg-white/[0.02] p-4 overflow-x-auto">
        <div className="min-w-[1100px]">
          {/* Header row */}
          <div className="grid grid-cols-[180px_repeat(7,minmax(120px,1fr))] gap-2 mb-3">
            <div className="text-sm font-medium text-white/80">
              Sales (Lane)
            </div>
            {STAGES.map((s, idx) => (
              <div key={s} className="text-center">
                <div className="text-xs text-white/40">Stage {idx + 1}</div>
                <div className="font-medium text-white/85">{s}</div>
              </div>
            ))}
          </div>

          {/* Lanes */}
          <div className="space-y-2">
            {owners.map((owner) => (
              <div
                key={owner}
                className="grid grid-cols-[180px_repeat(7,minmax(120px,1fr))] gap-2"
              >
                {/* Lane label */}
                <div className="rounded-xl border border-white/10 bg-white/[0.03] backdrop-blur-md p-3">
                  <div className="text-sm font-semibold text-white">
                    {ownerNameMap[owner] ?? `sales-${owner.slice(0, 8)}`}
                  </div>
                  <div className="text-xs text-white/40 break-all">
                    {owner.slice(0, 8)}
                  </div>
                  <div className="mt-2 text-xs text-white/55">
                    {projects.filter((p) => p.owner_user_id === owner).length}{" "}
                    horses
                  </div>
                </div>

                {/* Stage cells */}
                {STAGES.map((stage) => {
                  const list = laneMap[owner][stage];
                  return (
                    <div
                      key={stage}
                      className="rounded-xl border border-white/10 bg-white/[0.02] p-2 min-h-[90px]"
                    >
                      <div className="space-y-2">
                        {list.map((p) => {
                          const showAmount =
                            SHOW_AMOUNT_STAGES.includes(p.stage) &&
                            p.amount != null &&
                            Number(p.amount) > 0;

                          const showCloseStatus =
                            p.stage === "Closing" &&
                            (p.close_status === "won" ||
                              p.close_status === "lost");

                          const canShowReasonButton =
                            p.stage === "Closing" &&
                            p.close_status === "lost" &&
                            (p.lost_reason ?? "").trim().length > 0;

                          return (
                            <div
                              key={p.id}
                              className="rounded-lg border border-white/10 bg-[#0B0F18]/70 p-2"
                            >
                              {/* Top row: date + badges */}
                              <div className="flex items-start justify-between gap-2">
                                <div className="text-xs text-white/55">
                                  🐎 {p.date ?? "No date"}
                                </div>

                                <div className="flex flex-wrap items-center justify-end gap-1">
                                  {showAmount ? (
                                    <span className="shrink-0 inline-flex items-center rounded-full border border-blue-400/25 bg-blue-400/10 px-2 py-0.5 text-[11px] text-blue-200">
                                      {fmtMoney(Number(p.amount))}
                                    </span>
                                  ) : null}

                                  {showCloseStatus ? (
                                    <span
                                      className={`shrink-0 inline-flex items-center rounded-full border px-2 py-0.5 text-[11px] ${
                                        p.close_status === "won"
                                          ? "border-emerald-400/25 bg-emerald-400/10 text-emerald-200"
                                          : "border-rose-400/25 bg-rose-400/10 text-rose-200"
                                      }`}
                                    >
                                      {p.close_status === "won"
                                        ? "✅ Won"
                                        : "❌ Lost"}
                                    </span>
                                  ) : null}
                                </div>
                              </div>

                              <div className="mt-1 text-sm text-white/90">
                                {p.customer_detail ?? "No customer"}
                              </div>

                              <div className="text-xs text-white/65 line-clamp-2">
                                {p.project_info ?? "No info"}
                              </div>

                              {/* ✅ Bottom row: right-bottom Reason button (boss read-only) */}
                              {canShowReasonButton ? (
                                <div className="mt-2 flex justify-end">
                                  <button
                                    onClick={() => setReasonTarget(p)}
                                    className="text-xs border border-white/20 px-2 py-1 rounded-md hover:bg-white/10 transition text-white/80"
                                  >
                                    Reason
                                  </button>
                                </div>
                              ) : null}
                            </div>
                          );
                        })}

                        {list.length === 0 ? (
                          <div className="text-xs text-white/20">—</div>
                        ) : null}
                      </div>
                    </div>
                  );
                })}
              </div>
            ))}

            {owners.length === 0 ? (
              <div className="text-white/55">No projects yet.</div>
            ) : null}
          </div>

          <div className="mt-4 text-right text-xs text-white/40">
            Finish line → Closing
          </div>
        </div>
      </div>

      {/* ✅ Reason modal (boss read-only) */}
      {mounted && reasonTarget
        ? createPortal(
            <div className="fixed inset-0 z-[9999] bg-black/60">
              <div className="absolute left-1/2 top-1/2 -translate-x-1/2 -translate-y-1/2 w-[520px] max-w-[92vw] rounded-2xl border border-white/15 bg-black p-5 shadow-xl">
                <div className="flex items-start justify-between gap-4">
                  <div>
                    <div className="text-sm font-semibold">Lost reason</div>
                    <div className="mt-1 text-xs text-white/55">
                      🐎 {reasonTarget.customer_detail ?? "No customer"} —{" "}
                      {reasonTarget.project_info ?? "No info"}
                    </div>
                  </div>

                  <button
                    onClick={() => setReasonTarget(null)}
                    className="text-xs px-3 py-1 border border-white/20 rounded-md hover:bg-white/10 transition"
                  >
                    Close
                  </button>
                </div>

                <div className="mt-4 rounded-xl border border-white/10 bg-white/5 p-4">
                  <div className="text-xs text-white/50 mb-2">Reason</div>
                  <div className="text-sm whitespace-pre-wrap text-white/90">
                    {reasonText || "No reason saved."}
                  </div>
                </div>

                <div className="mt-4 flex justify-end">
                  <button
                    onClick={() => setReasonTarget(null)}
                    className="text-xs px-3 py-1 border border-white/20 rounded-md hover:bg-white/10 transition"
                  >
                    OK
                  </button>
                </div>
              </div>
            </div>,
            document.body
          )
        : null}
    </>
  );
}
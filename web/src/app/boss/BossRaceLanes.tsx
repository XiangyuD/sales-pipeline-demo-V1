"use client";

import { STAGES, type Stage } from "@/lib/stages";
import { useEffect, useMemo, useState } from "react";
import { createPortal } from "react-dom";
import { createClient } from "@/lib/supabase/client";

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

type StageLog = {
  id: string;
  project_id: string;
  stage: Stage;
  entered_at: string;
  comment: string | null;
  created_at: string;
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

function diffDays(from: string, to: string) {
  const a = new Date(from + "T00:00:00");
  const b = new Date(to + "T00:00:00");
  const ms = b.getTime() - a.getTime();
  return Math.round(ms / (1000 * 60 * 60 * 24));
}

function AmountBadge({ amount }: { amount: number }) {
  return (
    <span className="inline-flex items-center rounded-full border border-sky-400/25 bg-sky-400/10 px-2.5 py-1 text-[11px] font-medium text-sky-200 shadow-[0_0_0_1px_rgba(56,189,248,0.06)]">
      {fmtMoney(amount)}
    </span>
  );
}

function StatusBadge({ status }: { status: "won" | "lost" }) {
  const cls =
    status === "won"
      ? "border-emerald-400/25 bg-emerald-400/10 text-emerald-200 shadow-[0_0_0_1px_rgba(52,211,153,0.06)]"
      : "border-rose-400/25 bg-rose-400/10 text-rose-200 shadow-[0_0_0_1px_rgba(251,113,133,0.06)]";

  return (
    <span
      className={`inline-flex items-center rounded-full border px-2.5 py-1 text-[11px] font-medium ${cls}`}
    >
      {status === "won" ? "✅ Won" : "❌ Lost"}
    </span>
  );
}

function InfoButton({
  onClick,
  children = "Info",
}: {
  onClick: () => void;
  children?: React.ReactNode;
}) {
  return (
    <button
      onClick={onClick}
      className="text-xs border border-white/15 bg-white/[0.03] px-2.5 py-1 rounded-md text-white/80 hover:bg-white/[0.08] hover:text-white transition"
    >
      {children}
    </button>
  );
}

export function BossRaceLanes(props: {
  projects: Project[];
  ownerNameMap: Record<string, string>;
}) {
  const { projects, ownerNameMap } = props;
  const supabase = createClient();

  const [infoTarget, setInfoTarget] = useState<Project | null>(null);
  const [logs, setLogs] = useState<StageLog[]>([]);
  const [logsLoading, setLogsLoading] = useState(false);
  const [logsErr, setLogsErr] = useState<string | null>(null);

  const [mounted, setMounted] = useState(false);

  useEffect(() => {
    setMounted(true);
  }, []);

  async function openInfo(project: Project) {
    setInfoTarget(project);
    setLogs([]);
    setLogsErr(null);
    setLogsLoading(true);

    const { data, error } = await supabase
      .from("project_stage_logs")
      .select("id, project_id, stage, entered_at, comment, created_at")
      .eq("project_id", project.id)
      .order("entered_at", { ascending: true })
      .order("created_at", { ascending: true });

    if (error) {
      setLogsErr(error.message);
      setLogsLoading(false);
      return;
    }

    setLogs((data ?? []) as StageLog[]);
    setLogsLoading(false);
  }

  const leadDate = useMemo(() => {
    const lead = logs.find((l) => l.stage === "Lead");
    return lead?.entered_at ?? null;
  }, [logs]);

  const owners = Array.from(new Set(projects.map((p) => p.owner_user_id)));
  owners.sort((a, b) => a.localeCompare(b));

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
          <div className="grid grid-cols-[180px_repeat(7,minmax(120px,1fr))] gap-2 mb-3">
            <div className="text-sm font-medium text-white/80">Sales (Lane)</div>
            {STAGES.map((s, idx) => (
              <div key={s} className="text-center">
                <div className="text-xs text-white/40">Stage {idx + 1}</div>
                <div className="font-medium text-white/85">{s}</div>
              </div>
            ))}
          </div>

          <div className="space-y-2">
            {owners.map((owner) => (
              <div
                key={owner}
                className="grid grid-cols-[180px_repeat(7,minmax(120px,1fr))] gap-2"
              >
                <div className="rounded-xl border border-white/10 bg-white/[0.03] backdrop-blur-md p-3">
                  <div className="text-sm font-semibold text-white">
                    {ownerNameMap[owner] ?? `sales-${owner.slice(0, 8)}`}
                  </div>
                  <div className="text-xs text-white/40 break-all">
                    {owner.slice(0, 8)}
                  </div>
                  <div className="mt-2 text-xs text-white/55">
                    {projects.filter((p) => p.owner_user_id === owner).length} horses
                  </div>
                </div>

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
                            (p.close_status === "won" || p.close_status === "lost");

                          return (
                            <div
                              key={p.id}
                              className="group rounded-xl border border-white/10 bg-[#0B0F18]/78 p-3 transition duration-200 hover:border-sky-400/25 hover:bg-[#0E1422]/90 hover:shadow-[0_0_0_1px_rgba(56,189,248,0.08),0_12px_30px_rgba(2,12,27,0.45)]"
                            >
                              <div className="text-[13px] font-semibold text-white truncate">
                                {p.customer_detail ?? "No customer"}
                              </div>

                              <div className="mt-1 text-xs text-white/60 line-clamp-2 min-h-[32px]">
                                {p.project_info ?? "No info"}
                              </div>

                              <div className="mt-3 flex flex-wrap items-center gap-2 min-h-[30px]">
                                {showAmount ? (
                                  <AmountBadge amount={Number(p.amount)} />
                                ) : null}

                                {showCloseStatus ? (
                                  <StatusBadge status={p.close_status as "won" | "lost"} />
                                ) : null}
                              </div>

                              <div className="mt-3 flex justify-end">
                                <InfoButton onClick={() => openInfo(p)} />
                              </div>
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

      {mounted && infoTarget
        ? createPortal(
            <div
              className="fixed inset-0 z-[9999] bg-black/72 backdrop-blur-[3px]"
              onClick={() => setInfoTarget(null)}
            >
              <div
                className="absolute left-1/2 top-1/2 -translate-x-1/2 -translate-y-1/2 w-[720px] max-w-[94vw] max-h-[85vh] overflow-y-auto rounded-2xl border border-white/15 bg-[#101826] p-5 shadow-[0_24px_80px_rgba(0,0,0,0.65),0_0_0_1px_rgba(255,255,255,0.03)]"
                onClick={(e) => e.stopPropagation()}
              >
                <div className="flex items-start justify-between gap-4">
                  <div>
                    <div className="text-lg font-semibold text-white">Project info</div>
                    <div className="mt-1 text-xs text-white/55">
                      🐎 {infoTarget.customer_detail ?? "No customer"} —{" "}
                      {infoTarget.project_info ?? "No info"}
                    </div>
                  </div>

                  <button
                    onClick={() => setInfoTarget(null)}
                    className="text-xs px-3 py-1 border border-white/20 rounded-md hover:bg-white/10 transition"
                  >
                    Close
                  </button>
                </div>

                <div className="mt-4 h-px bg-white/8" />

                <div className="mt-4 grid grid-cols-1 sm:grid-cols-3 gap-3">
                  <div className="rounded-xl border border-white/12 bg-white/[0.06] p-3">
                    <div className="text-xs text-white/45">Current stage</div>
                    <div className="mt-1 text-sm text-white/90">
                      {infoTarget.stage}
                    </div>
                  </div>

                  <div className="rounded-xl border border-white/12 bg-white/[0.06] p-3">
                    <div className="text-xs text-white/45">Amount</div>
                    <div className="mt-1 text-sm text-white/90">
                      {infoTarget.amount != null && Number(infoTarget.amount) > 0
                        ? fmtMoney(Number(infoTarget.amount))
                        : "—"}
                    </div>
                  </div>

                  <div className="rounded-xl border border-white/12 bg-white/[0.06] p-3">
                    <div className="text-xs text-white/45">Outcome</div>
                    <div className="mt-1 text-sm text-white/90">
                      {infoTarget.stage === "Closing"
                        ? infoTarget.close_status === "won"
                          ? "Won"
                          : infoTarget.close_status === "lost"
                          ? "Lost"
                          : "Closing"
                        : "In progress"}
                    </div>
                  </div>
                </div>

                {infoTarget.stage === "Closing" &&
                infoTarget.close_status === "lost" &&
                (infoTarget.lost_reason ?? "").trim() ? (
                  <div className="mt-4 rounded-xl border border-rose-400/20 bg-rose-400/10 p-4">
                    <div className="text-xs text-rose-200/80 mb-2">
                      Lost reason
                    </div>
                    <div className="text-sm text-rose-100 whitespace-pre-wrap">
                      {infoTarget.lost_reason}
                    </div>
                  </div>
                ) : null}

                <div className="mt-5">
                  <div className="text-sm font-semibold text-white">Timeline</div>

                  {logsLoading ? (
                    <div className="mt-3 text-sm text-white/55">
                      Loading stage history...
                    </div>
                  ) : logsErr ? (
                    <div className="mt-3 text-sm text-rose-300">{logsErr}</div>
                  ) : logs.length === 0 ? (
                    <div className="mt-3 text-sm text-white/45">
                      No stage history yet.
                    </div>
                  ) : (
                    <div className="mt-3 space-y-3">
                      {logs.map((log, idx) => {
                        const daysFromLead =
                          leadDate && log.entered_at
                            ? diffDays(leadDate, log.entered_at)
                            : null;

                        const isLast = idx === logs.length - 1;

                        return (
                          <div key={log.id} className="flex gap-3">
                            <div className="flex flex-col items-center pt-1">
                              <div className="h-2.5 w-2.5 rounded-full bg-sky-400 shadow-[0_0_12px_rgba(56,189,248,0.45)]" />
                              {!isLast ? (
                                <div className="mt-1 w-px flex-1 bg-white/10 min-h-[48px]" />
                              ) : null}
                            </div>

                            <div className="flex-1 rounded-xl border border-white/12 bg-[#141D2B] p-4">
                              <div className="flex items-start justify-between gap-3">
                                <div>
                                  <div className="text-sm font-medium text-white/90">
                                    {log.stage}
                                  </div>
                                  <div className="mt-1 text-xs text-white/50">
                                    {log.entered_at}
                                    {daysFromLead != null
                                      ? daysFromLead === 0
                                        ? " · Day 0"
                                        : ` · +${daysFromLead} day${
                                            daysFromLead > 1 ? "s" : ""
                                          }` + " from the lead"
                                      : ""}
                                  </div>
                                </div>
                              </div>

                              <div className="mt-3">
                                <div className="text-xs text-white/45 mb-1">
                                  Comment
                                </div>
                                <div className="text-sm text-white/85 whitespace-pre-wrap">
                                  {log.comment?.trim() ? log.comment : "—"}
                                </div>
                              </div>
                            </div>
                          </div>
                        );
                      })}
                    </div>
                  )}
                </div>

                <div className="mt-5 flex justify-end">
                  <button
                    onClick={() => setInfoTarget(null)}
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
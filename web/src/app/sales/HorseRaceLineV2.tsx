"use client";

import { STAGES, type Stage } from "@/lib/stages";
import { useEffect, useMemo, useState } from "react";
import { createClient } from "@/lib/supabase/client";

type CloseStatus = "won" | "lost" | null;

export type Project = {
  id: string;
  date: string | null;
  customer_detail: string | null;
  project_info: string | null;
  stage: Stage;

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

const stagePct = (s: Stage) => {
  const i = STAGES.indexOf(s);
  const max = Math.max(1, STAGES.length - 1);
  return i / max;
};

const NEED_AMOUNT_STAGES: Stage[] = [
  "Proposal",
  "Negotiation",
  "Contract Review",
  "Closing",
];

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

function diffDays(from: string, to: string) {
  const a = new Date(from + "T00:00:00");
  const b = new Date(to + "T00:00:00");
  const ms = b.getTime() - a.getTime();
  return Math.round(ms / (1000 * 60 * 60 * 24));
}

// ========= tiny UI helpers =========
function Pill({
  children,
  tone = "default",
  className = "",
}: {
  children: React.ReactNode;
  tone?: "default" | "warn" | "won" | "lost" | "amount";
  className?: string;
}) {
  const toneCls =
    tone === "warn"
      ? "border-amber-400/25 bg-amber-400/10 text-amber-200"
      : tone === "won"
      ? "border-emerald-400/25 bg-emerald-400/10 text-emerald-200"
      : tone === "lost"
      ? "border-rose-400/25 bg-rose-400/10 text-rose-200"
      : tone === "amount"
      ? "border-blue-400/25 bg-blue-400/10 text-blue-200"
      : "border-white/10 bg-white/[0.04] text-white/85";

  return (
    <span
      className={`inline-flex items-center rounded-full border px-2 py-0.5 text-[11px] ${toneCls} ${className}`}
    >
      {children}
    </span>
  );
}

function GhostBtn({
  children,
  onClick,
  disabled,
  title,
  className = "",
}: {
  children: React.ReactNode;
  onClick?: (e: React.MouseEvent) => void;
  disabled?: boolean;
  title?: string;
  className?: string;
}) {
  return (
    <button
      disabled={disabled}
      title={title}
      onClick={onClick}
      className={`text-xs px-2.5 py-1 rounded-md border border-white/15 bg-white/[0.03] hover:bg-white/[0.08] transition disabled:opacity-40 disabled:cursor-not-allowed ${className}`}
    >
      {children}
    </button>
  );
}

function ModalShell({
  title,
  subtitle,
  onClose,
  children,
  widthClass = "w-[720px] max-w-[94vw]",
}: {
  title: string;
  subtitle?: string;
  onClose: () => void;
  children: React.ReactNode;
  widthClass?: string;
}) {
  return (
    <div className="fixed inset-0 z-50 bg-black/72 backdrop-blur-[3px] flex items-center justify-center p-4">
      <div
        className={`${widthClass} max-h-[85vh] overflow-y-auto rounded-2xl border border-white/15 bg-[#101826] p-5 shadow-[0_24px_80px_rgba(0,0,0,0.65),0_0_0_1px_rgba(255,255,255,0.03)]`}
      >
        <div className="flex items-start justify-between gap-4">
          <div>
            <div className="text-lg font-semibold text-white">{title}</div>
            {subtitle ? (
              <div className="mt-1 text-xs text-white/55">{subtitle}</div>
            ) : null}
          </div>

          <GhostBtn onClick={() => onClose()}>Close</GhostBtn>
        </div>

        <div className="mt-4 h-px bg-white/8" />
        <div className="mt-4">{children}</div>
      </div>
    </div>
  );
}

export function HorseRaceLineV2({
  projects,
  onMove,
  onDelete,
  onSaveReason,
  title = "Race Track",
}: {
  projects: Project[];
  onMove: (id: string, next: Stage) => void;
  onDelete: (id: string) => void;
  onSaveReason: (projectId: string, reason: string) => Promise<void> | void;
  title?: string;
}) {
  const supabase = createClient();

  // Sales info modal state
  const [infoTarget, setInfoTarget] = useState<Project | null>(null);
  const [logs, setLogs] = useState<StageLog[]>([]);
  const [logsLoading, setLogsLoading] = useState(false);
  const [logsErr, setLogsErr] = useState<string | null>(null);
  const [savingId, setSavingId] = useState<string | null>(null);

  const [amountDraft, setAmountDraft] = useState("");
  const [lostReasonDraft, setLostReasonDraft] = useState("");

  const canEditAmount =
  infoTarget ? NEED_AMOUNT_STAGES.includes(infoTarget.stage) : false;
  

  // keep old reason modal logic removed -> unified into info

  async function openInfo(p: Project) {
    setInfoTarget(p);
    setLogs([]);
    setLogsErr(null);
    setLogsLoading(true);
    setAmountDraft(
      p.amount != null && Number(p.amount) > 0 ? String(Number(p.amount)) : ""
    );
    setLostReasonDraft(p.lost_reason ?? "");

    const { data, error } = await supabase
      .from("project_stage_logs")
      .select("id, project_id, stage, entered_at, comment, created_at")
      .eq("project_id", p.id)
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

  function closeInfo() {
    setInfoTarget(null);
    setLogs([]);
    setLogsErr(null);
    setSavingId(null);
    setAmountDraft("");
    setLostReasonDraft("");
  }

  async function saveStageLog(logId: string, patch: { entered_at: string; comment: string }) {
    setLogsErr(null);
    setSavingId(logId);

    const { error } = await supabase
      .from("project_stage_logs")
      .update({
        entered_at: patch.entered_at,
        comment: patch.comment.trim() || null,
      })
      .eq("id", logId);

    if (error) {
      setLogsErr(error.message);
      setSavingId(null);
      return;
    }

    setLogs((prev) =>
      prev.map((l) =>
        l.id === logId
          ? {
              ...l,
              entered_at: patch.entered_at,
              comment: patch.comment.trim() || null,
            }
          : l
      )
    );

    setSavingId(null);
  }

  async function saveAmount(projectId: string) {
    if (!infoTarget) return;
  
    const canEditAmount = NEED_AMOUNT_STAGES.includes(infoTarget.stage);
    if (!canEditAmount) {
      setLogsErr("Amount can only be entered after Proposal.");
      return;
    }
  
    const amountNum = Number(amountDraft);
    if (!Number.isFinite(amountNum) || amountNum < 0) {
      setLogsErr("Amount must be a valid number.");
      return;
    }
  
    setLogsErr(null);
    setSavingId("amount");
  
    const nextAmount = amountDraft.trim() === "" ? null : amountNum;
  
    const { error } = await supabase
      .from("projects")
      .update({ amount: nextAmount })
      .eq("id", projectId);
  
    if (error) {
      setLogsErr(error.message);
      setSavingId(null);
      return;
    }
  
    setInfoTarget((prev) => (prev ? { ...prev, amount: nextAmount } : prev));
    setSavingId(null);
  }
  
  async function saveLostReasonInline(projectId: string) {
    setLogsErr(null);
    setSavingId("lost_reason");

    try {
      await onSaveReason(projectId, lostReasonDraft.trim());
      setInfoTarget((prev) =>
        prev ? { ...prev, lost_reason: lostReasonDraft.trim() } : prev
      );
    } catch (e: any) {
      setLogsErr(e?.message ?? "Failed to save lost reason.");
    } finally {
      setSavingId(null);
    }
  }

  const leadDate = useMemo(() => {
    const lead = logs.find((l) => l.stage === "Lead");
    return lead?.entered_at ?? null;
  }, [logs]);

  return (
    <>
      <div className="rounded-2xl border border-white/10 bg-white/[0.03] backdrop-blur-md shadow-[0_8px_30px_rgba(0,0,0,0.35)] p-6">
        <div className="flex items-center justify-between">
          <div>
            <div className="text-lg font-semibold text-white">{title}</div>
            <div className="mt-1 text-xs text-white/55">Lead → Closing</div>
          </div>
        </div>

        {/* Stage header */}
        <div className="relative mt-4 mb-3 h-8">
          <div className="absolute left-0 right-0 top-5 h-[6px] bg-white/[0.06] rounded-full" />
          <div className="absolute left-0 right-0 top-[22px] h-[2px] border-t border-dashed border-white/10" />

          {STAGES.map((s, idx) => {
            const isFirst = idx === 0;
            const isLast = idx === STAGES.length - 1;

            if (!isFirst && !isLast) {
              return (
                <div
                  key={s}
                  className="absolute -translate-x-1/2 text-[11px] text-white/45"
                  style={{ left: `${stagePct(s) * 100}%`, top: 0 }}
                >
                  {s}
                </div>
              );
            }

            if (isFirst) {
              return (
                <div
                  key={s}
                  className="absolute text-[11px] text-white/45"
                  style={{ left: 0, top: 0 }}
                >
                  {s}
                </div>
              );
            }

            return (
              <div
                key={s}
                className="absolute text-[11px] text-white/45 text-right"
                style={{ right: 0, top: 0 }}
              >
                {s}
              </div>
            );
          })}
        </div>

        {/* Lanes */}
        <div className="flex flex-col gap-3">
          {projects.map((p) => {
            const raw = stagePct(p.stage) * 100;
            const isStart = raw <= 0.0001;
            const isEnd = raw >= 99.9999;

            const anchorClass = isStart
              ? "translate-x-0"
              : isEnd
              ? "-translate-x-full"
              : "-translate-x-1/2";

            const i = STAGES.indexOf(p.stage);
            const next = i < STAGES.length - 1 ? STAGES[i + 1] : null;

            const isClosing = p.stage === "Closing";

            const amountMissing =
              NEED_AMOUNT_STAGES.includes(p.stage) &&
              (p.amount === null ||
                p.amount === undefined ||
                Number(p.amount) <= 0);

            const showAmount =
              p.amount !== null &&
              p.amount !== undefined &&
              Number(p.amount) > 0;

            const showCloseBadge =
              isClosing && (p.close_status === "won" || p.close_status === "lost");

            const closeText =
              p.close_status === "won"
                ? "Won"
                : p.close_status === "lost"
                ? "Lost"
                : "Closing";

            return (
              <div key={p.id} className="relative h-[120px]">
                <div className="absolute left-0 right-0 top-1/2 -translate-y-1/2 h-[6px] rounded-full bg-white/[0.06]" />
                <div className="absolute left-0 right-0 top-1/2 -translate-y-1/2 h-[2px] border-t border-dashed border-white/10" />

                <div
                  className={`absolute top-1/2 -translate-y-1/2 ${anchorClass} transition-[left] duration-300 ease-out`}
                  style={{ left: `${raw}%` }}
                >
                  <div className="relative w-64 rounded-2xl border border-white/12 bg-[#0B0F18]/80 backdrop-blur-md p-3 shadow-[0_10px_24px_rgba(0,0,0,0.35)] hover:bg-[#0B0F18]/90 transition">
                    <button
                      onClick={(e) => {
                        e.stopPropagation();
                        onDelete(p.id);
                      }}
                      className="absolute top-2 right-2 text-xs text-white/45 hover:text-white/90 transition"
                      title="Delete"
                    >
                      ✕
                    </button>

                    <div className="text-sm font-medium truncate text-white">
                      🐎 {p.customer_detail ?? "No customer"}
                    </div>
                    <div className="text-xs text-white/55 truncate">
                      {p.project_info ?? "No info"}
                    </div>

                    <div className="mt-2 flex flex-wrap items-center gap-2">
                      {amountMissing ? <Pill tone="warn">⚠ Amount required</Pill> : null}

                      {showAmount ? (
                        <Pill tone="amount">{fmtMoney(Number(p.amount))}</Pill>
                      ) : null}

                      {showCloseBadge ? (
                        <Pill tone={p.close_status === "won" ? "won" : "lost"}>
                          {p.close_status === "won" ? "✅" : "❌"} {closeText}
                        </Pill>
                      ) : null}
                    </div>

                    <div className="mt-3 flex items-center justify-between">
                      <div className="text-xs text-white/45">
                        {isClosing ? "Closing (final)" : p.stage}
                      </div>

                      {isClosing ? (
                        <div className="flex gap-2">
                          <GhostBtn
                            onClick={(e) => {
                              e.stopPropagation();
                              openInfo(p);
                            }}
                          >
                            Info
                          </GhostBtn>
                        </div>
                      ) : (
                        <div className="flex gap-2">
                          <GhostBtn
                            onClick={(e) => {
                              e.stopPropagation();
                              openInfo(p);
                            }}
                          >
                            Info
                          </GhostBtn>
                          <GhostBtn
                            disabled={!next}
                            onClick={() => next && onMove(p.id, next)}
                            title="Next"
                          >
                            ▶
                          </GhostBtn>
                        </div>
                      )}
                    </div>
                  </div>
                </div>
              </div>
            );
          })}

          {projects.length === 0 ? (
            <div className="text-sm text-white/50">No horses yet.</div>
          ) : null}
        </div>
      </div>

      {/* Sales info modal */}
      {infoTarget ? (
        <ModalShell
          title="Project info"
          subtitle={`🐎 ${infoTarget.customer_detail ?? "No customer"} — ${
            infoTarget.project_info ?? "No info"
          }`}
          onClose={closeInfo}
        >
          {logsErr ? (
            <div className="mb-3 rounded-xl border border-rose-400/20 bg-rose-400/10 px-4 py-3 text-xs text-rose-200">
              {logsErr}
            </div>
          ) : null}

          {/* Summary editable */}
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
            <div className="rounded-xl border border-white/12 bg-white/[0.06] p-3">
              <div className="text-xs text-white/45">Current stage</div>
              <div className="mt-1 text-sm text-white/90">{infoTarget.stage}</div>
            </div>

            <div className="rounded-xl border border-white/12 bg-white/[0.06] p-3">
              <div className="text-xs text-white/45">Amount</div>
              <input
                value={amountDraft}
                onChange={(e) => setAmountDraft(e.target.value)}
                placeholder={canEditAmount ? "e.g. 25000" : "Locked before Proposal"}
                disabled={!canEditAmount}
                className={`mt-2 w-full rounded-lg border px-3 py-2 text-sm outline-none ${
                  canEditAmount
                    ? "border-white/10 bg-white/[0.03] text-white focus:border-white/20"
                    : "border-white/8 bg-white/[0.02] text-white/35 cursor-not-allowed"
                }`}
              />

              {!canEditAmount ? (
                <div className="mt-2 text-[11px] text-amber-200/80">
                  Amount can only be entered after Proposal.
                </div>
              ) : null}

              <div className="mt-2 flex justify-end">
                <GhostBtn
                  onClick={() => saveAmount(infoTarget.id)}
                  disabled={savingId === "amount" || !canEditAmount}
                >
                  {savingId === "amount" ? "Saving..." : "Save"}
                </GhostBtn>
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

          {/* Lost reason editable */}
          {infoTarget.stage === "Closing" && infoTarget.close_status === "lost" ? (
            <div className="mt-4 rounded-xl border border-rose-400/20 bg-rose-400/10 p-4">
              <div className="text-xs text-rose-200/80 mb-2">Lost reason</div>
              <textarea
                value={lostReasonDraft}
                onChange={(e) => setLostReasonDraft(e.target.value)}
                rows={3}
                className="w-full rounded-xl border border-white/10 bg-white/[0.03] px-3 py-2 text-sm text-white outline-none focus:border-white/20"
                placeholder="Why was it lost?"
              />
              <div className="mt-3 flex justify-end">
                <GhostBtn
                  onClick={() => saveLostReasonInline(infoTarget.id)}
                  disabled={savingId === "lost_reason"}
                >
                  {savingId === "lost_reason" ? "Saving..." : "Save reason"}
                </GhostBtn>
              </div>
            </div>
          ) : null}

          {/* Timeline editable */}
          <div className="mt-5">
            <div className="text-sm font-semibold text-white">Timeline</div>

            {logsLoading ? (
              <div className="mt-3 text-sm text-white/55">
                Loading stage history...
              </div>
            ) : logs.length === 0 ? (
              <div className="mt-3 text-sm text-white/45">
                No stage history yet.
              </div>
            ) : (
              <div className="mt-3 space-y-3">
                {logs.map((log) => {
                  const daysFromLead =
                    leadDate && log.entered_at
                      ? diffDays(leadDate, log.entered_at)
                      : null;

                  return (
                    <EditableStageLogCard
                      key={log.id}
                      log={log}
                      daysFromLead={daysFromLead}
                      saving={savingId === log.id}
                      onSave={(patch) => saveStageLog(log.id, patch)}
                    />
                  );
                })}
              </div>
            )}
          </div>
        </ModalShell>
      ) : null}
    </>
  );
}

function EditableStageLogCard({
  log,
  daysFromLead,
  saving,
  onSave,
}: {
  log: StageLog;
  daysFromLead: number | null;
  saving: boolean;
  onSave: (patch: { entered_at: string; comment: string }) => void;
}) {
  const [enteredAt, setEnteredAt] = useState(log.entered_at);
  const [comment, setComment] = useState(log.comment ?? "");

  useEffect(() => {
    setEnteredAt(log.entered_at);
    setComment(log.comment ?? "");
  }, [log.entered_at, log.comment]);

  const invalid = !enteredAt;

  return (
    <div className="rounded-xl border border-white/12 bg-[#141D2B] p-4">
      <div className="flex items-start justify-between gap-3">
        <div>
          <div className="text-sm font-medium text-white/90">{log.stage}</div>
          <div className="mt-1 text-xs text-white/50">
            {daysFromLead != null
              ? daysFromLead === 0
                ? "Day 0 from Lead"
                : `+${daysFromLead} day${daysFromLead > 1 ? "s" : ""} from Lead`
              : ""}
          </div>
        </div>
      </div>

      <div className="mt-4 grid grid-cols-1 gap-4">
        <div>
          <div className="text-xs text-white/45 mb-1">Stage date</div>
          <input
            type="date"
            value={enteredAt}
            onChange={(e) => setEnteredAt(e.target.value)}
            className="w-full rounded-xl border border-white/10 bg-white/[0.03] px-3 py-2 text-sm text-white outline-none focus:border-white/20"
          />
        </div>

        <div>
          <div className="text-xs text-white/45 mb-1">Comment</div>
          <textarea
            value={comment}
            onChange={(e) => setComment(e.target.value)}
            rows={3}
            className="w-full resize-none rounded-xl border border-white/10 bg-white/[0.03] px-3 py-2 text-sm text-white outline-none focus:border-white/20"
            placeholder="Add notes for this stage..."
          />
        </div>
      </div>

      <div className="mt-3 flex justify-end">
        <GhostBtn
          onClick={() => onSave({ entered_at: enteredAt, comment })}
          disabled={saving || invalid}
        >
          {saving ? "Saving..." : "Save"}
        </GhostBtn>
      </div>
    </div>
  );
}
"use client";

import { STAGES, type Stage } from "@/lib/stages";
import { useMemo, useState } from "react";

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

const stagePct = (s: Stage) => {
  const i = STAGES.indexOf(s);
  const max = Math.max(1, STAGES.length - 1);
  return i / max; // 0..1
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

// ========= tiny UI helpers (same vibe) =========
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
}: {
  title: string;
  subtitle?: string;
  onClose: () => void;
  children: React.ReactNode;
}) {
  return (
    <div className="fixed inset-0 z-50 bg-black/60 flex items-center justify-center p-4">
      <div className="w-[560px] max-w-[94vw] rounded-2xl border border-white/10 bg-white/[0.04] backdrop-blur-md p-5 shadow-[0_18px_60px_rgba(0,0,0,0.55)]">
        <div className="flex items-start justify-between gap-4">
          <div>
            <div className="text-lg font-semibold text-white">{title}</div>
            {subtitle ? (
              <div className="mt-1 text-xs text-white/55">{subtitle}</div>
            ) : null}
          </div>

          <GhostBtn onClick={() => onClose()}>Close</GhostBtn>
        </div>

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
  // Reason modal state
  const [reasonTarget, setReasonTarget] = useState<Project | null>(null);
  const [isEditingReason, setIsEditingReason] = useState(false);
  const [reasonDraft, setReasonDraft] = useState("");
  const [reasonErr, setReasonErr] = useState<string | null>(null);
  const [savingReason, setSavingReason] = useState(false);

  const openReason = (p: Project) => {
    setReasonTarget(p);
    setIsEditingReason(false);
    setReasonDraft(p.lost_reason ?? "");
    setReasonErr(null);
  };

  const closeReason = () => {
    setReasonTarget(null);
    setIsEditingReason(false);
    setReasonErr(null);
    setSavingReason(false);
  };

  const reasonText = useMemo(() => {
    return (reasonTarget?.lost_reason ?? "").trim();
  }, [reasonTarget]);

  return (
    <>
      <div className="rounded-2xl border border-white/10 bg-white/[0.03] backdrop-blur-md shadow-[0_8px_30px_rgba(0,0,0,0.35)] p-6">
        <div className="flex items-center justify-between">
          <div>
            <div className="text-lg font-semibold text-white">{title}</div>
            <div className="mt-1 text-xs text-white/55">Lead → Closing</div>
          </div>
        </div>

        {/* Stage header (compressed) */}
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
            const raw = stagePct(p.stage) * 100; // 0..100
            const isStart = raw <= 0.0001;
            const isEnd = raw >= 99.9999;

            const anchorClass = isStart
              ? "translate-x-0"
              : isEnd
              ? "-translate-x-full"
              : "-translate-x-1/2";

            const i = STAGES.indexOf(p.stage);
            const prev = i > 0 ? STAGES[i - 1] : null;
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

            const canShowReasonButton =
              isClosing &&
              p.close_status === "lost" &&
              (p.lost_reason ?? "").trim().length > 0;

            return (
              <div key={p.id} className="relative h-[120px]">
                {/* lane track */}
                <div className="absolute left-0 right-0 top-1/2 -translate-y-1/2 h-[6px] rounded-full bg-white/[0.06]" />
                <div className="absolute left-0 right-0 top-1/2 -translate-y-1/2 h-[2px] border-t border-dashed border-white/10" />

                {/* card */}
                <div
                  className={`absolute top-1/2 -translate-y-1/2 ${anchorClass} transition-[left] duration-300 ease-out`}
                  style={{ left: `${raw}%` }}
                >
                  <div className="relative w-64 rounded-2xl border border-white/12 bg-[#0B0F18]/80 backdrop-blur-md p-3 shadow-[0_10px_24px_rgba(0,0,0,0.35)] hover:bg-[#0B0F18]/90 transition">
                    {/* delete */}
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

                    {/* badges */}
                    <div className="mt-2 flex flex-wrap items-center gap-2">
                      {amountMissing ? (
                        <Pill tone="warn">⚠ Amount required</Pill>
                      ) : null}

                      {showAmount ? (
                        <Pill tone="amount">{fmtMoney(Number(p.amount))}</Pill>
                      ) : null}

                      {showCloseBadge ? (
                        <Pill tone={p.close_status === "won" ? "won" : "lost"}>
                          {p.close_status === "won" ? "✅" : "❌"} {closeText}
                        </Pill>
                      ) : null}
                    </div>

                    {/* bottom row */}
                    <div className="mt-3 flex items-center justify-between">
                      <div className="text-xs text-white/45">
                        {isClosing ? "Closing (final)" : p.stage}
                      </div>

                      {isClosing ? (
                        canShowReasonButton ? (
                          <GhostBtn
                            onClick={(e) => {
                              e.stopPropagation();
                              openReason(p);
                            }}
                          >
                            Reason
                          </GhostBtn>
                        ) : (
                          <span className="text-xs text-white/45">Final</span>
                        )
                      ) : (
                        <div className="flex gap-2">
                          <GhostBtn
                            disabled={!prev}
                            onClick={() => prev && onMove(p.id, prev)}
                            title="Back"
                          >
                            ◀
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

      {/* Reason modal (view + edit) */}
      {reasonTarget ? (
        <ModalShell
          title="Lost reason"
          subtitle={`🐎 ${reasonTarget.customer_detail ?? "No customer"} — ${
            reasonTarget.project_info ?? "No info"
          }`}
          onClose={closeReason}
        >
          {reasonErr ? (
            <div className="mb-3 rounded-xl border border-rose-400/20 bg-rose-400/10 px-4 py-3 text-xs text-rose-200">
              {reasonErr}
            </div>
          ) : null}

          {!isEditingReason ? (
            <div className="rounded-xl border border-white/10 bg-white/[0.03] p-4">
              <div className="text-xs text-white/55 mb-2">Reason</div>
              <div className="text-sm whitespace-pre-wrap text-white/90">
                {reasonText || "No reason saved."}
              </div>
            </div>
          ) : (
            <textarea
              className="w-full min-h-[150px] rounded-xl border border-white/10 bg-white/[0.03] px-3 py-2 text-sm text-white outline-none focus:border-white/20"
              value={reasonDraft}
              onChange={(e) => setReasonDraft(e.target.value)}
              placeholder="Why was this project lost?"
            />
          )}

          <div className="mt-4 flex justify-end gap-2">
            {!isEditingReason ? (
              <GhostBtn onClick={() => setIsEditingReason(true)}>Edit</GhostBtn>
            ) : (
              <>
                <GhostBtn
                  disabled={savingReason}
                  onClick={() => {
                    setIsEditingReason(false);
                    setReasonDraft(reasonTarget.lost_reason ?? "");
                    setReasonErr(null);
                  }}
                >
                  Cancel
                </GhostBtn>

                <GhostBtn
                  disabled={savingReason}
                  onClick={async () => {
                    setReasonErr(null);
                    const nextReason = reasonDraft.trim();
                    if (!nextReason) {
                      setReasonErr("Reason is required.");
                      return;
                    }

                    setSavingReason(true);
                    try {
                      await onSaveReason(reasonTarget.id, nextReason);

                      // ✅ update modal immediately (fix “still old value”)
                      setReasonTarget((prev) =>
                        prev ? { ...prev, lost_reason: nextReason } : prev
                      );

                      setIsEditingReason(false);
                    } catch (e: any) {
                      setReasonErr(e?.message ?? "Failed to save reason.");
                    } finally {
                      setSavingReason(false);
                    }
                  }}
                >
                  {savingReason ? "Saving..." : "Save"}
                </GhostBtn>
              </>
            )}
          </div>
        </ModalShell>
      ) : null}
    </>
  );
}
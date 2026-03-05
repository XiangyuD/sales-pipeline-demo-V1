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
  // ✅ Single reason modal state (no double overlay)
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
      <div className="rounded-2xl border p-6 bg-black/30">
        <div className="flex items-center justify-between">
          <div className="text-lg font-semibold">{title}</div>
          <div className="text-xs text-neutral-400">Lead → Closing</div>
        </div>

        {/* ✅ Stage header (compressed so no huge blank area) */}
        <div className="relative mt-2 mb-2 h-8">
          <div className="absolute left-0 right-0 top-5 h-2 bg-white/10 rounded-full" />
          <div className="absolute left-0 right-0 top-6 h-[2px] border-t border-dashed border-white/15" />

          {STAGES.map((s, idx) => {
            const isFirst = idx === 0;
            const isLast = idx === STAGES.length - 1;

            if (!isFirst && !isLast) {
              return (
                <div
                  key={s}
                  className="absolute -translate-x-1/2 text-[11px] text-neutral-400"
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
                  className="absolute text-[11px] text-neutral-400"
                  style={{ left: 0, top: 0 }}
                >
                  {s}
                </div>
              );
            }

            return (
              <div
                key={s}
                className="absolute text-[11px] text-neutral-400 text-right"
                style={{ right: 0, top: 0 }}
              >
                {s}
              </div>
            );
          })}
        </div>

        {/* ✅ Lanes (tighter vertical spacing) */}
        <div className="flex flex-col gap-3">
          {projects.map((p) => {
            const raw = stagePct(p.stage) * 100; // 0..100
            const isStart = raw <= 0.0001;
            const isEnd = raw >= 99.9999;

            // keep card in bounds at start/end
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
                ? "✅ Won"
                : p.close_status === "lost"
                ? "❌ Lost"
                : "Closing";

            const canShowReasonButton =
              isClosing && p.close_status === "lost" && (p.lost_reason ?? "").trim().length > 0;

            return (
              <div key={p.id} className="relative h-[120px]">
                {/* lane track */}
                <div className="absolute left-0 right-0 top-1/2 -translate-y-1/2 h-2 rounded-full bg-white/10" />
                <div className="absolute left-0 right-0 top-1/2 -translate-y-1/2 h-[2px] border-t border-dashed border-white/15" />

                {/* card */}
                <div
                  className={`absolute top-1/2 -translate-y-1/2 ${anchorClass} transition-[left] duration-300 ease-out`}
                  style={{ left: `${raw}%` }}
                >
                  <div className="relative w-64 rounded-2xl border border-white/15 bg-black/70 p-3 shadow-lg">
                    {/* delete */}
                    <button
                      onClick={(e) => {
                        e.stopPropagation();
                        onDelete(p.id);
                      }}
                      className="absolute top-2 right-2 text-xs opacity-50 hover:opacity-100"
                      title="Delete"
                    >
                      ✕
                    </button>

                    <div className="text-sm font-medium truncate">
                      🐎 {p.customer_detail ?? "No customer"}
                    </div>
                    <div className="text-xs text-neutral-400 truncate">
                      {p.project_info ?? "No info"}
                    </div>

                    {/* badges row */}
                    <div className="mt-2 flex items-center gap-2">
                      {amountMissing ? (
                        <span className="text-[11px] px-2 py-0.5 rounded-full border border-amber-400/30 text-amber-300 bg-amber-400/10">
                          ⚠ Amount required
                        </span>
                      ) : null}

                      {showAmount ? (
                        <span className="text-[11px] px-2 py-0.5 rounded-full border border-white/10 text-neutral-200 bg-white/5">
                          {fmtMoney(Number(p.amount))}
                        </span>
                      ) : null}

                      {showCloseBadge ? (
                        <span className="text-[11px] px-2 py-0.5 rounded-full border border-white/10 text-neutral-200 bg-white/5">
                          {closeText}
                        </span>
                      ) : null}
                    </div>

                    {/* bottom row: left label + right controls */}
                    <div className="mt-3 flex items-center justify-between">
                      <div className="text-xs text-neutral-500">
                        {isClosing ? "Closing (final)" : p.stage}
                      </div>

                      {isClosing ? (
                        canShowReasonButton ? (
                          <button
                            onClick={(e) => {
                              e.stopPropagation();
                              openReason(p);
                            }}
                            className="text-xs border border-white/20 px-2 py-1 rounded-md hover:bg-white/10"
                          >
                            Reason
                          </button>
                        ) : (
                          <span className="text-xs text-neutral-500">Final</span>
                        )
                      ) : (
                        <div className="flex gap-2">
                          <button
                            disabled={!prev}
                            onClick={() => prev && onMove(p.id, prev)}
                            className="text-xs border border-white/20 px-2 py-1 rounded-md disabled:opacity-30"
                            title="Back"
                          >
                            ◀
                          </button>
                          <button
                            disabled={!next}
                            onClick={() => next && onMove(p.id, next)}
                            className="text-xs border border-white/20 px-2 py-1 rounded-md disabled:opacity-30"
                            title="Next"
                          >
                            ▶
                          </button>
                        </div>
                      )}
                    </div>
                  </div>
                </div>
              </div>
            );
          })}

          {projects.length === 0 ? (
            <div className="text-sm text-neutral-500">No horses yet.</div>
          ) : null}
        </div>
      </div>

      {/* ✅ Reason modal (view + edit) */}
      {reasonTarget ? (
        <div className="fixed inset-0 z-50 bg-black/60 flex items-center justify-center">
          <div className="w-[520px] max-w-[92vw] rounded-2xl border border-white/15 bg-black p-5 shadow-xl">
            <div className="flex items-start justify-between gap-4">
              <div>
                <div className="text-sm font-semibold">Lost reason</div>
                <div className="mt-1 text-xs text-neutral-400">
                  🐎 {reasonTarget.customer_detail ?? "No customer"} —{" "}
                  {reasonTarget.project_info ?? "No info"}
                </div>
              </div>

              <button
                onClick={closeReason}
                className="text-xs px-3 py-1 border border-white/20 rounded-md hover:bg-white/10 transition"
              >
                Close
              </button>
            </div>

            {reasonErr ? (
              <div className="mt-3 text-xs text-red-400">{reasonErr}</div>
            ) : null}

            {!isEditingReason ? (
              <div className="mt-4 rounded-xl border border-white/10 bg-white/5 p-4">
                <div className="text-xs text-neutral-400 mb-2">Reason</div>
                <div className="text-sm whitespace-pre-wrap">
                  {reasonText || "No reason saved."}
                </div>
              </div>
            ) : (
              <textarea
                className="mt-4 w-full min-h-[140px] rounded-xl border border-white/20 bg-transparent p-3 text-sm outline-none"
                value={reasonDraft}
                onChange={(e) => setReasonDraft(e.target.value)}
                placeholder="Why was this project lost?"
              />
            )}

            <div className="mt-4 flex justify-end gap-2">
              {!isEditingReason ? (
                <button
                  onClick={() => setIsEditingReason(true)}
                  className="text-xs px-3 py-1 border border-white/20 rounded-md hover:bg-white/10 transition"
                >
                  Edit
                </button>
              ) : (
                <>
                  <button
                    onClick={() => {
                      setIsEditingReason(false);
                      setReasonDraft(reasonTarget.lost_reason ?? "");
                      setReasonErr(null);
                    }}
                    className="text-xs px-3 py-1 border border-white/20 rounded-md hover:bg-white/10 transition"
                    disabled={savingReason}
                  >
                    Cancel
                  </button>

                  <button
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
                        // keep modal open but exit edit mode; refresh displayed reason
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
                    className="text-xs px-3 py-1 border border-white/20 rounded-md hover:bg-white/10 transition"
                    disabled={savingReason}
                  >
                    {savingReason ? "Saving..." : "Save"}
                  </button>
                </>
              )}
            </div>
          </div>
        </div>
      ) : null}
    </>
  );
}
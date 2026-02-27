"use client";

import { STAGES, type Stage } from "@/lib/stages";
import { useState } from "react";

type Project = {
  id: string;
  date: string | null;
  customer_detail: string | null;
  project_info: string | null;
  stage: Stage;
};

const stagePct = (s: Stage) => {
  const i = STAGES.indexOf(s);
  const max = Math.max(1, STAGES.length - 1);
  return i / max; // 0..1
};


export function HorseRaceLineV2({
  projects,
  onMove,
  onDelete,
  title = "Race Track",
}: {
  projects: Project[];
  onMove: (id: string, next: Stage) => void;
  onDelete: (id: string) => void;
  title?: string;
}) {
  return (
    <div className="rounded-2xl border p-6 bg-black/30">
      <div className="flex items-center justify-between">
        <div className="text-lg font-semibold">{title}</div>
        <div className="text-xs text-neutral-400">Lead → Closing</div>
      </div>

      {/* Stage header */}
      <div className="relative mt-4 mb-6 h-12">
        {/* header track */}
        <div className="absolute left-0 right-0 top-7 h-2 bg-white/10 rounded-full" />
        <div className="absolute left-0 right-0 top-8 h-[2px] border-t border-dashed border-white/15" />

        {STAGES.map((s, idx) => {
          const isFirst = idx === 0;
          const isLast = idx === STAGES.length - 1;

          // 中间的仍然按百分比居中
          if (!isFirst && !isLast) {
            return (
              <div
                key={s}
                className="absolute -translate-x-1/2 text-xs text-neutral-400"
                style={{ left: `${stagePct(s) * 100}%`, top: 0 }}
              >
                {s}
              </div>
            );
          }

          // ✅ Lead：L 对齐线起点（左对齐）
          if (isFirst) {
            return (
              <div
                key={s}
                className="absolute text-xs text-neutral-400"
                style={{ left: 0, top: 0 }}
              >
                {s}
              </div>
            );
          }

          // ✅ Closing：g 对齐线终点（右对齐）
          return (
            <div
              key={s}
              className="absolute text-xs text-neutral-400 text-right"
              style={{ right: 0, top: 0 }}
            >
              {s}
            </div>
          );
        })}
      </div>

      {/* Each horse is its own lane */}
      <div className="flex flex-col gap-7">
        {projects.map((p) => {
          const raw = stagePct(p.stage) * 100; // 0..100

          // ✅ Dynamic anchor so Lead/Closing align AND cards stay in bounds
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

          return (
            <div key={p.id} className="relative h-20">
              {/* lane track ONLY (no big box) */}
              <div className="absolute left-0 right-0 top-1/2 -translate-y-1/2 h-2 rounded-full bg-white/10" />
              <div className="absolute left-0 right-0 top-1/2 -translate-y-1/2 h-[2px] border-t border-dashed border-white/15" />

              {/* horse card */}
              <div
                className={`absolute top-1/2 -translate-y-1/2 ${anchorClass} transition-[left] duration-300 ease-out`}
                style={{ left: `${raw}%` }}
              >
               <div className="relative w-64 rounded-2xl border border-white/15 bg-black/70 p-3 shadow-lg">
               <button
                  onClick={() => onDelete(p.id)}
                  className="absolute top-2 right-2 text-xs opacity-50 hover:opacity-100"
                >
                  ✕
                </button>
                  <div className="text-sm font-medium truncate">
                    🐎 {p.customer_detail ?? "No customer"}
                  </div>
                  <div className="text-xs text-neutral-400 truncate">
                    {p.project_info ?? "No info"}
                  </div>

                  <div className="mt-3 flex items-center justify-between">
                    <div className="text-xs text-neutral-500">{p.stage}</div>

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
  );
}
"use client";

import { STAGES, type Stage } from "@/lib/stages";

type Project = {
  id: string;
  date: string | null;
  customer_detail: string | null;
  project_info: string | null;
  stage: Stage;
};

function stageProgress(stage: Stage) {
  const idx = STAGES.indexOf(stage);
  const max = STAGES.length - 1;
  return max === 0 ? 0 : idx / max; // 0..1
}

function clamp(n: number, min: number, max: number) {
  return Math.max(min, Math.min(max, n));
}

export function HorseRaceLine(props: {
  title?: string;
  projects: Project[];
  onMove?: (projectId: string, nextStage: Stage) => void;
}) {
  const { title = "My Horses", projects, onMove } = props;

  // Group by stage to compute small vertical offsets within same stage
  const stageBuckets: Record<Stage, Project[]> = {
    "Lead": [],
    "Qualification": [],
    "Solution Design": [],
    "Proposal": [],
    "Negotiation": [],
    "Contract Review": [],
    "Closing": [],
  };
  for (const p of projects) stageBuckets[p.stage].push(p);

  return (
    <div className="rounded-xl border p-4">
      <div className="flex items-baseline justify-between gap-3">
        <div className="font-medium">{title}</div>
        <div className="text-xs text-neutral-500">Finish line → Closing</div>
      </div>

      <div className="mt-3 overflow-x-auto">
        <div className="min-w-[980px]">
          {/* Checkpoints */}
          <div className="relative h-[520px] rounded-xl border bg-black/20">
            {/* Track line */}
            <div className="absolute left-6 right-6 top-[92px] h-[2px] bg-white/20" />

            {/* Finish line */}
            <div className="absolute right-6 top-[62px] w-[2px] h-[60px] bg-white/35" />

            {/* Stage markers */}
            {STAGES.map((s) => {
              const x = 6 + stageProgress(s) * 88; // percent across inside padding
              return (
                <div
                  key={s}
                  className="absolute top-[40px] -translate-x-1/2"
                  style={{ left: `${x}%` }}
                >
                  <div className="flex flex-col items-center gap-1">
                    <div className="text-xs text-neutral-400 whitespace-nowrap">
                      {s}
                    </div>
                    <div className="w-[2px] h-[26px] bg-white/25" />
                    <div className="w-2 h-2 rounded-full bg-white/40" />
                  </div>
                </div>
              );
            })}

            {/* Horses */}
            {STAGES.flatMap((stage) =>
              stageBuckets[stage].map((p, i) => {
                const progress = stageProgress(stage);
                const x = 6 + progress * 88; // align to markers (same formula)
                // Offset lanes vertically within one track section: 0, 1, 2... wrap
                const row = i % 8; // up to 8 rows before wrapping
                const y = 150 + row * 42; // px from top
                // Small horizontal jitter so cards don't overlap exactly when many
                const jitter = (Math.floor(i / 8) % 5) * 12; // 0..48px

                const idx = STAGES.indexOf(stage);
                const prev = idx > 0 ? STAGES[idx - 1] : null;
                const next = idx < STAGES.length - 1 ? STAGES[idx + 1] : null;

                return (
                  <div
                    key={p.id}
                    className="absolute -translate-x-1/2"
                    style={{
                      left: `calc(${x}% + ${jitter}px)`,
                      top: `${y}px`,
                    }}
                  >
                    <div className="group relative">
                      {/* Horse token */}
                      <div className="flex items-center gap-2">
                        <div className="w-8 h-8 rounded-full border bg-black/40 flex items-center justify-center">
                          🐎
                        </div>
                        <div className="text-xs text-neutral-300 max-w-[220px] truncate">
                          {p.customer_detail ?? "No customer"}
                        </div>
                      </div>

                      {/* Hover card */}
                      <div className="pointer-events-none opacity-0 group-hover:opacity-100 transition absolute left-0 mt-2 w-[320px] rounded-lg border bg-black/90 p-3 z-10">
                        <div className="text-xs text-neutral-400">
                          {p.date ?? "No date"} · {p.stage}
                        </div>
                        <div className="mt-1 font-medium">
                          {p.customer_detail ?? "No customer"}
                        </div>
                        <div className="mt-1 text-sm text-neutral-200">
                          {p.project_info ?? "No info"}
                        </div>

                        {onMove ? (
                          <div className="mt-3 flex gap-2 pointer-events-auto">
                            <button
                              type="button"
                              className="text-xs rounded-md border px-2 py-1 disabled:opacity-40"
                              disabled={!prev}
                              onClick={() => prev && onMove(p.id, prev)}
                            >
                              ◀ Back
                            </button>
                            <button
                              type="button"
                              className="text-xs rounded-md border px-2 py-1 disabled:opacity-40"
                              disabled={!next}
                              onClick={() => next && onMove(p.id, next)}
                            >
                              Next ▶
                            </button>
                          </div>
                        ) : null}
                      </div>
                    </div>
                  </div>
                );
              })
            )}

            {/* If too many horses, show hint */}
            {projects.length > 24 ? (
              <div className="absolute left-6 bottom-4 text-xs text-neutral-500">
                Tip: hover a horse to see details. (Many horses → auto-stacked)
              </div>
            ) : null}
          </div>

          {/* Legend */}
          <div className="mt-3 text-xs text-neutral-500">
            Hover on 🐎 to see details · Stage position is progress on the track
          </div>
        </div>
      </div>
    </div>
  );
}
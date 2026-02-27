"use client";

import { STAGES, type Stage } from "@/lib/stages";

type Project = {
  id: string;
  date: string | null;
  customer_detail: string | null;
  project_info: string | null;
  stage: Stage;
};

export function RaceTrack(props: {
  projects: Project[];
  onMove: (projectId: string, nextStage: Stage) => void;
}) {
  const { projects, onMove } = props;

  // group by stage
  const byStage: Record<Stage, Project[]> = {
    "Lead": [],
    "Qualification": [],
    "Solution Design": [],
    "Proposal": [],
    "Negotiation": [],
    "Contract Review": [],
    "Closing": [],
  };

  for (const p of projects) byStage[p.stage].push(p);

  return (
    <div className="rounded-xl border p-4 overflow-x-auto">
      <div className="min-w-[980px]">
        {/* Header: stage checkpoints */}
        <div className="grid grid-cols-7 gap-3 mb-4">
          {STAGES.map((s, idx) => (
            <div key={s} className="text-center">
              <div className="text-xs text-neutral-400">Stage {idx + 1}</div>
              <div className="font-medium">{s}</div>
              <div className="text-xs text-neutral-500">
                {byStage[s].length} horses
              </div>
            </div>
          ))}
        </div>

        {/* Track lanes: render columns with cards */}
        <div className="grid grid-cols-7 gap-3">
          {STAGES.map((stage) => (
            <div
              key={stage}
              className="rounded-lg border bg-black/20 p-2 min-h-[380px]"
            >
              <div className="space-y-2">
                {byStage[stage].map((p) => {
                  const i = STAGES.indexOf(p.stage);
                  const prev = i > 0 ? STAGES[i - 1] : null;
                  const next = i < STAGES.length - 1 ? STAGES[i + 1] : null;

                  return (
                    <div key={p.id} className="rounded-lg border p-3 bg-black/30">
                      <div className="text-sm text-neutral-300">
                        {p.date ?? "No date"} · {p.customer_detail ?? "No customer"}
                      </div>
                      <div className="text-sm mt-1">
                        {p.project_info ?? "No info"}
                      </div>

                      <div className="flex gap-2 mt-3">
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
                    </div>
                  );
                })}

                {byStage[stage].length === 0 ? (
                  <div className="text-sm text-neutral-600 p-2">
                    No horses here.
                  </div>
                ) : null}
              </div>
            </div>
          ))}
        </div>

        {/* Simple “finish line” hint */}
        <div className="mt-4 text-right text-xs text-neutral-500">
          Finish line → Closing
        </div>
      </div>
    </div>
  );
}
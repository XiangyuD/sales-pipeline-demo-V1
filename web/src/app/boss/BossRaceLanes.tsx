"use client";

import { STAGES, type Stage } from "@/lib/stages";

type Project = {
  id: string;
  date: string | null;
  customer_detail: string | null;
  project_info: string | null;
  stage: Stage;
  owner_user_id: string;
};

function shortId(id: string) {
  return id.slice(0, 8);
}

export function BossRaceLanes(props: { projects: Project[]; ownerNameMap: Record<string, string> }) {
  const { projects, ownerNameMap } = props;

  // Group projects by owner_user_id (each owner = one lane)
  const owners = Array.from(new Set(projects.map((p) => p.owner_user_id)));

  // Stable ordering: by owner id
  owners.sort((a, b) => a.localeCompare(b));

  const LANE_COL_PX = 200;
  const GRID_COLS = `${LANE_COL_PX}px repeat(7, minmax(0, 1fr))`;

  // Build a lookup: owner -> stage -> projects[]
  const laneMap: Record<string, Record<Stage, Project[]>> = {};
  for (const owner of owners) {
    laneMap[owner] = {
      "Lead": [],
      "Qualification": [],
      "Solution Design": [],
      "Proposal": [],
      "Negotiation": [],
      "Contract Review": [],
      "Closing": [],
    };
  }

  for (const p of projects) {
    laneMap[p.owner_user_id]?.[p.stage].push(p);
  }

  return (
    <div className="rounded-xl border p-4 overflow-x-auto">
      <div className="min-w-[1100px]">
        {/* Header row */}
        <div className="grid grid-cols-[180px_repeat(7,minmax(120px,1fr))] gap-2 mb-3">
          <div className="text-sm font-medium text-neutral-300">Sales (Lane)</div>
          {STAGES.map((s, idx) => (
            <div key={s} className="text-center">
              <div className="text-xs text-neutral-500">Stage {idx + 1}</div>
              <div className="font-medium">{s}</div>
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
              <div className="rounded-lg border bg-black/20 p-3">
              <div className="text-sm font-medium">
                {ownerNameMap[owner] ?? `sales-${owner.slice(0, 8)}`}
                </div>
                <div className="text-xs text-neutral-500 break-all">
                {owner.slice(0, 8)}
                </div>
                <div className="mt-2 text-xs text-neutral-400">
                  {projects.filter((p) => p.owner_user_id === owner).length} horses
                </div>
              </div>

              {/* Stage cells */}
              {STAGES.map((stage) => {
                const list = laneMap[owner][stage];
                return (
                  <div
                    key={stage}
                    className="rounded-lg border bg-black/20 p-2 min-h-[90px]"
                  >
                    <div className="space-y-2">
                      {list.map((p) => (
                        <div
                          key={p.id}
                          className="rounded-md border bg-black/30 p-2"
                        >
                          <div className="text-xs text-neutral-400">
                            🐎 {p.date ?? "No date"}
                          </div>
                          <div className="text-sm">
                            {p.customer_detail ?? "No customer"}
                          </div>
                          <div className="text-xs text-neutral-300 line-clamp-2">
                            {p.project_info ?? "No info"}
                          </div>
                        </div>
                      ))}

                      {list.length === 0 ? (
                        <div className="text-xs text-neutral-600">—</div>
                      ) : null}
                    </div>
                  </div>
                );
              })}
            </div>
          ))}

          {owners.length === 0 ? (
            <div className="text-neutral-400">No projects yet.</div>
          ) : null}
        </div>

        <div className="mt-4 text-right text-xs text-neutral-500">
          Finish line → Closing
        </div>
      </div>
    </div>
  );
}
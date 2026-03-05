"use client";

import { useEffect, useMemo, useState } from "react";
import { createClient } from "@/lib/supabase/client";
import { type Stage } from "@/lib/stages";
import { useRouter } from "next/navigation";
import { getMyRole } from "@/lib/authz";
import { HorseRaceLineV2 } from "./HorseRaceLineV2";

type CloseStatus = "won" | "lost" | null;

type Project = {
  id: string;
  created_at: string;
  owner_user_id: string;
  date: string | null;
  customer_detail: string | null;
  project_info: string | null;
  reason: string | null;
  stage: Stage;

  // ✅ 新增字段（DB 里要有）
  amount: number | null;
  close_status: CloseStatus;
  lost_reason: string | null;
};

type PendingMove =
  | { kind: "amount"; project: Project; nextStage: Stage }
  | { kind: "close"; project: Project; nextStage: Stage }
  | null;

const NEED_AMOUNT_STAGES: Stage[] = [
  "Proposal",
  "Negotiation",
  "Contract Review",
  "Closing",
];

export default function SalesPage() {
  const supabase = createClient();
  const router = useRouter();

  const [loading, setLoading] = useState(true);
  const [projects, setProjects] = useState<Project[]>([]);
  const [err, setErr] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  // new project form
  const [date, setDate] = useState("");
  const [customerDetail, setCustomerDetail] = useState("");
  const [projectInfo, setProjectInfo] = useState("");
  const [meEmail, setMeEmail] = useState<string>("");

  // delete modal (soft delete)
  const [deleteTarget, setDeleteTarget] = useState<string | null>(null);

  // ✅ 新增：move guard 弹框
  const [pendingMove, setPendingMove] = useState<PendingMove>(null);

  const handleDeleteRequest = (id: string) => {
    setDeleteTarget(id);
  };

  async function load() {
    setLoading(true);
    setErr(null);

    const { data, error } = await supabase
      .from("projects")
      .select(
        "id, created_at, owner_user_id, date, customer_detail, project_info, stage, amount, close_status, lost_reason"
      )
      .is("deleted_at", null)
      .order("created_at", { ascending: false });

    if (error) {
      setErr(error.message);
      setLoading(false);
      return;
    }

    setProjects((data ?? []) as Project[]);
    setLoading(false);
  }

  async function confirmDelete() {
    if (!deleteTarget) return;

    const { data: auth } = await supabase.auth.getUser();

    const { error } = await supabase
      .from("projects")
      .update({
        deleted_at: new Date().toISOString(),
        deleted_by: auth.user?.id,
      })
      .eq("id", deleteTarget);

    if (error) {
      setErr(error.message);
      return;
    }

    setDeleteTarget(null);
    await load();
  }

  async function saveLostReason(projectId: string, reason: string) {
    setErr(null);
  
    const { error } = await supabase
      .from("projects")
      .update({ lost_reason: reason })
      .eq("id", projectId);
  
    if (error) {
      throw new Error(error.message);
    }
  
    // 推荐：本地 optimistic 更新（更快）
    setProjects((prev) =>
      prev.map((p) => (p.id === projectId ? { ...p, lost_reason: reason } : p))
    );
  }

  useEffect(() => {
    async function init() {
      const { user, role } = await getMyRole();

      if (!user) {
        router.replace("/login");
        return;
      }

      if (role === "boss") {
        router.replace("/boss");
        return;
      }

      // ✅ 只有是 sales 才继续加载
      const { data: auth } = await supabase.auth.getUser();
      setMeEmail(auth.user?.email ?? "");

      await load();
    }

    init();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const byStage = useMemo(() => {
    const map: Record<Stage, Project[]> = {
      Lead: [],
      Qualification: [],
      "Solution Design": [],
      Proposal: [],
      Negotiation: [],
      "Contract Review": [],
      Closing: [],
    };

    for (const p of projects) {
      map[p.stage].push(p);
    }

    return map;
  }, [projects]);

  async function createProject(e: React.FormEvent) {
    e.preventDefault();
    setErr(null);

    const { data: auth } = await supabase.auth.getUser();
    const user = auth.user;
    if (!user) {
      setErr("Not signed in");
      return;
    }

    const { error } = await supabase.from("projects").insert({
      owner_user_id: user.id,
      date: date || null,
      customer_detail: customerDetail || null,
      project_info: projectInfo || null,
      stage: "Lead",
      amount: null,
      close_status: null,
      lost_reason: null,
    });

    if (error) {
      setErr(error.message);
      return;
    }

    setDate("");
    setCustomerDetail("");
    setProjectInfo("");
    await load();
  }

  // ====== DB update helpers ======
  async function updateAmount(projectId: string, amount: number) {
    const { error } = await supabase
      .from("projects")
      .update({ amount })
      .eq("id", projectId);

    if (error) throw error;
  }

  async function updateCloseInfo(
    projectId: string,
    close_status: "won" | "lost",
    lost_reason: string | null
  ) {
    const payload: any = { close_status };
    payload.lost_reason = close_status === "lost" ? (lost_reason ?? "") : null;

    const { error } = await supabase
      .from("projects")
      .update(payload)
      .eq("id", projectId);

    if (error) throw error;
  }

  async function moveStageDB(projectId: string, nextStage: Stage) {
    const { error } = await supabase
      .from("projects")
      .update({ stage: nextStage })
      .eq("id", projectId);

    if (error) throw error;
  }

  // ====== the function you pass to HorseRaceLineV2 ======
  async function moveStage(projectId: string, nextStage: Stage) {
    setErr(null);

    const project = projects.find((p) => p.id === projectId);
    if (!project) {
      setErr("Project not found");
      return;
    }

    // 1) Closing 是最终态，直接挡
    if (project.stage === "Closing") {
      setErr("Closing is final. This project cannot be moved.");
      return;
    }

    // 2) 进入 Closing：必须先选 won/lost(+reason)
    if (nextStage === "Closing") {
      setPendingMove({ kind: "close", project, nextStage });
      return;
    }

    // 3) Proposal+：必须有 amount（否则弹框）
    if (NEED_AMOUNT_STAGES.includes(nextStage)) {
      const missingAmount =
        project.amount === null ||
        project.amount === undefined ||
        Number(project.amount) <= 0;

      if (missingAmount) {
        setPendingMove({ kind: "amount", project, nextStage });
        return;
      }
    }

    // 4) 正常移动
    try {
      setBusy(true);
      await moveStageDB(projectId, nextStage);
      await load();
    } catch (e: any) {
      setErr(e.message ?? "Failed to move stage");
    } finally {
      setBusy(false);
    }
  }

  async function signOut() {
    await supabase.auth.signOut();
    window.location.href = "/login";
  }

  return (
    <div className="min-h-screen p-6 space-y-6">
      <div className="flex items-center justify-between">
        {/* 左侧 */}
        <h1 className="text-2xl font-semibold">Sales Dashboard</h1>

        {/* 右侧整体 */}
        <div className="flex items-center gap-4">
          <div className="text-sm opacity-70">{meEmail}</div>

          <div className="flex items-center gap-2">
            <button
              onClick={() => router.push("/trash")}
              className="text-sm px-3 py-1 border border-white/20 rounded-md hover:bg-white/10 transition"
            >
              ♻ Recycle Bin
            </button>

            <button
              onClick={signOut}
              className="text-sm px-3 py-1 border border-white/20 rounded-md hover:bg-white/10 transition"
            >
              Sign out
            </button>
          </div>
        </div>
      </div>

      <form
        onSubmit={createProject}
        className="rounded-xl border p-4 space-y-3"
      >
        <div className="font-medium">Create a new horse (project)</div>

        <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
          <div className="space-y-1">
            <div className="text-sm text-neutral-300">Date</div>
            <input
              className="w-full rounded-md border bg-transparent px-3 py-2"
              type="date"
              value={date}
              onChange={(e) => setDate(e.target.value)}
            />
          </div>

          <div className="space-y-1">
            <div className="text-sm text-neutral-300">Customer detail</div>
            <input
              className="w-full rounded-md border bg-transparent px-3 py-2"
              value={customerDetail}
              onChange={(e) => setCustomerDetail(e.target.value)}
              placeholder="Name / company / contact..."
            />
          </div>

          <div className="space-y-1">
            <div className="text-sm text-neutral-300">Project info</div>
            <input
              className="w-full rounded-md border bg-transparent px-3 py-2"
              value={projectInfo}
              onChange={(e) => setProjectInfo(e.target.value)}
              placeholder="What is this project about?"
            />
          </div>
        </div>

        <button className="rounded-md bg-white text-black px-4 py-2 text-sm font-medium">
          Create
        </button>
      </form>

      {err ? <div className="text-sm text-red-500">{err}</div> : null}
      {loading ? <div className="text-neutral-300">Loading...</div> : null}

      <HorseRaceLineV2
        projects={projects}
        onMove={moveStage}
        onDelete={handleDeleteRequest}
        onSaveReason={saveLostReason}
      />

      {/* ===== Delete confirm modal (soft delete) ===== */}
      {deleteTarget && (
        <div className="fixed inset-0 bg-black/60 flex items-center justify-center z-50">
          <div className="bg-black border border-white/20 rounded-xl p-6 w-80">
            <div className="text-sm">
              Are you sure you want to delete this horse?
            </div>

            <div className="mt-4 flex justify-end gap-3">
              <button
                onClick={() => setDeleteTarget(null)}
                className="text-xs px-3 py-1 border rounded-md"
              >
                Cancel
              </button>

              <button
                onClick={confirmDelete}
                className="text-xs px-3 py-1 border border-red-500 text-red-400 rounded-md"
              >
                Delete
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ===== Amount modal ===== */}
      {pendingMove?.kind === "amount" ? (
        <AmountModal
          project={pendingMove.project}
          nextStage={pendingMove.nextStage}
          busy={busy}
          onCancel={() => setPendingMove(null)}
          onConfirm={async (amount) => {
            setErr(null);
            try {
              setBusy(true);
              await updateAmount(pendingMove.project.id, amount);
              await moveStageDB(pendingMove.project.id, pendingMove.nextStage);
              setPendingMove(null);
              await load();
            } catch (e: any) {
              setErr(e.message ?? "Failed to update amount");
            } finally {
              setBusy(false);
            }
          }}
        />
      ) : null}

      {/* ===== Closing modal ===== */}
      {pendingMove?.kind === "close" ? (
        <CloseModal
          project={pendingMove.project}
          busy={busy}
          onCancel={() => setPendingMove(null)}
          onConfirm={async (status, reason) => {
            setErr(null);
            try {
              setBusy(true);
              await updateCloseInfo(
                pendingMove.project.id,
                status,
                status === "lost" ? reason : null
              );
              await moveStageDB(pendingMove.project.id, "Closing");
              setPendingMove(null);
              await load();
            } catch (e: any) {
              setErr(e.message ?? "Failed to close project");
            } finally {
              setBusy(false);
            }
          }}
        />
      ) : null}
    </div>
  );
}

// ===================== Modals =====================

function AmountModal({
  project,
  nextStage,
  busy,
  onCancel,
  onConfirm,
}: {
  project: Project;
  nextStage: Stage;
  busy: boolean;
  onCancel: () => void;
  onConfirm: (amount: number) => void;
}) {
  const [val, setVal] = useState<string>(
    project.amount?.toString() ?? ""
  );

  const amountNum = Number(val);
  const invalid = !Number.isFinite(amountNum) || amountNum <= 0;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-4">
      <div className="w-full max-w-md rounded-2xl border border-white/10 bg-neutral-950 p-5 shadow-xl">
        <div className="text-lg font-semibold">Amount required</div>
        <div className="mt-1 text-sm text-neutral-400">
          This project is moving to{" "}
          <span className="text-neutral-200">{nextStage}</span>. Please enter
          the deal amount.
        </div>

        <div className="mt-4">
          <label className="text-xs text-neutral-400">Amount (USD)</label>
          <input
            value={val}
            onChange={(e) => setVal(e.target.value)}
            placeholder="e.g. 25000"
            inputMode="decimal"
            className="mt-2 w-full rounded-xl border border-white/10 bg-black/40 px-3 py-2 text-neutral-100 outline-none focus:border-white/20"
          />
          {invalid ? (
            <div className="mt-2 text-xs text-red-400">Amount must be &gt; 0.</div>
          ) : null}
        </div>

        <div className="mt-5 flex justify-end gap-2">
          <button
            disabled={busy}
            onClick={onCancel}
            className="rounded-xl border border-white/10 px-3 py-2 text-sm text-neutral-200 opacity-80 hover:opacity-100 disabled:opacity-50"
          >
            Cancel
          </button>
          <button
            disabled={busy || invalid}
            onClick={() => onConfirm(amountNum)}
            className="rounded-xl border border-white/10 bg-white/10 px-3 py-2 text-sm text-neutral-100 hover:bg-white/15 disabled:opacity-50"
          >
            Confirm
          </button>
        </div>
      </div>
    </div>
  );
}

function CloseModal({
  project,
  busy,
  onCancel,
  onConfirm,
}: {
  project: Project;
  busy: boolean;
  onCancel: () => void;
  onConfirm: (status: "won" | "lost", reason: string) => void;
}) {
  const [status, setStatus] = useState<"won" | "lost">(
    project.close_status === "lost" ? "lost" : "won"
  );
  const [reason, setReason] = useState<string>(project.lost_reason ?? "");

  const needReason = status === "lost";
  const reasonInvalid = needReason && reason.trim().length === 0;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-4">
      <div className="w-full max-w-md rounded-2xl border border-white/10 bg-neutral-950 p-5 shadow-xl">
        <div className="text-lg font-semibold">Close this project</div>
        <div className="mt-1 text-sm text-neutral-400">
          Choose the outcome. Closing is final (stage cannot be changed later).
        </div>

        <div className="mt-4 flex gap-2">
          <button
            disabled={busy}
            onClick={() => setStatus("won")}
            className={`flex-1 rounded-xl border px-3 py-2 text-sm ${
              status === "won"
                ? "border-white/20 bg-white/10 text-white"
                : "border-white/10 text-neutral-300 hover:bg-white/5"
            }`}
          >
            Won
          </button>
          <button
            disabled={busy}
            onClick={() => setStatus("lost")}
            className={`flex-1 rounded-xl border px-3 py-2 text-sm ${
              status === "lost"
                ? "border-white/20 bg-white/10 text-white"
                : "border-white/10 text-neutral-300 hover:bg-white/5"
            }`}
          >
            Lost
          </button>
        </div>

        {status === "lost" ? (
          <div className="mt-4">
            <label className="text-xs text-neutral-400">Reason (required)</label>
            <textarea
              value={reason}
              onChange={(e) => setReason(e.target.value)}
              rows={3}
              className="mt-2 w-full resize-none rounded-xl border border-white/10 bg-black/40 px-3 py-2 text-neutral-100 outline-none focus:border-white/20"
              placeholder="Why was it lost?"
            />
            {reasonInvalid ? (
              <div className="mt-2 text-xs text-red-400">
                Reason is required for Lost.
              </div>
            ) : null}
          </div>
        ) : null}

        <div className="mt-5 flex justify-end gap-2">
          <button
            disabled={busy}
            onClick={onCancel}
            className="rounded-xl border border-white/10 px-3 py-2 text-sm text-neutral-200 opacity-80 hover:opacity-100 disabled:opacity-50"
          >
            Cancel
          </button>
          <button
            disabled={busy || reasonInvalid}
            onClick={() => onConfirm(status, reason)}
            className="rounded-xl border border-white/10 bg-white/10 px-3 py-2 text-sm text-neutral-100 hover:bg-white/15 disabled:opacity-50"
          >
            Confirm & Close
          </button>
        </div>
      </div>
    </div>
  );
}
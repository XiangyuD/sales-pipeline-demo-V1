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

// ========= UI helpers (same vibe as Boss) =========
function Card({
  title,
  subtitle,
  children,
}: {
  title?: string;
  subtitle?: string;
  children: React.ReactNode;
}) {
  return (
    <div className="rounded-2xl border border-white/10 bg-white/[0.03] backdrop-blur-md shadow-[0_8px_30px_rgba(0,0,0,0.35)] px-5 py-4">
      {title ? <div className="text-lg font-semibold text-white">{title}</div> : null}
      {subtitle ? <div className="mt-1 text-sm text-white/55">{subtitle}</div> : null}
      <div className={title || subtitle ? "mt-4" : ""}>{children}</div>
    </div>
  );
}

function Btn({
  children,
  onClick,
  disabled,
  variant = "ghost",
  className = "",
  type,
}: {
  children: React.ReactNode;
  onClick?: () => void;
  disabled?: boolean;
  variant?: "ghost" | "solid" | "danger";
  className?: string;
  type?: "button" | "submit";
}) {
  const base =
    "inline-flex items-center justify-center gap-2 rounded-md px-3 py-1.5 text-sm transition border";
  const style =
    variant === "solid"
      ? "border-white/15 bg-white text-black hover:bg-white/90"
      : variant === "danger"
      ? "border-rose-400/25 bg-rose-400/10 text-rose-200 hover:bg-rose-400/15"
      : "border-white/15 bg-white/[0.03] text-white/90 hover:bg-white/[0.08]";
  return (
    <button
      type={type ?? "button"}
      disabled={disabled}
      onClick={onClick}
      className={`${base} ${style} disabled:opacity-50 disabled:cursor-not-allowed ${className}`}
    >
      {children}
    </button>
  );
}

function Input({
  label,
  value,
  onChange,
  placeholder,
  type = "text",
}: {
  label: string;
  value: string;
  onChange: (v: string) => void;
  placeholder?: string;
  type?: string;
}) {
  return (
    <div className="space-y-2">
      <div className="text-xs text-white/55">{label}</div>
      <input
        className="w-full rounded-xl border border-white/10 bg-white/[0.03] px-3 py-2 text-white outline-none focus:border-white/20"
        value={value}
        onChange={(e) => onChange(e.target.value)}
        placeholder={placeholder}
        type={type}
      />
    </div>
  );
}

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

  // move guard modal
  const [pendingMove, setPendingMove] = useState<PendingMove>(null);

  const handleDeleteRequest = (id: string) => setDeleteTarget(id);

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

    if (error) throw new Error(error.message);

    // optimistic update
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

      const { data: auth } = await supabase.auth.getUser();
      setMeEmail(auth.user?.email ?? "");

      await load();
    }

    init();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // (still useful for future, keep)
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
    for (const p of projects) map[p.stage].push(p);
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
    const { error } = await supabase.from("projects").update({ amount }).eq("id", projectId);
    if (error) throw error;
  }

  async function updateCloseInfo(
    projectId: string,
    close_status: "won" | "lost",
    lost_reason: string | null
  ) {
    const payload: any = { close_status };
    payload.lost_reason = close_status === "lost" ? (lost_reason ?? "") : null;

    const { error } = await supabase.from("projects").update(payload).eq("id", projectId);
    if (error) throw error;
  }

  async function moveStageDB(projectId: string, nextStage: Stage) {
    const { error } = await supabase.from("projects").update({ stage: nextStage }).eq("id", projectId);
    if (error) throw error;
  }

  async function moveStage(projectId: string, nextStage: Stage) {
    setErr(null);

    const project = projects.find((p) => p.id === projectId);
    if (!project) {
      setErr("Project not found");
      return;
    }

    // Closing is final
    if (project.stage === "Closing") {
      setErr("Closing is final. This project cannot be moved.");
      return;
    }

    // entering Closing: must pick won/lost (+reason)
    if (nextStage === "Closing") {
      setPendingMove({ kind: "close", project, nextStage });
      return;
    }

    // Proposal+: must have amount
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
    <div className="min-h-screen p-6 space-y-6 bg-gradient-to-b from-[#070A0F] via-[#0A0F1A] to-[#0B1020] text-white">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-semibold tracking-tight">Sales Dashboard</h1>
          <div className="mt-1 text-sm text-white/55">{meEmail}</div>
        </div>

        <div className="flex items-center gap-2">
          <Btn onClick={() => router.push("/trash")}>♻ Recycle Bin</Btn>
          <Btn onClick={signOut}>Sign out</Btn>
        </div>
      </div>

      {err ? (
        <div className="rounded-xl border border-rose-400/20 bg-rose-400/10 px-4 py-3 text-sm text-rose-200">
          {err}
        </div>
      ) : null}

      {loading ? <div className="text-white/60">Loading...</div> : null}

      {/* Create */}
      <Card title="Create a new horse (project)" subtitle="Quickly add a new deal into the pipeline.">
        <form onSubmit={createProject} className="space-y-4">
          <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
            <Input label="Date" value={date} onChange={setDate} type="date" />
            <Input
              label="Customer detail"
              value={customerDetail}
              onChange={setCustomerDetail}
              placeholder="Name / company / contact..."
            />
            <Input
              label="Project info"
              value={projectInfo}
              onChange={setProjectInfo}
              placeholder="What is this project about?"
            />
          </div>

          <div className="flex items-center justify-end gap-2">
            <Btn type="submit" variant="solid">
              Create
            </Btn>
          </div>
        </form>
      </Card>

      {/* Track */}
      <div className="rounded-2xl border border-white/10 bg-white/[0.02] p-4">
        <HorseRaceLineV2
          projects={projects}
          onMove={moveStage}
          onDelete={handleDeleteRequest}
          onSaveReason={saveLostReason}
        />
      </div>

      {/* ===== Delete confirm modal (soft delete) ===== */}
      {deleteTarget && (
        <ModalShell title="Delete this horse?" onClose={() => setDeleteTarget(null)}>
          <div className="text-sm text-white/70">
            This will move the project to the Recycle Bin.
          </div>

          <div className="mt-5 flex justify-end gap-2">
            <Btn onClick={() => setDeleteTarget(null)}>Cancel</Btn>
            <Btn variant="danger" onClick={confirmDelete}>
              Delete
            </Btn>
          </div>
        </ModalShell>
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

// ===================== Modal shell =====================
function ModalShell({
  title,
  onClose,
  children,
  widthClass = "max-w-md",
}: {
  title: string;
  onClose: () => void;
  children: React.ReactNode;
  widthClass?: string;
}) {
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-4">
      <div
        className={`w-full ${widthClass} rounded-2xl border border-white/10 bg-white/[0.04] backdrop-blur-md p-5 shadow-[0_18px_60px_rgba(0,0,0,0.55)]`}
      >
        <div className="flex items-start justify-between gap-4">
          <div className="text-lg font-semibold text-white">{title}</div>
          <Btn onClick={onClose}>Close</Btn>
        </div>
        <div className="mt-4">{children}</div>
      </div>
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
  const [val, setVal] = useState<string>(project.amount?.toString() ?? "");

  const amountNum = Number(val);
  const invalid = !Number.isFinite(amountNum) || amountNum <= 0;

  return (
    <ModalShell title="Amount required" onClose={onCancel}>
      <div className="text-sm text-white/65">
        This project is moving to <span className="text-white">{nextStage}</span>. Please enter the
        deal amount.
      </div>

      <div className="mt-4">
        <div className="text-xs text-white/55">Amount (USD)</div>
        <input
          value={val}
          onChange={(e) => setVal(e.target.value)}
          placeholder="e.g. 25000"
          inputMode="decimal"
          className="mt-2 w-full rounded-xl border border-white/10 bg-white/[0.03] px-3 py-2 text-white outline-none focus:border-white/20"
        />
        {invalid ? <div className="mt-2 text-xs text-rose-200">Amount must be &gt; 0.</div> : null}
      </div>

      <div className="mt-5 flex justify-end gap-2">
        <Btn disabled={busy} onClick={onCancel}>
          Cancel
        </Btn>
        <Btn
          disabled={busy || invalid}
          variant="solid"
          onClick={() => onConfirm(amountNum)}
        >
          Confirm
        </Btn>
      </div>
    </ModalShell>
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
    <ModalShell title="Close this project" onClose={onCancel}>
      <div className="text-sm text-white/65">
        Choose the outcome. <span className="text-white">Closing is final</span> (stage cannot be
        changed later).
      </div>

      <div className="mt-4 flex gap-2">
        <button
          disabled={busy}
          onClick={() => setStatus("won")}
          className={`flex-1 rounded-xl border px-3 py-2 text-sm transition ${
            status === "won"
              ? "border-emerald-400/25 bg-emerald-400/10 text-emerald-200"
              : "border-white/10 bg-white/[0.02] text-white/80 hover:bg-white/[0.05]"
          } disabled:opacity-50`}
        >
          ✅ Won
        </button>
        <button
          disabled={busy}
          onClick={() => setStatus("lost")}
          className={`flex-1 rounded-xl border px-3 py-2 text-sm transition ${
            status === "lost"
              ? "border-rose-400/25 bg-rose-400/10 text-rose-200"
              : "border-white/10 bg-white/[0.02] text-white/80 hover:bg-white/[0.05]"
          } disabled:opacity-50`}
        >
          ❌ Lost
        </button>
      </div>

      {status === "lost" ? (
        <div className="mt-4">
          <div className="text-xs text-white/55">Reason (required)</div>
          <textarea
            value={reason}
            onChange={(e) => setReason(e.target.value)}
            rows={3}
            className="mt-2 w-full resize-none rounded-xl border border-white/10 bg-white/[0.03] px-3 py-2 text-white outline-none focus:border-white/20"
            placeholder="Why was it lost?"
          />
          {reasonInvalid ? (
            <div className="mt-2 text-xs text-rose-200">Reason is required for Lost.</div>
          ) : null}
        </div>
      ) : null}

      <div className="mt-5 flex justify-end gap-2">
        <Btn disabled={busy} onClick={onCancel}>
          Cancel
        </Btn>
        <Btn
          disabled={busy || reasonInvalid}
          variant="solid"
          onClick={() => onConfirm(status, reason)}
        >
          Confirm & Close
        </Btn>
      </div>
    </ModalShell>
  );
}
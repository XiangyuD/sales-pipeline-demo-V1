"use client";

import { useEffect, useState } from "react";
import { createClient } from "@/lib/supabase/client";
import { useRouter } from "next/navigation";

type Project = {
  id: string;
  customer_detail: string | null;
  project_info: string | null;
  deleted_at: string | null;
  owner_user_id: string | null;
};

export default function TrashPage() {
  const supabase = createClient();
  const router = useRouter();

  const [projects, setProjects] = useState<Project[]>([]);
  const [err, setErr] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [isBoss, setIsBoss] = useState(false);
  const [ownerNameMap, setOwnerNameMap] = useState<Record<string, string>>({});

  useEffect(() => {
    async function load() {

        const { data: auth } = await supabase.auth.getUser();
        const user = auth.user;
        
        if (!user) {
          router.replace("/login");
          return;
        }
        
        const { data: profile } = await supabase
          .from("profiles")
          .select("role")
          .eq("user_id", user.id)
          .single();
        
        setIsBoss(profile?.role === "boss");

      const { data, error } = await supabase
        .from("projects")
        .select("id, customer_detail, project_info, deleted_at, owner_user_id")
        .not("deleted_at", "is", null)
        .order("deleted_at", { ascending: false });

      if (error) {
        setErr(error.message);
      } else {
        setProjects(data ?? []);
      }

      const rows = data ?? [];
      setProjects(rows);
      
      // collect unique owner ids
      const ownerIds = Array.from(
        new Set(rows.map(r => r.owner_user_id).filter(Boolean) as string[])
      );
      
      if (ownerIds.length > 0) {
        const { data: owners, error: ownerErr } = await supabase
          .from("profiles")
          .select("user_id, display_name")
          .in("user_id", ownerIds);
      
        if (!ownerErr && owners) {
          const map: Record<string, string> = {};
          for (const o of owners) {
            map[o.user_id] = o.display_name || o.user_id;
          }
          setOwnerNameMap(map);
        }
      }

      setLoading(false);
    }

    load();
  }, []);

  async function restore(id: string) {
    await supabase
      .from("projects")
      .update({ deleted_at: null, deleted_by: null })
      .eq("id", id);

    setProjects((prev) => prev.filter((p) => p.id !== id));
  }

  async function permanentDelete(id: string) {
    await supabase
      .from("projects")
      .delete()
      .eq("id", id);

    setProjects((prev) => prev.filter((p) => p.id !== id));
  }

  return (
    <div className="min-h-screen bg-black text-white">
      <div className="max-w-4xl mx-auto px-6 pt-10 pb-20">

        {/* ===== Header ===== */}
        <div className="flex items-center justify-between mb-6">
          <h1 className="text-2xl font-semibold flex items-center gap-2">
            🗑 Trash
          </h1>

          <button
            onClick={() => router.back()}
            className="text-sm px-3 py-1 border border-white/20 rounded-md opacity-70 hover:opacity-100 transition"
          >
            ← Back
          </button>
        </div>

        {/* ===== Stats Bar ===== */}
        <div className="mb-6 flex items-center justify-between text-xs opacity-60">
          <div>{projects.length} item(s) in trash</div>
          <div>Restore anytime · Optional auto-delete after 30 days</div>
        </div>

        {/* ===== Loading ===== */}
        {loading && (
          <div className="opacity-60 text-sm">Loading...</div>
        )}

        {/* ===== Error ===== */}
        {err && (
          <div className="text-red-400 text-sm mb-4">{err}</div>
        )}

        {/* ===== Empty State ===== */}
        {!loading && projects.length === 0 && (
          <div className="border border-white/10 rounded-xl p-6 bg-white/5 text-sm opacity-80">
            <div className="text-base font-semibold mb-1">
              Trash is empty
            </div>
            <div className="opacity-70">
              Deleted projects will appear here. You can restore them anytime.
            </div>
          </div>
        )}

        {/* ===== Project List ===== */}
        {projects.map((p) => (
          <div
            key={p.id}
            className="border border-white/15 rounded-xl p-5 mb-4 bg-white/5 backdrop-blur-sm"
          >
            <div className="font-semibold text-lg">
              {p.customer_detail ?? "No customer"}
            </div>

            {p.project_info && (
              <div className="text-sm opacity-70 mt-1">
                {p.project_info}
              </div>
            )}

            <div className="text-xs opacity-50 mt-3">
              Deleted at: {p.deleted_at}
            </div>
            {isBoss && p.owner_user_id && (
            <div className="text-xs opacity-60 mt-2">
                Owner: {ownerNameMap[p.owner_user_id] ?? p.owner_user_id}
            </div>
            )}
            <div className="mt-4 flex gap-3">
              <button
                onClick={() => restore(p.id)}
                className="text-xs px-3 py-1 border border-white/20 rounded-md hover:bg-white/10 transition"
              >
                Restore
              </button>

                {isBoss && (
                <button
                    onClick={() => permanentDelete(p.id)}
                    className="text-xs px-3 py-1 border border-red-500 text-red-400 rounded-md hover:bg-red-500/10 transition"
                >
                    Delete Forever
                </button>
                )}
            </div>
          </div>
        ))}

        {/* ===== Bottom Info Card (fills empty space) ===== */}
        <div className="mt-10 border border-white/10 rounded-xl p-4 bg-white/5 text-sm opacity-80">
          <div className="font-semibold mb-1">Trash rules</div>
          <ul className="list-disc pl-5 space-y-1 opacity-80">
            <li>Restore will bring the project back to the race track.</li>
            <li>Delete Forever removes only by boss (no undo).</li>
            <li>Recommended: auto-delete items after 30 days.</li>
          </ul>
        </div>

      </div>
    </div>
  );
}
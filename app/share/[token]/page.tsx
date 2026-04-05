import { notFound } from "next/navigation";
import { getSupabaseAdmin } from "@/lib/supabase/admin";

type SharedCycle = {
  id: string;
  startDate: string;
  endDate: string;
  periodLength: number;
  flow: string;
  symptoms: string[];
  notes: string;
};

type SharedDailyLog = {
  id: string;
  logDate: string;
  mood: string;
  painLevel: number | null;
  energyLevel: number | null;
  discharge: string;
  medications: string;
  notes: string;
};

type SharedReportPayload = {
  generatedAt: string;
  rangeStart: string | null;
  rangeEnd: string | null;
  summary: {
    cyclesLogged: number;
    averageCycleLength: number | null;
    averagePeriodLength: number | null;
    topSymptoms: string[];
  };
  cycles: SharedCycle[];
  dailyLogs: SharedDailyLog[];
};

type SharedReportRow = {
  title: string | null;
  token: string;
  revoked: boolean;
  expires_at: string | null;
  report_payload: SharedReportPayload | null;
};

function formatDate(dateText: string) {
  return new Intl.DateTimeFormat("en-US", {
    month: "short",
    day: "numeric",
    year: "numeric",
  }).format(new Date(`${dateText}T00:00:00`));
}

function asPayload(value: unknown): SharedReportPayload | null {
  if (!value || typeof value !== "object") {
    return null;
  }

  return value as SharedReportPayload;
}

export const dynamic = "force-dynamic";

type PageProps = {
  params: Promise<{
    token: string;
  }>;
};

export default async function ShareReportPage({ params }: PageProps) {
  const { token } = await params;
  const supabaseAdmin = getSupabaseAdmin();

  const { data, error } = await supabaseAdmin
    .from("shared_reports")
    .select("title, token, revoked, expires_at, report_payload")
    .eq("token", token)
    .eq("revoked", false)
    .or("expires_at.is.null,expires_at.gt.now()")
    .maybeSingle<SharedReportRow>();

  if (error || !data) {
    notFound();
  }

  const payload = asPayload(data.report_payload);
  if (!payload) {
    notFound();
  }

  return (
    <main className="mx-auto flex min-h-screen w-full max-w-5xl flex-col gap-5 px-4 py-8 sm:px-6">
      <section className="rounded-3xl border border-[var(--border)] bg-[var(--surface)] p-5 shadow-[0_24px_45px_-32px_rgba(var(--shadow),0.85)]">
        <h1 className="text-3xl text-[var(--foreground)]">{data.title ?? "Shared cycle report"}</h1>
        <p className="mt-2 text-sm text-[color-mix(in_oklab,var(--foreground)_72%,white)]">
          Generated {new Date(payload.generatedAt).toLocaleString()}
        </p>
        <p className="mt-1 text-sm text-[color-mix(in_oklab,var(--foreground)_72%,white)]">
          Range: {payload.rangeStart ? formatDate(payload.rangeStart) : "All"} -{" "}
          {payload.rangeEnd ? formatDate(payload.rangeEnd) : "All"}
        </p>
      </section>

      <section className="grid gap-3 sm:grid-cols-3">
        <article className="rounded-2xl border border-[var(--border)] bg-[var(--surface)] p-4">
          <p className="text-xs font-semibold uppercase tracking-[0.08em] text-[var(--accent)]">Cycles logged</p>
          <p className="mt-2 text-2xl font-bold text-[var(--foreground)]">{payload.summary.cyclesLogged}</p>
        </article>
        <article className="rounded-2xl border border-[var(--border)] bg-[var(--surface)] p-4">
          <p className="text-xs font-semibold uppercase tracking-[0.08em] text-[var(--accent)]">Avg cycle</p>
          <p className="mt-2 text-2xl font-bold text-[var(--foreground)]">
            {payload.summary.averageCycleLength ?? "-"}
          </p>
        </article>
        <article className="rounded-2xl border border-[var(--border)] bg-[var(--surface)] p-4">
          <p className="text-xs font-semibold uppercase tracking-[0.08em] text-[var(--accent)]">Avg period</p>
          <p className="mt-2 text-2xl font-bold text-[var(--foreground)]">
            {payload.summary.averagePeriodLength ?? "-"}
          </p>
        </article>
      </section>

      <section className="rounded-3xl border border-[var(--border)] bg-[var(--surface)] p-5">
        <h2 className="text-2xl text-[var(--foreground)]">Cycles</h2>
        {payload.cycles.length ? (
          <ul className="mt-4 space-y-3">
            {payload.cycles.map((cycle) => (
              <li key={cycle.id} className="rounded-2xl border border-[var(--border)] bg-[var(--surface-soft)] p-4">
                <p className="text-sm font-semibold text-[var(--foreground)]">
                  {formatDate(cycle.startDate)} - {formatDate(cycle.endDate)}
                </p>
                <p className="mt-1 text-xs text-[color-mix(in_oklab,var(--foreground)_72%,white)]">
                  Flow {cycle.flow} | Period length {cycle.periodLength} days
                </p>
                {cycle.symptoms.length ? (
                  <p className="mt-2 text-sm text-[var(--foreground)]">Symptoms: {cycle.symptoms.join(", ")}</p>
                ) : null}
                {cycle.notes ? <p className="mt-1 text-sm text-[var(--foreground)]">Notes: {cycle.notes}</p> : null}
              </li>
            ))}
          </ul>
        ) : (
          <p className="mt-4 text-sm text-[color-mix(in_oklab,var(--foreground)_72%,white)]">No cycle rows.</p>
        )}
      </section>

      <section className="rounded-3xl border border-[var(--border)] bg-[var(--surface)] p-5">
        <h2 className="text-2xl text-[var(--foreground)]">Daily logs</h2>
        {payload.dailyLogs.length ? (
          <ul className="mt-4 space-y-3">
            {payload.dailyLogs.map((log) => (
              <li key={log.id} className="rounded-2xl border border-[var(--border)] bg-[var(--surface-soft)] p-4">
                <p className="text-sm font-semibold text-[var(--foreground)]">{formatDate(log.logDate)}</p>
                <p className="mt-1 text-xs text-[color-mix(in_oklab,var(--foreground)_72%,white)]">
                  Mood {log.mood || "-"} | Pain {log.painLevel ?? "-"} | Energy {log.energyLevel ?? "-"}
                </p>
                {log.notes ? <p className="mt-2 text-sm text-[var(--foreground)]">{log.notes}</p> : null}
              </li>
            ))}
          </ul>
        ) : (
          <p className="mt-4 text-sm text-[color-mix(in_oklab,var(--foreground)_72%,white)]">No daily logs.</p>
        )}
      </section>
    </main>
  );
}

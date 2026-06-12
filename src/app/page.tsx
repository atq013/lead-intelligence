"use client";

import { useMemo, useState } from "react";
import type { ReactNode } from "react";
import type { LeadAnalysis } from "@/lib/schemas";

type ApiSuccessResponse = {
  success: true;
  analysis: LeadAnalysis;
};

type ApiErrorResponse = {
  success: false;
  error: string;
};

function getErrorMessage(error: unknown): string {
  if (error instanceof Error) return error.message;
  return String(error);
}

function safeText(value: unknown, fallback = "Not enough information provided.") {
  if (typeof value === "string" && value.trim()) {
    return value.trim();
  }
  return fallback;
}

function safeList(value: unknown): string[] {
  return Array.isArray(value)
    ? value.filter((item): item is string => typeof item === "string" && item.trim().length > 0)
    : [];
}

function safeScore(value: unknown): number | null {
  return typeof value === "number" && Number.isFinite(value) ? Math.min(10, Math.max(1, Math.round(value))) : null;
}

function CopyButton({ value, label }: { value: string; label: string }) {
  const [copied, setCopied] = useState(false);

  async function handleCopy() {
    try {
      await navigator.clipboard.writeText(value);
      setCopied(true);
      window.setTimeout(() => setCopied(false), 1500);
    } catch {
      setCopied(false);
    }
  }

  return (
    <button
      type="button"
      onClick={handleCopy}
      className="rounded-full border border-white/10 bg-white/5 px-3 py-1 text-xs font-medium text-sand-50 transition hover:bg-white/10"
    >
      {copied ? "Copied" : label}
    </button>
  );
}

function SectionCard({
  title,
  children,
  action,
}: {
  title: string;
  children: ReactNode;
  action?: ReactNode;
}) {
  return (
    <section className="rounded-2xl border border-white/10 bg-white/5 p-5 shadow-glow backdrop-blur">
      <div className="mb-4 flex items-center justify-between gap-3">
        <h2 className="text-lg font-semibold text-sand-50">{title}</h2>
        {action}
      </div>
      <div className="space-y-3 text-sm leading-6 text-sand-100">{children}</div>
    </section>
  );
}

export default function HomePage() {
  const [input, setInput] = useState("");
  const [analysis, setAnalysis] = useState<LeadAnalysis | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  const canAnalyze = useMemo(() => input.trim().length >= 20 && !loading, [input, loading]);

  async function handleAnalyze() {
    setLoading(true);
    setError("");
    setAnalysis(null);

    try {
      const response = await fetch("/api/analyze-lead", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({ input }),
      });

      const responseBody = await response.text();
      console.log("[FRONTEND] Response status:", response.status);
      console.log("[FRONTEND] Response body:", responseBody);

      let data: ApiSuccessResponse | ApiErrorResponse | null = null;
      try {
        data = JSON.parse(responseBody) as ApiSuccessResponse | ApiErrorResponse;
      } catch (parseError) {
        console.error("[FRONTEND] Failed to parse response JSON:", parseError);
      }

      if (!response.ok || !data || !data.success) {
        setError(data && "error" in data ? data.error : "Something went wrong while analyzing the lead.");
        return;
      }

      setAnalysis(data.analysis);
    } catch (error) {
      console.error("[FRONTEND] Fetch failed:", error);
      console.error("[FRONTEND] Fetch error message:", getErrorMessage(error));
      setError("Unable to reach the local API. Make sure the dev server is running.");
    } finally {
      setLoading(false);
    }
  }

  function handleClear() {
    setInput("");
    setAnalysis(null);
    setError("");
  }

  const painPoints = safeList(analysis?.likelyPainPoints);
  const discoveryQuestions = safeList(analysis?.discoveryQuestions);
  const score = safeScore(analysis?.leadScore);

  const summaryText = safeText(analysis?.leadSummary);
  const outreachText = safeText(analysis?.outreachAngle);
  const linkedinText = safeText(analysis?.linkedinMessage);
  const followUpText = safeText(analysis?.followUpMessage);
  const serviceText = safeText(analysis?.bestServiceToPitch);
  const projectText = safeText(analysis?.matchingAestheTeQsProject);

  return (
    <main className="min-h-screen px-4 py-8 text-sand-50 sm:px-6 lg:px-8">
      <div className="mx-auto flex w-full max-w-7xl flex-col gap-6">
        <header className="rounded-3xl border border-white/10 bg-white/5 p-6 shadow-glow backdrop-blur sm:p-8">
          <div className="max-w-3xl space-y-4">
            <span className="inline-flex rounded-full border border-sand-200/20 bg-sand-100/10 px-3 py-1 text-xs font-semibold uppercase tracking-[0.2em] text-sand-100">
              Local-first AestheTeQs intelligence
            </span>
            <h1 className="text-3xl font-semibold tracking-tight text-white sm:text-5xl">
              AestheTeQs Lead Intelligence Assistant
            </h1>
            <p className="max-w-2xl text-sm leading-7 text-sand-100 sm:text-base">
              Paste a LinkedIn About section, company description, website copy, job brief, or lead profile text.
              The assistant will analyze the lead locally with Ollama, match the best AestheTeQs project, and draft
              outreach you can use immediately.
            </p>
          </div>
        </header>

        <section className="grid gap-6 lg:grid-cols-[1.1fr_0.9fr]">
          <div className="rounded-3xl border border-white/10 bg-white/5 p-5 shadow-glow backdrop-blur sm:p-6">
            <label htmlFor="lead-input" className="mb-3 block text-sm font-semibold text-sand-50">
              Lead / company context
            </label>
            <textarea
              id="lead-input"
              value={input}
              onChange={(event) => setInput(event.target.value)}
              placeholder="Paste the lead text here..."
              className="min-h-[320px] w-full resize-y rounded-2xl border border-white/10 bg-ink-900/80 p-4 text-sm leading-6 text-sand-50 outline-none transition placeholder:text-sand-100/40 focus:border-sand-200/40 focus:ring-2 focus:ring-sand-200/20"
            />
            <div className="mt-4 flex flex-wrap gap-3">
              <button
                type="button"
                disabled={!canAnalyze}
                onClick={handleAnalyze}
                className="rounded-full bg-sand-100 px-5 py-2.5 text-sm font-semibold text-ink-950 transition hover:bg-white disabled:cursor-not-allowed disabled:opacity-50"
              >
                {loading ? "Analyzing..." : "Analyze Lead"}
              </button>
              <button
                type="button"
                onClick={handleClear}
                className="rounded-full border border-white/10 bg-white/5 px-5 py-2.5 text-sm font-semibold text-sand-50 transition hover:bg-white/10"
              >
                Clear
              </button>
            </div>
            <p className="mt-3 text-xs leading-5 text-sand-100/70">
              Tip: include pain points, current team setup, services, recent posts, hiring language, or website copy
              for stronger results.
            </p>
            {error ? (
              <div className="mt-4 rounded-2xl border border-red-400/20 bg-red-500/10 p-4 text-sm text-red-100">
                {error}
              </div>
            ) : null}
          </div>

          <div className="grid gap-4">
            <SectionCard
              title="Lead Score"
              action={
                <span className="rounded-full border border-sand-200/20 bg-sand-100/10 px-3 py-1 text-xs font-semibold text-sand-50">
                  {score ?? "-"} / 10
                </span>
              }
            >
              <p>{analysis ? `Confidence-focused fit score for this lead.` : "Your score will appear here after analysis."}</p>
            </SectionCard>

            <SectionCard title="Lead Summary" action={analysis ? <CopyButton value={summaryText} label="Copy" /> : null}>
              <p>{analysis ? summaryText : "Summary output will appear here."}</p>
            </SectionCard>

            <SectionCard title="Best Service to Pitch">
              <p>{analysis ? serviceText : "Service recommendation will appear here."}</p>
            </SectionCard>

            <SectionCard title="Matching AestheTeQs Project">
              <p>{analysis ? projectText : "Portfolio match will appear here."}</p>
            </SectionCard>
          </div>
        </section>

        <section className="grid gap-6 lg:grid-cols-2">
          <SectionCard title="Likely Pain Points">
            {painPoints.length > 0 ? (
              <ul className="space-y-2">
                {painPoints.map((point) => (
                  <li key={point} className="rounded-xl border border-white/10 bg-black/10 px-3 py-2">
                    {point}
                  </li>
                ))}
              </ul>
            ) : (
              <p>Likely pain points will appear here.</p>
            )}
          </SectionCard>

          <SectionCard title="Outreach Angle" action={analysis ? <CopyButton value={outreachText} label="Copy" /> : null}>
            <p>{analysis ? outreachText : "Outreach angle will appear here."}</p>
          </SectionCard>
        </section>

        <section className="grid gap-6 lg:grid-cols-2">
          <SectionCard
            title="LinkedIn Message"
            action={analysis ? <CopyButton value={linkedinText} label="Copy" /> : null}
          >
            <p className="whitespace-pre-wrap">{analysis ? linkedinText : "LinkedIn message will appear here."}</p>
          </SectionCard>

          <SectionCard
            title="Follow-up Message"
            action={analysis ? <CopyButton value={followUpText} label="Copy" /> : null}
          >
            <p className="whitespace-pre-wrap">{analysis ? followUpText : "Follow-up message will appear here."}</p>
          </SectionCard>
        </section>

        <SectionCard title="Discovery Questions">
          {discoveryQuestions.length > 0 ? (
            <ol className="space-y-2">
              {discoveryQuestions.map((question) => (
                <li key={question} className="rounded-xl border border-white/10 bg-black/10 px-3 py-2">
                  {question}
                </li>
              ))}
            </ol>
          ) : (
            <p>Discovery call questions will appear here.</p>
          )}
        </SectionCard>
      </div>
    </main>
  );
}

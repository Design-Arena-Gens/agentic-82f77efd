'use client';

import { format } from "date-fns";
import dynamic from "next/dynamic";
import { useCallback, useEffect, useMemo, useState } from "react";

type PatrolPoint = {
  code: string;
  name: string;
  area: string;
  checklist: string[];
};

type PatrolStatus = "Clear" | "Follow-up" | "Incident";

type PatrolLog = {
  id: string;
  timestamp: string;
  guardName: string;
  pointCode: string;
  pointName: string;
  qrData: string;
  status: PatrolStatus;
  notes: string;
};

const PATROL_POINTS: PatrolPoint[] = [
  {
    code: "BLDG-A-LOBBY",
    name: "Tower A – Lobby",
    area: "Ground Access",
    checklist: [
      "Check visitor registration desk",
      "Inspect emergency exits",
      "Verify fire alarm panel status",
    ],
  },
  {
    code: "BLDG-A-PODIUM",
    name: "Tower A – Podium Parking",
    area: "Podium Parking",
    checklist: [
      "Inspect access barriers",
      "Ensure CCTV coverage operational",
      "Walk the EV charging bays",
    ],
  },
  {
    code: "BLDG-B-ROOF",
    name: "Tower B – Roof Deck",
    area: "Restricted Maintenance",
    checklist: [
      "Lock integrity checks",
      "Review HVAC enclosures",
      "Sweep for unauthorized equipment",
    ],
  },
  {
    code: "BLDG-B-LEVEL7",
    name: "Tower B – Level 7",
    area: "Tenant Floor",
    checklist: [
      "Check corridor lighting",
      "Review fire extinguisher tags",
      "Verify stairwell access doors",
    ],
  },
];

const STATUS_STYLES: Record<PatrolStatus, string> = {
  Clear: "bg-emerald-50 text-emerald-700 border border-emerald-100",
  "Follow-up": "bg-amber-50 text-amber-700 border border-amber-100",
  Incident: "bg-rose-50 text-rose-700 border border-rose-100",
};

const QRReader = dynamic(async () => (await import("./qr-reader")).QRReader, {
  ssr: false,
});

export default function Home() {
  const [isScanning, setIsScanning] = useState(false);
  const [scanError, setScanError] = useState<string | null>(null);
  const [qrPayload, setQrPayload] = useState<string>("");
  const [guardName, setGuardName] = useState("");
  const [status, setStatus] = useState<PatrolStatus>("Clear");
  const [notes, setNotes] = useState("");
  const [logs, setLogs] = useState<PatrolLog[]>(() => {
    if (typeof window === "undefined") {
      return [];
    }
    try {
      const stored = window.localStorage.getItem("patrol-logs");
      if (!stored) {
        return [];
      }
      const parsed: PatrolLog[] = JSON.parse(stored);
      return Array.isArray(parsed) ? parsed : [];
    } catch (error) {
      console.error("Failed to parse stored patrol logs", error);
      return [];
    }
  });

  useEffect(() => {
    if (typeof window === "undefined") {
      return;
    }
    window.localStorage.setItem("patrol-logs", JSON.stringify(logs));
  }, [logs]);

  const matchedPoint = useMemo(() => {
    if (!qrPayload) {
      return null;
    }
    const normalized = qrPayload.trim().toUpperCase();
    return (
      PATROL_POINTS.find((point) => point.code === normalized) ?? null
    );
  }, [qrPayload]);

  const handleScanSuccess = useCallback(
    (decodedText: string) => {
      setQrPayload(decodedText);
      setScanError(null);
      setIsScanning(false);
    },
    [setQrPayload]
  );

  const handleScanError = useCallback((message: string) => {
    setScanError(message);
  }, []);

  const hasValidSubmission =
    !!guardName.trim() && !!qrPayload.trim() && !!matchedPoint;

  const handleSubmit = () => {
    if (!hasValidSubmission || !matchedPoint) {
      return;
    }

    const entryId =
      typeof crypto !== "undefined" && "randomUUID" in crypto
        ? crypto.randomUUID()
        : Math.random().toString(36).slice(2);

    const entry: PatrolLog = {
      id: entryId,
      timestamp: new Date().toISOString(),
      guardName: guardName.trim(),
      pointCode: matchedPoint.code,
      pointName: matchedPoint.name,
      qrData: qrPayload.trim(),
      status,
      notes: notes.trim(),
    };

    setLogs((previous) => [entry, ...previous]);
    setStatus("Clear");
    setNotes("");
    setQrPayload("");
  };

  const totals = useMemo(() => {
    const base = {
      total: logs.length,
      clear: logs.filter((log) => log.status === "Clear").length,
      followUp: logs.filter((log) => log.status === "Follow-up").length,
      incident: logs.filter((log) => log.status === "Incident").length,
    };
    const coverage =
      base.total === 0
        ? 0
        : Math.min(
            100,
            Math.round(
              (new Set(logs.map((log) => log.pointCode)).size /
                PATROL_POINTS.length) *
                100
            )
          );

    return { ...base, coverage };
  }, [logs]);

  return (
    <div className="min-h-screen bg-slate-950 text-slate-100">
      <div className="mx-auto flex w-full max-w-6xl flex-col gap-8 px-4 py-10 sm:px-6 lg:px-8">
        <header className="flex flex-col gap-3 rounded-3xl bg-gradient-to-r from-slate-900 to-slate-800 p-6 shadow-lg ring-1 ring-slate-700/50 sm:flex-row sm:items-end sm:justify-between">
          <div>
            <p className="text-sm uppercase tracking-[0.4em] text-slate-400">
              Guardian Ops Center
            </p>
            <h1 className="mt-2 text-3xl font-semibold tracking-tight sm:text-4xl">
              QR Patrol Console
            </h1>
            <p className="mt-2 max-w-xl text-sm text-slate-300">
              Validate team patrols by scanning post QR codes, completing
              mandatory checklists, and recording incidents in real time.
            </p>
          </div>
          <div className="flex items-center gap-3 text-sm text-slate-300">
            <span className="rounded-full bg-emerald-500/10 px-3 py-1 text-xs font-medium text-emerald-300 ring-1 ring-emerald-500/20">
              Live
            </span>
            <div>
              <p className="text-xs text-slate-400">Last sync</p>
              <p className="font-mono text-sm">
                {format(new Date(), "MMM dd • HH:mm")}
              </p>
            </div>
          </div>
        </header>

        <section className="grid gap-6 lg:grid-cols-[minmax(0,1.3fr)_minmax(0,1fr)]">
          <div className="flex flex-col gap-6">
            <div className="rounded-3xl border border-slate-800 bg-slate-900/60 p-6 shadow-xl backdrop-blur">
              <div className="flex flex-wrap items-center justify-between gap-3">
                <div>
                  <h2 className="text-lg font-semibold tracking-tight text-white">
                    Patrol Post Capture
                  </h2>
                  <p className="text-sm text-slate-400">
                    Scan the checkpoint QR or enter its code manually.
                  </p>
                </div>
                <button
                  onClick={() => {
                    setScanError(null);
                    setIsScanning((value) => !value);
                    setQrPayload("");
                  }}
                  className="inline-flex items-center gap-2 rounded-full bg-indigo-500 px-4 py-2 text-sm font-semibold text-white transition hover:bg-indigo-400 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-indigo-300"
                >
                  {isScanning ? "Stop Scanner" : "Start QR Scanner"}
                </button>
              </div>

              <div className="mt-6 flex flex-col gap-4">
                {isScanning ? (
                  <div className="overflow-hidden rounded-2xl border border-slate-800 bg-black">
                    <QRReader
                      onDecode={handleScanSuccess}
                      onError={handleScanError}
                    />
                  </div>
                ) : (
                  <div className="rounded-2xl border border-dashed border-slate-700 bg-slate-900 p-6 text-center text-sm text-slate-400">
                    Activate the scanner or enter a code below to continue.
                  </div>
                )}

                {scanError && (
                  <p className="rounded-xl border border-rose-500/40 bg-rose-500/10 px-4 py-2 text-sm text-rose-200">
                    {scanError}
                  </p>
                )}
              </div>

              <div className="mt-6 grid gap-4 sm:grid-cols-2">
                <label className="flex flex-col gap-1.5 text-sm">
                  <span className="text-slate-300">Patrol Code</span>
                  <input
                    value={qrPayload}
                    onChange={(event) =>
                      setQrPayload(event.target.value.toUpperCase())
                    }
                    placeholder="BLDG-A-LOBBY"
                    className="w-full rounded-xl border border-slate-700 bg-slate-900 px-3 py-2 font-mono text-sm text-slate-100 outline-none transition placeholder:text-slate-500 focus:border-indigo-400 focus:ring-2 focus:ring-indigo-400/40"
                  />
                </label>

                <label className="flex flex-col gap-1.5 text-sm">
                  <span className="text-slate-300">Guard on Duty</span>
                  <input
                    value={guardName}
                    onChange={(event) => setGuardName(event.target.value)}
                    placeholder="e.g. Sgt. Elena Cruz"
                    className="w-full rounded-xl border border-slate-700 bg-slate-900 px-3 py-2 text-sm text-slate-100 outline-none transition placeholder:text-slate-500 focus:border-indigo-400 focus:ring-2 focus:ring-indigo-400/40"
                  />
                </label>

                <label className="flex flex-col gap-1.5 text-sm">
                  <span className="text-slate-300">Status</span>
                  <select
                    value={status}
                    onChange={(event) =>
                      setStatus(event.target.value as PatrolStatus)
                    }
                    className="w-full rounded-xl border border-slate-700 bg-slate-900 px-3 py-2 text-sm text-slate-100 outline-none transition focus:border-indigo-400 focus:ring-2 focus:ring-indigo-400/40"
                  >
                    <option value="Clear">Clear</option>
                    <option value="Follow-up">Needs Follow-up</option>
                    <option value="Incident">Incident / Escalated</option>
                  </select>
                </label>

                <label className="flex flex-col gap-1.5 text-sm sm:col-span-2">
                  <span className="text-slate-300">Observations</span>
                  <textarea
                    value={notes}
                    onChange={(event) => setNotes(event.target.value)}
                    placeholder="Record condition, incident reference, or equipment updates."
                    rows={3}
                    className="w-full resize-none rounded-xl border border-slate-700 bg-slate-900 px-3 py-2 text-sm text-slate-100 outline-none transition placeholder:text-slate-500 focus:border-indigo-400 focus:ring-2 focus:ring-indigo-400/40"
                  />
                </label>
              </div>

              <div className="mt-6 flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
                {matchedPoint ? (
                  <div className="rounded-2xl border border-slate-800 bg-slate-900/80 p-4 sm:max-w-[60%]">
                    <p className="text-xs uppercase tracking-wide text-indigo-300">
                      Post Details
                    </p>
                    <p className="mt-1 font-semibold text-slate-100">
                      {matchedPoint.name}
                    </p>
                    <p className="text-xs text-slate-400">{matchedPoint.area}</p>
                    <ul className="mt-3 space-y-2 text-xs text-slate-300">
                      {matchedPoint.checklist.map((item) => (
                        <li
                          key={item}
                          className="flex items-start gap-2 rounded-xl border border-slate-800 bg-slate-900 px-3 py-2"
                        >
                          <span className="mt-1 h-2 w-2 rounded-full bg-indigo-400" />
                          <span>{item}</span>
                        </li>
                      ))}
                    </ul>
                  </div>
                ) : (
                  <div className="rounded-2xl border border-dashed border-slate-700 bg-slate-900/80 p-4 text-sm text-slate-400 sm:max-w-[60%]">
                    Scan a valid checkpoint QR to display the required tasks.
                  </div>
                )}

                <button
                  onClick={handleSubmit}
                  disabled={!hasValidSubmission}
                  className="inline-flex items-center justify-center rounded-full bg-emerald-500 px-5 py-3 text-sm font-semibold text-emerald-900 transition hover:bg-emerald-400 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-emerald-300 disabled:cursor-not-allowed disabled:bg-emerald-500/20 disabled:text-emerald-200"
                >
                  Log Patrol Event
                </button>
              </div>
            </div>

            <div className="rounded-3xl border border-slate-800 bg-slate-900/50 p-6 shadow-xl backdrop-blur">
              <div className="flex flex-wrap items-center justify-between gap-3">
                <div>
                  <h2 className="text-lg font-semibold tracking-tight text-white">
                    Checkpoint Directory
                  </h2>
                  <p className="text-sm text-slate-400">
                    QR identifiers assigned to active patrol posts.
                  </p>
                </div>
              </div>

              <div className="mt-6 grid gap-4 sm:grid-cols-2">
                {PATROL_POINTS.map((point) => (
                  <article
                    key={point.code}
                    className="rounded-2xl border border-slate-800 bg-slate-900/70 p-4 shadow-inner"
                  >
                    <p className="text-xs uppercase tracking-[0.25em] text-slate-500">
                      {point.area}
                    </p>
                    <p className="mt-2 text-sm font-semibold text-slate-100">
                      {point.name}
                    </p>
                    <p className="mt-2 inline-flex rounded-full border border-slate-700 px-3 py-1 font-mono text-xs text-indigo-300">
                      {point.code}
                    </p>
                    <ul className="mt-3 space-y-2 text-xs text-slate-300">
                      {point.checklist.map((item) => (
                        <li key={item} className="flex items-center gap-2">
                          <span className="h-[6px] w-[6px] rounded-full bg-indigo-400" />
                          <span>{item}</span>
                        </li>
                      ))}
                    </ul>
                  </article>
                ))}
              </div>
            </div>
          </div>

          <aside className="flex flex-col gap-6">
            <div className="rounded-3xl border border-slate-800 bg-slate-900/70 p-6 shadow-xl backdrop-blur">
              <h2 className="text-lg font-semibold tracking-tight text-white">
                Patrol Coverage
              </h2>
              <p className="text-sm text-slate-400">
                Snapshot updates as logs are captured.
              </p>
              <div className="mt-6 grid gap-4">
                <MetricPill
                  label="Posts completed"
                  value={`${totals.total}`}
                  caption="Logged in the last session"
                />
                <MetricPill
                  label="Site coverage"
                  value={`${totals.coverage}%`}
                  caption="Unique checkpoints visited"
                />
                <MetricPill
                  label="Clear"
                  value={`${totals.clear}`}
                  accent="bg-emerald-400/90"
                />
                <MetricPill
                  label="Follow-ups"
                  value={`${totals.followUp}`}
                  accent="bg-amber-400/90"
                />
                <MetricPill
                  label="Incidents"
                  value={`${totals.incident}`}
                  accent="bg-rose-400/90"
                />
              </div>
            </div>

            <div className="flex-grow rounded-3xl border border-slate-800 bg-slate-900/80 p-6 shadow-xl backdrop-blur">
              <div className="flex items-center justify-between">
                <div>
                  <h2 className="text-lg font-semibold tracking-tight text-white">
                    Patrol Timeline
                  </h2>
                  <p className="text-sm text-slate-400">
                    Real-time feed of recorded checkpoints.
                  </p>
                </div>
                <span className="text-xs text-slate-500">
                  {logs.length === 0
                    ? "No logs yet"
                    : `${logs.length} ${
                        logs.length === 1 ? "entry" : "entries"
                      }`}
                </span>
              </div>

              <ol className="mt-6 space-y-4">
                {logs.map((log) => (
                  <li
                    key={log.id}
                    className="rounded-2xl border border-slate-800 bg-slate-900 p-4 shadow-inner"
                  >
                    <div className="flex flex-wrap items-center justify-between gap-3">
                      <div>
                        <p className="text-sm font-semibold text-slate-100">
                          {log.pointName}
                        </p>
                        <p className="text-xs text-slate-500">
                          {format(new Date(log.timestamp), "MMM dd • HH:mm")}
                        </p>
                      </div>
                      <span
                        className={`rounded-full px-3 py-1 text-xs font-semibold ${STATUS_STYLES[log.status]}`}
                      >
                        {log.status}
                      </span>
                    </div>
                    <div className="mt-3 flex flex-col gap-2 text-xs text-slate-300">
                      <p>
                        <span className="text-slate-400">Guard:</span>{" "}
                        {log.guardName}
                      </p>
                      <p className="font-mono text-[11px] text-indigo-300">
                        {log.qrData}
                      </p>
                      {log.notes && (
                        <p className="rounded-xl border border-slate-800 bg-slate-950/70 px-3 py-2 text-slate-200">
                          {log.notes}
                        </p>
                      )}
                    </div>
                  </li>
                ))}
              </ol>
            </div>
          </aside>
        </section>
      </div>
    </div>
  );
}

function MetricPill({
  label,
  value,
  caption,
  accent,
}: {
  label: string;
  value: string;
  caption?: string;
  accent?: string;
}) {
  return (
    <div className="flex items-center justify-between rounded-2xl border border-slate-800 bg-slate-950/60 p-4">
      <div>
        <p className="text-xs uppercase tracking-[0.25em] text-slate-500">
          {label}
        </p>
        {caption && <p className="mt-1 text-xs text-slate-400">{caption}</p>}
      </div>
      <span
        className={`flex h-10 min-w-[3.5rem] items-center justify-center rounded-full px-4 text-sm font-semibold shadow-inner ${
          accent
            ? `${accent} text-slate-900`
            : "bg-gradient-to-b from-slate-800 to-slate-900 text-slate-100"
        }`}
      >
        {value}
      </span>
    </div>
  );
}

import { EmptyState } from "@/components/ui/EmptyState";
import { Button } from "@/components/ui/Button";
import type { JobSnapshot } from "@/types";

interface JobCenterProps {
  jobs: JobSnapshot[];
  loading?: boolean;
  onCancel: (jobId: string) => void;
  onRefresh?: () => void;
}

function canCancel(job: JobSnapshot): boolean {
  return job.state === "queued" || job.state === "running" || job.state === "cancelRequested";
}

export function JobCenter({ jobs, loading, onCancel, onRefresh }: JobCenterProps) {
  return (
    <div className="space-y-2" data-testid="job-center">
      <div className="flex items-center justify-between gap-2">
        <h3 className="text-[10px] font-medium uppercase tracking-[0.16em] text-charcoal-500">
          Jobs
        </h3>
        {onRefresh ? (
          <Button size="sm" variant="ghost" onClick={onRefresh} disabled={loading}>
            Refresh
          </Button>
        ) : null}
      </div>

      {jobs.length === 0 ? (
        <EmptyState
          title="No media jobs"
          description="Import assets or generate proxies, thumbnails, and waveforms to see progress here."
        />
      ) : (
        <ul className="max-h-36 space-y-1.5 overflow-auto pr-1">
          {jobs.map((job) => (
            <li
              key={job.id}
              className="flex items-center gap-3 rounded-xl border border-white/[0.06] bg-charcoal-900/60 px-3 py-2"
              data-testid={`job-${job.id}`}
            >
              <div className="min-w-0 flex-1">
                <p className="truncate text-xs font-medium text-charcoal-100">
                  {job.jobType}
                  <span className="ml-2 text-charcoal-500">{job.state}</span>
                </p>
                <p className="truncate text-[11px] text-charcoal-400">
                  {job.progress.stage}
                  {job.progress.message ? ` · ${job.progress.message}` : ""}
                  {typeof job.progress.fraction === "number"
                    ? ` · ${Math.round(job.progress.fraction * 100)}%`
                    : ""}
                </p>
              </div>
              {canCancel(job) ? (
                <Button
                  size="sm"
                  variant="danger"
                  onClick={() => onCancel(job.id)}
                  data-testid={`cancel-job-${job.id}`}
                >
                  Cancel
                </Button>
              ) : null}
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}

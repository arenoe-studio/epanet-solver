from __future__ import annotations

import json
import os
import threading
import time
import uuid
from dataclasses import dataclass
from pathlib import Path


@dataclass
class Job:
    id: str
    status: str  # queued | running | succeeded | failed
    created_at: float
    started_at: float | None = None
    finished_at: float | None = None
    error: str | None = None
    result_path: str | None = None


class JobStore:
    def __init__(self, jobs_dir: str):
        self._jobs_dir = Path(jobs_dir)
        self._lock = threading.Lock()
        self._jobs: dict[str, Job] = {}

    def _job_dir(self, job_id: str) -> Path:
        return self._jobs_dir / job_id

    def ensure_dirs(self) -> None:
        self._jobs_dir.mkdir(parents=True, exist_ok=True)

    def _meta_path(self, job_id: str) -> Path:
        return self._job_dir(job_id) / "meta.json"

    def _write_meta(self, job: Job) -> None:
        meta = {
            "id": job.id,
            "status": job.status,
            "created_at": job.created_at,
            "started_at": job.started_at,
            "finished_at": job.finished_at,
            "error": job.error,
            "result_path": job.result_path,
        }
        self._meta_path(job.id).write_text(json.dumps(meta, ensure_ascii=False), encoding="utf-8")

    def _load_meta(self, job_id: str) -> Job | None:
        p = self._meta_path(job_id)
        if not p.exists():
            return None
        try:
            meta = json.loads(p.read_text(encoding="utf-8"))
            return Job(
                id=str(meta.get("id") or job_id),
                status=str(meta.get("status") or "queued"),
                created_at=float(meta.get("created_at") or time.time()),
                started_at=(float(meta["started_at"]) if meta.get("started_at") is not None else None),
                finished_at=(float(meta["finished_at"]) if meta.get("finished_at") is not None else None),
                error=(str(meta["error"]) if meta.get("error") is not None else None),
                result_path=(str(meta["result_path"]) if meta.get("result_path") is not None else None),
            )
        except Exception:
            return None

    def create(self) -> Job:
        self.ensure_dirs()
        job_id = str(uuid.uuid4())
        job = Job(id=job_id, status="queued", created_at=time.time())
        with self._lock:
            self._jobs[job_id] = job
        self._job_dir(job_id).mkdir(parents=True, exist_ok=True)
        self._write_meta(job)
        return job

    def get(self, job_id: str) -> Job | None:
        with self._lock:
            job = self._jobs.get(job_id)
            if job:
                return job
        loaded = self._load_meta(job_id)
        if not loaded:
            return None
        with self._lock:
            self._jobs[job_id] = loaded
        return loaded

    def mark_running(self, job_id: str) -> None:
        with self._lock:
            job = self._jobs.get(job_id)
            if not job:
                return
            job.status = "running"
            job.started_at = time.time()
            self._write_meta(job)

    def mark_failed(self, job_id: str, error: str) -> None:
        with self._lock:
            job = self._jobs.get(job_id)
            if not job:
                return
            job.status = "failed"
            job.error = error
            job.finished_at = time.time()
            self._write_meta(job)

    def mark_succeeded(self, job_id: str, result: dict) -> str:
        job_dir = self._job_dir(job_id)
        job_dir.mkdir(parents=True, exist_ok=True)
        result_path = job_dir / "result.json"
        result_path.write_text(json.dumps(result, ensure_ascii=False), encoding="utf-8")

        with self._lock:
            job = self._jobs.get(job_id)
            if not job:
                raise KeyError(job_id)
            job.status = "succeeded"
            job.finished_at = time.time()
            job.result_path = str(result_path)
            self._write_meta(job)

        return str(result_path)

    def read_result(self, job_id: str) -> dict | None:
        job = self.get(job_id)
        if not job or not job.result_path:
            return None
        p = Path(job.result_path)
        if not p.exists():
            return None
        return json.loads(p.read_text(encoding="utf-8"))

    def job_file(self, job_id: str, name: str) -> Path:
        job_dir = self._job_dir(job_id)
        candidate = (job_dir / name).resolve()
        if job_dir.resolve() not in candidate.parents:
            raise ValueError("Invalid file path")
        return candidate

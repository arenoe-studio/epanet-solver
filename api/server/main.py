from __future__ import annotations

import shutil
import threading
import traceback
from concurrent.futures import ThreadPoolExecutor
from pathlib import Path

from fastapi import FastAPI, File, Form, HTTPException, UploadFile
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import FileResponse, JSONResponse

from .analysis import InpValidationError, UserError, analyze_inp_bytes
from .config import get_settings
from .jobs import JobStore

from api.epanet.simulation import EpanetToolkitUnavailable

settings = get_settings()
jobs = JobStore(settings.jobs_dir)
executor = ThreadPoolExecutor(max_workers=settings.max_workers)

app = FastAPI(title="EPANET Solver API", version="0.1.0")

app.add_middleware(
    CORSMiddleware,
    allow_origins=settings.cors_allow_origins or [],
    allow_origin_regex=settings.cors_allow_origin_regex,
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)


@app.get("/health")
def health():
    return {"ok": True}


@app.post("/v1/analyze")
async def analyze(
    file: UploadFile = File(...),
    action: str = Form(default=settings.default_action),
    max_iterations: int = Form(default=settings.default_max_iterations),
    time_budget_s: float = Form(default=settings.default_time_budget_s),
):
    try:
        data = await file.read()
        result, _files = analyze_inp_bytes(
            filename=file.filename or "network.inp",
            inp_bytes=data,
            action=action,
            max_iterations=max_iterations,
            time_budget_s=time_budget_s,
            embed_files_base64=True,
        )
        return JSONResponse(result)
    except EpanetToolkitUnavailable:
        raise HTTPException(
            status_code=503,
            detail="Solver sedang maintenance. Silakan coba lagi beberapa saat.",
        )
    except (UserError, InpValidationError) as e:
        raise HTTPException(status_code=422, detail=str(e))
    except Exception:
        traceback.print_exc()
        raise HTTPException(status_code=500, detail="System error")


@app.post("/v1/simulations")
async def create_simulation_job(
    file: UploadFile = File(...),
    action: str = Form(default=settings.default_action),
    max_iterations: int = Form(default=settings.default_max_iterations),
    time_budget_s: float = Form(default=settings.default_time_budget_s),
):
    try:
        job = jobs.create()
        job_dir = jobs.job_file(job.id, "input.inp").parent
        job_dir.mkdir(parents=True, exist_ok=True)
        inp_path = job_dir / "input.inp"
        raw = await file.read()
        original_filename = file.filename or "network.inp"
        inp_path.write_bytes(raw)
    except Exception:
        traceback.print_exc()
        raise HTTPException(status_code=500, detail="Failed to create simulation job")

    def _run():
        jobs.mark_running(job.id)
        try:
            result, files = analyze_inp_bytes(
                filename=original_filename,
                inp_bytes=raw,
                action=action,
                max_iterations=max_iterations,
                time_budget_s=time_budget_s,
                work_dir=job_dir,
                embed_files_base64=False,
            )

            # Normalize output filenames for download endpoints
            shutil.copyfile(files.optimized_inp_v1, job_dir / "optimized_v1.inp")
            shutil.copyfile(files.report_md_v1, job_dir / "report_v1.md")
            if files.optimized_inp_final and files.report_md_final:
                shutil.copyfile(files.optimized_inp_final, job_dir / "optimized_final.inp")
                shutil.copyfile(files.report_md_final, job_dir / "report_final.md")

            jobs.mark_succeeded(job.id, result)
        except EpanetToolkitUnavailable:
            jobs.mark_failed(job.id, "MAINTENANCE")
        except Exception as e:
            jobs.mark_failed(job.id, str(e))

    try:
        executor.submit(_run)
    except Exception:
        traceback.print_exc()
        thread = threading.Thread(target=_run, daemon=True)
        thread.start()

    return {"id": job.id, "status": job.status}


@app.get("/v1/simulations/{job_id}")
def simulation_status(job_id: str):
    job = jobs.get(job_id)
    if not job:
        raise HTTPException(status_code=404, detail="Not found")
    return {
        "id": job.id,
        "status": job.status,
        "createdAt": job.created_at,
        "startedAt": job.started_at,
        "finishedAt": job.finished_at,
        "error": job.error,
    }


@app.get("/v1/simulations/{job_id}/result")
def simulation_result(job_id: str):
    job = jobs.get(job_id)
    if not job:
        raise HTTPException(status_code=404, detail="Not found")
    if job.status == "failed":
        raise HTTPException(status_code=500, detail=job.error or "Job failed")
    if job.status != "succeeded":
        raise HTTPException(status_code=409, detail="Job not finished")

    result = jobs.read_result(job_id)
    if result is None:
        raise HTTPException(status_code=404, detail="Result not found")
    return JSONResponse(result)


@app.get("/v1/simulations/{job_id}/files/{name}")
def simulation_file(job_id: str, name: str):
    job = jobs.get(job_id)
    if not job:
        raise HTTPException(status_code=404, detail="Not found")
    if job.status != "succeeded":
        raise HTTPException(status_code=409, detail="Job not finished")

    allowed = {
        "input.inp",
        "optimized_v1.inp",
        "report_v1.md",
        "optimized_final.inp",
        "report_final.md",
        "result.json",
    }
    if name not in allowed:
        raise HTTPException(status_code=404, detail="Unknown file")

    p = jobs.job_file(job_id, name)
    if not p.exists():
        raise HTTPException(status_code=404, detail="Not found")

    media_type = "text/plain"
    if name.endswith(".inp"):
        media_type = "text/plain"
    elif name.endswith(".md"):
        media_type = "text/markdown"
    elif name.endswith(".json"):
        media_type = "application/json"

    return FileResponse(str(p), media_type=media_type, filename=name)

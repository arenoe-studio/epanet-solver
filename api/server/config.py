from __future__ import annotations

import os
from dataclasses import dataclass


def _env_int(name: str, default: int) -> int:
    v = os.environ.get(name)
    if v is None or str(v).strip() == "":
        return default
    try:
        return int(str(v).strip())
    except Exception:
        return default


def _env_float(name: str, default: float) -> float:
    v = os.environ.get(name)
    if v is None or str(v).strip() == "":
        return default
    try:
        return float(str(v).strip())
    except Exception:
        return default


def _env_csv(name: str) -> list[str]:
    raw = (os.environ.get(name) or "").strip()
    if not raw:
        return []
    return [p.strip() for p in raw.split(",") if p.strip()]


@dataclass(frozen=True)
class Settings:
    port: int
    cors_allow_origins: list[str]
    cors_allow_origin_regex: str | None
    jobs_dir: str
    max_upload_mb: int
    max_workers: int
    default_action: str
    default_max_iterations: int
    default_time_budget_s: float


def get_settings() -> Settings:
    cors_allow_origins = _env_csv("CORS_ALLOW_ORIGINS")
    cors_allow_origin_regex = (os.environ.get("CORS_ALLOW_ORIGIN_REGEX") or "").strip() or None

    if not cors_allow_origins and not cors_allow_origin_regex:
        cors_allow_origins = [
            "http://localhost:3000",
            "http://localhost:5173",
        ]
        cors_allow_origin_regex = r"^https://.*\.vercel\.app$"

    return Settings(
        port=_env_int("PORT", 3000),
        cors_allow_origins=cors_allow_origins,
        cors_allow_origin_regex=cors_allow_origin_regex,
        jobs_dir=(os.environ.get("EPANET_SOLVER_JOBS_DIR") or "/tmp/epanet-solver-jobs").strip(),
        max_upload_mb=_env_int("MAX_UPLOAD_MB", 25),
        max_workers=_env_int("EPANET_SOLVER_MAX_WORKERS", 4),
        default_action=(os.environ.get("EPANET_SOLVER_DEFAULT_ACTION") or "analyze").strip(),
        default_max_iterations=_env_int("EPANET_SOLVER_MAX_ITERATIONS", 50),
        default_time_budget_s=_env_float("EPANET_SOLVER_TIME_BUDGET_S", 180.0),
    )


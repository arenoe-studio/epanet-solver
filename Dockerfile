FROM python:3.11-slim-bookworm

ENV PYTHONDONTWRITEBYTECODE=1 \
    PYTHONUNBUFFERED=1 \
    MPLBACKEND=Agg

WORKDIR /app

RUN apt-get update && apt-get install -y --no-install-recommends \
    build-essential \
    curl \
    ca-certificates \
    libgomp1 \
    libfreetype6 \
    libpng16-16 \
  && rm -rf /var/lib/apt/lists/*

COPY api/requirements.txt /app/api/requirements.txt
RUN python -m pip install --upgrade pip \
  && pip install --no-cache-dir -r /app/api/requirements.txt

# EPyT on Linux expects libepanet.so to be present (EPANET 2.2 shared library).
# Try to locate a bundled libepanet2.so inside the epyt package and link/copy it.
RUN python -c "from importlib.resources import files; import pathlib, shutil; root=pathlib.Path(files('epyt')); cands=list(root.rglob('libepanet2.so'))+list(root.rglob('libepanet.so')); print('epyt lib candidates:', [str(p) for p in cands]); target=pathlib.Path('/lib/x86_64-linux-gnu/libepanet.so'); target.parent.mkdir(parents=True, exist_ok=True); src=(cands[0] if cands else None); (shutil.copyfile(src, target) if src and src.exists() else None); print('libepanet.so exists:', target.exists())"

COPY api /app/api

EXPOSE 3000

HEALTHCHECK --interval=30s --timeout=3s --start-period=15s --retries=3 \
  CMD curl -fsS "http://127.0.0.1:${PORT:-3000}/health" || exit 1

CMD ["sh", "-c", "uvicorn api.server.main:app --host 0.0.0.0 --port ${PORT:-3000}"]

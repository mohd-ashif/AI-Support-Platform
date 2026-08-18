FROM python:3.11-slim

WORKDIR /app

# Copy requirements file dynamically regardless of build context
COPY requirements.txt* apps/api/requirements.txt* ./
RUN if [ -f requirements.txt ]; then pip install --no-cache-dir -r requirements.txt; elif [ -f apps/api/requirements.txt ]; then pip install --no-cache-dir -r apps/api/requirements.txt; fi

# Copy application source code
COPY . .

ENV PYTHONPATH=/app

CMD ["sh", "-c", "if [ -d apps/api/src ]; then uvicorn apps.api.src.main:app --host 0.0.0.0 --port ${PORT:-8000}; else uvicorn src.main:app --host 0.0.0.0 --port ${PORT:-8000}; fi"]

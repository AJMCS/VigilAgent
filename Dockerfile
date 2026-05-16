FROM python:3.12-slim

# System deps: git + scanning tools
RUN apt-get update && apt-get install -y --no-install-recommends \
    git \
    curl \
    nodejs \
    npm \
    && rm -rf /var/lib/apt/lists/*

# semgrep
RUN pip install --no-cache-dir semgrep

# bandit + pip-audit
RUN pip install --no-cache-dir bandit pip-audit

# gitleaks
RUN curl -sSfL https://github.com/gitleaks/gitleaks/releases/download/v8.21.2/gitleaks_8.21.2_linux_x64.tar.gz \
    | tar -xz -C /usr/local/bin gitleaks

# trufflehog
RUN curl -sSfL https://raw.githubusercontent.com/trufflesecurity/trufflehog/main/scripts/install.sh \
    | sh -s -- -b /usr/local/bin

WORKDIR /app

COPY requirements.txt .
RUN pip install --no-cache-dir -r requirements.txt

COPY . .

# Sandbox dirs (mirrors NemoClaw policy mounts)
RUN mkdir -p /root/vigilagent/repos /root/vigilagent/reports

EXPOSE 8000

CMD ["uvicorn", "api.main:app", "--host", "0.0.0.0", "--port", "8000"]

# Build context is the repo root (see wrangler.jsonc: image_build_context = "..")
# because this image needs both lab-ui/backend/ AND the sibling attack-scripts/
# directory baked in — there are no bind mounts on Cloudflare Containers.
FROM python:3.11-slim
WORKDIR /app

COPY lab-ui/backend/requirements.txt ./requirements.txt
RUN pip install --no-cache-dir -r requirements.txt

# attack-scripts has its own (slightly different, e.g. dnspython[doh]) deps —
# install those too so campaign_engine's imports (campaigns/*, scenarios/*)
# all resolve at runtime.
COPY attack-scripts/requirements.txt ./attack-scripts-requirements.txt
RUN pip install --no-cache-dir -r attack-scripts-requirements.txt

# Application code — copied in (not bind-mounted) so the image is self-contained.
COPY lab-ui/backend/ .
# attack-scripts baked in at the same /app/attack-scripts path the app expects
# (PYTHONPATH below matches docker-compose's dev-time mount path).
COPY attack-scripts/ /app/attack-scripts/

ENV PYTHONPATH=/app/attack-scripts

EXPOSE 8000
CMD ["uvicorn", "main:app", "--host", "0.0.0.0", "--port", "8000"]

FROM python:3.13-slim-bookworm@sha256:e32be0e55814a08977501ca863271d9bd02443710db8f2afaf8372e2c4508530
WORKDIR /app
COPY engine/requirements.txt /app/requirements.txt
COPY engine/vendor/ /wheels/
RUN pip install --no-index --find-links=/wheels --no-cache-dir --require-hashes -r requirements.txt && rm -rf /wheels
COPY --chmod=0444 engine/server.py /app/server.py
ENV PYTHONDONTWRITEBYTECODE=1 PYTHONUNBUFFERED=1
USER 65532:65532
EXPOSE 8080
CMD ["python", "server.py"]

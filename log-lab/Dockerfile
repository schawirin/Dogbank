FROM python:3.11-slim
RUN pip install --no-cache-dir requests
COPY send_bad_logs.py /app/send_bad_logs.py
CMD while true; do python /app/send_bad_logs.py; sleep 60; done

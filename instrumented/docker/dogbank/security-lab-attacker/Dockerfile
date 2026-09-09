FROM nginx:stable-alpine

COPY nginx.conf /etc/nginx/conf.d/default.conf
COPY index.html app.js styles.css /usr/share/nginx/html/

EXPOSE 80 443
HEALTHCHECK --interval=10s --timeout=3s --retries=3 CMD wget --no-check-certificate -q -O- https://127.0.0.1/health || exit 1

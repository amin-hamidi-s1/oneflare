# Single-stage image: serve the pre-built SPA with nginx.
#
# We deliberately do NOT run `npm install` / `npm run build` inside the image.
# The build is done on the host (`npm run build`, using the already-installed
# node_modules — a fully local step that needs no network), and its output in
# dist/ is copied in here. dist/ is static HTML/CSS/JS with no native binaries,
# so — unlike node_modules — it is safe to copy from a macOS host into this
# Linux image. This also keeps the container build fast and independent of npm
# registry availability.
FROM nginx:alpine
COPY dist /usr/share/nginx/html
COPY nginx.conf /etc/nginx/conf.d/default.conf
EXPOSE 80

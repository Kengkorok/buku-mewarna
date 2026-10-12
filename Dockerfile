FROM nginx:alpine
LABEL org.opencontainers.image.title="Buku Mewarna" \
      org.opencontainers.image.description="Offline coloring game for kids (tap-to-fill + brush), no ads."
COPY nginx.conf /etc/nginx/conf.d/default.conf
COPY site/ /usr/share/nginx/html/
# sesetengah shell guna umask 077 -> fail 600 -> nginx 403; betulkan dalam image
RUN chmod -R a+rX /usr/share/nginx/html
EXPOSE 80

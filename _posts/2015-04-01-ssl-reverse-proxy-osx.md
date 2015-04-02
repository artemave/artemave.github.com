---
layout: post
title: "Setup Nginx reverse proxy (with ssl termination) on OSX"
description: ""
category: 
tags:
  - tools
---
{% include JB/setup %}

_This is_ NOT _a joke._

To test Google Game Services integration locally, I wanted my local machine to be accessible over https on something other than locahost or 127.0.0.1. So I decided to employ [localtest.me](http://readme.localtest.me/) and use nginx locally as ssl terminating reverse proxy to my app running on port 9999.

Install nginx:

    % brew install nginx

Generate self-signed certificate:

    % openssl req -x509 -nodes -days 365 -newkey rsa:2048 -keyout /usr/local/etc/nginx/cert.key -out /usr/local/etc/nginx/cert.crt

Nginx.conf:

    # Important! I had to change this to myself (artem) or it wouldn't serve js assets with "permission denied".
    # Group is mandatory despite nginx docs claiming otherwise.
    user  artem admin;
    
    worker_processes  1;
    
    events {
        worker_connections  1024;
    }
    
    http {
        include       mime.types;
        default_type  application/octet-stream;
    
        log_format  main  '$remote_addr - $remote_user [$time_local] "$request" '
                          '$status $body_bytes_sent "$http_referer" '
                          '"$http_user_agent" "$http_x_forwarded_for"';
    
        sendfile        on;
    
        keepalive_timeout  65;
    
        server {
            listen       443 ssl;
            server_name  abc.localtest.me;
    
            ssl_certificate      cert.crt;
            ssl_certificate_key  cert.key;
    
            ssl_session_cache    shared:SSL:1m;
            ssl_session_timeout  5m;
    
            ssl_ciphers  HIGH:!aNULL:!MD5;
            ssl_prefer_server_ciphers  on;
    
            location / {
                proxy_pass http://localhost:9999;
                proxy_set_header Host $host;
                proxy_set_header X-Real-IP $remote_addr;
                proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
                proxy_set_header X-Forwarded-Proto $scheme;
            }
            # Proxy websocket connections (you probably don't need this)
            location /games/play/ {
                proxy_pass http://localhost:9999;
                proxy_http_version 1.1;
                proxy_set_header Upgrade $http_upgrade;
                proxy_set_header Connection "upgrade";
            }
        }
    }

Start nginx as sudo:

    % sudo nginx

Test it: [https://abc.localtest.me](https://abc.localtest.me)

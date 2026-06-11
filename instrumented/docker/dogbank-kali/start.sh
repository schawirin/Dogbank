#!/bin/bash

# Inicia display virtual
Xvfb :1 -screen 0 ${RESOLUTION}x24 &
sleep 2

# Inicia XFCE
DISPLAY=:1 startxfce4 &
sleep 3

# VNC com senha
mkdir -p ~/.vnc
x11vnc -storepasswd ${VNC_PASSWORD} ~/.vnc/passwd

x11vnc -display :1 \
  -rfbauth ~/.vnc/passwd \
  -rfbport 5900 \
  -forever \
  -shared \
  -bg

# noVNC — acesso via browser na porta 8080
websockify --web /usr/share/novnc/ 8080 localhost:5900

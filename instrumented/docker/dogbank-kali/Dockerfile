FROM kalilinux/kali-rolling

ENV DEBIAN_FRONTEND=noninteractive
ENV TARGET=lab.dogbank.dog
ENV DISPLAY=:1
ENV VNC_PASSWORD=dogbank
ENV RESOLUTION=1280x768

# Desktop XFCE + ferramentas de segurança + VNC
RUN apt-get update -q && apt-get install -y --no-install-recommends \
    # Desktop
    kali-desktop-xfce \
    dbus-x11 \
    x11vnc \
    xvfb \
    novnc \
    websockify \
    # Ferramentas de segurança
    nmap \
    nikto \
    whatweb \
    sqlmap \
    hydra \
    ffuf \
    burpsuite \
    metasploit-framework \
    # Utils
    curl \
    wget \
    jq \
    git \
    python3 \
    python3-pip \
    python3-requests \
    dnsutils \
    iputils-ping \
    ca-certificates \
    unzip \
    && apt-get clean && rm -rf /var/lib/apt/lists/*

# log4j-scan
RUN git clone --depth=1 https://github.com/fullhunt/log4j-scan /opt/log4j-scan && \
    pip3 install --break-system-packages -r /opt/log4j-scan/requirements.txt

# Wordlists essenciais
COPY wordlists/ /wordlists/

# Script de recon
WORKDIR /demo
COPY recon.sh /demo/recon.sh
COPY evildog.sh /demo/evildog.sh
COPY evildog-exploit.sh /demo/evildog-exploit.sh
RUN chmod +x /demo/recon.sh /demo/evildog.sh /demo/evildog-exploit.sh

# Script de inicialização do desktop
COPY start.sh /start.sh
RUN chmod +x /start.sh

EXPOSE 8080 5900

CMD ["/start.sh"]

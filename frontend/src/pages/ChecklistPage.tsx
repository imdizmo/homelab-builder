import { useState } from 'react';
import { useLocation, useNavigate } from 'react-router-dom';
import type { Service } from '../types';
import './ChecklistPage.css';

const SERVICE_DEPLOY: Record<string, { compose: string; notes?: string }> = {
  Plex: {
    compose: `services:
  plex:
    image: lscr.io/linuxserver/plex:latest
    container_name: plex
    network_mode: host
    environment:
      - PUID=1000
      - PGID=1000
      - TZ=Europe/Warsaw
    volumes:
      - ./plex/config:/config
      - /path/to/media:/media
    restart: unless-stopped`,
    notes: 'Use Intel QuickSync (iGPU) for hardware transcoding. Passthrough with --device /dev/dri.',
  },
  Jellyfin: {
    compose: `services:
  jellyfin:
    image: jellyfin/jellyfin:latest
    container_name: jellyfin
    ports:
      - "8096:8096"
    environment:
      - PUID=1000
      - PGID=1000
      - TZ=Europe/Warsaw
    volumes:
      - ./jellyfin/config:/config
      - /path/to/media:/media
    restart: unless-stopped`,
    notes: 'Free and open-source. Supports hardware transcoding with VAAPI.',
  },
  'Home Assistant': {
    compose: `services:
  homeassistant:
    image: ghcr.io/home-assistant/home-assistant:stable
    container_name: homeassistant
    network_mode: host
    volumes:
      - ./homeassistant/config:/config
    environment:
      - TZ=Europe/Warsaw
    restart: unless-stopped`,
    notes: 'Use host networking for device discovery. Add --privileged for USB device access.',
  },
  'Pi-hole': {
    compose: `services:
  pihole:
    image: pihole/pihole:latest
    container_name: pihole
    ports:
      - "53:53/tcp"
      - "53:53/udp"
      - "8080:80/tcp"
    environment:
      TZ: Europe/Warsaw
      WEBPASSWORD: changeme
    volumes:
      - ./pihole/etc:/etc/pihole
      - ./pihole/dnsmasq:/etc/dnsmasq.d
    restart: unless-stopped`,
    notes: 'Point your router DNS to this server IP. Web admin at :8080.',
  },
  Traefik: {
    compose: `services:
  traefik:
    image: traefik:v3.0
    container_name: traefik
    ports:
      - "80:80"
      - "443:443"
      - "8080:8080"
    volumes:
      - /var/run/docker.sock:/var/run/docker.sock:ro
      - ./traefik:/etc/traefik
    restart: unless-stopped`,
  },
  Nextcloud: {
    compose: `services:
  nextcloud:
    image: nextcloud:latest
    container_name: nextcloud
    ports:
      - "8080:80"
    environment:
      - POSTGRES_HOST=db
      - POSTGRES_DB=nextcloud
      - POSTGRES_USER=nextcloud
      - POSTGRES_PASSWORD=changeme
    volumes:
      - ./nextcloud/data:/var/www/html
    restart: unless-stopped`,
    notes: 'Pair with a PostgreSQL or MariaDB container for better performance.',
  },
  Portainer: {
    compose: `services:
  portainer:
    image: portainer/portainer-ce:latest
    container_name: portainer
    ports:
      - "9443:9443"
    volumes:
      - /var/run/docker.sock:/var/run/docker.sock
      - ./portainer/data:/data
    restart: unless-stopped`,
    notes: 'Access at https://your-server:9443. Sets up on first visit.',
  },
  'AdGuard Home': {
    compose: `services:
  adguard:
    image: adguard/adguardhome:latest
    container_name: adguard
    ports:
      - "53:53/tcp"
      - "53:53/udp"
      - "3000:3000/tcp"
    volumes:
      - ./adguard/work:/opt/adguardhome/work
      - ./adguard/conf:/opt/adguardhome/conf
    restart: unless-stopped`,
    notes: 'Setup wizard at :3000. Supports DNS-over-HTTPS.',
  },
  Grafana: {
    compose: `services:
  grafana:
    image: grafana/grafana:latest
    container_name: grafana
    ports:
      - "3000:3000"
    environment:
      - GF_SECURITY_ADMIN_PASSWORD=changeme
    volumes:
      - ./grafana/data:/var/lib/grafana
    restart: unless-stopped`,
  },
  'Uptime Kuma': {
    compose: `services:
  uptime-kuma:
    image: louislam/uptime-kuma:latest
    container_name: uptime-kuma
    ports:
      - "3001:3001"
    volumes:
      - ./uptime-kuma/data:/app/data
    restart: unless-stopped`,
    notes: 'Beautiful status pages. Add monitors for all your other services.',
  },
  'Minecraft Server': {
    compose: `services:
  minecraft:
    image: itzg/minecraft-server:latest
    container_name: minecraft
    ports:
      - "25565:25565"
    environment:
      EULA: "TRUE"
      MEMORY: "2G"
      TYPE: "PAPER"
    volumes:
      - ./minecraft/data:/data
    restart: unless-stopped`,
    notes: 'Set MEMORY based on player count. Paper server recommended for performance.',
  },
  'Nginx Proxy Manager': {
    compose: `services:
  npm:
    image: jc21/nginx-proxy-manager:latest
    container_name: npm
    ports:
      - "80:80"
      - "443:443"
      - "81:81"
    volumes:
      - ./npm/data:/data
      - ./npm/letsencrypt:/etc/letsencrypt
    restart: unless-stopped`,
    notes: 'Admin panel at :81. Default login: admin@example.com / changeme.',
  },
  Prometheus: {
    compose: `services:
  prometheus:
    image: prom/prometheus:latest
    container_name: prometheus
    ports:
      - "9090:9090"
    volumes:
      - ./prometheus/config:/etc/prometheus
      - ./prometheus/data:/prometheus
    restart: unless-stopped`,
  },
  Vaultwarden: {
    compose: `services:
  vaultwarden:
    image: vaultwarden/server:latest
    container_name: vaultwarden
    ports:
      - "8080:80"
    environment:
      - SIGNUPS_ALLOWED=false
    volumes:
      - ./vaultwarden/data:/data
    restart: unless-stopped`,
    notes: 'Disable signups after creating your account. Use with Bitwarden clients.',
  },
  Immich: {
    compose: `# Immich requires multiple services.
# Use their official docker-compose:
# curl -o docker-compose.yml \\
#   https://github.com/immich-app/immich/releases/latest/download/docker-compose.yml
# curl -o .env \\
#   https://github.com/immich-app/immich/releases/latest/download/example.env`,
    notes: 'Immich uses its own compose stack with Redis, PostgreSQL, and ML. Follow official docs.',
  },
};

interface CheckItem {
  id: string;
  title: string;
  description: string;
  code?: string;
  link?: { url: string; label: string };
  notes?: string;
}

function ChecklistPage() {
  const location = useLocation();
  const navigate = useNavigate();
  const state = location.state as { services?: Service[]; tier?: string } | undefined;

  const [checked, setChecked] = useState<Set<string>>(() => {
    const saved = localStorage.getItem('checklist_checked');
    return saved ? new Set(JSON.parse(saved)) : new Set();
  });

  if (!state?.services || state.services.length === 0) {
    return (
      <div className="checklist-page">
        <div className="error-state">
          <p>⚠️ No services selected. Generate recommendations first.</p>
          <button className="btn-primary" onClick={() => navigate('/services')}>
            Select Services
          </button>
        </div>
      </div>
    );
  }

  const serviceNames = state.services.map((s) => s.name);

  const steps: CheckItem[] = [
    {
      id: 'buy-hardware',
      title: '🛒 Buy Your Hardware',
      description: 'Purchase the components from your shopping list. Check multiple stores for the best prices.',
      notes: 'Tip: Used enterprise hardware (Dell OptiPlex, HP EliteDesk) is a great budget option.',
    },
    {
      id: 'install-os',
      title: '💿 Install Operating System',
      description: 'Flash a USB drive with your OS and boot from it.',
      code: `# Recommended: Ubuntu Server 24.04 LTS
# Download: https://ubuntu.com/download/server
# Flash with: Rufus (Windows) or balenaEtcher (Mac/Linux)
# Boot from USB, follow the installer`,
      link: { url: 'https://ubuntu.com/tutorials/install-ubuntu-server', label: 'Ubuntu Server Install Guide' },
    },
    {
      id: 'setup-ssh',
      title: '🔑 Enable SSH Access',
      description: 'Set up SSH so you can manage your server remotely.',
      code: `# On your server:
sudo apt update && sudo apt install -y openssh-server
sudo systemctl enable ssh

# From your PC, connect with:
ssh your-username@your-server-ip`,
    },
    {
      id: 'install-docker',
      title: '🐳 Install Docker & Docker Compose',
      description: 'Docker is the foundation for running all your services.',
      code: `# Install Docker
curl -fsSL https://get.docker.com | sh

# Add your user to docker group
sudo usermod -aG docker $USER
newgrp docker

# Verify
docker --version
docker compose version`,
      link: { url: 'https://docs.docker.com/engine/install/ubuntu/', label: 'Docker Official Install Docs' },
    },
    {
      id: 'create-dirs',
      title: '📁 Create Directory Structure',
      description: 'Organize your service data in a clean folder structure.',
      code: `mkdir -p ~/homelab
cd ~/homelab
${serviceNames.map((n) => `mkdir -p ${n.toLowerCase().replace(/\s+/g, '-')}`).join('\n')}`,
    },
    // Per-service deployment steps
    ...serviceNames.map((name) => {
      const deploy = SERVICE_DEPLOY[name];
      return {
        id: `deploy-${name.toLowerCase().replace(/\s+/g, '-')}`,
        title: `🚀 Deploy ${name}`,
        description: deploy
          ? `Create docker-compose.yml and start ${name}.`
          : `Set up ${name} using Docker.`,
        code: deploy
          ? `# ~/homelab/${name.toLowerCase().replace(/\s+/g, '-')}/docker-compose.yml\n${deploy.compose}\n\n# Start it:\ncd ~/homelab/${name.toLowerCase().replace(/\s+/g, '-')}\ndocker compose up -d`
          : `# Search Docker Hub for ${name}:\n# https://hub.docker.com/search?q=${encodeURIComponent(name)}`,
        notes: deploy?.notes,
      };
    }),
    {
      id: 'firewall',
      title: '🔒 Basic Security',
      description: 'Set up a firewall and disable password SSH login.',
      code: `# Enable UFW firewall
sudo ufw default deny incoming
sudo ufw default allow outgoing
sudo ufw allow ssh
sudo ufw allow 80/tcp
sudo ufw allow 443/tcp
sudo ufw enable

# Disable password auth (after setting up SSH keys!)
# sudo nano /etc/ssh/sshd_config
# Set: PasswordAuthentication no
# sudo systemctl restart ssh`,
    },
    {
      id: 'done',
      title: '🎉 You\'re Done!',
      description: 'Your homelab is running. Bookmark your service URLs and enjoy!',
      notes: 'Next step: Set up a reverse proxy (Traefik or Nginx Proxy Manager) for clean URLs.',
    },
  ];

  function toggle(id: string) {
    setChecked((prev) => {
      const next = new Set(prev);
      if (next.has(id)) {
        next.delete(id);
      } else {
        next.add(id);
      }
      localStorage.setItem('checklist_checked', JSON.stringify([...next]));
      return next;
    });
  }

  function copyCode(code: string) {
    navigator.clipboard.writeText(code);
  }

  const progress = Math.round((checked.size / steps.length) * 100);

  return (
    <div className="checklist-page">
      <div className="page-header">
        <h1>Your Setup Checklist</h1>
        <p>Step-by-step guide to get your homelab running. Check off steps as you go — progress is saved.</p>
      </div>

      <div className="progress-bar-container">
        <div className="progress-header">
          <span>{checked.size} of {steps.length} steps completed</span>
          <span className="progress-percent">{progress}%</span>
        </div>
        <div className="progress-track">
          <div className="progress-fill" style={{ width: `${progress}%` }} />
        </div>
      </div>

      <div className="checklist-steps">
        {steps.map((step, idx) => (
          <div key={step.id} className={`checklist-step ${checked.has(step.id) ? 'completed' : ''}`}>
            <div className="step-header" onClick={() => toggle(step.id)}>
              <div className={`step-checkbox ${checked.has(step.id) ? 'checked' : ''}`}>
                {checked.has(step.id) ? '✓' : idx + 1}
              </div>
              <div className="step-info">
                <h3 className="step-title">{step.title}</h3>
                <p className="step-description">{step.description}</p>
              </div>
            </div>

            {!checked.has(step.id) && (
              <div className="step-body">
                {step.code && (
                  <div className="code-block">
                    <button className="copy-btn" onClick={() => copyCode(step.code!)}>
                      📋 Copy
                    </button>
                    <pre><code>{step.code}</code></pre>
                  </div>
                )}
                {step.notes && <p className="step-notes">💡 {step.notes}</p>}
                {step.link && (
                  <a href={step.link.url} target="_blank" rel="noopener noreferrer" className="step-link">
                    {step.link.label} ↗
                  </a>
                )}
              </div>
            )}
          </div>
        ))}
      </div>

      <div className="checklist-actions">
        <button className="btn-secondary" onClick={() => navigate(-1)}>← Back</button>
        <button className="btn-secondary" onClick={() => {
          setChecked(new Set());
          localStorage.removeItem('checklist_checked');
        }}>Reset Progress</button>
      </div>
    </div>
  );
}

export default ChecklistPage;

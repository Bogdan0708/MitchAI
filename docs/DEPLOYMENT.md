# Deployment Guide: Hospitality SaaS Platform

This guide details how to deploy the Hospitality SaaS Platform to a production environment using Docker Compose.

## Prerequisites

1.  **Server**: A Linux server (Ubuntu 22.04 LTS recommended) with at least 4GB RAM and 2 vCPUs.
2.  **Docker**: Docker Engine and Docker Compose plugin installed.
3.  **Domain**: A domain name pointing to your server's IP address (e.g., `app.yourdomain.com` for frontend, `api.yourdomain.com` for backend).

## 1. Sever Setup

SSH into your server and install Docker:

```bash
# Add Docker's official GPG key:
sudo apt-get update
sudo apt-get install ca-certificates curl
sudo install -m 0755 -d /etc/apt/keyrings
sudo curl -fsSL https://download.docker.com/linux/ubuntu/gpg -o /etc/apt/keyrings/docker.asc
sudo chmod a+r /etc/apt/keyrings/docker.asc

# Add the repository to Apt sources:
echo \
  "deb [arch=$(dpkg --print-architecture) signed-by=/etc/apt/keyrings/docker.asc] https://download.docker.com/linux/ubuntu \
  $(. /etc/os-release && echo "$VERSION_CODENAME") stable" | \
  sudo tee /etc/apt/sources.list.d/docker.list > /dev/null
sudo apt-get update

# Install Docker
sudo apt-get install docker-ce docker-ce-cli containerd.io docker-buildx-plugin docker-compose-plugin
```

## 2. Configuration

Clone the repository to your server:

```bash
git clone https://github.com/Bogdan0708/SAAS_Agency.git hospitality-saas
cd hospitality-saas
```

Create a production environment file:

```bash
cp .env.example .env
nano .env
```

**Critical Variables to Set:**

*   `NODE_ENV=production`
*   `POSTGRES_PASSWORD`: generate a strong password.
*   `JWT_SECRET`: generate a strong secret (`openssl rand -base64 32`).
*   `CORS_ORIGINS`: `https://app.yourdomain.com` (your frontend domain).
*   `NEXT_PUBLIC_API_URL`: `https://api.yourdomain.com/api/v1` (your backend URL).

## 3. Build and Deploy

Run the production compose file:

```bash
docker compose -f docker-compose.prod.yml up --build -d
```

This will:
1.  Build the Backend API image.
2.  Build the Next.js Frontend image (standalone mode).
3.  Start PostgreSQL, Redis, Qdrant, and n8n.
4.  Start the Backend and Frontend containers.

## 4. Reverse Proxy & SSL (Recommended)

It is highly recommended to run Nginx or Caddy in front of the Docker containers to handle SSL/TLS termination.

### Example Caddyfile (easiest)

Install Caddy: `sudo apt install -y debian-keyring debian-archive-keyring apt-transport-https && curl -1sLf 'https://dl.cloudsmith.io/public/caddy/stable/gpg.key' | sudo gpg --dearmor -o /usr/share/keyrings/caddy-stable-archive-keyring.gpg && curl -1sLf 'https://dl.cloudsmith.io/public/caddy/stable/debian.deb.txt' | sudo tee /etc/apt/sources.list.d/caddy-stable.list && sudo apt update && sudo apt install caddy`

Create `/etc/caddy/Caddyfile`:

```caddyfile
api.yourdomain.com {
    reverse_proxy localhost:3000
}

app.yourdomain.com {
    reverse_proxy localhost:3001
}
```

Reload Caddy: `sudo systemctl reload caddy`. Caddy retrieves certificates automatically.

## 5. Maintenance

### Update Application
```bash
git pull
docker compose -f docker-compose.prod.yml up --build -d
```

### View Logs
```bash
docker compose -f docker-compose.prod.yml logs -f
```

### Database Backup
```bash
docker exec -t hospitality-postgres-prod pg_dumpall -c -U hospitality_admin > dump_$(date +%Y-%m-%d).sql
```

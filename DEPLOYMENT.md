# 🚀 Production Deployment Guide: Campus Navigation System

This guide explains how to containerize and deploy the **Campus Navigation System** using Docker and Docker Compose on any server (AWS, DigitalOcean, Hetzner, Linode, or self-hosted Linux VPS).

---

## 📋 Prerequisites
1. A Linux VPS or cloud instance (Ubuntu 22.04 / 24.04 LTS recommended, 1 GB+ RAM).
2. **Docker** and **Docker Compose** installed on the server.
3. (Optional) A custom domain name pointing to your server's IP address (e.g. `campus.youruniversity.edu`).

---

## 🛠️ Option 1: Quick Deployment with Docker Compose

### Step 1: Transfer the project to your server
You can transfer the files using Git, SCP, or Rsync:
```bash
# Example via SCP:
scp -r "campus navigation app" user@your-server-ip:/var/www/campus-nav
```
Or clone via GitHub:
```bash
git clone <your-repo-url> /var/www/campus-nav
cd /var/www/campus-nav
```

### Step 2: Build and start the container
```bash
# Make the helper script executable
chmod +x docker-run.sh

# Run docker-compose
docker compose up --build -d
```

### Step 3: Verify the deployment
Check if the container is healthy:
```bash
docker compose ps
docker compose logs -f
```
Open your server IP in the browser:
```text
http://<your-server-ip>:3000
```
Health Check Endpoint:
```text
http://<your-server-ip>:3000/api/health
```

---

## 🌐 Option 2: Deploying to AWS (EC2 / Lightsail)

### 1. Launch Instance
- Select an **Ubuntu 24.04 LTS** instance (t3.micro or Lightsail $3.50/mo plan is plenty).
- In the **Security Group / Firewall**, open:
  - Port `22` (SSH)
  - Port `80` (HTTP)
  - Port `443` (HTTPS)
  - Port `3000` (Direct test port)

### 2. Install Docker on EC2
```bash
sudo apt update && sudo apt install -y docker.io docker-compose-v2
sudo usermod -aG docker $USER
newgrp docker
```

### 3. Deploy
```bash
cd /var/www/campus-nav
docker compose up --build -d
```

---

## 🌊 Option 3: Deploying to DigitalOcean

### 1. Create a Droplet
- Choose the **Basic Plan** (1 GB RAM / 1 vCPU, ~$4-6/month).
- Distribution: **Ubuntu 24.04 LTS** (or choose the **Docker 1-Click App** from DigitalOcean Marketplace).

### 2. Run Container
```bash
cd /var/www/campus-nav
docker compose up --build -d
```

---

## 🔒 Production Setup: Nginx Reverse Proxy with Free SSL (HTTPS)

For production university domains (e.g. `https://campus.myuniversity.edu`), place Nginx in front of Docker for SSL encryption:

### 1. Install Nginx & Certbot on the host:
```bash
sudo apt update
sudo apt install -y nginx certbot python3-certbot-nginx
```

### 2. Configure Nginx:
Create `/etc/nginx/sites-available/campus-nav`:
```nginx
server {
    server_name campus.youruniversity.edu;

    location / {
        proxy_pass http://127.0.0.1:3000;
        proxy_http_version 1.1;
        proxy_set_header Upgrade $http_upgrade;
        proxy_set_header Connection 'upgrade';
        proxy_set_header Host $host;
        proxy_cache_bypass $http_upgrade;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto $scheme;
    }
}
```

Enable the site and reload Nginx:
```bash
sudo ln -s /etc/nginx/sites-available/campus-nav /etc/nginx/sites-enabled/
sudo nginx -t
sudo systemctl reload nginx
```

### 3. Generate Free HTTPS Certificate (Let's Encrypt):
```bash
sudo certbot --nginx -d campus.youruniversity.edu
```

Certbot will automatically configure HTTPS redirection and handle automatic renewals.

---

## 🧰 Useful Docker Management Commands

| Task | Command |
| :--- | :--- |
| **Start in background** | `docker compose up -d` |
| **Rebuild after updates** | `docker compose up --build -d` |
| **View live logs** | `docker compose logs -f` |
| **Stop application** | `docker compose down` |
| **Restart container** | `docker compose restart` |
| **Check container health** | `docker ps` |

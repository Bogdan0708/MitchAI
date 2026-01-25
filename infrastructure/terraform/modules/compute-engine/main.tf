# =============================================================================
# Compute Engine Module - n8n + Redis VM
# =============================================================================
# Single VM running n8n and Redis via Docker Compose.
# This is more cost-effective and reliable than running n8n on Cloud Run.
# =============================================================================

# Service account for the VM
resource "google_service_account" "n8n" {
  account_id   = "${var.name_prefix}-n8n-sa"
  project      = var.project_id
  display_name = "n8n VM Service Account"
}

# Grant necessary permissions to service account
resource "google_project_iam_member" "n8n_log_writer" {
  project = var.project_id
  role    = "roles/logging.logWriter"
  member  = "serviceAccount:${google_service_account.n8n.email}"
}

resource "google_project_iam_member" "n8n_metric_writer" {
  project = var.project_id
  role    = "roles/monitoring.metricWriter"
  member  = "serviceAccount:${google_service_account.n8n.email}"
}

resource "google_project_iam_member" "n8n_secret_accessor" {
  project = var.project_id
  role    = "roles/secretmanager.secretAccessor"
  member  = "serviceAccount:${google_service_account.n8n.email}"
}

# Static internal IP for the VM (so Cloud Run can reliably connect)
resource "google_compute_address" "n8n_internal" {
  name         = "${var.name_prefix}-n8n-internal-ip"
  project      = var.project_id
  region       = var.region
  address_type = "INTERNAL"
  subnetwork   = var.subnet_id
}

# External IP for n8n web access and SSH
resource "google_compute_address" "n8n_external" {
  name    = "${var.name_prefix}-n8n-external-ip"
  project = var.project_id
  region  = var.region
}

# Startup script to install Docker and run services
locals {
  startup_script = <<-EOF
    #!/bin/bash
    set -e

    # Logging
    exec 1> >(logger -s -t $(basename $0)) 2>&1
    echo "Starting n8n VM setup..."

    # Install Docker
    if ! command -v docker &> /dev/null; then
      echo "Installing Docker..."
      curl -fsSL https://get.docker.com -o get-docker.sh
      sh get-docker.sh
      usermod -aG docker $USER
      systemctl enable docker
      systemctl start docker
    fi

    # Install Docker Compose
    if ! command -v docker-compose &> /dev/null; then
      echo "Installing Docker Compose..."
      curl -L "https://github.com/docker/compose/releases/latest/download/docker-compose-$(uname -s)-$(uname -m)" -o /usr/local/bin/docker-compose
      chmod +x /usr/local/bin/docker-compose
    fi

    # Create app directory
    mkdir -p /opt/hospitality
    cd /opt/hospitality

    # Get secrets from Secret Manager
    echo "Fetching secrets..."
    N8N_PASSWORD=$(gcloud secrets versions access latest --secret="${var.n8n_password_secret_id}" 2>/dev/null || echo "changeme")

    # Create docker-compose.yml for n8n + Redis
    cat > docker-compose.yml << 'COMPOSE'
    version: '3.8'

    services:
      redis:
        image: redis:7-alpine
        container_name: redis
        restart: always
        command: >
          redis-server
          --maxmemory 256mb
          --maxmemory-policy allkeys-lru
          --appendonly yes
          --appendfsync everysec
        ports:
          - "6379:6379"
        volumes:
          - redis_data:/data
        healthcheck:
          test: ["CMD", "redis-cli", "ping"]
          interval: 10s
          timeout: 5s
          retries: 3

      n8n:
        image: n8nio/n8n:latest
        container_name: n8n
        restart: always
        ports:
          - "5678:5678"
        environment:
          - N8N_BASIC_AUTH_ACTIVE=true
          - N8N_BASIC_AUTH_USER=admin
          - N8N_BASIC_AUTH_PASSWORD=$${N8N_PASSWORD}
          - N8N_HOST=0.0.0.0
          - N8N_PORT=5678
          - N8N_PROTOCOL=http
          - WEBHOOK_URL=http://$${EXTERNAL_IP}:5678/
          - GENERIC_TIMEZONE=UTC
          - DB_TYPE=postgresdb
          - DB_POSTGRESDB_HOST=$${DB_HOST}
          - DB_POSTGRESDB_PORT=5432
          - DB_POSTGRESDB_DATABASE=n8n
          - DB_POSTGRESDB_USER=$${DB_USER}
          - DB_POSTGRESDB_PASSWORD=$${DB_PASSWORD}
          - EXECUTIONS_DATA_PRUNE=true
          - EXECUTIONS_DATA_MAX_AGE=168
        volumes:
          - n8n_data:/home/node/.n8n
        depends_on:
          redis:
            condition: service_healthy

      # Optional: Qdrant for local vector DB (comment out if using Qdrant Cloud)
      # qdrant:
      #   image: qdrant/qdrant:latest
      #   container_name: qdrant
      #   restart: always
      #   ports:
      #     - "6333:6333"
      #     - "6334:6334"
      #   volumes:
      #     - qdrant_data:/qdrant/storage

    volumes:
      redis_data:
      n8n_data:
      # qdrant_data:
    COMPOSE

    # Create environment file
    cat > .env << ENVFILE
    N8N_PASSWORD=${N8N_PASSWORD}
    EXTERNAL_IP=$(curl -s http://metadata.google.internal/computeMetadata/v1/instance/network-interfaces/0/access-configs/0/external-ip -H "Metadata-Flavor: Google")
    DB_HOST=${split("@", var.db_connection_string)[1]}
    DB_USER=${split("://", split("@", var.db_connection_string)[0])[1]}
    DB_PASSWORD=placeholder
    ENVFILE

    # Start services
    echo "Starting services..."
    docker-compose up -d

    # Setup auto-updates (weekly on Sunday at 2 AM)
    echo "0 2 * * 0 cd /opt/hospitality && docker-compose pull && docker-compose up -d" | crontab -

    echo "n8n VM setup complete!"
  EOF
}

# Compute Engine instance
resource "google_compute_instance" "n8n" {
  name         = "${var.name_prefix}-n8n-vm"
  project      = var.project_id
  zone         = var.zone
  machine_type = var.machine_type

  tags = ["n8n", "allow-ssh", "allow-health-check"]

  boot_disk {
    initialize_params {
      image = "ubuntu-os-cloud/ubuntu-2204-lts" # Ubuntu 22.04 LTS
      size  = var.disk_size
      type  = "pd-balanced"
    }
  }

  network_interface {
    network    = var.network_id
    subnetwork = var.subnet_id
    network_ip = google_compute_address.n8n_internal.address

    access_config {
      nat_ip = google_compute_address.n8n_external.address
    }
  }

  service_account {
    email  = google_service_account.n8n.email
    scopes = ["cloud-platform"]
  }

  metadata = {
    enable-oslogin = "TRUE"
  }

  metadata_startup_script = local.startup_script

  labels = var.labels

  # Allow instance to be stopped for cost savings
  scheduling {
    preemptible       = false
    automatic_restart = true
  }

  lifecycle {
    ignore_changes = [metadata_startup_script]
  }
}

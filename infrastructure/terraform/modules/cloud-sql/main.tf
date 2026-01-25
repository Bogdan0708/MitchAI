# =============================================================================
# Cloud SQL Module - PostgreSQL Database
# =============================================================================

resource "random_id" "db_suffix" {
  byte_length = 4
}

resource "google_sql_database_instance" "main" {
  name                = "${var.name_prefix}-postgres-${random_id.db_suffix.hex}"
  project             = var.project_id
  region              = var.region
  database_version    = "POSTGRES_16"
  deletion_protection = true # Prevent accidental deletion

  settings {
    tier              = var.db_tier
    availability_type = var.high_availability ? "REGIONAL" : "ZONAL"
    disk_size         = var.db_disk_size
    disk_type         = "PD_SSD"
    disk_autoresize   = true

    # Use public IP with Cloud SQL Auth Proxy for simplicity
    # Private IP requires more VPC configuration
    ip_configuration {
      ipv4_enabled    = true
      private_network = var.network_id

      # Allow Cloud Run and Cloud Build to connect
      authorized_networks {
        name  = "allow-all" # Secure via Cloud SQL Auth Proxy
        value = "0.0.0.0/0"
      }
    }

    backup_configuration {
      enabled                        = var.backup_enabled
      start_time                     = "03:00" # 3 AM UTC
      point_in_time_recovery_enabled = var.backup_enabled
      backup_retention_settings {
        retained_backups = 7
        retention_unit   = "COUNT"
      }
    }

    maintenance_window {
      day          = 7 # Sunday
      hour         = 4 # 4 AM UTC
      update_track = "stable"
    }

    database_flags {
      name  = "log_checkpoints"
      value = "on"
    }

    database_flags {
      name  = "log_connections"
      value = "on"
    }

    database_flags {
      name  = "log_disconnections"
      value = "on"
    }

    database_flags {
      name  = "log_lock_waits"
      value = "on"
    }

    insights_config {
      query_insights_enabled  = true
      query_string_length     = 1024
      record_application_tags = true
      record_client_address   = true
    }

    user_labels = var.labels
  }

  lifecycle {
    prevent_destroy = true
  }
}

# Create database
resource "google_sql_database" "main" {
  name     = var.db_name
  project  = var.project_id
  instance = google_sql_database_instance.main.name
}

# Get password from Secret Manager
data "google_secret_manager_secret_version" "db_password" {
  secret = var.db_password_secret_id
}

# Create database user
resource "google_sql_user" "main" {
  name     = var.db_user
  project  = var.project_id
  instance = google_sql_database_instance.main.name
  password = data.google_secret_manager_secret_version.db_password.secret_data
}

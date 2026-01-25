# =============================================================================
# Secret Manager Module - Sensitive Configuration
# =============================================================================
# Creates empty secrets that will be populated manually or via CI/CD.
# This approach separates infrastructure from secret values.
# =============================================================================

locals {
  secrets = {
    db_password = {
      id          = "${var.name_prefix}-db-password"
      description = "PostgreSQL database password"
    }
    db_connection_string = {
      id          = "${var.name_prefix}-db-connection-string"
      description = "Full PostgreSQL connection string"
    }
    jwt_secret = {
      id          = "${var.name_prefix}-jwt-secret"
      description = "JWT signing secret"
    }
    stripe_secret_key = {
      id          = "${var.name_prefix}-stripe-secret-key"
      description = "Stripe API secret key"
    }
    stripe_webhook_secret = {
      id          = "${var.name_prefix}-stripe-webhook-secret"
      description = "Stripe webhook signing secret"
    }
    openai_api_key = {
      id          = "${var.name_prefix}-openai-api-key"
      description = "OpenAI API key"
    }
    anthropic_api_key = {
      id          = "${var.name_prefix}-anthropic-api-key"
      description = "Anthropic Claude API key"
    }
    perplexity_api_key = {
      id          = "${var.name_prefix}-perplexity-api-key"
      description = "Perplexity API key"
    }
    sendgrid_api_key = {
      id          = "${var.name_prefix}-sendgrid-api-key"
      description = "SendGrid API key for email"
    }
    n8n_password = {
      id          = "${var.name_prefix}-n8n-password"
      description = "n8n admin password"
    }
    qdrant_api_key = {
      id          = "${var.name_prefix}-qdrant-api-key"
      description = "Qdrant Cloud API key"
    }
  }
}

# Create all secrets (empty - values added manually or via gcloud)
resource "google_secret_manager_secret" "secrets" {
  for_each  = local.secrets
  project   = var.project_id
  secret_id = each.value.id

  labels = merge(var.labels, {
    secret-type = each.key
  })

  replication {
    auto {}
  }
}

# Generate random password for database
resource "random_password" "db_password" {
  length           = 32
  special          = true
  override_special = "!#$%&*()-_=+[]{}<>:?"
}

# Generate random JWT secret
resource "random_password" "jwt_secret" {
  length  = 64
  special = false
}

# Generate random n8n password
resource "random_password" "n8n_password" {
  length           = 24
  special          = true
  override_special = "!#$%&*()-_=+[]{}<>:?"
}

# Store generated passwords as initial versions
resource "google_secret_manager_secret_version" "db_password" {
  secret      = google_secret_manager_secret.secrets["db_password"].id
  secret_data = random_password.db_password.result
}

resource "google_secret_manager_secret_version" "jwt_secret" {
  secret      = google_secret_manager_secret.secrets["jwt_secret"].id
  secret_data = random_password.jwt_secret.result
}

resource "google_secret_manager_secret_version" "n8n_password" {
  secret      = google_secret_manager_secret.secrets["n8n_password"].id
  secret_data = random_password.n8n_password.result
}

# Placeholder versions for API keys (to be updated manually)
resource "google_secret_manager_secret_version" "placeholders" {
  for_each = {
    db_connection_string  = "placeholder-update-after-sql-creation"
    stripe_secret_key     = "sk_test_placeholder"
    stripe_webhook_secret = "whsec_placeholder"
    openai_api_key        = "sk-placeholder"
    anthropic_api_key     = "sk-ant-placeholder"
    perplexity_api_key    = "pplx-placeholder"
    sendgrid_api_key      = "SG.placeholder"
    qdrant_api_key        = "placeholder"
  }

  secret      = google_secret_manager_secret.secrets[each.key].id
  secret_data = each.value

  lifecycle {
    ignore_changes = [secret_data]
  }
}

# IAM: Allow Cloud Run service account to access secrets
data "google_project" "current" {
  project_id = var.project_id
}

resource "google_secret_manager_secret_iam_member" "cloud_run_access" {
  for_each  = google_secret_manager_secret.secrets
  project   = var.project_id
  secret_id = each.value.secret_id
  role      = "roles/secretmanager.secretAccessor"
  member    = "serviceAccount:${data.google_project.current.number}-compute@developer.gserviceaccount.com"
}

# IAM: Allow Compute Engine service account to access specific secrets
resource "google_secret_manager_secret_iam_member" "compute_access" {
  for_each = {
    db_password    = google_secret_manager_secret.secrets["db_password"].secret_id
    db_connection  = google_secret_manager_secret.secrets["db_connection_string"].secret_id
    n8n_password   = google_secret_manager_secret.secrets["n8n_password"].secret_id
  }

  project   = var.project_id
  secret_id = each.value
  role      = "roles/secretmanager.secretAccessor"
  member    = "serviceAccount:${data.google_project.current.number}-compute@developer.gserviceaccount.com"
}

# =============================================================================
# Hospitality SaaS - GCP Infrastructure
# =============================================================================
# This Terraform configuration deploys:
# - VPC with private subnets and Cloud NAT
# - Cloud SQL PostgreSQL (micro tier for cost savings)
# - Artifact Registry for Docker images
# - Cloud Run services for API and Frontend
# - Compute Engine VM for n8n + Redis
# - Secret Manager for sensitive configuration
# =============================================================================

locals {
  project_name = "hospitality-saas"
  env_suffix   = var.environment == "production" ? "prod" : "staging"

  # Resource naming convention: {project}-{resource}-{environment}
  name_prefix = "${local.project_name}-${local.env_suffix}"

  # Common labels
  common_labels = merge(var.labels, {
    environment = var.environment
  })
}

# =============================================================================
# Enable Required APIs
# =============================================================================

resource "google_project_service" "apis" {
  for_each = toset([
    "compute.googleapis.com",
    "sqladmin.googleapis.com",
    "run.googleapis.com",
    "secretmanager.googleapis.com",
    "artifactregistry.googleapis.com",
    "vpcaccess.googleapis.com",
    "servicenetworking.googleapis.com",
    "cloudresourcemanager.googleapis.com",
    "iam.googleapis.com",
  ])

  project            = var.project_id
  service            = each.value
  disable_on_destroy = false
}

# =============================================================================
# VPC Network
# =============================================================================

module "vpc" {
  source = "./modules/vpc"

  project_id  = var.project_id
  region      = var.region
  name_prefix = local.name_prefix
  vpc_cidr    = var.vpc_cidr
  labels      = local.common_labels

  depends_on = [google_project_service.apis]
}

# =============================================================================
# Artifact Registry
# =============================================================================

module "artifact_registry" {
  source = "./modules/artifact-registry"

  project_id  = var.project_id
  region      = var.region
  name_prefix = local.name_prefix
  labels      = local.common_labels

  depends_on = [google_project_service.apis]
}

# =============================================================================
# Secret Manager
# =============================================================================

module "secrets" {
  source = "./modules/secrets"

  project_id  = var.project_id
  name_prefix = local.name_prefix
  labels      = local.common_labels

  depends_on = [google_project_service.apis]
}

# =============================================================================
# Cloud SQL (PostgreSQL)
# =============================================================================

module "cloud_sql" {
  source = "./modules/cloud-sql"

  project_id        = var.project_id
  region            = var.region
  name_prefix       = local.name_prefix
  network_id        = module.vpc.network_id
  db_tier           = var.db_tier
  db_disk_size      = var.db_disk_size
  db_name           = var.db_name
  db_user           = var.db_user
  high_availability = var.db_high_availability
  backup_enabled    = var.db_backup_enabled
  labels            = local.common_labels

  # Store credentials in Secret Manager
  db_password_secret_id = module.secrets.db_password_secret_id

  depends_on = [
    google_project_service.apis,
    module.vpc,
    module.secrets
  ]
}

# =============================================================================
# Compute Engine VM (n8n + Redis)
# =============================================================================

module "n8n_vm" {
  source = "./modules/compute-engine"

  project_id    = var.project_id
  region        = var.region
  zone          = var.zone
  name_prefix   = local.name_prefix
  network_id    = module.vpc.network_id
  subnet_id     = module.vpc.private_subnet_id
  machine_type  = var.n8n_vm_machine_type
  disk_size     = var.n8n_vm_disk_size
  labels        = local.common_labels

  # Secrets for n8n
  n8n_password_secret_id = module.secrets.n8n_password_secret_id
  db_connection_string   = module.cloud_sql.connection_string

  depends_on = [
    google_project_service.apis,
    module.vpc,
    module.cloud_sql,
    module.secrets
  ]
}

# =============================================================================
# Cloud Run Services
# =============================================================================

module "cloud_run" {
  source = "./modules/cloud-run"

  project_id              = var.project_id
  region                  = var.region
  name_prefix             = local.name_prefix
  vpc_connector_id        = module.vpc.vpc_connector_id
  labels                  = local.common_labels

  # Images
  api_image               = var.api_image != "" ? var.api_image : "${module.artifact_registry.repository_url}/api:latest"
  frontend_image          = var.frontend_image != "" ? var.frontend_image : "${module.artifact_registry.repository_url}/frontend:latest"

  # Scaling
  api_min_instances       = var.api_min_instances
  api_max_instances       = var.api_max_instances
  frontend_min_instances  = var.frontend_min_instances
  frontend_max_instances  = var.frontend_max_instances

  # Resources
  api_cpu                 = var.api_cpu
  api_memory              = var.api_memory
  frontend_cpu            = var.frontend_cpu
  frontend_memory         = var.frontend_memory

  # Secrets (passed as secret references)
  db_connection_secret_id  = module.secrets.db_connection_string_secret_id
  jwt_secret_id            = module.secrets.jwt_secret_id
  stripe_secret_key_id     = module.secrets.stripe_secret_key_id
  stripe_webhook_secret_id = module.secrets.stripe_webhook_secret_id
  openai_api_key_id        = module.secrets.openai_api_key_id
  anthropic_api_key_id     = module.secrets.anthropic_api_key_id
  sendgrid_api_key_id      = module.secrets.sendgrid_api_key_id

  # Internal service URLs
  redis_url = "redis://${module.n8n_vm.internal_ip}:6379"

  # External URLs
  qdrant_url = var.enable_qdrant_cloud ? var.qdrant_cloud_url : "http://${module.n8n_vm.internal_ip}:6333"

  depends_on = [
    google_project_service.apis,
    module.vpc,
    module.artifact_registry,
    module.cloud_sql,
    module.n8n_vm,
    module.secrets
  ]
}

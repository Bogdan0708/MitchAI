# =============================================================================
# Project Configuration
# =============================================================================

variable "project_id" {
  description = "GCP Project ID"
  type        = string
}

variable "region" {
  description = "GCP region for resources"
  type        = string
  default     = "us-central1"
}

variable "zone" {
  description = "GCP zone for zonal resources"
  type        = string
  default     = "us-central1-a"
}

variable "environment" {
  description = "Environment name (staging, production)"
  type        = string
  default     = "production"

  validation {
    condition     = contains(["staging", "production"], var.environment)
    error_message = "Environment must be staging or production."
  }
}

# =============================================================================
# Networking
# =============================================================================

variable "vpc_cidr" {
  description = "CIDR block for the VPC"
  type        = string
  default     = "10.0.0.0/16"
}

# =============================================================================
# Cloud SQL (PostgreSQL)
# =============================================================================

variable "db_tier" {
  description = "Cloud SQL machine tier"
  type        = string
  default     = "db-f1-micro" # Cheapest tier for startups, upgrade to db-g1-small later
}

variable "db_disk_size" {
  description = "Cloud SQL disk size in GB"
  type        = number
  default     = 10
}

variable "db_name" {
  description = "Database name"
  type        = string
  default     = "hospitality_db"
}

variable "db_user" {
  description = "Database admin username"
  type        = string
  default     = "hospitality_admin"
}

variable "db_high_availability" {
  description = "Enable high availability for Cloud SQL"
  type        = bool
  default     = false # Enable in production when ready
}

variable "db_backup_enabled" {
  description = "Enable automated backups"
  type        = bool
  default     = true
}

# =============================================================================
# Cloud Run
# =============================================================================

variable "api_image" {
  description = "Docker image for API service"
  type        = string
  default     = "" # Set via CI/CD or tfvars
}

variable "frontend_image" {
  description = "Docker image for Frontend service"
  type        = string
  default     = "" # Set via CI/CD or tfvars
}

variable "api_min_instances" {
  description = "Minimum instances for API (0 for scale-to-zero)"
  type        = number
  default     = 0
}

variable "api_max_instances" {
  description = "Maximum instances for API"
  type        = number
  default     = 10
}

variable "frontend_min_instances" {
  description = "Minimum instances for Frontend"
  type        = number
  default     = 0
}

variable "frontend_max_instances" {
  description = "Maximum instances for Frontend"
  type        = number
  default     = 5
}

variable "api_cpu" {
  description = "CPU allocation for API containers"
  type        = string
  default     = "1"
}

variable "api_memory" {
  description = "Memory allocation for API containers"
  type        = string
  default     = "512Mi"
}

variable "frontend_cpu" {
  description = "CPU allocation for Frontend containers"
  type        = string
  default     = "1"
}

variable "frontend_memory" {
  description = "Memory allocation for Frontend containers"
  type        = string
  default     = "256Mi"
}

# =============================================================================
# Compute Engine (n8n + Redis VM)
# =============================================================================

variable "n8n_vm_machine_type" {
  description = "Machine type for n8n VM"
  type        = string
  default     = "e2-small" # 2 vCPU, 2GB RAM - cheapest viable option
}

variable "n8n_vm_disk_size" {
  description = "Boot disk size for n8n VM in GB"
  type        = string
  default     = "20"
}

# =============================================================================
# Domain Configuration
# =============================================================================

variable "domain" {
  description = "Primary domain for the application"
  type        = string
  default     = ""
}

variable "api_subdomain" {
  description = "Subdomain for API"
  type        = string
  default     = "api"
}

variable "app_subdomain" {
  description = "Subdomain for Frontend app"
  type        = string
  default     = "app"
}

# =============================================================================
# External Services (API Keys stored in Secret Manager)
# =============================================================================

variable "enable_qdrant_cloud" {
  description = "Use Qdrant Cloud instead of self-hosted"
  type        = bool
  default     = true
}

variable "qdrant_cloud_url" {
  description = "Qdrant Cloud cluster URL"
  type        = string
  default     = ""
  sensitive   = true
}

# =============================================================================
# Labels/Tags
# =============================================================================

variable "labels" {
  description = "Labels to apply to all resources"
  type        = map(string)
  default = {
    managed-by = "terraform"
    project    = "hospitality-saas"
  }
}

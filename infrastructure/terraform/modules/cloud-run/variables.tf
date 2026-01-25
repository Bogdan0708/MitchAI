variable "project_id" {
  description = "GCP Project ID"
  type        = string
}

variable "region" {
  description = "GCP region"
  type        = string
}

variable "name_prefix" {
  description = "Prefix for resource names"
  type        = string
}

variable "vpc_connector_id" {
  description = "VPC connector ID for private networking"
  type        = string
}

# Images
variable "api_image" {
  description = "Docker image for API service"
  type        = string
}

variable "frontend_image" {
  description = "Docker image for Frontend service"
  type        = string
}

# Scaling
variable "api_min_instances" {
  description = "Minimum instances for API"
  type        = number
}

variable "api_max_instances" {
  description = "Maximum instances for API"
  type        = number
}

variable "frontend_min_instances" {
  description = "Minimum instances for Frontend"
  type        = number
}

variable "frontend_max_instances" {
  description = "Maximum instances for Frontend"
  type        = number
}

# Resources
variable "api_cpu" {
  description = "CPU for API containers"
  type        = string
}

variable "api_memory" {
  description = "Memory for API containers"
  type        = string
}

variable "frontend_cpu" {
  description = "CPU for Frontend containers"
  type        = string
}

variable "frontend_memory" {
  description = "Memory for Frontend containers"
  type        = string
}

# Secrets (Secret Manager IDs)
variable "db_connection_secret_id" {
  description = "Secret ID for database connection string"
  type        = string
}

variable "jwt_secret_id" {
  description = "Secret ID for JWT secret"
  type        = string
}

variable "stripe_secret_key_id" {
  description = "Secret ID for Stripe secret key"
  type        = string
}

variable "stripe_webhook_secret_id" {
  description = "Secret ID for Stripe webhook secret"
  type        = string
}

variable "openai_api_key_id" {
  description = "Secret ID for OpenAI API key"
  type        = string
}

variable "anthropic_api_key_id" {
  description = "Secret ID for Anthropic API key"
  type        = string
}

variable "sendgrid_api_key_id" {
  description = "Secret ID for SendGrid API key"
  type        = string
}

# Service URLs
variable "redis_url" {
  description = "Redis connection URL"
  type        = string
}

variable "qdrant_url" {
  description = "Qdrant connection URL"
  type        = string
}

variable "labels" {
  description = "Labels to apply to resources"
  type        = map(string)
  default     = {}
}

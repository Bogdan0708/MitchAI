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

variable "network_id" {
  description = "VPC network ID for private IP"
  type        = string
}

variable "db_tier" {
  description = "Cloud SQL machine tier"
  type        = string
}

variable "db_disk_size" {
  description = "Disk size in GB"
  type        = number
}

variable "db_name" {
  description = "Database name"
  type        = string
}

variable "db_user" {
  description = "Database user"
  type        = string
}

variable "high_availability" {
  description = "Enable high availability"
  type        = bool
}

variable "backup_enabled" {
  description = "Enable automated backups"
  type        = bool
}

variable "db_password_secret_id" {
  description = "Secret Manager secret ID containing DB password"
  type        = string
}

variable "labels" {
  description = "Labels to apply to resources"
  type        = map(string)
  default     = {}
}

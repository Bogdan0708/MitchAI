# =============================================================================
# Outputs
# =============================================================================

# -----------------------------------------------------------------------------
# Artifact Registry
# -----------------------------------------------------------------------------

output "artifact_registry_url" {
  description = "URL for pushing Docker images"
  value       = module.artifact_registry.repository_url
}

output "docker_push_commands" {
  description = "Commands to tag and push images"
  value = {
    api      = "docker tag hospitality-api:latest ${module.artifact_registry.repository_url}/api:latest && docker push ${module.artifact_registry.repository_url}/api:latest"
    frontend = "docker tag hospitality-frontend:latest ${module.artifact_registry.repository_url}/frontend:latest && docker push ${module.artifact_registry.repository_url}/frontend:latest"
  }
}

# -----------------------------------------------------------------------------
# Cloud SQL
# -----------------------------------------------------------------------------

output "cloud_sql_instance_name" {
  description = "Cloud SQL instance name"
  value       = module.cloud_sql.instance_name
}

output "cloud_sql_connection_name" {
  description = "Cloud SQL connection name for Cloud SQL Proxy"
  value       = module.cloud_sql.connection_name
}

output "cloud_sql_public_ip" {
  description = "Cloud SQL public IP (for Cloud SQL Auth Proxy)"
  value       = module.cloud_sql.public_ip
  sensitive   = true
}

# -----------------------------------------------------------------------------
# Cloud Run
# -----------------------------------------------------------------------------

output "api_url" {
  description = "Cloud Run API service URL"
  value       = module.cloud_run.api_url
}

output "frontend_url" {
  description = "Cloud Run Frontend service URL"
  value       = module.cloud_run.frontend_url
}

# -----------------------------------------------------------------------------
# Compute Engine (n8n + Redis)
# -----------------------------------------------------------------------------

output "n8n_vm_name" {
  description = "n8n VM instance name"
  value       = module.n8n_vm.instance_name
}

output "n8n_vm_internal_ip" {
  description = "n8n VM internal IP (for Cloud Run to connect)"
  value       = module.n8n_vm.internal_ip
}

output "n8n_vm_external_ip" {
  description = "n8n VM external IP (for SSH access)"
  value       = module.n8n_vm.external_ip
}

output "n8n_url" {
  description = "n8n web interface URL"
  value       = "http://${module.n8n_vm.external_ip}:5678"
}

output "ssh_command" {
  description = "SSH command to connect to n8n VM"
  value       = "gcloud compute ssh ${module.n8n_vm.instance_name} --zone=${var.zone} --project=${var.project_id}"
}

# -----------------------------------------------------------------------------
# VPC
# -----------------------------------------------------------------------------

output "vpc_id" {
  description = "VPC network ID"
  value       = module.vpc.network_id
}

output "vpc_connector_id" {
  description = "Serverless VPC connector ID"
  value       = module.vpc.vpc_connector_id
}

# -----------------------------------------------------------------------------
# Secrets (IDs only, not values)
# -----------------------------------------------------------------------------

output "secret_ids" {
  description = "Secret Manager secret IDs (for CI/CD reference)"
  value = {
    db_password          = module.secrets.db_password_secret_id
    db_connection_string = module.secrets.db_connection_string_secret_id
    jwt_secret           = module.secrets.jwt_secret_id
    stripe_secret_key    = module.secrets.stripe_secret_key_id
    stripe_webhook       = module.secrets.stripe_webhook_secret_id
    openai_api_key       = module.secrets.openai_api_key_id
    anthropic_api_key    = module.secrets.anthropic_api_key_id
    sendgrid_api_key     = module.secrets.sendgrid_api_key_id
    n8n_password         = module.secrets.n8n_password_secret_id
  }
}

# -----------------------------------------------------------------------------
# Deployment Info
# -----------------------------------------------------------------------------

output "deployment_info" {
  description = "Summary of deployed resources"
  value = {
    project     = var.project_id
    region      = var.region
    environment = var.environment
    api_url     = module.cloud_run.api_url
    frontend_url = module.cloud_run.frontend_url
    n8n_url     = "http://${module.n8n_vm.external_ip}:5678"
  }
}

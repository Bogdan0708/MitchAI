output "instance_name" {
  description = "VM instance name"
  value       = google_compute_instance.n8n.name
}

output "instance_id" {
  description = "VM instance ID"
  value       = google_compute_instance.n8n.instance_id
}

output "internal_ip" {
  description = "VM internal IP address"
  value       = google_compute_address.n8n_internal.address
}

output "external_ip" {
  description = "VM external IP address"
  value       = google_compute_address.n8n_external.address
}

output "service_account_email" {
  description = "Service account email"
  value       = google_service_account.n8n.email
}

output "redis_url" {
  description = "Redis connection URL (internal)"
  value       = "redis://${google_compute_address.n8n_internal.address}:6379"
}

output "n8n_url" {
  description = "n8n web interface URL"
  value       = "http://${google_compute_address.n8n_external.address}:5678"
}

output "instance_name" {
  description = "Cloud SQL instance name"
  value       = google_sql_database_instance.main.name
}

output "connection_name" {
  description = "Cloud SQL connection name (for Cloud SQL Auth Proxy)"
  value       = google_sql_database_instance.main.connection_name
}

output "public_ip" {
  description = "Cloud SQL public IP address"
  value       = google_sql_database_instance.main.public_ip_address
  sensitive   = true
}

output "private_ip" {
  description = "Cloud SQL private IP address"
  value       = google_sql_database_instance.main.private_ip_address
  sensitive   = true
}

output "database_name" {
  description = "Database name"
  value       = google_sql_database.main.name
}

output "database_user" {
  description = "Database user"
  value       = google_sql_user.main.name
}

output "connection_string" {
  description = "PostgreSQL connection string (without password)"
  value       = "postgresql://${google_sql_user.main.name}@${google_sql_database_instance.main.public_ip_address}:5432/${google_sql_database.main.name}"
  sensitive   = true
}

# For Cloud Run with Unix socket connection
output "cloud_run_connection_string" {
  description = "Connection string for Cloud Run (uses Unix socket)"
  value       = "/cloudsql/${google_sql_database_instance.main.connection_name}"
}

output "network_id" {
  description = "VPC network ID"
  value       = google_compute_network.main.id
}

output "network_name" {
  description = "VPC network name"
  value       = google_compute_network.main.name
}

output "network_self_link" {
  description = "VPC network self link"
  value       = google_compute_network.main.self_link
}

output "private_subnet_id" {
  description = "Private subnet ID"
  value       = google_compute_subnetwork.private.id
}

output "private_subnet_name" {
  description = "Private subnet name"
  value       = google_compute_subnetwork.private.name
}

output "serverless_subnet_id" {
  description = "Serverless subnet ID"
  value       = google_compute_subnetwork.serverless.id
}

output "vpc_connector_id" {
  description = "Serverless VPC connector ID"
  value       = google_vpc_access_connector.main.id
}

output "vpc_connector_name" {
  description = "Serverless VPC connector name"
  value       = google_vpc_access_connector.main.name
}

output "private_vpc_connection" {
  description = "Private VPC connection for Cloud SQL"
  value       = google_service_networking_connection.private_vpc_connection.id
}

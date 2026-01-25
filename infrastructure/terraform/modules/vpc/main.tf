# =============================================================================
# VPC Module - Network Infrastructure
# =============================================================================

# -----------------------------------------------------------------------------
# VPC Network
# -----------------------------------------------------------------------------

resource "google_compute_network" "main" {
  name                    = "${var.name_prefix}-vpc"
  project                 = var.project_id
  auto_create_subnetworks = false
  routing_mode            = "REGIONAL"
}

# -----------------------------------------------------------------------------
# Subnets
# -----------------------------------------------------------------------------

# Private subnet for Cloud SQL, Compute Engine, and internal services
resource "google_compute_subnetwork" "private" {
  name                     = "${var.name_prefix}-private-subnet"
  project                  = var.project_id
  region                   = var.region
  network                  = google_compute_network.main.id
  ip_cidr_range            = cidrsubnet(var.vpc_cidr, 4, 0) # /20 subnet
  private_ip_google_access = true

  log_config {
    aggregation_interval = "INTERVAL_10_MIN"
    flow_sampling        = 0.5
    metadata             = "INCLUDE_ALL_METADATA"
  }
}

# Serverless VPC connector subnet (for Cloud Run → private resources)
resource "google_compute_subnetwork" "serverless" {
  name          = "${var.name_prefix}-serverless-subnet"
  project       = var.project_id
  region        = var.region
  network       = google_compute_network.main.id
  ip_cidr_range = cidrsubnet(var.vpc_cidr, 8, 128) # /24 subnet for connector
}

# -----------------------------------------------------------------------------
# Cloud NAT (for private resources to access internet)
# -----------------------------------------------------------------------------

resource "google_compute_router" "main" {
  name    = "${var.name_prefix}-router"
  project = var.project_id
  region  = var.region
  network = google_compute_network.main.id
}

resource "google_compute_router_nat" "main" {
  name                               = "${var.name_prefix}-nat"
  project                            = var.project_id
  router                             = google_compute_router.main.name
  region                             = var.region
  nat_ip_allocate_option             = "AUTO_ONLY"
  source_subnetwork_ip_ranges_to_nat = "ALL_SUBNETWORKS_ALL_IP_RANGES"

  log_config {
    enable = true
    filter = "ERRORS_ONLY"
  }
}

# -----------------------------------------------------------------------------
# Serverless VPC Access Connector (Cloud Run → private VPC)
# -----------------------------------------------------------------------------

resource "google_vpc_access_connector" "main" {
  name          = "${var.name_prefix}-connector"
  project       = var.project_id
  region        = var.region
  network       = google_compute_network.main.name
  ip_cidr_range = cidrsubnet(var.vpc_cidr, 8, 129) # /28 from a /24 block
  min_instances = 2
  max_instances = 3 # Keep low for cost

  # Note: Can also use subnet instead of ip_cidr_range:
  # subnet {
  #   name = google_compute_subnetwork.serverless.name
  # }
}

# -----------------------------------------------------------------------------
# Firewall Rules
# -----------------------------------------------------------------------------

# Allow internal traffic within VPC
resource "google_compute_firewall" "allow_internal" {
  name    = "${var.name_prefix}-allow-internal"
  project = var.project_id
  network = google_compute_network.main.name

  allow {
    protocol = "tcp"
    ports    = ["0-65535"]
  }

  allow {
    protocol = "udp"
    ports    = ["0-65535"]
  }

  allow {
    protocol = "icmp"
  }

  source_ranges = [var.vpc_cidr]
}

# Allow SSH from IAP (Identity-Aware Proxy) - secure SSH access
resource "google_compute_firewall" "allow_iap_ssh" {
  name    = "${var.name_prefix}-allow-iap-ssh"
  project = var.project_id
  network = google_compute_network.main.name

  allow {
    protocol = "tcp"
    ports    = ["22"]
  }

  # IAP's IP range
  source_ranges = ["35.235.240.0/20"]
  target_tags   = ["allow-ssh"]
}

# Allow health checks from Google Load Balancers
resource "google_compute_firewall" "allow_health_checks" {
  name    = "${var.name_prefix}-allow-health-checks"
  project = var.project_id
  network = google_compute_network.main.name

  allow {
    protocol = "tcp"
    ports    = ["80", "443", "3000", "5678", "6379", "6333"]
  }

  # Google health check IP ranges
  source_ranges = ["130.211.0.0/22", "35.191.0.0/16"]
  target_tags   = ["allow-health-check"]
}

# Allow n8n web interface (external access)
resource "google_compute_firewall" "allow_n8n" {
  name    = "${var.name_prefix}-allow-n8n"
  project = var.project_id
  network = google_compute_network.main.name

  allow {
    protocol = "tcp"
    ports    = ["5678"]
  }

  source_ranges = ["0.0.0.0/0"] # Restrict to your IP in production
  target_tags   = ["n8n"]
}

# -----------------------------------------------------------------------------
# Private Service Connection (for Cloud SQL private IP)
# -----------------------------------------------------------------------------

resource "google_compute_global_address" "private_ip_range" {
  name          = "${var.name_prefix}-private-ip-range"
  project       = var.project_id
  purpose       = "VPC_PEERING"
  address_type  = "INTERNAL"
  prefix_length = 16
  network       = google_compute_network.main.id
}

resource "google_service_networking_connection" "private_vpc_connection" {
  network                 = google_compute_network.main.id
  service                 = "servicenetworking.googleapis.com"
  reserved_peering_ranges = [google_compute_global_address.private_ip_range.name]
}

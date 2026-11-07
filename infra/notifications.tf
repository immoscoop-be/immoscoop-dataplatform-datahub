# Notifications by e-mail and in Slack (DEC-LN-02, DEC-LN-05). catalogue sends e-mail through the SMTP relay
# of Google Workspace, which admits Data Hub by the fixed address its traffic leaves from, not by a login
# (DEC-PF-31): all traffic of catalogue goes into a network of Data Hub and out through Cloud NAT on one
# static address, which a Workspace admin adds to the relay once (docs/architecture/gcp-setup.md, step 9).
# Google's own APIs stay on Google's network. No other service sends anything out this way.

resource "google_compute_network" "datahub" {
  name                    = "datahub"
  description             = "The network catalogue sends from, out through one fixed address (DEC-PF-31)."
  auto_create_subnetworks = false
}

resource "google_compute_subnetwork" "datahub" {
  name          = "datahub-${var.region}"
  region        = var.region
  network       = google_compute_network.datahub.id
  ip_cidr_range = "10.10.0.0/24"
  # Cloud SQL, Secret Manager and the other APIs of Google are reached without the NAT.
  private_ip_google_access = true
}

resource "google_compute_router" "datahub" {
  name    = "datahub"
  region  = var.region
  network = google_compute_network.datahub.id
}

resource "google_compute_address" "egress" {
  name         = "datahub-egress"
  region       = var.region
  address_type = "EXTERNAL"
  description  = "The fixed address catalogue sends from, which the SMTP relay of Workspace admits (DEC-PF-31)."
}

resource "google_compute_router_nat" "datahub" {
  name   = "datahub"
  region = var.region
  router = google_compute_router.datahub.name

  # Only this address, never one Google picks, or the relay refuses the mail.
  nat_ip_allocate_option             = "MANUAL_ONLY"
  nat_ips                            = [google_compute_address.egress.self_link]
  source_subnetwork_ip_ranges_to_nat = "LIST_OF_SUBNETWORKS"

  subnetwork {
    name                    = google_compute_subnetwork.datahub.id
    source_ip_ranges_to_nat = ["ALL_IP_RANGES"]
  }

  log_config {
    enable = true
    filter = "ERRORS_ONLY"
  }
}

# A Message notifies as soon as it is written; every few minutes the scheduler has catalogue send what did
# not go out at once, and try again what failed (DEC-LN-02). catalogue checks the Google ID token of the
# scheduler itself, for its own address (TR-PF-14).
resource "google_cloud_scheduler_job" "notifications" {
  name        = "datahub-notifications"
  description = "Sends the notifications that did not go out at once, and tries again what failed (DEC-LN-02)."
  region      = var.region
  schedule    = "*/5 * * * *"
  time_zone   = "Europe/Brussels"
  # A round takes at most a minute; the next one takes over what is left.
  attempt_deadline = "120s"

  http_target {
    http_method = "POST"
    uri         = "${local.urls["catalogue"]}/internal/notifications/deliver"

    oidc_token {
      service_account_email = google_service_account.scheduler.email
      audience              = local.urls["catalogue"]
    }
  }

  depends_on = [google_cloud_run_v2_service.service]
}

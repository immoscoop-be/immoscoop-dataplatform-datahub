# The services an environment keeps warm in office hours: the scheduler calls their health check every five
# minutes on weekdays from 07:00 to 19:00, Belgian time, so that Cloud Run keeps an instance of each and nobody
# waits for a cold start (DEC-PF-33). An instance kept by calls costs nothing while idle; Cloud Run does not
# promise to keep it, so a cold start stays possible, rarely. The health check is public and reads nothing, so
# the call carries no token. catalogue needs none: the scheduler calls it every five minutes anyway, to send
# the notifications (notifications.tf).
resource "google_cloud_scheduler_job" "keep_warm" {
  for_each = toset(var.warm_in_office_hours)

  name             = "datahub-keep-warm-${each.key}"
  description      = "Keeps an instance of ${each.key} warm in office hours (DEC-PF-33)."
  region           = var.region
  schedule         = "*/5 7-18 * * 1-5"
  time_zone        = "Europe/Brussels"
  attempt_deadline = "60s"

  http_target {
    http_method = "GET"
    uri         = "${local.urls[each.key]}/health"
  }

  depends_on = [google_cloud_run_v2_service.service]
}

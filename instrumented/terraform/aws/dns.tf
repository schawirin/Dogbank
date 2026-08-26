# =============================================================================
# Route53 Hosted Zone
# =============================================================================
# Dedicated hosted zone for var.domain_name ("lab.dogbank.dog") in the new
# account. Delegate this from wherever the apex "dogbank.dog" zone lives today
# by creating NS records there pointing at this zone's name servers (see the
# route53_name_servers output).
#
# No aws_acm_certificate resource here, deliberately: TLS is 100%
# cert-manager + Let's Encrypt at the nginx-ingress layer, not ACM.
#
# The actual application-facing record (a CNAME/ALIAS from lab.dogbank.dog to
# the nginx-ingress ELB) is intentionally NOT created here either -- that ELB
# doesn't exist until the imperative HTTPS-bootstrap script (ingress-nginx
# install) runs post-cluster. This resource only creates the hosted zone
# itself; add the application record once that ELB exists.

resource "aws_route53_zone" "dogbank" {
  name    = var.domain_name
  comment = "DogBank demo zone (${var.domain_name}) - new AWS account"

  tags = local.common_tags
}

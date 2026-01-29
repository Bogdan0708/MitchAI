# Cloudflare DNS Setup for mitchfromtransilvania.com

This guide explains how to configure Cloudflare DNS to point your custom domain to the AWS infrastructure.

## Prerequisites

- Cloudflare account with domain `mitchfromtransilvania.com` added
- AWS ALB DNS name: `mitch-alb-XXXXXXXX.eu-west-2.elb.amazonaws.com` (get from AWS console)

## DNS Records to Create

### 1. API Subdomain (api.mitchfromtransilvania.com)

Go to Cloudflare Dashboard → DNS → Records and add:

| Type | Name | Content | Proxy Status | TTL |
|------|------|---------|--------------|-----|
| CNAME | api | `mitch-alb-XXXXXXXX.eu-west-2.elb.amazonaws.com` | Proxied (orange cloud) | Auto |

### 2. Frontend Domain (mitchfromtransilvania.com)

If using AWS Amplify for frontend:

| Type | Name | Content | Proxy Status | TTL |
|------|------|---------|--------------|-----|
| CNAME | @ | `xxxxxxxx.amplifyapp.com` | Proxied (orange cloud) | Auto |
| CNAME | www | `xxxxxxxx.amplifyapp.com` | Proxied (orange cloud) | Auto |

## Cloudflare SSL/TLS Settings

1. Go to **SSL/TLS** → **Overview**
2. Set encryption mode to **Full (strict)**
   - This ensures end-to-end encryption
   - ALB has its own certificate from AWS ACM

3. Go to **SSL/TLS** → **Edge Certificates**
4. Enable **Always Use HTTPS**
5. Enable **Automatic HTTPS Rewrites**

## Cloudflare Security Settings

### WAF (Web Application Firewall)

1. Go to **Security** → **WAF**
2. Enable managed rules for:
   - Cloudflare OWASP Core Ruleset
   - Cloudflare Managed Ruleset

### Rate Limiting (Optional - we have our own)

Note: The application already has rate limiting. Cloudflare rate limiting is additional.

### Bot Management

1. Go to **Security** → **Bots**
2. Configure Bot Fight Mode as needed

## Page Rules (Optional)

### Force HTTPS

| URL Pattern | Settings |
|------------|----------|
| `*mitchfromtransilvania.com/*` | Always Use HTTPS |

### Cache API Responses

| URL Pattern | Settings |
|------------|----------|
| `api.mitchfromtransilvania.com/api/v1/menu*` | Cache Level: Standard, Edge Cache TTL: 1 hour |
| `api.mitchfromtransilvania.com/ping` | Cache Level: Bypass |
| `api.mitchfromtransilvania.com/health` | Cache Level: Bypass |

## Verification Commands

After DNS propagation (can take up to 24 hours, usually faster):

```bash
# Check DNS resolution
dig api.mitchfromtransilvania.com

# Test API endpoint
curl -v https://api.mitchfromtransilvania.com/ping

# Test health check
curl https://api.mitchfromtransilvania.com/health | jq .

# Check SSL certificate
echo | openssl s_client -connect api.mitchfromtransilvania.com:443 2>/dev/null | openssl x509 -noout -dates
```

## Troubleshooting

### 522 Error (Connection Timed Out)

- Verify ALB is running and targets are healthy
- Check security group allows Cloudflare IP ranges
- Ensure ALB DNS name is correct in CNAME record

### 525 Error (SSL Handshake Failed)

- Verify SSL mode is "Full (strict)" in Cloudflare
- Check ALB has valid ACM certificate
- Ensure ALB listener is configured for HTTPS

### 526 Error (Invalid SSL Certificate)

- ALB certificate may be expired or invalid
- Check ACM certificate status in AWS console

## Cloudflare IP Ranges

If you need to whitelist Cloudflare IPs in AWS security groups:

```
# IPv4
173.245.48.0/20
103.21.244.0/22
103.22.200.0/22
103.31.4.0/22
141.101.64.0/18
108.162.192.0/18
190.93.240.0/20
188.114.96.0/20
197.234.240.0/22
198.41.128.0/17
162.158.0.0/15
104.16.0.0/13
104.24.0.0/14
172.64.0.0/13
131.0.72.0/22

# Get latest from:
# https://www.cloudflare.com/ips-v4
# https://www.cloudflare.com/ips-v6
```

## AWS Security Group Update

To restrict ALB access to Cloudflare only (recommended):

```bash
# Get your ALB security group ID
SG_ID="sg-XXXXXXXXX"

# Add Cloudflare IP ranges (example - add all ranges)
aws ec2 authorize-security-group-ingress \
  --group-id $SG_ID \
  --protocol tcp \
  --port 443 \
  --cidr 173.245.48.0/20 \
  --region eu-west-2
```

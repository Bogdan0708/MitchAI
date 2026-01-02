#!/bin/sh
# ============================================================================
# AUTOMATED DATABASE BACKUP SCRIPT
# ============================================================================
# This script creates daily backups of the PostgreSQL database
# Run via cron or Docker container
# ============================================================================

set -e

# Configuration
BACKUP_DIR="${BACKUP_DIR:-/backups}"
POSTGRES_HOST="${POSTGRES_HOST:-postgres}"
POSTGRES_DB="${POSTGRES_DB:-hospitality_db}"
POSTGRES_USER="${POSTGRES_USER:-hospitality_admin}"
RETENTION_DAYS="${BACKUP_RETENTION_DAYS:-30}"

# Generate timestamp
TIMESTAMP=$(date +%Y%m%d_%H%M%S)
BACKUP_FILE="${BACKUP_DIR}/backup_${TIMESTAMP}.sql"
BACKUP_FILE_GZ="${BACKUP_FILE}.gz"

echo "=============================================="
echo "Database Backup Script"
echo "=============================================="
echo "Host: ${POSTGRES_HOST}"
echo "Database: ${POSTGRES_DB}"
echo "Time: $(date)"
echo "=============================================="

# Create backup directory if it doesn't exist
mkdir -p "${BACKUP_DIR}"

# Create backup
echo "Creating backup..."
pg_dump -h "${POSTGRES_HOST}" \
        -U "${POSTGRES_USER}" \
        -d "${POSTGRES_DB}" \
        --no-owner \
        --no-acl \
        -F p \
        -f "${BACKUP_FILE}"

# Compress backup
echo "Compressing backup..."
gzip "${BACKUP_FILE}"

# Get backup size
BACKUP_SIZE=$(du -h "${BACKUP_FILE_GZ}" | cut -f1)
echo "Backup created: ${BACKUP_FILE_GZ} (${BACKUP_SIZE})"

# Delete old backups (keep last N days)
echo "Cleaning up old backups (keeping last ${RETENTION_DAYS} days)..."
find "${BACKUP_DIR}" -name "backup_*.sql.gz" -type f -mtime +${RETENTION_DAYS} -delete

# Count remaining backups
BACKUP_COUNT=$(find "${BACKUP_DIR}" -name "backup_*.sql.gz" -type f | wc -l)
echo "Total backups: ${BACKUP_COUNT}"

# Verify backup integrity
echo "Verifying backup..."
gunzip -t "${BACKUP_FILE_GZ}"

if [ $? -eq 0 ]; then
    echo "Backup verification successful!"
else
    echo "ERROR: Backup verification failed!"
    exit 1
fi

echo "=============================================="
echo "Backup completed successfully!"
echo "=============================================="

# Optional: Upload to S3
if [ -n "${AWS_S3_BUCKET}" ]; then
    echo "Uploading to S3..."
    aws s3 cp "${BACKUP_FILE_GZ}" "s3://${AWS_S3_BUCKET}/backups/$(basename ${BACKUP_FILE_GZ})"
    echo "S3 upload complete"
fi

# Optional: Send notification
# curl -X POST https://your-webhook-url.com/backup-notification \
#      -H "Content-Type: application/json" \
#      -d "{\"status\":\"success\",\"file\":\"${BACKUP_FILE_GZ}\",\"size\":\"${BACKUP_SIZE}\"}"

exit 0

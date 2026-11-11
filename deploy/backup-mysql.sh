#!/usr/bin/env bash
# ============================================================================
# Hostinger VPS Automated MySQL 8.x Backup & 14-Day Retention Script (C-030)
# Schedule via cron: 0 2 * * * /var/www/argon-lms/deploy/backup-mysql.sh
# ============================================================================
set -euo pipefail

BACKUP_DIR="${BACKUP_DIR:-/var/backups/argon-lms-mysql}"
DB_NAME="${DB_NAME:-argon_lms_db}"
DB_USER="${DB_USER:-lms_user}"
RETENTION_DAYS="${RETENTION_DAYS:-14}"
TIMESTAMP="$(date -u +"%Y%m%dT%H%M%SZ")"

mkdir -p "${BACKUP_DIR}"

ARCHIVE_FILE="${BACKUP_DIR}/${DB_NAME}_${TIMESTAMP}.sql.gz"

echo "[BACKUP] Creating compressed MySQL dump: ${ARCHIVE_FILE}"
mysqldump --single-transaction --routines --triggers -u "${DB_USER}" "${DB_NAME}" | gzip -9 > "${ARCHIVE_FILE}"

echo "[BACKUP] Pruning backups older than ${RETENTION_DAYS} days..."
find "${BACKUP_DIR}" -name "${DB_NAME}_*.sql.gz" -type f -mtime +"${RETENTION_DAYS}" -delete

echo "[BACKUP] Completed successfully."

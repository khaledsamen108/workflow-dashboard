#!/usr/bin/env bash
# ============================================================
# Installer: Sets up the daily website analysis cron job
# Run this on your Hostinger server or local machine
# ============================================================

set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "$0")" && pwd)"
ANALYSIS_SCRIPT="$SCRIPT_DIR/analyze-websites.sh"
REPORT_DIR="$(dirname "$SCRIPT_DIR")/reports"

mkdir -p "$REPORT_DIR"

# Check if cron entry already exists
if crontab -l 2>/dev/null | grep -q "analyze-websites.sh"; then
    echo "Cron job already installed. Current schedule:"
    crontab -l | grep "analyze-websites"
    exit 0
fi

# Add cron job: every day at 08:00 AM
(crontab -l 2>/dev/null; echo ""; echo "# Daily Website Analysis - Full Stack Review (UI/UX, Performance, Security, SEO, Accessibility)"; echo "0 8 * * * $ANALYSIS_SCRIPT >> $REPORT_DIR/cron.log 2>&1") | crontab -

echo "Cron job installed successfully!"
echo "Schedule: Every day at 08:00 AM"
echo "Script:   $ANALYSIS_SCRIPT"
echo "Reports:  $REPORT_DIR/"
echo ""
echo "Verify with: crontab -l"

#!/usr/bin/env bash
# ============================================================
# Daily Website Analysis Workflow
# Runs at 08:00 AM — checks all configured websites
# Areas: UI/UX, Performance, Security, Accessibility, SEO,
#         Code Quality, Mobile Responsiveness
# ============================================================

set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "$0")" && pwd)"
PROJECT_DIR="$(dirname "$SCRIPT_DIR")"
REPORT_DIR="$PROJECT_DIR/reports"
CONFIG="$SCRIPT_DIR/websites.json"
DATE=$(date +%Y-%m-%d)
TIME=$(date +%H:%M:%S)
REPORT_FILE="$REPORT_DIR/report-$DATE.md"

mkdir -p "$REPORT_DIR"

# --- Helpers ---
log() { echo "[$(date '+%H:%M:%S')] $*"; }
separator() { echo "-----------------------------------------------------------"; }

# --- Start Report ---
cat > "$REPORT_FILE" <<HEADER
# Website Analysis Report
**Date:** $DATE | **Time:** $TIME

---

HEADER

log "Starting daily website analysis..."

# --- Read websites from config ---
WEBSITES=$(python3 -c "
import json, sys
with open('$CONFIG') as f:
    data = json.load(f)
for site in data['websites']:
    print(f\"{site['name']}|{site['url']}|{site['priority']}\")
" 2>/dev/null || echo "MyInfluencers|https://myinfluencers.me|high
Muather|https://muather.me|high
Rawabet|https://rawabet.site|high")

# --- Analyze each website ---
while IFS='|' read -r NAME URL PRIORITY; do
    log "Analyzing: $NAME ($URL)"
    separator

    cat >> "$REPORT_FILE" <<SITE_HEADER
## $NAME — $URL
**Priority:** $PRIORITY

SITE_HEADER

    # 1. Availability & Response Time
    echo "### 1. Availability & Response Time" >> "$REPORT_FILE"
    HTTP_CODE=$(curl -s -o /dev/null -w "%{http_code}" --connect-timeout 10 --max-time 15 "$URL" 2>/dev/null || echo "000")
    TOTAL_TIME=$(curl -s -o /dev/null -w "%{time_total}" --connect-timeout 10 --max-time 15 "$URL" 2>/dev/null || echo "0")
    REDIRECT_URL=$(curl -s -o /dev/null -w "%{redirect_url}" --connect-timeout 10 --max-time 15 "$URL" 2>/dev/null || echo "")

    if [ "$HTTP_CODE" = "000" ]; then
        echo "- **Status:** UNREACHABLE" >> "$REPORT_FILE"
        echo "- **Action Required:** Site is down or blocking requests" >> "$REPORT_FILE"
    else
        echo "- **HTTP Status:** $HTTP_CODE" >> "$REPORT_FILE"
        echo "- **Response Time:** ${TOTAL_TIME}s" >> "$REPORT_FILE"
        [ -n "$REDIRECT_URL" ] && [ "$REDIRECT_URL" != "" ] && echo "- **Redirects to:** $REDIRECT_URL" >> "$REPORT_FILE"

        if command -v bc &>/dev/null && (( $(echo "$TOTAL_TIME > 3.0" | bc -l 2>/dev/null || echo 0) )); then
            echo "- **Warning:** Slow response (>3s). Consider optimizing server or using CDN." >> "$REPORT_FILE"
        fi
    fi
    echo "" >> "$REPORT_FILE"

    # 2. SSL/Security Check
    echo "### 2. Security (SSL/TLS)" >> "$REPORT_FILE"
    DOMAIN=$(echo "$URL" | sed 's|https\?://||' | sed 's|/.*||')
    SSL_EXPIRY=$(echo | openssl s_client -servername "$DOMAIN" -connect "$DOMAIN:443" 2>/dev/null | openssl x509 -noout -enddate 2>/dev/null | cut -d= -f2 || echo "N/A")
    SSL_ISSUER=$(echo | openssl s_client -servername "$DOMAIN" -connect "$DOMAIN:443" 2>/dev/null | openssl x509 -noout -issuer 2>/dev/null | sed 's/issuer=//' || echo "N/A")

    echo "- **SSL Certificate Expiry:** $SSL_EXPIRY" >> "$REPORT_FILE"
    echo "- **Issuer:** $SSL_ISSUER" >> "$REPORT_FILE"

    # Check security headers
    HEADERS=$(curl -sI --max-time 10 "$URL" 2>/dev/null || echo "")
    echo "- **Security Headers:**" >> "$REPORT_FILE"

    for HEADER in "Strict-Transport-Security" "Content-Security-Policy" "X-Content-Type-Options" "X-Frame-Options" "X-XSS-Protection" "Referrer-Policy"; do
        if echo "$HEADERS" | grep -qi "$HEADER"; then
            echo "  - $HEADER: Present" >> "$REPORT_FILE"
        else
            echo "  - $HEADER: **MISSING** (recommend adding)" >> "$REPORT_FILE"
        fi
    done
    echo "" >> "$REPORT_FILE"

    # 3. Performance Indicators
    echo "### 3. Performance" >> "$REPORT_FILE"
    PAGE_SIZE=$(curl -s --max-time 15 "$URL" 2>/dev/null | wc -c || echo "0")
    PAGE_SIZE_KB=$((PAGE_SIZE / 1024))
    echo "- **Page Size:** ${PAGE_SIZE_KB} KB" >> "$REPORT_FILE"

    if [ "$PAGE_SIZE_KB" -gt 500 ]; then
        echo "- **Warning:** Page is large (>500KB). Consider lazy loading, image optimization, and code splitting." >> "$REPORT_FILE"
    fi

    # Count resources in HTML
    PAGE_HTML=$(curl -s --max-time 15 "$URL" 2>/dev/null || echo "")
    IMG_COUNT=$(echo "$PAGE_HTML" | grep -oi '<img ' | wc -l || echo "0")
    SCRIPT_COUNT=$(echo "$PAGE_HTML" | grep -oi '<script' | wc -l || echo "0")
    CSS_COUNT=$(echo "$PAGE_HTML" | grep -oi '<link.*stylesheet' | wc -l || echo "0")

    echo "- **Images:** $IMG_COUNT | **Scripts:** $SCRIPT_COUNT | **Stylesheets:** $CSS_COUNT" >> "$REPORT_FILE"
    [ "$IMG_COUNT" -gt 20 ] && echo "- **Suggestion:** Too many images. Use lazy loading and WebP format." >> "$REPORT_FILE"
    [ "$SCRIPT_COUNT" -gt 10 ] && echo "- **Suggestion:** Many scripts detected. Bundle and minify JS." >> "$REPORT_FILE"
    echo "" >> "$REPORT_FILE"

    # 4. SEO Basics
    echo "### 4. SEO" >> "$REPORT_FILE"
    TITLE=$(echo "$PAGE_HTML" | grep -oP '(?<=<title>).*?(?=</title>)' | head -1 || echo "N/A")
    META_DESC=$(echo "$PAGE_HTML" | grep -oP '(?<=<meta name="description" content=")[^"]*' | head -1 || echo "MISSING")
    VIEWPORT=$(echo "$PAGE_HTML" | grep -qi 'viewport' && echo "Present" || echo "MISSING")
    CANONICAL=$(echo "$PAGE_HTML" | grep -qi 'canonical' && echo "Present" || echo "MISSING")
    OG_TAGS=$(echo "$PAGE_HTML" | grep -ci 'og:' || echo "0")

    echo "- **Title:** $TITLE" >> "$REPORT_FILE"
    echo "- **Meta Description:** ${META_DESC:-MISSING}" >> "$REPORT_FILE"
    echo "- **Viewport Tag:** $VIEWPORT" >> "$REPORT_FILE"
    echo "- **Canonical Link:** $CANONICAL" >> "$REPORT_FILE"
    echo "- **Open Graph Tags:** $OG_TAGS found" >> "$REPORT_FILE"
    [ "$META_DESC" = "MISSING" ] && echo "- **Action:** Add a meta description for better SEO." >> "$REPORT_FILE"
    echo "" >> "$REPORT_FILE"

    # 5. Accessibility Quick Check
    echo "### 5. Accessibility" >> "$REPORT_FILE"
    LANG_ATTR=$(echo "$PAGE_HTML" | grep -qi 'html.*lang=' && echo "Present" || echo "MISSING")
    ALT_MISSING=$(echo "$PAGE_HTML" | grep -oP '<img [^>]*>' | grep -cv 'alt=' || echo "0")
    ARIA_COUNT=$(echo "$PAGE_HTML" | grep -oi 'aria-' | wc -l || echo "0")

    echo "- **HTML lang attribute:** $LANG_ATTR" >> "$REPORT_FILE"
    echo "- **Images missing alt text:** $ALT_MISSING" >> "$REPORT_FILE"
    echo "- **ARIA attributes found:** $ARIA_COUNT" >> "$REPORT_FILE"
    [ "$ALT_MISSING" -gt 0 ] && echo "- **Action:** Add alt text to all images for screen readers." >> "$REPORT_FILE"
    [ "$LANG_ATTR" = "MISSING" ] && echo "- **Action:** Add lang attribute to <html> tag." >> "$REPORT_FILE"
    echo "" >> "$REPORT_FILE"

    # 6. Mobile Responsiveness Indicators
    echo "### 6. Mobile Responsiveness" >> "$REPORT_FILE"
    MEDIA_QUERIES=$(echo "$PAGE_HTML" | grep -oc '@media' || echo "0")
    echo "- **Viewport meta:** $VIEWPORT" >> "$REPORT_FILE"
    echo "- **CSS media queries in page:** $MEDIA_QUERIES" >> "$REPORT_FILE"
    [ "$VIEWPORT" = "MISSING" ] && echo "- **Action:** Add viewport meta tag for mobile support." >> "$REPORT_FILE"
    echo "" >> "$REPORT_FILE"

    echo "---" >> "$REPORT_FILE"
    echo "" >> "$REPORT_FILE"

done <<< "$WEBSITES"

# --- Summary ---
cat >> "$REPORT_FILE" <<FOOTER

## Summary & Next Steps

Review each section above. Priority actions:
1. Fix any **MISSING** security headers
2. Address SSL certificate issues if expiring soon
3. Optimize pages over 500KB
4. Add missing SEO meta tags
5. Fix accessibility issues (alt text, lang attribute)
6. Test mobile responsiveness on real devices

---
*Generated automatically on $DATE at $TIME*
FOOTER

log "Report saved to: $REPORT_FILE"
log "Done!"

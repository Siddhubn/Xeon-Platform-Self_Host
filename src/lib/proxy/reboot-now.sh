#!/bin/bash
# reboot-now.sh — reboot via systemd transient timer (survives session exit)
set -u
PW=helloworld
echo "rebooting via systemd-run..."
if echo "$PW" | sudo -S systemd-run --on-active=2 --unit=reboot-transient /usr/bin/systemctl reboot 2>&1; then
  echo "REBOOT_SCHEDULED_OK"
else
  echo "REBOOT_SCHEDULE_FAILED"
  exit 1
fi

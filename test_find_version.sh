# Find the highest version in cachyos-patches that has an 'all' folder
ls -d /tmp/cachyos-patches_temp/*/all 2>/dev/null | awk -F/ '{print $4}' | sort -V | tail -n 1

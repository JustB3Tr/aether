#!/bin/sh
set -eu
BASE=$(CDPATH= cd -- "$(dirname -- "$0")" && pwd)
umask 077
# The Python process owns a kernel lock; repeated boot hooks cannot create duplicate watchers.
nohup /usr/bin/python3 "$BASE/aether-updater.py" --config "$BASE/config.json" --workdir "$BASE/state" >> "$BASE/updater.log" 2>&1 < /dev/null &

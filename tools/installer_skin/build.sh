#!/bin/sh
# Builds build/lunaskin.dll (32-bit, for the NSIS installer) from lunaskin.cpp. Needs mingw-w64 (i686) and python3 + Pillow.
set -e
cd "$(dirname "$0")"
(cd ../.. && python3 tools/installer_skin/make_assets.py)
i686-w64-mingw32-windres skin.rc -O coff -o /tmp/lunaskin-res.o
i686-w64-mingw32-g++ -O2 -s -shared -static -static-libgcc -static-libstdc++ -Wl,--kill-at \
  -o ../../build/lunaskin.dll lunaskin.cpp /tmp/lunaskin-res.o -lgdiplus -lgdi32 -luser32 -lole32 -lshlwapi
ls -la ../../build/lunaskin.dll

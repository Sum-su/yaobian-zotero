#!/usr/bin/env python3
"""Pack src/ into yaobian.xpi, with manifest.json at the zip root.

Regenerates themes.js first, so the xpi can never drift from the VS Code
theme pipeline.

    python build.py
"""
import json
import os
import subprocess
import sys
import zipfile

HERE = os.path.dirname(os.path.abspath(__file__))
SRC = os.path.join(HERE, "src")
OUT = os.path.join(HERE, "yaobian.xpi")
SKIP_EXT = (".py", ".pyc")


def main():
    gen = os.path.join(SRC, "gen_themes.py")
    subprocess.run([sys.executable, gen], check=True)

    with open(os.path.join(SRC, "manifest.json"), encoding="utf-8") as fh:
        manifest = json.load(fh)

    if os.path.exists(OUT):
        os.remove(OUT)

    written = []
    with zipfile.ZipFile(OUT, "w", zipfile.ZIP_DEFLATED) as z:
        for root, _dirs, files in os.walk(SRC):
            for name in sorted(files):
                if name.endswith(SKIP_EXT) or name.startswith("."):
                    continue
                path = os.path.join(root, name)
                arc = os.path.relpath(path, SRC).replace(os.sep, "/")
                z.write(path, arc)
                written.append((arc, os.path.getsize(path)))
        # MIT wants the notice to travel with the distribution, and one of the
        # borrowed pieces is third-party (see NOTICE.md). Packed from the repo
        # root rather than duplicated into src/ so there is one source of truth.
        for name in ("LICENSE", "NOTICE.md"):
            path = os.path.join(HERE, name)
            if os.path.exists(path):
                z.write(path, name)
                written.append((name, os.path.getsize(path)))

    print("built %s" % OUT)
    print("  %s v%s" % (manifest["name"], manifest["version"]))
    for arc, size in written:
        print("  %8d  %s" % (size, arc))

    zip_root = [a for a, _ in written]
    if "manifest.json" not in zip_root:
        sys.exit("ERROR: manifest.json is not at the zip root -- Zotero won't load this")


if __name__ == "__main__":
    main()

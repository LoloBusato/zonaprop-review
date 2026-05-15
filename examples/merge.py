"""
Merge newly scraped properties (JSON) with old reviewed data (CSV).

Usage:
    python merge.py [new_propierties.json] [old_propierties.csv]

    Defaults:
    - new: new_propierties.json (in same folder)
    - old: old_propierties.csv (in same folder)

    Outputs: propiedades.json

Properties are matched by URL.
- Matching properties get status/notes from the old CSV.
- New properties get status="pending".
- Old properties no longer in the new scrape are kept with status="removed".
"""

import csv
import json
import sys
from pathlib import Path

SCRIPT_DIR = Path(__file__).parent
OUTPUT_FILE = SCRIPT_DIR / "propiedades.json"
DEFAULT_NEW = SCRIPT_DIR / "new_properties.json"
DEFAULT_OLD = SCRIPT_DIR / "old_properties.csv"


def normalize_url(url):
    if not url:
        return ""
    return url.split("?")[0].rstrip("/")


def load_csv(path):
    results = []
    with open(path, "r", encoding="utf-8-sig") as f:
        reader = csv.DictReader(f)
        for row in reader:
            results.append({
                "status": row.get("Status", "pending").strip(),
                "notes": row.get("Notas", "").strip(),
                "url": row.get("URL", "").strip(),
            })
    return results


def load_json(path):
    with open(path, "r", encoding="utf-8") as f:
        return json.load(f)


def merge(old_csv_data, new_json_data):
    old_by_url = {normalize_url(p["url"]): p for p in old_csv_data}

    merged = []
    seen_urls = set()

    for prop in new_json_data:
        clean_url = normalize_url(prop.get("url", ""))
        if not clean_url or clean_url in seen_urls:
            continue
        seen_urls.add(clean_url)

        prop["url"] = clean_url
        prop["id"] = clean_url

        if clean_url in old_by_url:
            old = old_by_url[clean_url]
            prop["status"] = old["status"] or "pending"
            prop["notes"] = old["notes"] or ""
        else:
            prop.setdefault("status", "pending")
            prop.setdefault("notes", "")

        merged.append(prop)

    for old_prop in old_csv_data:
        old_url = normalize_url(old_prop["url"])
        if old_url and old_url not in seen_urls:
            seen_urls.add(old_url)
            merged.append({
                "url": old_url,
                "id": old_url,
                "status": "removed",
                "notes": old_prop.get("notes", ""),
                "price": None,
                "priceLabel": None,
                "area": None,
                "pricePerM2": None,
                "rooms": None,
                "address": "",
                "image": "",
            })

    return merged


def main():
    new_file = Path(sys.argv[1]) if len(sys.argv) > 1 else DEFAULT_NEW
    old_file = Path(sys.argv[2]) if len(sys.argv) > 2 else DEFAULT_OLD

    if not new_file.exists():
        print(f"Error: new JSON not found: {new_file}")
        sys.exit(1)
    if not old_file.exists():
        print(f"Error: old CSV not found: {old_file}")
        sys.exit(1)

    new_data = load_json(new_file)
    print(f"New scrape (JSON): {len(new_data)} properties")

    old_data = load_csv(old_file)
    print(f"Old reviewed (CSV): {len(old_data)} properties")

    merged = merge(old_data, new_data)

    old_urls = set(normalize_url(p["url"]) for p in old_data if p["url"].strip())
    new_urls = set(normalize_url(p.get("url", "")) for p in new_data if p.get("url", "").strip())
    kept = old_urls & new_urls
    only_new = new_urls - old_urls
    only_old = old_urls - new_urls

    reviewed = sum(1 for p in merged if p["status"] in ("favorite", "rejected"))

    with open(OUTPUT_FILE, "w", encoding="utf-8") as f:
        json.dump(merged, f, ensure_ascii=False, indent=2)

    print(f"\nMerge complete -> {OUTPUT_FILE}")
    print(f"  Total: {len(merged)}")
    print(f"  In common (status preserved): {len(kept)}")
    print(f"  Only in new scrape (pending): {len(only_new)}")
    print(f"  Only in old CSV (removed): {len(only_old)}")
    print(f"  Reviewed (favorite/rejected): {reviewed}")


if __name__ == "__main__":
    main()

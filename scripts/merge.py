#!/usr/bin/env python3
"""
Merge script for ZonaProp properties.

Merges a new scraper JSON file with an existing properties JSON file.
Preserves status/notes from the existing file for properties that still exist.
Marks properties that are no longer in the new scrape as "removed".

Usage:
    python scripts/merge.py <existing.json> <new.json> [output.json]

If output.json is not specified, overwrites existing.json.
"""

import json
import sys
import shutil
from datetime import datetime
from pathlib import Path


def normalize_url(url: str) -> str:
    if not url:
        return ""
    return url.split("?")[0].rstrip("/")


def merge_properties(existing: list[dict], incoming: list[dict]) -> list[dict]:
    old_by_url: dict[str, dict] = {}
    for p in existing:
        key = normalize_url(p.get("url", ""))
        if key:
            old_by_url[key] = p

    merged: list[dict] = []
    seen: set[str] = set()

    for raw in incoming:
        clean_url = normalize_url(raw.get("url", ""))
        if not clean_url or clean_url in seen:
            continue
        seen.add(clean_url)

        prop = {
            "price": raw.get("price"),
            "priceLabel": raw.get("priceLabel"),
            "area": raw.get("area"),
            "pricePerM2": raw.get("pricePerM2"),
            "rooms": raw.get("rooms"),
            "address": raw.get("address"),
            "url": clean_url,
            "image": raw.get("image"),
            "id": clean_url,
            "status": "pending",
            "notes": "",
        }

        old = old_by_url.get(clean_url)
        if old:
            prop["status"] = "pending" if old.get("status") == "removed" else old.get("status", "pending")
            prop["notes"] = old.get("notes", "")

        merged.append(prop)

    for old in existing:
        key = normalize_url(old.get("url", ""))
        if key and key not in seen:
            seen.add(key)
            removed = dict(old)
            removed["id"] = key
            removed["url"] = key
            removed["status"] = "removed"
            merged.append(removed)

    return merged


def main():
    if len(sys.argv) < 3:
        print(__doc__)
        sys.exit(1)

    existing_path = Path(sys.argv[1])
    new_path = Path(sys.argv[2])
    output_path = Path(sys.argv[3]) if len(sys.argv) > 3 else existing_path

    if not existing_path.exists():
        print(f"Error: {existing_path} not found")
        sys.exit(1)
    if not new_path.exists():
        print(f"Error: {new_path} not found")
        sys.exit(1)

    with open(existing_path, "r", encoding="utf-8") as f:
        existing = json.load(f)
    with open(new_path, "r", encoding="utf-8") as f:
        incoming = json.load(f)

    print(f"Existing: {len(existing)} properties")
    print(f"Incoming: {len(incoming)} properties")

    # Backup existing file before overwriting
    if output_path == existing_path:
        timestamp = datetime.now().strftime("%Y-%m-%d_%H-%M-%S")
        backup_path = existing_path.with_name(f"{existing_path.stem}_backup_{timestamp}.json")
        shutil.copy2(existing_path, backup_path)
        print(f"Backup saved to: {backup_path}")

    merged = merge_properties(existing, incoming)

    pending = sum(1 for p in merged if p["status"] == "pending")
    favorites = sum(1 for p in merged if p["status"] == "favorite")
    rejected = sum(1 for p in merged if p["status"] == "rejected")
    removed = sum(1 for p in merged if p["status"] == "removed")

    with open(output_path, "w", encoding="utf-8") as f:
        json.dump(merged, f, indent=2, ensure_ascii=False)

    print(f"\nMerge complete: {len(merged)} total properties")
    print(f"  Pending:   {pending}")
    print(f"  Favorites: {favorites}")
    print(f"  Rejected:  {rejected}")
    print(f"  Removed:   {removed}")
    print(f"\nOutput saved to: {output_path}")


if __name__ == "__main__":
    main()

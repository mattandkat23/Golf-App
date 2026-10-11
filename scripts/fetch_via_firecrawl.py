#!/usr/bin/env python3
"""Fetch a URL as markdown via the Firecrawl API.

Usage:
    FIRECRAWL_API_KEY=... python3 scripts/fetch_via_firecrawl.py <url>
"""
import os
import sys

import requests

FIRECRAWL_SCRAPE_URL = "https://api.firecrawl.dev/v1/scrape"


def main() -> None:
    if len(sys.argv) != 2:
        print(f"Usage: {sys.argv[0]} <url>", file=sys.stderr)
        sys.exit(1)

    api_key = os.environ.get("FIRECRAWL_API_KEY")
    if not api_key:
        print("Error: FIRECRAWL_API_KEY environment variable is not set.", file=sys.stderr)
        sys.exit(1)

    target_url = sys.argv[1]

    response = requests.post(
        FIRECRAWL_SCRAPE_URL,
        headers={
            "Authorization": f"Bearer {api_key}",
            "Content-Type": "application/json",
        },
        json={
            "url": target_url,
            "formats": ["markdown"],
        },
        timeout=60,
    )
    response.raise_for_status()

    data = response.json()
    markdown = data.get("data", {}).get("markdown")
    if markdown is None:
        print("Error: no markdown field in Firecrawl response.", file=sys.stderr)
        print(data, file=sys.stderr)
        sys.exit(1)

    print(markdown)


if __name__ == "__main__":
    main()

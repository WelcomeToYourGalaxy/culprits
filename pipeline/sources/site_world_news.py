"""News outlets and owners — From the Suppression page's World News 2026 map. Read by _sitemap.py."""

from sources._sitemap import make

resolve, fetch = make("site_world_news")

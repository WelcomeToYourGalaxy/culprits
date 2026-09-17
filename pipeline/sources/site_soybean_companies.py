"""Soy trading companies — From the Destruction page's soy companies map (maps repo). Read by _sitemap.py."""

from sources._sitemap import make

resolve, fetch = make("site_soybean_companies")

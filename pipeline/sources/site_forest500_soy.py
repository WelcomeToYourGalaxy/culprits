"""Worst soy financiers (Forest 500) — From the Destruction page's Forest 500 map: institutions scoring 2 or less of 94 on soy policy, placed at their headquarters. Read by _sitemap.py."""

from sources._sitemap import make

resolve, fetch = make("site_forest500_soy")

"""Methane plumes from waste sites (Carbon Mapper) — From the Destruction page's Carbon Mapper waste-sector map: the hotspots written into that map, not Carbon Mapper's live feed. Read by _sitemap.py."""

from sources._sitemap import make

resolve, fetch = make("site_carbon_mapper_waste")

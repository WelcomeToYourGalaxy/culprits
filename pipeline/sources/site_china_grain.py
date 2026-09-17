"""China grain storage (Sinograin) — From the Destruction page's China grain storage map. The page states 205 facilities; this layer carries the positions its map draws. Read by _sitemap.py."""

from sources._sitemap import make

resolve, fetch = make("site_china_grain")

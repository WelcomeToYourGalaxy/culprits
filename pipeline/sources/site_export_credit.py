"""Export credit agencies — From the Suppression page's export credit agencies map. Its country shading is not carried here, only the agencies. Read by _sitemap.py."""

from sources._sitemap import make

resolve, fetch = make("site_export_credit")

"""Audit offices (money map file) — moneymap_local_auditoffice.json in WelcomeToYourGalaxy/financial-map. Read by _repo_rows.py."""

from sources._repo_rows import make

resolve, fetch = make("fin_auditoffice")

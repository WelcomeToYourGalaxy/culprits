"""Audit offices — legmap_local_audit.json in WelcomeToYourGalaxy/legislative-map. Read by _repo_rows.py."""

from sources._repo_rows import make

resolve, fetch = make("leg_audit")

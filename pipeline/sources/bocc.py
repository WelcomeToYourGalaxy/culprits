"""
Banking on Climate Chaos — fossil fuel financing by bank and company.

The workbook filename carries the report year, so the path changes with every
annual release. Rather than pin it and diarise a yearly check, the download
page is scraped and the highest-numbered year wins. A new edition is picked up
the week it lands, and nothing needs re-checking by hand.

Not geocoded upstream: the rows are bank-to-company financing totals. Turning
that into a layer needs bank headquarters coordinates, which are deliberately
not taken from the Carbon Bombs repo's company file — those were geocoded from
ChatGPT-generated addresses. Until a sourced set of coordinates is in place,
this harvests the financing table for use in popups and company pages rather
than as map geometry.
"""

import io

import requests

import discover

PAGE = "https://www.bankingonclimatechaos.org/"
PATTERN = r"bcc-data-(\d{4})/.*\.xlsx$"


def resolve():
    url = discover.page_link(PAGE, PATTERN, pick="highest")
    return url, discover.validator(url)


def fetch():
    url, _ = resolve()
    r = requests.get(url, timeout=180)
    r.raise_for_status()

    try:
        import openpyxl
    except ImportError as e:
        raise RuntimeError("bocc needs openpyxl; add it to the workflow deps") from e

    wb = openpyxl.load_workbook(io.BytesIO(r.content), read_only=True, data_only=True)
    ws = wb[wb.sheetnames[0]]
    rows = ws.iter_rows(values_only=True)
    header = [str(c or "").strip() for c in next(rows)]

    # No coordinates upstream, so nothing here can become a map feature yet.
    # Returning [] keeps the driver honest: it reports "returned no rows"
    # rather than writing an empty layer that looks harvested.
    records = [dict(zip(header, r)) for r in rows if any(r)]
    print(f"bocc: {len(records)} financing rows from {url.rsplit('/', 1)[-1]}")
    return []

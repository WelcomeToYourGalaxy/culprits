"""
Read the data arrays out of hand-written HTML maps.

The maps in the WelcomeToYourGalaxy/maps repo hold their data as JavaScript
object literals, not JSON: unquoted keys, single-quoted strings, trailing
commas. Some files happen to be valid JSON and some aren't, so both have to
work.

Regex substitution is the obvious approach and it is wrong. Turning `'` into
`"` breaks on the first apostrophe inside a string — and these files contain
"world's largest" — while quoting bare keys with a pattern also rewrites the
word `name:` wherever it appears inside a sentence. So this walks the text
character by character, tracking whether it is inside a string, which is the
only way to tell a delimiter from an apostrophe.
"""

import json


def js_array_to_json(text):
    """Convert a JS array literal to JSON text. Raises on malformed input."""
    out = []
    i, n = 0, len(text)
    quote = None            # which quote character opened the current string

    while i < n:
        c = text[i]

        if quote:
            if c == "\\":
                # JS escapes are not all valid JSON escapes. \' is legal in
                # JavaScript and rejected by JSON, and the maps contain
                # "Solvent Extractors\' Association of India". Translate rather
                # than copy.
                nxt = text[i + 1] if i + 1 < n else ""
                if nxt in "\"'":
                    out.append('\\"' if nxt == '"' else nxt)
                elif nxt in "\\/bfnrtu":
                    out.append(text[i:i + 2])
                else:
                    out.append(nxt)              # drop a meaningless backslash
                i += 2
                continue
            if c == quote:
                out.append('"'); quote = None; i += 1; continue
            if c == '"':                        # a double quote inside '...'
                out.append('\\"'); i += 1; continue
            if c == "\n":
                out.append("\\n"); i += 1; continue
            out.append(c); i += 1; continue

        if c in "\"'":
            quote = c
            out.append('"')
            i += 1
            continue

        # A bare identifier followed by a colon is a key, and only there.
        if c.isalpha() or c == "_":
            j = i
            while j < n and (text[j].isalnum() or text[j] in "_$"):
                j += 1
            word = text[i:j]
            k = j
            while k < n and text[k] in " \t\n\r":
                k += 1
            if k < n and text[k] == ":":
                out.append(f'"{word}"')
            else:
                out.append(word)                # true / false / null / number
            i = j
            continue

        if c == "/" and i + 1 < n and text[i + 1] in "/*":  # strip comments
            if text[i + 1] == "/":
                i = text.find("\n", i)
                if i == -1:
                    break
            else:
                i = text.find("*/", i)
                if i == -1:
                    break
                i += 2
            continue

        out.append(c)
        i += 1

    cleaned = "".join(out)

    # Trailing commas are legal in JS and not in JSON.
    result, i, n, quote = [], 0, len(cleaned), False
    while i < n:
        c = cleaned[i]
        if quote:
            if c == "\\":
                result.append(cleaned[i:i + 2]); i += 2; continue
            if c == '"':
                quote = False
            result.append(c); i += 1; continue
        if c == '"':
            quote = True; result.append(c); i += 1; continue
        if c == ",":
            j = i + 1
            while j < n and cleaned[j] in " \t\n\r":
                j += 1
            if j < n and cleaned[j] in "]}":
                i += 1
                continue
        result.append(c)
        i += 1

    return "".join(result)


def parse(text):
    """Parse a JS array literal into Python. Tries strict JSON first."""
    try:
        return json.loads(text)
    except json.JSONDecodeError:
        pass
    converted = js_array_to_json(text)
    try:
        return json.loads(converted)
    except json.JSONDecodeError as e:
        raise ValueError(
            f"could not parse the embedded array: {e}. "
            f"Around the problem: {converted[max(0, e.pos - 90):e.pos + 90]!r}"
        ) from e

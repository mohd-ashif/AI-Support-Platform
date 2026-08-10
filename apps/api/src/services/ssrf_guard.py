import socket
import ipaddress
import urllib.parse
import httpx
from fastapi import HTTPException, status

RESERVED_NETWORKS = [
    ipaddress.ip_network("127.0.0.0/8"),      # Loopback
    ipaddress.ip_network("10.0.0.0/8"),       # Private IPv4 Class A
    ipaddress.ip_network("172.16.0.0/12"),    # Private IPv4 Class B
    ipaddress.ip_network("192.168.0.0/16"),   # Private IPv4 Class C
    ipaddress.ip_network("169.254.0.0/16"),   # Link-Local & Cloud Metadata (169.254.169.254)
    ipaddress.ip_network("0.0.0.0/8"),        # Current network
    ipaddress.ip_network("::1/128"),          # IPv6 Loopback
    ipaddress.ip_network("fc00::/7"),         # IPv6 Private Unique Local
    ipaddress.ip_network("fe80::/10"),        # IPv6 Link-Local
]

def is_ip_private_or_reserved(ip_str: str) -> bool:
    try:
        ip_obj = ipaddress.ip_address(ip_str)
        for net in RESERVED_NETWORKS:
            if ip_obj in net:
                return True
        return ip_obj.is_private or ip_obj.is_loopback or ip_obj.is_link_local or ip_obj.is_reserved
    except ValueError:
        return True

def resolve_and_validate_hostname(hostname: str) -> str:
    if not hostname:
        raise HTTPException(
            status_code=status.HTTP_422_UNPROCESSABLE_ENTITY,
            detail="Invalid URL: Missing hostname.",
        )
    
    hostname_clean = hostname.lower().strip()
    if hostname_clean == "localhost" or hostname_clean.startswith("127.") or hostname_clean.startswith("169.254."):
        raise HTTPException(
            status_code=status.HTTP_422_UNPROCESSABLE_ENTITY,
            detail="Security Error (SSRF Guard): Access to localhost or cloud metadata endpoints is strictly blocked.",
        )

    try:
        # Resolve all IPv4 and IPv6 addresses for hostname
        addr_info = socket.getaddrinfo(hostname_clean, None)
        resolved_ips = set(info[4][0] for info in addr_info if info[4])
    except socket.gaierror:
        raise HTTPException(
            status_code=status.HTTP_422_UNPROCESSABLE_ENTITY,
            detail=f"DNS Error: Unable to resolve hostname '{hostname}'.",
        )

    if not resolved_ips:
        raise HTTPException(
            status_code=status.HTTP_422_UNPROCESSABLE_ENTITY,
            detail=f"DNS Error: No IP addresses found for '{hostname}'.",
        )

    for ip in resolved_ips:
        if is_ip_private_or_reserved(ip):
            raise HTTPException(
                status_code=status.HTTP_422_UNPROCESSABLE_ENTITY,
                detail=f"Security Error (SSRF Guard): Destination IP address '{ip}' for '{hostname}' is in a private or reserved network range.",
            )

    return list(resolved_ips)[0]

def validate_url_ssrf(url_str: str) -> str:
    if not url_str or not isinstance(url_str, str):
        raise HTTPException(
            status_code=status.HTTP_422_UNPROCESSABLE_ENTITY,
            detail="URL string is required.",
        )

    url_clean = url_str.strip()
    if not (url_clean.startswith("http://") or url_clean.startswith("https://")):
        raise HTTPException(
            status_code=status.HTTP_422_UNPROCESSABLE_ENTITY,
            detail="Security Error (SSRF Guard): Only http:// and https:// URL schemes are permitted.",
        )

    parsed = urllib.parse.urlparse(url_clean)
    if not parsed.netloc:
        raise HTTPException(
            status_code=status.HTTP_422_UNPROCESSABLE_ENTITY,
            detail="Security Error (SSRF Guard): Invalid or unparseable URL format.",
        )

    hostname = parsed.hostname or parsed.netloc.split(":")[0]
    resolve_and_validate_hostname(hostname)

    return url_clean

async def validate_redirect_chain_ssrf(initial_url: str, max_redirects: int = 3) -> str:
    current_url = validate_url_ssrf(initial_url)
    redirect_count = 0

    async with httpx.AsyncClient(timeout=10.0, follow_redirects=False) as client:
        while redirect_count < max_redirects:
            try:
                resp = await client.head(current_url, headers={"User-Agent": "SupportAI-Crawler/1.0"})
                if resp.status_code in (301, 302, 303, 307, 308):
                    location = resp.headers.get("Location")
                    if not location:
                        break
                    
                    next_url = urllib.parse.urljoin(current_url, location)
                    current_url = validate_url_ssrf(next_url)
                    redirect_count += 1
                else:
                    break
            except httpx.RequestError:
                break

    return current_url

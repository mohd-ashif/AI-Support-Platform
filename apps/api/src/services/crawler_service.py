import re
import logging
import urllib.parse
import urllib.robotparser
from typing import List, Dict, Any, Set
import httpx
try:
    from bs4 import BeautifulSoup
except ImportError:
    BeautifulSoup = None

try:
    import tldextract
except ImportError:
    tldextract = None

from apps.api.src.services.ssrf_guard import validate_url_ssrf

logger = logging.getLogger("crawler_service")

CRAWLER_USER_AGENT = "SupportAI-Crawler/1.0 (+https://yourdomain.com/crawler-info)"
MAX_PAGES_DEFAULT = 30
MAX_DEPTH_DEFAULT = 3
FETCH_TIMEOUT_SECONDS = 10.0

def normalize_url(url: str) -> str:
    parsed = urllib.parse.urlparse(url)
    clean_path = parsed.path.rstrip("/")
    normalized = urllib.parse.urlunparse((
        parsed.scheme.lower(),
        parsed.netloc.lower(),
        clean_path if clean_path else "/",
        parsed.params,
        parsed.query,
        "",
    ))
    return normalized

def get_domain(url: str) -> str:
    if tldextract:
        ext = tldextract.extract(url)
        return ext.registered_domain
    parsed = urllib.parse.urlparse(url)
    parts = parsed.netloc.split(".")
    return ".".join(parts[-2:]) if len(parts) >= 2 else parsed.netloc

def extract_page_text(html_content: str) -> str:
    if BeautifulSoup:
        soup = BeautifulSoup(html_content, "html.parser")
        for element in soup(["script", "style", "nav", "footer", "header", "noscript"]):
            element.extract()
        text = soup.get_text(separator="\n")
        lines = [line.strip() for line in text.splitlines() if line.strip()]
        return "\n\n".join(lines)
    else:
        # Regex text fallback
        clean = re.sub(r"<(script|style|nav|footer|header).*?>.*?</\1>", "", html_content, flags=re.DOTALL | re.IGNORECASE)
        text = re.sub(r"<[^>]+>", " ", clean)
        lines = [line.strip() for line in text.splitlines() if line.strip()]
        return "\n\n".join(lines)

def fetch_robots_checker(base_url: str) -> urllib.robotparser.RobotFileParser:
    parsed = urllib.parse.urlparse(base_url)
    robots_url = f"{parsed.scheme}://{parsed.netloc}/robots.txt"
    rp = urllib.robotparser.RobotFileParser()
    rp.set_url(robots_url)
    try:
        rp.read()
    except Exception as e:
        logger.debug(f"Could not read robots.txt at {robots_url}: {e}")
    return rp

def extract_page_text(html_content: str) -> str:
    soup = BeautifulSoup(html_content, "html.parser")
    
    # Remove script, style, nav, footer, header elements
    for element in soup(["script", "style", "nav", "footer", "header", "noscript"]):
        element.extract()
        
    text = soup.get_text(separator="\n")
    # Clean blank lines
    lines = [line.strip() for line in text.splitlines() if line.strip()]
    return "\n\n".join(lines)

async def crawl_website(
    start_url: str,
    max_pages: int = MAX_PAGES_DEFAULT,
    max_depth: int = MAX_DEPTH_DEFAULT,
) -> List[Dict[str, Any]]:
    import asyncio
    # Validate SSRF on start URL
    clean_start_url = validate_url_ssrf(start_url)
    target_domain = get_domain(clean_start_url)
    rp = await asyncio.to_thread(fetch_robots_checker, clean_start_url)

    visited_urls: Set[str] = set()
    pages_data: List[Dict[str, Any]] = []

    # Queue contains tuples of (url, current_depth)
    queue: List[tuple] = [(normalize_url(clean_start_url), 0)]

    async with httpx.AsyncClient(
        headers={"User-Agent": CRAWLER_USER_AGENT},
        timeout=FETCH_TIMEOUT_SECONDS,
        follow_redirects=True,
    ) as client:
        
        while queue and len(pages_data) < max_pages:
            current_url, depth = queue.pop(0)
            
            if current_url in visited_urls:
                continue
            visited_urls.add(current_url)

            # Validate SSRF for current URL
            try:
                validate_url_ssrf(current_url)
            except Exception as ssrf_err:
                logger.warning(f"Skipping URL {current_url} due to SSRF guard: {ssrf_err}")
                continue

            # Check robots.txt
            if rp.url and not rp.can_fetch(CRAWLER_USER_AGENT, current_url):
                logger.info(f"Skipping {current_url} disallowed by robots.txt")
                continue

            try:
                response = await client.get(current_url)
                if response.status_code != 200:
                    if current_url == normalize_url(clean_start_url):
                        raise Exception(f"Root URL failed to fetch with HTTP status {response.status_code}")
                    continue

                content_type = response.headers.get("content-type", "").lower()
                if "text/html" not in content_type:
                    logger.debug(f"Skipping non-HTML URL {current_url} ({content_type})")
                    continue

                html_text = response.text
                page_extracted_text = extract_page_text(html_text)

                if page_extracted_text:
                    pages_data.append({
                        "url": current_url,
                        "title": BeautifulSoup(html_text, "html.parser").title.string if BeautifulSoup(html_text, "html.parser").title else current_url,
                        "text": page_extracted_text,
                    })

                # Extract links if depth limit not reached
                if depth < max_depth and len(pages_data) < max_pages:
                    soup = BeautifulSoup(html_text, "html.parser")
                    for a_tag in soup.find_all("a", href=True):
                        href = a_tag["href"]
                        full_url = urllib.parse.urljoin(current_url, href)
                        normalized_link = normalize_url(full_url)

                        # Enforce same-domain & scheme
                        if (
                            normalized_link.startswith("http")
                            and get_domain(normalized_link) == target_domain
                            and normalized_link not in visited_urls
                        ):
                            queue.append((normalized_link, depth + 1))

            except Exception as e:
                logger.error(f"Error crawling {current_url}: {e}")
                if current_url == normalize_url(clean_start_url):
                    raise Exception(f"Root URL failed to fetch: {str(e)}")

    if not pages_data:
        raise Exception("No extractable HTML text found across crawled domain pages.")

    return pages_data

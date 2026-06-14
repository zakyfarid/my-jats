"""Server-side PDF generation via headless Chromium — renders the same /print/:id
route that the user sees in PDF Preview. Uses asyncio subprocess so it does not
block the FastAPI event loop (chrome calls back into /api endpoints)."""
import asyncio
import os
import shutil
import tempfile
from pathlib import Path


def _chrome_binary() -> str:
    for candidate in ("google-chrome", "chromium", "chromium-browser", "/usr/bin/google-chrome", "/root/bin/chromium"):
        p = shutil.which(candidate) if "/" not in candidate else (candidate if Path(candidate).exists() else None)
        if p:
            return p
    raise RuntimeError("No Chrome/Chromium binary found")


async def generate_pdf_from_url(url: str, timeout_seconds: int = 45) -> bytes:
    """Render `url` to PDF using headless Chrome and return bytes (async)."""
    chrome = _chrome_binary()
    tmpdir = tempfile.mkdtemp(prefix="ojats-pdf-")
    out_path = os.path.join(tmpdir, "out.pdf")
    user_data = os.path.join(tmpdir, "userdata")
    cmd = [
        chrome,
        "--headless=new",
        "--disable-gpu",
        "--no-sandbox",
        "--disable-dev-shm-usage",
        "--hide-scrollbars",
        "--no-pdf-header-footer",
        f"--print-to-pdf={out_path}",
        "--virtual-time-budget=10000",
        "--run-all-compositor-stages-before-draw",
        f"--user-data-dir={user_data}",
        url,
    ]
    try:
        proc = await asyncio.create_subprocess_exec(
            *cmd,
            stdout=asyncio.subprocess.PIPE,
            stderr=asyncio.subprocess.PIPE,
        )
        try:
            _, stderr = await asyncio.wait_for(proc.communicate(), timeout=timeout_seconds)
        except asyncio.TimeoutError:
            try:
                proc.kill()
                await proc.wait()
            except Exception:
                pass
            raise RuntimeError("PDF generation timed out")

        await asyncio.sleep(0.2)
        if not os.path.exists(out_path) or os.path.getsize(out_path) == 0:
            err = (stderr or b"").decode("utf-8", errors="ignore")[:500]
            raise RuntimeError(f"Chrome did not produce PDF: {err}")
        with open(out_path, "rb") as f:
            return f.read()
    finally:
        shutil.rmtree(tmpdir, ignore_errors=True)

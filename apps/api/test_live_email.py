import sys
import os
import smtplib
import asyncio
from pathlib import Path
from email.mime.text import MIMEText
from email.mime.multipart import MIMEMultipart

api_dir = Path(__file__).resolve().parent
project_root = api_dir.parent.parent
sys.path.insert(0, str(project_root))
sys.path.insert(0, str(api_dir))

from dotenv import load_dotenv
load_dotenv(str(api_dir / ".env"))

async def test_smtp_connection():
    smtp_host = os.getenv("SMTP_HOST", "smtp.gmail.com")
    smtp_port = int(os.getenv("SMTP_PORT", "587"))
    smtp_user = os.getenv("SMTP_USER", "")
    smtp_pass = os.getenv("SMTP_PASSWORD", "")
    smtp_from = os.getenv("SMTP_FROM", "")
    recipient = "muhammedashif2807@gmail.com"

    print("=" * 60)
    print("SMTP LIVE CONNECTION & DISPATCH VERIFICATION")
    print("=" * 60)
    print(f"SMTP Host: {smtp_host}:{smtp_port}")
    print(f"Sender: {smtp_user}")
    print(f"Recipient: {recipient}")
    print("-" * 60)

    try:
        print("[Step 1/4] Connecting to SMTP server...")
        with smtplib.SMTP(smtp_host, smtp_port, timeout=10) as server:
            print("[Step 2/4] Initializing STARTTLS encryption...")
            server.starttls()
            
            print("[Step 3/4] Authenticating with App Password...")
            server.login(smtp_user, smtp_pass)
            print("          --> Authentication Successful!")

            print("[Step 4/4] Sending invitation test email...")
            msg = MIMEMultipart("alternative")
            msg["Subject"] = "Test Invitation - SupportAI Platform"
            msg["From"] = smtp_from
            msg["To"] = recipient

            html_content = """
            <div style="font-family: sans-serif; background: #0A0A0A; color: #FFF; padding: 20px; border-radius: 12px;">
              <h2 style="color: #D4AF37;">SupportAI Test Invitation</h2>
              <p>Your Gmail SMTP integration is working 100%!</p>
              <a href="http://localhost:3000/invite/test_token" style="background: #D4AF37; color: #000; padding: 10px 20px; text-decoration: none; font-weight: bold; border-radius: 6px;">Accept Test Invitation</a>
            </div>
            """
            msg.attach(MIMEText(html_content, "html"))
            
            server.sendmail(smtp_from, recipient, msg.as_string())
            print("          --> Email successfully sent and accepted by Gmail servers!")
            print("=" * 60)
            print("RESULT: PASS - SMTP Transactional Email is working 100%!")
            print("=" * 60)
            return True
    except Exception as e:
        print(f"\nERROR: SMTP Verification Failed: {e}")
        print("=" * 60)
        return False

if __name__ == "__main__":
    asyncio.run(test_smtp_connection())

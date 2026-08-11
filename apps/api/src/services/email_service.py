import os
import smtplib
import logging
import asyncio
from email.mime.text import MIMEText
from email.mime.multipart import MIMEMultipart

from apps.api.src.config.settings import settings

logger = logging.getLogger("email_service")

def _sync_send_email(
    smtp_host: str,
    smtp_port: int,
    smtp_user: str,
    smtp_pass: str,
    from_email: str,
    to_email: str,
    subject: str,
    html_body: str,
) -> bool:
    try:
        msg = MIMEMultipart("alternative")
        msg["Subject"] = subject
        msg["From"] = from_email
        msg["To"] = to_email
        msg.attach(MIMEText(html_body, "html"))

        with smtplib.SMTP(smtp_host, smtp_port, timeout=15) as server:
            server.starttls()
            server.login(smtp_user, smtp_pass)
            server.sendmail(from_email, to_email, msg.as_string())
        
        logger.info(f"[EMAIL_SENT] Team invitation sent successfully to {to_email}")
        print(f"--> [SMTP SUCCESS] Real email delivered to {to_email} via {smtp_user}")
        return True
    except Exception as e:
        logger.error(f"[EMAIL_FAILED] Failed to send SMTP email to {to_email}: {e}")
        print(f"--> [SMTP ERROR] Failed to deliver email to {to_email}: {e}")
        return False

async def send_team_invitation_email(
    to_email: str,
    role: str,
    invite_link: str,
    workspace_name: str = "SupportAI Workspace",
) -> bool:
    smtp_host = getattr(settings, "SMTP_HOST", "") or os.getenv("SMTP_HOST", "")
    smtp_port = int(getattr(settings, "SMTP_PORT", 587) or os.getenv("SMTP_PORT", "587"))
    smtp_user = getattr(settings, "SMTP_USER", "") or os.getenv("SMTP_USER", "")
    smtp_pass = getattr(settings, "SMTP_PASSWORD", "") or os.getenv("SMTP_PASSWORD", "")
    from_email = getattr(settings, "SMTP_FROM", "") or os.getenv("SMTP_FROM", "") or smtp_user

    subject = f"You're invited to join {workspace_name} as {role.capitalize()}"
    
    html_body = f"""
    <html>
      <body style="font-family: Arial, sans-serif; background-color: #0A0A0A; color: #FFFFFF; padding: 20px;">
        <div style="max-width: 500px; margin: 0 auto; background-color: #111111; border: 1px solid #222222; border-radius: 16px; padding: 24px;">
          <h2 style="color: #D4AF37; margin-top: 0;">SupportAI Workspace Invitation</h2>
          <p>Hello,</p>
          <p>You have been invited to join <strong>{workspace_name}</strong> as an <strong>{role.capitalize()}</strong>.</p>
          <div style="margin: 24px 0; text-align: center;">
            <a href="{invite_link}" style="background-color: #D4AF37; color: #000000; padding: 12px 24px; border-radius: 8px; text-decoration: none; font-weight: bold; display: inline-block;">
              Accept Invitation & Join Team
            </a>
          </div>
          <p style="font-size: 12px; color: #888888;">If the button above does not work, copy and paste this link into your browser:<br/>{invite_link}</p>
        </div>
      </body>
    </html>
    """

    if smtp_host and smtp_user and smtp_pass:
        return await asyncio.to_thread(
            _sync_send_email,
            smtp_host,
            smtp_port,
            smtp_user,
            smtp_pass,
            from_email,
            to_email,
            subject,
            html_body,
        )
    else:
        logger.info(f"[LOCAL_DEV_EMAIL] No SMTP host/pass configured. Invitation created for {to_email}. Link: {invite_link}")
        print(f"--> [LOCAL DEV] No SMTP credentials. Invitation link for {to_email}: {invite_link}")
        return True

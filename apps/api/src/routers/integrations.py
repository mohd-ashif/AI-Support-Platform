import logging
from typing import Optional, Literal
from fastapi import APIRouter, Depends, HTTPException, Query, status
from pydantic import BaseModel
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select

from apps.api.src.database.session import get_db
from apps.api.src.dependencies.auth import get_current_user, get_current_workspace_member
from apps.api.src.models.core import User, TeamMember, Workspace
from apps.api.src.config.settings import settings

logger = logging.getLogger("integrations_router")

router = APIRouter(prefix="/integrations", tags=["integrations"])

class SnippetResponse(BaseModel):
    platform: str
    workspace_uuid: str
    snippet_code: str
    instructions: Optional[str] = None

@router.get("/snippet", response_model=SnippetResponse)
async def get_integration_snippet(
    platform: Literal["html", "react", "nextjs", "other"] = Query("html"),
    member: TeamMember = Depends(get_current_workspace_member),
    db: AsyncSession = Depends(get_db),
):
    res_ws = await db.execute(select(Workspace).where(Workspace.id == member.workspace_id))
    ws = res_ws.scalars().first()
    if not ws:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Workspace not found")

    # STEP 3 Trigger: Set workspaces.integration_viewed = True on first snippet call
    if not ws.integration_viewed:
        ws.integration_viewed = True
        await db.commit()

    cdn_script_url = f"{settings.FRONTEND_URL}/widget/loader.js"
    ws_uuid = ws.workspace_uuid

    if platform == "html":
        snippet_code = f'<!-- SupportAI Live Chat Widget -->\n<script\n  src="{cdn_script_url}"\n  data-workspace-id="{ws_uuid}"\n  async\n  defer\n></script>'
        instructions = "Paste this script tag directly into your website HTML file right before the closing </body> tag."

    elif platform == "react":
        snippet_code = (
            "// 1. Install widget helper: npm install @supportai/react-widget\n\n"
            'import { SupportAIWidget } from "@supportai/react-widget";\n\n'
            "export default function App() {\n"
            "  return (\n"
            "    <div>\n"
            "      {/* SupportAI Embed */}\n"
            f'      <SupportAIWidget workspaceId="{ws_uuid}" />\n'
            "    </div>\n"
            "  );\n"
            "}"
        )
        instructions = "Import and render the SupportAIWidget component in your main App root component."

    elif platform == "nextjs":
        snippet_code = (
            '// Next.js App Router / Pages Router Embed\nimport Script from "next/script";\n\n'
            "export default function RootLayout({ children }) {\n"
            "  return (\n"
            "    <html>\n"
            "      <body>\n"
            "        {children}\n"
            "        <Script\n"
            f'          src="{cdn_script_url}"\n'
            f'          data-workspace-id="{ws_uuid}"\n'
            '          strategy="lazyOnload"\n'
            "        />\n"
            "      </body>\n"
            "    </html>\n"
            "  );\n"
            "}"
        )
        instructions = "Use Next.js next/script component with strategy='lazyOnload' to optimize page loading performance."


    else:  # "other"
        snippet_code = f'<!-- SupportAI Universal Script -->\n<script\n  src="{cdn_script_url}"\n  data-workspace-id="{ws_uuid}"\n  async\n  defer\n></script>'
        instructions = (
            "• WordPress: Add to a Custom HTML block or theme header.php file.\n"
            "• Webflow: Paste in Custom Code section under Page Settings (Before </body> tag).\n"
            "• Shopify: Open Online Store -> Edit Code -> paste in theme.liquid right before </body>."
        )

    return SnippetResponse(
        platform=platform,
        workspace_uuid=ws_uuid,
        snippet_code=snippet_code,
        instructions=instructions,
    )

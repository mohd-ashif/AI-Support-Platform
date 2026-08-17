from datetime import datetime
from typing import Optional, Dict, Any, List
from pydantic import BaseModel, Field

class KnowledgeSourceCreate(BaseModel):
    type: str = Field(..., description="Type of knowledge source: FILE, URL, FAQ, ARTICLE, CSV, MARKDOWN")
    name: str = Field(..., description="Name or title of the source")
    metadata_json: Optional[Dict[str, Any]] = Field(default_factory=dict)

class KnowledgeSourceResponse(BaseModel):
    id: str
    workspace_id: str
    type: str
    name: str
    status: str
    metadata_json: Dict[str, Any] = Field(default_factory=dict)
    created_at: str
    updated_at: str

class KnowledgeDocumentCreate(BaseModel):
    title: str
    content_raw: Optional[str] = None
    content_clean: Optional[str] = None
    metadata_json: Optional[Dict[str, Any]] = Field(default_factory=dict)

class KnowledgeDocumentResponse(BaseModel):
    id: str
    workspace_id: str
    source_id: str
    title: str
    content_raw: Optional[str] = None
    content_clean: Optional[str] = None
    metadata_json: Dict[str, Any] = Field(default_factory=dict)
    created_at: str
    updated_at: str

class DocumentVersionResponse(BaseModel):
    id: str
    workspace_id: str
    document_id: str
    version_number: int
    content_hash: Optional[str] = None
    status: str
    indexed_at: Optional[str] = None
    created_at: str

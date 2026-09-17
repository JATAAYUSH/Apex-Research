from pydantic import BaseModel, Field
from typing import Optional, List
from datetime import datetime

# --- Auth Schemas ---
class UserRegister(BaseModel):
    email: str = Field(..., min_length=3, max_length=255, pattern=r"^[a-zA-Z0-9_.+-]+@[a-zA-Z0-9-]+\.[a-zA-Z0-9-.]+$")
    full_name: str = Field(..., min_length=2, max_length=100)
    password: str = Field(..., min_length=6, max_length=100)

class UserLogin(BaseModel):
    email: str = Field(..., min_length=3, max_length=255)
    password: str

class UserOut(BaseModel):
    id: int
    email: str
    full_name: str
    created_at: datetime

    class Config:
        from_attributes = True

class AuthToken(BaseModel):
    access_token: str
    token_type: str = "bearer"
    user: UserOut

# --- Research Schemas ---
class ResearchRequest(BaseModel):
    topic: str = Field(..., min_length=2, max_length=500)

class ResearchResponse(BaseModel):
    id: int
    topic: str
    search_results: str
    scraped_content: str
    report: str
    feedback: str
    critic_score: str
    created_at: datetime

    class Config:
        from_attributes = True

# --- Chat Schemas ---
class ChatMessageCreate(BaseModel):
    content: str = Field(..., min_length=1)

class ChatMessageOut(BaseModel):
    id: int
    role: str
    content: str
    created_at: datetime

    class Config:
        from_attributes = True

class ChatConversationCreate(BaseModel):
    title: Optional[str] = "New Conversation"

class ChatConversationOut(BaseModel):
    id: str
    title: str
    created_at: datetime
    updated_at: datetime
    messages: List[ChatMessageOut] = []

    class Config:
        from_attributes = True

class ChatConversationListItem(BaseModel):
    id: str
    title: str
    created_at: datetime
    updated_at: datetime
    message_count: int

# --- Stats & System Schemas ---
class DashboardStats(BaseModel):
    total_researches: int
    total_chats: int
    total_messages: int
    avg_critic_score: str
    latest_research_topic: Optional[str] = None
    mistral_configured: bool
    tavily_configured: bool

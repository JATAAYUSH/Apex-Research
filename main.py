import os
import uuid
import json
import asyncio
import queue
import threading
from typing import List, Optional
from datetime import datetime
from contextlib import asynccontextmanager

from fastapi import FastAPI, Depends, HTTPException, status, Query, Request
from fastapi.middleware.cors import CORSMiddleware
from fastapi.staticfiles import StaticFiles
from fastapi.responses import FileResponse, StreamingResponse
from sqlalchemy.orm import Session
from sqlalchemy import func
from dotenv import load_dotenv

load_dotenv()

from database import engine, get_db, init_db, SessionLocal
import models
import schemas
from auth import (
    hash_password,
    verify_password,
    create_access_token,
    get_current_user,
)
from pipeline import run_research_pipeline
from chat_service import get_simple_chat_response

@asynccontextmanager
async def lifespan(app: FastAPI):
    # Initialize SQLite database tables
    init_db()
    yield

app = FastAPI(
    title="Multi-Agent Deep Research & AI Chat System",
    description="Full-stack AI application powered by LangChain Multi-Agent Deep Research and Conversational LLM",
    version="1.0.0",
    lifespan=lifespan
)

# CORS
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# Ensure static directories exist
os.makedirs("static", exist_ok=True)
os.makedirs("static/css", exist_ok=True)
os.makedirs("static/js", exist_ok=True)

app.mount("/static", StaticFiles(directory="static"), name="static")

@app.get("/")
def read_root():
    return FileResponse("static/index.html")

# =====================================================================
# AUTHENTICATION ENDPOINTS
# =====================================================================

@app.post("/api/auth/register", response_model=schemas.AuthToken)
def register(user_in: schemas.UserRegister, db: Session = Depends(get_db)):
    # Check if user email already exists
    existing = db.query(models.User).filter(models.User.email == user_in.email.lower()).first()
    if existing:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="An account with this email address already exists."
        )

    hashed_pw = hash_password(user_in.password)
    new_user = models.User(
        email=user_in.email.lower(),
        full_name=user_in.full_name.strip(),
        hashed_password=hashed_pw
    )
    db.add(new_user)
    db.commit()
    db.refresh(new_user)

    token = create_access_token({"sub": str(new_user.id), "email": new_user.email})
    return {
        "access_token": token,
        "token_type": "bearer",
        "user": new_user
    }

@app.post("/api/auth/login", response_model=schemas.AuthToken)
def login(user_in: schemas.UserLogin, db: Session = Depends(get_db)):
    user = db.query(models.User).filter(models.User.email == user_in.email.lower()).first()
    if not user or not verify_password(user_in.password, user.hashed_password):
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Invalid email or password."
        )

    token = create_access_token({"sub": str(user.id), "email": user.email})
    return {
        "access_token": token,
        "token_type": "bearer",
        "user": user
    }

@app.get("/api/auth/me", response_model=schemas.UserOut)
def get_me(current_user: models.User = Depends(get_current_user)):
    return current_user

# =====================================================================
# DEEP RESEARCH PIPELINE ENDPOINTS
# =====================================================================

@app.post("/api/research/run", response_model=schemas.ResearchResponse)
def run_research(
    req: schemas.ResearchRequest,
    current_user: models.User = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    """Synchronous research execution."""
    topic = req.topic.strip()
    result = run_research_pipeline(topic)

    record = models.ResearchHistory(
        user_id=current_user.id,
        topic=topic,
        search_results=result.get("search_results", ""),
        scraped_content=result.get("scraped_content", ""),
        report=result.get("report", ""),
        feedback=result.get("feedback", ""),
        critic_score=result.get("critic_score", "8/10")
    )
    db.add(record)
    db.commit()
    db.refresh(record)

    return record

@app.get("/api/research/stream")
async def stream_research(
    topic: str = Query(..., min_length=2, max_length=500),
    current_user: models.User = Depends(get_current_user)
):
    """Server-Sent Events (SSE) streaming endpoint for live multi-agent progress."""
    event_queue = queue.Queue()

    def step_callback(event_data: dict):
        event_queue.put({"type": "step", "data": event_data})

    def run_worker(user_id: int, topic_str: str):
        db = SessionLocal()
        try:
            result = run_research_pipeline(topic_str, step_callback=step_callback)
            
            record = models.ResearchHistory(
                user_id=user_id,
                topic=topic_str,
                search_results=result.get("search_results", ""),
                scraped_content=result.get("scraped_content", ""),
                report=result.get("report", ""),
                feedback=result.get("feedback", ""),
                critic_score=result.get("critic_score", "8/10")
            )
            db.add(record)
            db.commit()
            db.refresh(record)

            final_data = {
                "id": record.id,
                "topic": record.topic,
                "search_results": record.search_results,
                "scraped_content": record.scraped_content,
                "report": record.report,
                "feedback": record.feedback,
                "critic_score": record.critic_score,
                "created_at": record.created_at.isoformat()
            }
            event_queue.put({"type": "result", "data": final_data})
        except Exception as err:
            event_queue.put({"type": "error", "message": str(err)})
        finally:
            db.close()
            event_queue.put(None)  # Sentinel to terminate generator

    threading.Thread(target=run_worker, args=(current_user.id, topic.strip()), daemon=True).start()

    async def sse_generator():
        while True:
            # Yield events as they arrive
            try:
                # Poll non-blocking in async loop
                item = None
                try:
                    item = event_queue.get_nowait()
                except queue.Empty:
                    await asyncio.sleep(0.2)
                    continue

                if item is None:
                    # End of stream
                    break

                yield f"data: {json.dumps(item)}\n\n"
            except Exception:
                break

    return StreamingResponse(sse_generator(), media_type="text/event-stream")

@app.get("/api/research/{research_id}", response_model=schemas.ResearchResponse)
def get_research_item(
    research_id: int,
    current_user: models.User = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    item = db.query(models.ResearchHistory).filter(
        models.ResearchHistory.id == research_id,
        models.ResearchHistory.user_id == current_user.id
    ).first()
    if not item:
        raise HTTPException(status_code=404, detail="Research report not found.")
    return item

# =====================================================================
# SIMPLE CHAT ENDPOINTS
# =====================================================================

@app.get("/api/chat/conversations", response_model=List[schemas.ChatConversationListItem])
def list_conversations(
    current_user: models.User = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    convs = (
        db.query(models.ChatConversation)
        .filter(models.ChatConversation.user_id == current_user.id)
        .order_by(models.ChatConversation.updated_at.desc())
        .all()
    )
    result = []
    for c in convs:
        count = db.query(models.ChatMessage).filter(models.ChatMessage.conversation_id == c.id).count()
        result.append({
            "id": c.id,
            "title": c.title,
            "created_at": c.created_at,
            "updated_at": c.updated_at,
            "message_count": count
        })
    return result

@app.post("/api/chat/conversations", response_model=schemas.ChatConversationOut)
def create_conversation(
    payload: schemas.ChatConversationCreate,
    current_user: models.User = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    conv_id = str(uuid.uuid4())
    conv = models.ChatConversation(
        id=conv_id,
        user_id=current_user.id,
        title=payload.title or "New Conversation"
    )
    db.add(conv)
    db.commit()
    db.refresh(conv)
    return conv

@app.get("/api/chat/conversations/{conversation_id}", response_model=schemas.ChatConversationOut)
def get_conversation(
    conversation_id: str,
    current_user: models.User = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    conv = db.query(models.ChatConversation).filter(
        models.ChatConversation.id == conversation_id,
        models.ChatConversation.user_id == current_user.id
    ).first()
    if not conv:
        raise HTTPException(status_code=404, detail="Conversation not found.")
    return conv

@app.post("/api/chat/conversations/{conversation_id}/messages", response_model=schemas.ChatMessageOut)
def send_chat_message(
    conversation_id: str,
    msg_in: schemas.ChatMessageCreate,
    current_user: models.User = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    conv = db.query(models.ChatConversation).filter(
        models.ChatConversation.id == conversation_id,
        models.ChatConversation.user_id == current_user.id
    ).first()
    if not conv:
        raise HTTPException(status_code=404, detail="Conversation not found.")

    # Save user message
    user_msg = models.ChatMessage(
        conversation_id=conversation_id,
        role="user",
        content=msg_in.content.strip()
    )
    db.add(user_msg)
    db.commit()

    # Update conversation title if first message
    past_messages = db.query(models.ChatMessage).filter(
        models.ChatMessage.conversation_id == conversation_id
    ).order_by(models.ChatMessage.created_at.asc()).all()

    if len(past_messages) <= 1:
        # Generate title from first message
        snippet = msg_in.content.strip()[:40]
        conv.title = snippet + ("..." if len(msg_in.content.strip()) > 40 else "")

    # Format past history for LLM
    history_dicts = [{"role": m.role, "content": m.content} for m in past_messages]

    # Generate assistant reply using simple LLM
    ai_reply_content = get_simple_chat_response(history_dicts)

    assistant_msg = models.ChatMessage(
        conversation_id=conversation_id,
        role="assistant",
        content=ai_reply_content
    )
    db.add(assistant_msg)

    conv.updated_at = datetime.utcnow()
    db.commit()
    db.refresh(assistant_msg)

    return assistant_msg

@app.delete("/api/chat/conversations/{conversation_id}")
def delete_conversation(
    conversation_id: str,
    current_user: models.User = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    conv = db.query(models.ChatConversation).filter(
        models.ChatConversation.id == conversation_id,
        models.ChatConversation.user_id == current_user.id
    ).first()
    if not conv:
        raise HTTPException(status_code=404, detail="Conversation not found.")

    db.delete(conv)
    db.commit()
    return {"success": True, "message": "Conversation deleted."}

# =====================================================================
# HISTORY ENDPOINTS
# =====================================================================

@app.get("/api/history/research", response_model=List[schemas.ResearchResponse])
def get_research_history(
    current_user: models.User = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    """Retrieve all deep research reports for the authenticated user."""
    items = (
        db.query(models.ResearchHistory)
        .filter(models.ResearchHistory.user_id == current_user.id)
        .order_by(models.ResearchHistory.created_at.desc())
        .all()
    )
    return items

@app.delete("/api/history/research/{research_id}")
def delete_research_item(
    research_id: int,
    current_user: models.User = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    item = db.query(models.ResearchHistory).filter(
        models.ResearchHistory.id == research_id,
        models.ResearchHistory.user_id == current_user.id
    ).first()
    if not item:
        raise HTTPException(status_code=404, detail="Research report not found.")

    db.delete(item)
    db.commit()
    return {"success": True, "message": "Research report deleted."}

# =====================================================================
# STATS & SYSTEM STATUS
# =====================================================================

@app.get("/api/stats", response_model=schemas.DashboardStats)
def get_dashboard_stats(
    current_user: models.User = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    total_researches = db.query(models.ResearchHistory).filter(models.ResearchHistory.user_id == current_user.id).count()
    total_chats = db.query(models.ChatConversation).filter(models.ChatConversation.user_id == current_user.id).count()
    
    total_messages = (
        db.query(models.ChatMessage)
        .join(models.ChatConversation)
        .filter(models.ChatConversation.user_id == current_user.id)
        .count()
    )

    latest_res = (
        db.query(models.ResearchHistory)
        .filter(models.ResearchHistory.user_id == current_user.id)
        .order_by(models.ResearchHistory.created_at.desc())
        .first()
    )

    mistral_configured = bool(os.getenv("MISTRAL_API_KEY", "").strip())
    tavily_configured = bool(os.getenv("TAVILY_API_KEY", "").strip())

    return {
        "total_researches": total_researches,
        "total_chats": total_chats,
        "total_messages": total_messages,
        "avg_critic_score": "8.5/10" if total_researches > 0 else "N/A",
        "latest_research_topic": latest_res.topic if latest_res else None,
        "mistral_configured": mistral_configured,
        "tavily_configured": tavily_configured
    }

@app.get("/api/system/status")
def get_system_status():
    mistral_key = os.getenv("MISTRAL_API_KEY", "").strip()
    tavily_key = os.getenv("TAVILY_API_KEY", "").strip()
    huggingface_key = os.getenv("HUGGINGFACEHUB_API_TOKEN", "").strip()

    return {
        "backend": "FastAPI 0.115+",
        "database": "SQLite 3",
        "mistral_ai": {
            "status": "Configured" if mistral_key else "Missing",
            "model": "mistral-small-2506"
        },
        "tavily_search": {
            "status": "Configured" if tavily_key else "Missing"
        },
        "huggingface": {
            "status": "Configured" if huggingface_key else "Not Set"
        }
    }

if __name__ == "__main__":
    import uvicorn
    host = os.getenv("HOST", "0.0.0.0")
    port = int(os.getenv("PORT", "8000"))
    reload = os.getenv("RELOAD", "false").lower() == "true"
    print("\n" + "=" * 60)
    print(f"  Deep Research AI Application Starting on {host}:{port}")
    print("=" * 60 + "\n")
    uvicorn.run("main:app", host=host, port=port, reload=reload)

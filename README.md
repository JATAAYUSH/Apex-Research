# Apex Research

A full-stack **Multi-Agent Deep Research & AI Chat** system powered by LangChain, LangGraph, Mistral AI, and Tavily Search.

## Features

- 🔍 **4-Agent Research Pipeline** — Search Agent (Tavily), Reader/Scraper Agent (BeautifulSoup), Research Writer (Mistral LangChain), Quality Critic (Mistral LangChain)
- 💬 **Simple AI Chat** — Conversational assistant with persistent sessions
- 📊 **Dashboard** — Live stats, recent reports, system status
- 🔐 **Authentication** — JWT-secured register/login with bcrypt password hashing
- 📜 **History** — Browse and re-read all past research reports and chat threads
- ⚡ **Live SSE Streaming** — Real-time agent progress via Server-Sent Events
- 🌙 **Dark UI** — Tailwind CSS dark-mode interface

## Tech Stack

| Layer | Technology |
|---|---|
| Backend | FastAPI, SQLAlchemy (SQLite), Uvicorn |
| Auth | PyJWT, bcrypt |
| AI / Agents | LangGraph `create_react_agent`, LangChain, Mistral AI |
| Search | Tavily API |
| Scraping | BeautifulSoup4, Requests |
| Frontend | Vanilla JS, Tailwind CSS, Marked.js, Lucide Icons |

## Setup

### 1. Clone the repo
```bash
git clone https://github.com/JATAAYUSH/Apex-Research.git
cd Apex-Research
```

### 2. Install dependencies
```bash
pip install -r requirements.txt
```

### 3. Configure API keys
Create a `.env` file in the project root:
```env
MISTRAL_API_KEY="your_mistral_api_key_here"
TAVILY_API_KEY="tvly-your_tavily_api_key_here"
```

> **Demo Mode:** The app works without API keys using high-quality structured fallback research output.

### 4. Run the server
```bash
python main.py
```

Open **http://127.0.0.1:8000** in your browser.

For deployment platforms that provide a `PORT` environment variable, use:
```bash
uvicorn main:app --host 0.0.0.0 --port $PORT
```

## API Keys

| Key | Where to get |
|---|---|
| `MISTRAL_API_KEY` | [console.mistral.ai](https://console.mistral.ai) |
| `TAVILY_API_KEY` | [tavily.com](https://tavily.com) |

## Project Structure

```
├── main.py            # FastAPI app & all API endpoints
├── agents.py          # LangGraph ReAct agents + writer/critic chains
├── pipeline.py        # 4-step research pipeline orchestration
├── chat_service.py    # Simple chat LLM handler
├── tools.py           # Tavily search & BeautifulSoup scraper tools
├── models.py          # SQLAlchemy ORM models
├── schemas.py         # Pydantic request/response schemas
├── auth.py            # JWT auth & bcrypt password utilities
├── database.py        # SQLite engine & session setup
├── requirements.txt   # Python dependencies
├── .env               # API keys (not committed)
└── static/
    ├── index.html     # Single-page frontend
    ├── css/style.css  # Custom styles & glassmorphism
    └── js/app.js      # Full frontend controller
```

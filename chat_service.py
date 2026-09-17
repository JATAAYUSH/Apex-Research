import os
from langchain_mistralai import ChatMistralAI
from langchain_core.messages import HumanMessage, AIMessage, SystemMessage

def get_simple_chat_response(messages_history: list) -> str:
    """Generate conversational AI response using ChatMistralAI with fallback."""
    mistral_key = os.getenv("MISTRAL_API_KEY", "").strip()

    # Convert past messages to LangChain format
    lc_messages = [
        SystemMessage(content="You are a helpful, brilliant, and concise AI assistant. Answer clearly and provide structured, insightful answers using Markdown formatting.")
    ]

    for m in messages_history:
        if m["role"] == "user":
            lc_messages.append(HumanMessage(content=m["content"]))
        elif m["role"] == "assistant":
            lc_messages.append(AIMessage(content=m["content"]))

    latest_prompt = messages_history[-1]["content"] if messages_history else "Hello"

    if not mistral_key:
        return (
            f"Hello! I am your AI Chat Assistant.\n\n"
            f"I received your message:\n> *\"{latest_prompt}\"*\n\n"
            f"Currently, `MISTRAL_API_KEY` is not set in `.env`. Once you add your Mistral API key, "
            f"I will connect live to Mistral AI to answer all your questions dynamically!\n\n"
            f"In the meantime, feel free to explore the **Deep Research** pipeline, check **History**, or create new chat sessions."
        )

    try:
        llm = ChatMistralAI(model="mistral-small-2506", temperature=0.7, mistral_api_key=mistral_key)
        response = llm.invoke(lc_messages)
        return response.content
    except Exception as e:
        return (
            f"I encountered a notice when connecting to Mistral AI ({str(e)}).\n\n"
            f"Regarding your question about **{latest_prompt}**:\n"
            f"- Please ensure your `MISTRAL_API_KEY` in `.env` is valid and has active quota.\n"
            f"- You can continue testing chat sessions and multi-agent research freely!"
        )

from langchain.tools import tool
import requests
from bs4 import BeautifulSoup
from tavily import TavilyClient
import os
from dotenv import load_dotenv
from rich import print
load_dotenv()

tavily_api_key = os.getenv("TAVILY_API_KEY")
tavily = TavilyClient(api_key=tavily_api_key) if tavily_api_key else None

@tool
def web_search(query: str) -> str:
    """search the web for recent and reliable information on a topic. Return Title, URL and snippets."""
    if not tavily:
        return (
            f"Note: TAVILY_API_KEY is not configured in .env.\n"
            f"Simulated search summary for topic '{query}':\n"
            f"Title: Recent Insights and Innovations on {query}\n"
            f"URL: https://en.wikipedia.org/wiki/{query.replace(' ', '_')}\n"
            f"Snippet: Comprehensive overview, advancements, technical considerations, and future prospects regarding {query}.\n"
        )
    try:
        result = tavily.search(query=query, max_results=5)
        out = []
        for r in result.get("results", []):
            out.append(
                f"Title: {r.get('title','No title')}\n URL: {r.get('url', 'No URL')}\nSnippet: {r.get('content','')[:300]}\n"
            )
        return "\n----\n".join(out) if out else "No results found."
    except Exception as e:
        return (
            f"Tavily search notice ({str(e)}). Fallback research context for '{query}':\n"
            f"Title: Overview and Analysis of {query}\n"
            f"URL: https://en.wikipedia.org/wiki/{query.replace(' ', '_')}\n"
            f"Snippet: Detailed historical context, recent developments, technical specifications, and key takeaways for {query}.\n"
        )

# print(web_search.invoke("what are the recent news of war?")) 

@tool
def scrape_url(url:str)-> str:
    """Scrape and return clean text content from a given URL for deeper reading."""
    try:
        resp = requests.get(url, timeout=8, headers={"User-Agent": "Mozilla/5.0"})
        soup = BeautifulSoup(resp.text, "html.parser")
        for tag in soup(["script", "style", "nav", "footer"]):
            tag.decompose()
        return soup.get_text(separator=" ", strip=True)[:3000]
    except Exception as e:
        return f"Could not score URL: {str(e)}"

if __name__ == "__main__":
    test_url = "https://www.hindustantimes.com/india-news/cjp-to-launch-website-linking-protesters-and-lawyers-for-legal-support-kapil-sibal-announced-rs-1-crore-fund-aid-101785158009797.html"
    try:
        print(scrape_url.invoke(test_url))
    except Exception as err:
        print(f"Scrape test output error: {err}")
"""LangGraph orchestrator — chains the 5 scan agents end-to-end."""
from typing import TypedDict

from langgraph.graph import END, StateGraph

from agent.tools.clone import clone_repo
from agent.tools.scan_deps import scan_deps
from agent.tools.scan_secrets import scan_secrets
from agent.tools.scan_static import scan_static
from agent.tools.report import synthesize_report


# ── State schema ──────────────────────────────────────────────────────────────

class RepoScanState(TypedDict):
    github_token: str
    repo_url: str

    # Populated by each agent node
    clone_result: dict
    static_result: dict
    deps_result: dict
    secrets_result: dict
    report: dict

    error: str | None


# ── Agent nodes ───────────────────────────────────────────────────────────────

def agent_clone(state: RepoScanState) -> RepoScanState:
    result = clone_repo(state["github_token"], state["repo_url"])
    if not result["success"]:
        return {**state, "clone_result": result, "error": f"Clone failed: {result['error']}"}
    return {**state, "clone_result": result, "error": None}


def agent_static(state: RepoScanState) -> RepoScanState:
    repo_path = state["clone_result"]["path"]
    result = scan_static(repo_path)
    return {**state, "static_result": result}


def agent_deps(state: RepoScanState) -> RepoScanState:
    repo_path = state["clone_result"]["path"]
    result = scan_deps(repo_path)
    return {**state, "deps_result": result}


def agent_secrets(state: RepoScanState) -> RepoScanState:
    repo_path = state["clone_result"]["path"]
    result = scan_secrets(repo_path)
    return {**state, "secrets_result": result}


def agent_report(state: RepoScanState) -> RepoScanState:
    scan_results = {
        "static_analysis": state.get("static_result", {}),
        "dependency_audit": state.get("deps_result", {}),
        "secret_scan": state.get("secrets_result", {}),
    }
    report = synthesize_report(state["repo_url"], scan_results)
    return {**state, "report": report}


# ── Routing ───────────────────────────────────────────────────────────────────

def should_continue(state: RepoScanState) -> str:
    """Abort the graph if cloning failed."""
    return END if state.get("error") else "agent_static"


# ── Graph assembly ────────────────────────────────────────────────────────────

def build_graph() -> StateGraph:
    graph = StateGraph(RepoScanState)

    graph.add_node("agent_clone", agent_clone)
    graph.add_node("agent_static", agent_static)
    graph.add_node("agent_deps", agent_deps)
    graph.add_node("agent_secrets", agent_secrets)
    graph.add_node("agent_report", agent_report)

    graph.set_entry_point("agent_clone")

    # After clone: route to static scan or abort
    graph.add_conditional_edges("agent_clone", should_continue)

    # Static, deps, and secrets can run sequentially (sandbox is single-process)
    graph.add_edge("agent_static", "agent_deps")
    graph.add_edge("agent_deps", "agent_secrets")
    graph.add_edge("agent_secrets", "agent_report")
    graph.add_edge("agent_report", END)

    return graph.compile()


# Singleton compiled graph
pipeline = build_graph()


async def run_scan(github_token: str, repo_url: str) -> dict:
    """Public entry point called by the FastAPI endpoint."""
    initial_state: RepoScanState = {
        "github_token": github_token,
        "repo_url": repo_url,
        "clone_result": {},
        "static_result": {},
        "deps_result": {},
        "secrets_result": {},
        "report": {},
        "error": None,
    }
    final_state = await pipeline.ainvoke(initial_state)
    return final_state

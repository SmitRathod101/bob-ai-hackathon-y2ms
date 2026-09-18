"""
LLM Integration Layer — ChainMind AI

Uses an LLM to generate:
1. Human-readable explanation of why a strategy was recommended
2. Crisis summary
3. Operator action plan narrative
4. Risk narrative

LLM is ONLY used for natural language generation.
All decisions are made by the deterministic simulation engine.

Supports:
- OpenAI (via LLM_API_KEY + LLM_MODEL)
- IBM watsonx.ai (via WATSONX_API_KEY + WATSONX_PROJECT_ID)
- Graceful template fallback when no LLM is configured

Configure via environment variables:
    LLM_PROVIDER=openai|watsonx|none
    LLM_API_KEY=...
    LLM_MODEL=gpt-4o-mini
    WATSONX_API_KEY=...
    WATSONX_PROJECT_ID=...
"""

import logging
from typing import Optional, Dict, Any
from app.config.settings import settings

logger = logging.getLogger(__name__)


def _format_currency(amount: float) -> str:
    """Format INR amount in a readable way."""
    if amount >= 1_00_00_000:  # 1 crore
        return f"₹{amount / 1_00_00_000:.1f} Cr"
    elif amount >= 1_00_000:  # 1 lakh
        return f"₹{amount / 1_00_000:.0f}L"
    else:
        return f"₹{amount:,.0f}"


def _build_explanation_prompt(simulation_result: Dict[str, Any]) -> str:
    """Build a structured prompt for LLM explanation."""
    impact = simulation_result.get("impact_summary", {})
    rec = simulation_result.get("recommended_strategy", {})
    strategies = simulation_result.get("strategies", [])
    scenario = simulation_result.get("scenario", {})

    # Find strategies for comparison
    cheapest = next((s for s in strategies if s["strategy_type"] == "cheapest"), {})
    fastest = next((s for s in strategies if s["strategy_type"] == "fastest"), {})
    balanced = next((s for s in strategies if s["strategy_type"] == "balanced"), {})

    prompt = f"""You are ChainMind AI, a supply chain crisis management system.

A disruption has been simulated and the system has computed three recovery strategies using deterministic algorithms.

DISRUPTION:
- Type: {scenario.get('disruption_type', '').replace('_', ' ').title()}
- Location: {scenario.get('location', '')}
- Duration: {scenario.get('duration_hours', 0)} hours
- Severity: {scenario.get('severity', '').title()}

IMPACT:
- Total affected shipments: {impact.get('total_affected_shipments', 0)}
- Cargo value exposed: {_format_currency(impact.get('total_cargo_value_exposed', 0))}
- Average delay: {impact.get('average_delay_hours', 0):.1f} hours
- Cold-chain shipments at risk: {impact.get('cold_chain_at_risk', 0)}
- High-priority shipments affected: {impact.get('high_priority_affected', 0)}

STRATEGY COMPARISON:
1. Cost-Optimized:  Cost {_format_currency(cheapest.get('additional_cost_inr', 0))}, Delay {cheapest.get('average_delay_hours', 0):.1f}h, Risk {cheapest.get('risk_level', '')}
2. Speed-Optimized: Cost {_format_currency(fastest.get('additional_cost_inr', 0))}, Delay {fastest.get('average_delay_hours', 0):.1f}h, Risk {fastest.get('risk_level', '')}
3. AI-Recommended:  Cost {_format_currency(balanced.get('additional_cost_inr', 0))}, Delay {balanced.get('average_delay_hours', 0):.1f}h, Risk {balanced.get('risk_level', '')}

SYSTEM RECOMMENDATION: {rec.get('name', '')} — {rec.get('strategy_type', '')}

Your task: Write a clear, professional explanation (3-5 sentences) of WHY ChainMind recommends this strategy.
Focus on: the trade-off between cost, time, and risk; cold-chain protection; cargo value preservation; fleet efficiency.
Be specific — use the actual numbers. Write in second person ("ChainMind recommends...").
Do not repeat the scenario — focus on the strategic rationale.
"""
    return prompt


def _template_explanation(simulation_result: Dict[str, Any]) -> str:
    """
    Generate a deterministic template-based explanation.
    Used as fallback when no LLM is configured.
    """
    impact = simulation_result.get("impact_summary", {})
    rec = simulation_result.get("recommended_strategy", {})
    strategies = simulation_result.get("strategies", [])
    scenario = simulation_result.get("scenario", {})

    cheapest = next((s for s in strategies if s["strategy_type"] == "cheapest"), {})
    fastest = next((s for s in strategies if s["strategy_type"] == "fastest"), {})
    balanced = next((s for s in strategies if s["strategy_type"] == "balanced"), {})
    rec_type = rec.get("strategy_type", "balanced")

    disruption_str = f"{scenario.get('duration_hours', 0):.0f}-hour {scenario.get('disruption_type', '').replace('_', ' ')} at {scenario.get('location', '')}"
    affected = impact.get("total_affected_shipments", 0)
    value = _format_currency(impact.get("total_cargo_value_exposed", 0))
    cold = impact.get("cold_chain_at_risk", 0)
    high_pri = impact.get("high_priority_affected", 0)

    if rec_type == "cheapest":
        cost_saving = (fastest.get("additional_cost_inr", 0) - cheapest.get("additional_cost_inr", 0))
        delay_penalty = (cheapest.get("average_delay_hours", 0) - balanced.get("average_delay_hours", 0))
        return (
            f"ChainMind recommends the Cost-Optimized strategy for this {disruption_str}, "
            f"affecting {affected} shipments with {value} cargo exposed. "
            f"This approach saves approximately {_format_currency(cost_saving)} compared to the fastest recovery option, "
            f"at the trade-off of {delay_penalty:.0f} additional hours of delay. "
            f"Given the {scenario.get('severity', '')} severity and current fleet availability, "
            f"consolidating shipments on cost-efficient routes is the most responsible approach. "
            f"{'Cold-chain exposure is elevated and requires special attention for the ' + str(cold) + ' temperature-sensitive shipments. ' if cold > 0 else ''}"
            f"Operations should monitor delivery ETAs closely and escalate if disruption extends beyond {scenario.get('duration_hours', 0):.0f} hours."
        )
    elif rec_type == "fastest":
        cost_premium = (fastest.get("additional_cost_inr", 0) - balanced.get("additional_cost_inr", 0))
        time_saving = (balanced.get("average_delay_hours", 0) - fastest.get("average_delay_hours", 0))
        return (
            f"ChainMind recommends the Speed-Optimized strategy for this {disruption_str}. "
            f"With {affected} shipments affected and {value} in cargo exposed — including {high_pri} high-priority and {cold} cold-chain items — "
            f"minimizing delay is critical to preventing cascading business impact. "
            f"This strategy reduces average delay by {time_saving:.0f} hours compared to the balanced approach, "
            f"at an additional cost premium of {_format_currency(cost_premium)}. "
            f"The severity level justifies the cost premium given the high proportion of priority cargo at risk."
        )
    else:  # balanced
        cost_vs_cheapest = (balanced.get("additional_cost_inr", 0) - cheapest.get("additional_cost_inr", 0))
        delay_vs_cheapest = (cheapest.get("average_delay_hours", 0) - balanced.get("average_delay_hours", 0))
        cost_vs_fastest = (fastest.get("additional_cost_inr", 0) - balanced.get("additional_cost_inr", 0))
        return (
            f"ChainMind recommends the AI-Recommended Balanced strategy for this {disruption_str}. "
            f"With {affected} shipments affected ({high_pri} high-priority, {cold} cold-chain) and {value} in cargo exposed, "
            f"this strategy achieves {delay_vs_cheapest:.0f} hours of delay reduction versus the cheapest option "
            f"while saving {_format_currency(cost_vs_fastest)} versus the fastest approach. "
            f"The balanced scoring model (weight: 30% delay, 25% cost, 25% cold-chain, 20% risk) selected this strategy "
            f"as the optimal trade-off across all four dimensions. "
            f"{'Refrigerated vehicles have been prioritized for the ' + str(cold) + ' temperature-sensitive shipments to prevent spoilage. ' if cold > 0 else ''}"
            f"Operations should execute the immediate actions and re-run the simulation if the disruption duration changes."
        )


def _template_crisis_summary(simulation_result: Dict[str, Any]) -> str:
    """Generate a template-based crisis summary."""
    impact = simulation_result.get("impact_summary", {})
    scenario = simulation_result.get("scenario", {})
    risk_dist = simulation_result.get("risk_distribution", {})
    rec = simulation_result.get("recommended_strategy", {})

    critical = risk_dist.get("critical", 0)
    high = risk_dist.get("high", 0)

    return (
        f"**Crisis Assessment: {scenario.get('severity', '').upper()} SEVERITY**\n\n"
        f"A {scenario.get('duration_hours', 0):.0f}-hour "
        f"{scenario.get('disruption_type', '').replace('_', ' ')} at "
        f"{scenario.get('location', '')} has been simulated. "
        f"The disruption directly impacts {impact.get('directly_affected', 0)} shipments "
        f"with an additional {impact.get('indirectly_affected', 0)} experiencing cascading delays. "
        f"Total cargo value exposed: {_format_currency(impact.get('total_cargo_value_exposed', 0))}. "
        f"{critical + high} shipments are classified as HIGH or CRITICAL risk. "
        f"\n\nChainMind has identified the **{rec.get('name', 'Balanced Recovery')}** "
        f"as the optimal response, expected to resolve the situation in "
        f"approximately {rec.get('average_delay_hours', 0):.0f} additional hours "
        f"with {_format_currency(rec.get('additional_cost_inr', 0))} in recovery costs."
    )


async def _call_openai(prompt: str) -> Optional[str]:
    """Call OpenAI API for explanation generation."""
    try:
        import httpx
        headers = {
            "Authorization": f"Bearer {settings.llm_api_key}",
            "Content-Type": "application/json",
        }
        payload = {
            "model": settings.llm_model,
            "messages": [
                {"role": "system", "content": "You are ChainMind AI, a supply chain crisis management system. Be professional, concise, and data-driven."},
                {"role": "user", "content": prompt},
            ],
            "max_tokens": 400,
            "temperature": 0.3,
        }
        async with httpx.AsyncClient(timeout=30.0) as client:
            response = await client.post(
                "https://api.openai.com/v1/chat/completions",
                headers=headers,
                json=payload,
            )
            response.raise_for_status()
            return response.json()["choices"][0]["message"]["content"].strip()
    except Exception as e:
        logger.warning(f"OpenAI call failed: {e}")
        return None


async def _call_watsonx(prompt: str) -> Optional[str]:
    """Call IBM watsonx.ai API for explanation generation."""
    try:
        import httpx
        # Get IAM token
        token_response = httpx.post(
            "https://iam.cloud.ibm.com/identity/token",
            data={
                "grant_type": "urn:ibm:params:oauth:grant-type:apikey",
                "apikey": settings.watsonx_api_key,
            },
            headers={"Content-Type": "application/x-www-form-urlencoded"},
            timeout=15.0,
        )
        token_response.raise_for_status()
        iam_token = token_response.json()["access_token"]

        model = settings.llm_model if settings.llm_model != "gpt-4o-mini" else "ibm/granite-13b-instruct-v2"

        async with httpx.AsyncClient(timeout=30.0) as client:
            response = await client.post(
                f"{settings.watsonx_url}/ml/v1/text/generation?version=2023-05-29",
                headers={
                    "Authorization": f"Bearer {iam_token}",
                    "Content-Type": "application/json",
                },
                json={
                    "model_id": model,
                    "project_id": settings.watsonx_project_id,
                    "input": f"<|system|>You are ChainMind AI, a supply chain crisis management expert.<|user|>{prompt}<|assistant|>",
                    "parameters": {
                        "decoding_method": "greedy",
                        "max_new_tokens": 400,
                        "temperature": 0.3,
                    },
                },
            )
            response.raise_for_status()
            result = response.json()
            return result["results"][0]["generated_text"].strip()
    except Exception as e:
        logger.warning(f"watsonx.ai call failed: {e}")
        return None


async def generate_explanation(simulation_result: Dict[str, Any]) -> Dict[str, Any]:
    """
    Generate AI explanation for the recommended strategy.
    Falls back to template if no LLM is configured or LLM call fails.

    When no shipments are affected (strategies=[]), returns a safe zero-impact
    explanation so the API response is always structurally valid.
    """
    # Guard: if there are no strategies (0 affected shipments), return a safe
    # explanation stub rather than crashing inside template/basis builders.
    strategies = simulation_result.get("strategies", [])
    if not strategies:
        return _zero_impact_explanation(simulation_result)

    explanation_text = None
    used_llm = False
    llm_provider = settings.llm_provider.lower()

    if llm_provider != "none" and (settings.llm_api_key or settings.watsonx_api_key):
        prompt = _build_explanation_prompt(simulation_result)

        if llm_provider == "openai" and settings.llm_api_key:
            explanation_text = await _call_openai(prompt)
        elif llm_provider == "watsonx" and settings.watsonx_api_key:
            explanation_text = await _call_watsonx(prompt)

        if explanation_text:
            used_llm = True
            logger.info(f"LLM explanation generated via {llm_provider}")
        else:
            logger.info("LLM call failed, using template fallback")

    if not explanation_text:
        explanation_text = _template_explanation(simulation_result)

    crisis_summary = _template_crisis_summary(simulation_result)

    return {
        "explanation": explanation_text,
        "crisis_summary": crisis_summary,
        "used_llm": used_llm,
        "llm_provider": llm_provider if used_llm else "template",
        "explanation_basis": _build_explanation_basis(simulation_result),
    }


def _zero_impact_explanation(simulation_result: Dict[str, Any]) -> Dict[str, Any]:
    """
    Return a structurally complete explanation object for zero-impact simulations.
    Used when no shipments were affected and no strategies were generated.
    """
    scenario = simulation_result.get("scenario", {})
    location = scenario.get("location", "the affected area")
    dtype = scenario.get("disruption_type", "disruption").replace("_", " ")
    return {
        "explanation": (
            f"ChainMind analyzed the {dtype} at {location}. "
            f"No active shipments were found on the affected routes at this time, "
            f"so no recovery strategies are required. The network is unaffected for current cargo."
        ),
        "crisis_summary": (
            f"**Crisis Assessment: LOW IMPACT**\n\n"
            f"A {dtype} at {location} was simulated. "
            f"No active shipments are currently using the affected routes or nodes. "
            f"No recovery action is required."
        ),
        "used_llm": False,
        "llm_provider": "template",
        "explanation_basis": {
            "cost_reasoning": {
                "value": 0, "vs_cheapest": 0, "vs_fastest": 0,
                "label": "No recovery cost — no affected shipments",
            },
            "delay_reasoning": {
                "value": 0, "vs_cheapest": 0, "vs_fastest": 0,
                "label": "No delay — no affected shipments",
            },
            "risk_reasoning": {
                "level": "low", "cold_chain_risk": 0.0, "cold_chain_count": 0,
                "label": "No risk — no affected shipments",
            },
            "cargo_reasoning": {
                "total_value": 0, "high_priority": 0,
                "label": "No cargo exposed",
            },
            "fleet_reasoning": {
                "vehicles_required": 0,
                "available": simulation_result.get("fleet_summary", {}).get("available_vehicles", 0),
                "label": "No fleet redeployment required",
            },
        },
    }


def _build_explanation_basis(simulation_result: Dict[str, Any]) -> Dict[str, Any]:
    """Build the structured basis for the explanation (for the explainable AI section)."""
    impact = simulation_result.get("impact_summary", {})
    rec = simulation_result.get("recommended_strategy") or {}
    strategies = simulation_result.get("strategies", [])

    cheapest = next((s for s in strategies if s.get("strategy_type") == "cheapest"), {})
    fastest = next((s for s in strategies if s.get("strategy_type") == "fastest"), {})
    balanced = next((s for s in strategies if s.get("strategy_type") == "balanced"), {})
    rec_type = rec.get("strategy_type", "balanced")
    rec_strategy = next((s for s in strategies if s.get("strategy_type") == rec_type), balanced)

    return {
        "cost_reasoning": {
            "value": rec_strategy.get("additional_cost_inr", 0),
            "vs_cheapest": rec_strategy.get("additional_cost_inr", 0) - cheapest.get("additional_cost_inr", 0),
            "vs_fastest": fastest.get("additional_cost_inr", 0) - rec_strategy.get("additional_cost_inr", 0),
            "label": "Recovery cost analysis",
        },
        "delay_reasoning": {
            "value": rec_strategy.get("average_delay_hours", 0),
            "vs_cheapest": cheapest.get("average_delay_hours", 0) - rec_strategy.get("average_delay_hours", 0),
            "vs_fastest": rec_strategy.get("average_delay_hours", 0) - fastest.get("average_delay_hours", 0),
            "label": "Delay reduction analysis",
        },
        "risk_reasoning": {
            "level": rec_strategy.get("risk_level", "medium"),
            "cold_chain_risk": rec_strategy.get("cold_chain_risk_score", 0),
            "cold_chain_count": impact.get("cold_chain_at_risk", 0),
            "label": "Risk and cold-chain protection",
        },
        "cargo_reasoning": {
            "total_value": impact.get("total_cargo_value_exposed", 0),
            "high_priority": impact.get("high_priority_affected", 0),
            "label": "Cargo value and priority protection",
        },
        "fleet_reasoning": {
            "vehicles_required": rec_strategy.get("fleet_required", 0),
            "available": simulation_result.get("fleet_summary", {}).get("available_vehicles", 0),
            "label": "Fleet availability and deployment",
        },
    }

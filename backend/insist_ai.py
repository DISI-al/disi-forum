"""
INSIST · AI 审核接口（预留）

现在不接任何外部服务：默认关闭，返回 manual_review。
接大模型时只需要：
  1. 设置环境变量 INSIST_AI_REVIEW=1、INSIST_AI_PROVIDER=deepseek（或其它）
  2. 在 _call_provider() 里补 HTTP 调用（结构化 JSON 输出）
  3. 前端在晋升前调用 POST /api/insist/ai/review，把结果展示给你确认
原则：AI 只给建议，不直接改 XP / 段位。
"""
import json
import os

AI_REVIEW_ENABLED = os.getenv("INSIST_AI_REVIEW", "0") == "1"
AI_PROVIDER = os.getenv("INSIST_AI_PROVIDER", "manual")
AI_MODEL = os.getenv("INSIST_AI_MODEL", "")

SYSTEM_PROMPT = (
    "你是 INSIST 技能晋升审核助手。根据技能、目标段位、已完成的经验卡与成就卡，"
    "判断是否达到晋升标准，输出 JSON："
    '{"verdict": "pass|reject|manual", "confidence": 0-1, "reasons": ["..."], "missing": ["..."]}'
)


def _call_provider(payload: dict) -> dict:
    """
    预留：调用真实模型。
    未启用时抛 NotImplementedError，由 review_promotion 兜底。
    """
    raise NotImplementedError("AI provider not wired yet")


def review_promotion(payload: dict) -> dict:
    """返回审核建议；未启用时明确告诉前端走人工确认。"""
    checklist = payload.get("checklist", [])
    base = {
        "enabled": AI_REVIEW_ENABLED,
        "provider": AI_PROVIDER,
        "model": AI_MODEL or None,
        "checklist": checklist,
    }

    if not AI_REVIEW_ENABLED:
        base.update(
            verdict="manual",
            confidence=0.0,
            reasons=["AI 审核未启用，按「按量」清单自行确认"],
            missing=[i["label"] for i in checklist if i.get("got", 0) < i.get("need", 0)],
            suggestion="manual",
        )
        return base

    try:
        result = _call_provider(payload)
        base.update(result)
        base["suggestion"] = result.get("verdict", "manual")
        return base
    except NotImplementedError:
        base.update(
            verdict="manual",
            confidence=0.0,
            reasons=["已开启 AI 审核，但 provider 还没接线"],
            missing=[],
            suggestion="manual",
        )
        return base


def review_prompt_payload(skill: dict, cards: list) -> dict:
    """组装给模型的最小上下文（用户数据不外发多余字段）"""
    return {
        "system": SYSTEM_PROMPT,
        "skill": {
            "name": skill.get("name"),
            "level": skill.get("level"),
            "levelName": skill.get("levelName"),
            "tier": skill.get("tier"),
            "importance": skill.get("importance"),
            "xp": skill.get("xp"),
            "overflow": skill.get("overflow"),
        },
        "cards": [
            {"kind": c.get("kind"), "title": c.get("title"), "tier": c.get("tier"), "status": c.get("status")}
            for c in cards
        ],
        "raw": json.dumps(payload_preview(cards), ensure_ascii=False)[:2000],
    }


def payload_preview(cards):
    return [{"title": c.get("title"), "kind": c.get("kind"), "tier": c.get("tier")} for c in cards]

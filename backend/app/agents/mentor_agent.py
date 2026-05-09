"""AI Mentor agent with context-aware tutoring."""
from typing import Any, AsyncIterator, Dict, List, Optional

from app.agents.llm_client import get_llm


def _build_system_prompt(context: Optional[Dict] = None) -> str:
    weak_points = context.get("weakPoints", []) if context else []
    current_topic = context.get("currentTopic", "") if context else ""
    recent_documents = context.get("recentDocuments", []) if context else []
    knowledge_rate = context.get("knowledgeRate", None) if context else None

    # 构建薄弱知识点描述（包含分数）
    if weak_points:
        weak_str = "\n".join([f"  - {w.get('name', '')}: 掌握度 {w.get('score', 0)}%" for w in weak_points])
    else:
        weak_str = "  暂无明确数据"

    # 构建最近上传文件描述
    docs_info = ""
    if recent_documents:
        docs_list = "\n".join([f"  - {d.get('name', '未知文件')} ({d.get('type', '未知类型')})" for d in recent_documents])
        docs_info = f"\n\n📁 最近上传文件：\n{docs_list}"

    # 构建掌握率信息
    knowledge_info = ""
    if knowledge_rate is not None:
        knowledge_info = f"\n📊 整体掌握率：{knowledge_rate}%"

    return f"""你是「学业啄木鸟」AI学习助手，正在进行一对一深度辅导。

🎯 当前学生学习数据：

📚 薄弱知识点（按掌握度排序）：
{weak_str}{knowledge_info}{docs_info}

📖 当前学习主题：{current_topic}

📋 教学策略（重要！）：
1. 难度匹配学生水平（薄弱知识点→从基础讲起，掌握知识点→可讲进阶）
2. 回复要耐心、鼓励、条理清晰
3. 如果学生上传了成绩单或试卷，可以结合文件内容进行针对性分析
4. 优先根据学生的薄弱点提供个性化学习建议

🗣️ 回复格式：
- 用中文，公式用 $...$ LaTeX 格式
- 代码用 ``` 代码块
- 结构化：先说结论 → 再讲细节 → 最后总结

💡 提示：你已经完全了解学生的学习情况，可以直接基于这些数据提供有针对性的辅导，无需询问学生的薄弱点或学习进度。"""


async def chat_with_mentor(
    user_message: str,
    context: Optional[Dict[str, Any]] = None,
    thread_id: Optional[str] = None,
) -> str:
    """Send message to LLM and get response.

    Args:
        user_message: The student's question or message.
        context: Optional student context (weakPoints, currentTopic).
        thread_id: Conversation thread ID for multi-turn memory.

    Returns:
        The mentor's response text.
    """
    llm = get_llm()
    system_prompt = _build_system_prompt(context)

    # Build messages with system prompt and user message
    messages = [
        ("system", system_prompt),
        ("user", user_message),
    ]

    # Call LLM directly
    response = await llm.ainvoke(messages)
    return response.content if hasattr(response, "content") else "抱歉，我暂时无法回答这个问题。"


async def chat_with_mentor_stream(
    user_message: str,
    context: Optional[Dict] = None,
    thread_id: Optional[str] = None,
) -> AsyncIterator[str]:
    """Stream LLM response token by token.

    Args:
        user_message: The student's question or message.
        context: Optional student context (weakPoints, currentTopic).
        thread_id: Conversation thread ID for multi-turn memory.

    Yields:
        Content chunks from the AI response as they arrive.
    """
    llm = get_llm()
    system_prompt = _build_system_prompt(context)

    messages = [
        ("system", system_prompt),
        ("user", user_message),
    ]

    async for chunk in llm.astream(messages):
        if chunk.content:
            yield chunk.content


def get_suggested_questions() -> List[Dict[str, Any]]:
    """Get preset suggested questions based on student context."""
    return [
        {"id": 1, "text": "帮我制定一个复习计划", "icon": "plan"},
        {"id": 2, "text": "总结我最近的易错类型", "icon": "chart"},
        {"id": 3, "text": "解释一下贝叶斯定理", "icon": "book"},
        {"id": 4, "text": "推荐一些练习题", "icon": "practice"},
    ]
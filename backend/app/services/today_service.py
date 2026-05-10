"""Service for today page endpoints: push, recommendations, progress, goals, start-study."""
import uuid
import json
from datetime import datetime, timedelta

from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select, func, and_, desc
from sqlalchemy.orm.attributes import flag_modified

from app.models.knowledge import UserKnowledge, KnowledgePoint
from app.models.learning_record import UserLearningRecord, LearningAction
from app.models.study_plan import StudyPlan
from app.models.resource import Resource, ResourceType, Difficulty
from app.models.study_session import StudySession
from app.models.document import Document, DocStatus
from app.models.push_history import PushHistory
from app.models.user_goal import UserGoal
from app.schemas.today import (
    TodayPushData,
    RecommendationItem,
    TodayRecommendationsData,
    TodayProgressData,
    WeeklyTrendItem,
    TodayGoalItem,
    TodayGoalsData,
    StudySessionData,
    PushHistoryItem,
    PushHistoryListData,
)
from app.agents.llm_client import get_llm
from app.core.logging import get_logger

logger = get_logger("today_service")

TYPE_LABEL_MAP = {"video": "视频", "exercise": "练习", "article": "文章", "course": "课程", "code": "代码"}

PLATFORM_MAP = {
    "video": ("B站", "https://search.bilibili.com/all?keyword="),
    "code": ("Virtual Online Judge", "https://voj.mobi/home?keyword="),
    "article": ("CSDN", "https://so.csdn.net/so/search?q="),
}

PLATFORM_COLORS = {
    "B站": "#FB7299",
    "Virtual Online Judge": "#4CAF50",
    "CSDN": "#FC5531",
}

WEEKDAY_MAP = {0: "Mon", 1: "Tue", 2: "Wed", 3: "Thu", 4: "Fri", 5: "Sat", 6: "Sun"}

WEATHER_OPTIONS = ["晴", "晴", "多云", "多云", "晴", "阴", "小雨", "晴", "多云", "晴", "晴", "多云"]


def _get_weather() -> str:
    return WEATHER_OPTIONS[datetime.now().month - 1]


def _get_week_range(offset: int = 0) -> tuple[datetime, datetime]:
    today = datetime.now().date()
    monday = today - timedelta(days=today.weekday()) + timedelta(weeks=offset)
    start = datetime.combine(monday, datetime.min.time())
    end = datetime.combine(monday + timedelta(days=6), datetime.max.time())
    return start, end


async def _get_weekly_duration(db: AsyncSession, user_id: int, offset: int = 0) -> float:
    start, end = _get_week_range(offset)
    shift = timedelta(hours=8)
    start_local = start - shift
    end_local = end - shift
    logger.info(f"_get_weekly_duration: START - user_id={user_id}, offset={offset}, start={start}, end={end}, start_local={start_local}, end_local={end_local}")

    result = await db.execute(
        select(UserLearningRecord.id, UserLearningRecord.duration_seconds, UserLearningRecord.created_at)
        .where(
            and_(
                UserLearningRecord.user_id == user_id,
                UserLearningRecord.created_at >= start_local,
                UserLearningRecord.created_at <= end_local,
            )
        )
    )
    records = result.all()
    logger.info(f"_get_weekly_duration: found {len(records)} records")

    total_seconds = sum(r.duration_seconds or 0 for r in records)
    logger.info(f"_get_weekly_duration: total_seconds={total_seconds} from {len(records)} records")

    hours = round(total_seconds / 3600, 1)
    logger.info(f"_get_weekly_duration: returning {hours} hours")
    return hours


async def _get_daily_durations(db: AsyncSession, user_id: int) -> dict[int, float]:
    start, end = _get_week_range(0)
    shift = timedelta(hours=8)
    start_local = start - shift
    end_local = end - shift
    result = await db.execute(
        select(
            UserLearningRecord.created_at,
            UserLearningRecord.duration_seconds,
        )
        .where(
            and_(
                UserLearningRecord.user_id == user_id,
                UserLearningRecord.created_at >= start_local,
                UserLearningRecord.created_at <= end_local,
            )
        )
    )
    rows = result.all()
    day_hours: dict[int, float] = {}
    for row in rows:
        ts = row.created_at
        seconds = row.duration_seconds or 0
        local_ts = ts + shift
        dow = local_ts.weekday()
        day_hours[dow] = round(day_hours.get(dow, 0) + seconds / 3600, 1)
    return day_hours


async def _get_knowledge_rate(db: AsyncSession, user_id: int) -> float:
    result = await db.execute(
        select(func.avg(UserKnowledge.score))
        .where(UserKnowledge.user_id == user_id)
    )
    avg_score = result.scalar()
    if avg_score is None:
        return 0.0
    return round(float(avg_score) / 100, 2)


async def _get_weak_points(db: AsyncSession, user_id: int) -> list[str]:
    result = await db.execute(
        select(KnowledgePoint.name, UserKnowledge.score)
        .join(UserKnowledge, UserKnowledge.knowledge_id == KnowledgePoint.id)
        .where(
            and_(
                UserKnowledge.user_id == user_id,
                UserKnowledge.score < 75,
            )
        )
    )
    rows = result.all()
    return [row[0] for row in rows]


async def _has_uploaded_documents(db: AsyncSession, user_id: int) -> bool:
    result = await db.execute(
        select(func.count())
        .select_from(Document)
        .where(
            and_(
                Document.user_id == user_id,
                Document.status == DocStatus.completed,
            )
        )
    )
    return (result.scalar() or 0) > 0


async def _has_knowledge_data(db: AsyncSession, user_id: int) -> bool:
    result = await db.execute(
        select(func.count())
        .select_from(UserKnowledge)
        .where(UserKnowledge.user_id == user_id)
    )
    return (result.scalar() or 0) > 0


# =====================================================
# Public API
# =====================================================


async def get_push(db: AsyncSession, user_id: int) -> TodayPushData:
    now = datetime.now()

    weak_count = await db.execute(
        select(func.count())
        .select_from(UserKnowledge)
        .where(
            and_(
                UserKnowledge.user_id == user_id,
                UserKnowledge.score < 75,
            )
        )
    )
    n_weak = weak_count.scalar() or 0
    suggested = min(max(2 + n_weak, 2), 5)

    this_week_hours = await _get_weekly_duration(db, user_id, 0)
    if this_week_hours >= 15:
        status = "最佳"
    elif this_week_hours >= 8:
        status = "良好"
    else:
        status = "一般"

    last_week_hours = await _get_weekly_duration(db, user_id, -1)
    if last_week_hours > 0:
        growth = round((this_week_hours - last_week_hours) / last_week_hours, 2)
    else:
        growth = 0.0 if this_week_hours == 0 else 1.0

    has_data = await _has_knowledge_data(db, user_id)

    return TodayPushData(
        date=now.strftime("%Y-%m-%d"),
        weather=_get_weather(),
        suggestedStudyHours=suggested,
        status=status,
        weeklyGrowthRate=max(growth, -1.0),
        hasKnowledgeData=has_data,
    )


async def _generate_llm_recommendations(
    user_kps: list[dict],
    resources: list[Resource],
) -> list[RecommendationItem]:
    llm = get_llm().bind(response_format={"type": "json_object"})

    resource_pool = []
    for r in resources:
        tags_dict = r.tags if isinstance(r.tags, dict) else {}
        resource_pool.append({
            "id": r.id,
            "title": r.title,
            "type": r.type.value if r.type else "article",
            "difficulty": r.difficulty.value if r.difficulty else "入门",
            "platform": r.platform,
            "url": r.url,
            "summary": r.summary or "",
            "duration": tags_dict.get("duration", "") or tags_dict.get("count", ""),
        })

    prompt = f"""你是学业啄木鸟的学习推荐专家。根据学生的知识掌握情况，从资源池中选出最适合的3-6个学习资源。

**学生知识点掌握情况：**
{json.dumps(user_kps, ensure_ascii=False)}

**可用资源池：**
{json.dumps(resource_pool, ensure_ascii=False, indent=2)}

**任务：**
1. 选出3-6个最匹配学生薄弱点的资源（分数越低越需要优先推荐）
2. 为每个选中的资源写一句个性化推荐理由（必须引用学生的具体分数和薄弱点名称）
3. 难度级别根据学生该知识点的分数匹配：0-40→入门，40-70→中级，70+→进阶

**严格按照以下JSON格式返回：**
{{"recommendations": [{{"resourceId": 1, "reason": "推荐理由", "difficulty": "入门"}}]}}

只返回JSON，不要其他文字。"""

    try:
        response = await llm.ainvoke(prompt)
        content = response.content.strip()
        if content.startswith("```"):
            content = content.split("\n", 1)[1].rsplit("\n```", 1)[0] if "\n```" in content else content[3:-3]
        llm_result = json.loads(content)
        selected = llm_result.get("recommendations", [])
    except Exception as e:
        logger.warning(f"LLM recommendation from DB resources failed: {e}")
        return []

    resource_map = {r.id: r for r in resources}
    items: list[RecommendationItem] = []
    for sel in selected[:6]:
        r = resource_map.get(sel.get("resourceId"))
        if not r:
            continue
        r_type = r.type.value if r.type else "article"
        tags_dict = r.tags if isinstance(r.tags, dict) else {}
        items.append(RecommendationItem(
            id=f"res_{r.id}",
            type=r_type,
            typeLabel=TYPE_LABEL_MAP.get(r_type, "文章"),
            difficulty=sel.get("difficulty", r.difficulty.value if r.difficulty else "入门"),
            title=r.title,
            platform=r.platform,
            duration=tags_dict.get("duration") or tags_dict.get("count"),
            reason=sel.get("reason", ""),
            url=r.url,
            thumbnail=r.thumbnail,
        ))
    return items


async def _generate_online_recommendations(
    user_kps: list[dict],
) -> list[RecommendationItem]:
    llm = get_llm().bind(response_format={"type": "json_object"})

    weak_names = [k["name"] for k in user_kps if k["score"] < 75]
    all_names = [k["name"] for k in user_kps]

    prompt = f"""你是学业啄木鸟的学习推荐专家。根据学生的知识掌握情况，推荐3-6个在线学习资源。

**学生知识点掌握情况：**
{json.dumps(user_kps, ensure_ascii=False)}

**薄弱知识点：** {', '.join(weak_names) if weak_names else '暂无'}

**任务：**
1. 根据学生的薄弱知识点，推荐3-6个在线学习资源
2. 视频类资源必须使用B站，URL格式为 https://search.bilibili.com/all?keyword=搜索关键词
3. 代码/编程类资源必须使用Virtual Online Judge，URL格式为 https://vjudge.net/problem?keyword=搜索关键词
4. 文章类资源必须使用CSDN，URL格式为 https://so.csdn.net/so/search?q=搜索关键词
5. 至少1个视频(B站)、1个代码(VOJ)、1个文章(CSDN)资源
6. 为每个资源写一句个性化推荐理由（必须引用学生的具体分数和薄弱点名称）
7. 难度级别根据学生该知识点的分数匹配：0-40→入门，40-70→中级，70+→进阶
8. 资源标题要具体、有吸引力，格式如"【B站】数据结构-链表详解"、"【VOJ】链表练习题"、"【CSDN】链表知识点总结"

**严格按照以下JSON格式返回：**
{{"recommendations": [{{"title": "资源标题", "type": "video", "difficulty": "入门", "platform": "B站", "url": "https://search.bilibili.com/all?keyword=关键词", "duration": "约30分钟", "reason": "推荐理由"}}]}}

type只能是以下三种：video(视频/B站)、code(代码/VOJ)、article(文章/CSDN)
platform只能是以下三种：B站、Virtual Online Judge、CSDN

只返回JSON，不要其他文字。"""

    try:
        response = await llm.ainvoke(prompt)
        content = response.content.strip()
        if content.startswith("```"):
            content = content.split("\n", 1)[1].rsplit("\n```", 1)[0] if "\n```" in content else content[3:-3]
        llm_result = json.loads(content)
        selected = llm_result.get("recommendations", [])
    except Exception as e:
        logger.warning(f"LLM online recommendation failed: {e}, generating rule-based")
        return _generate_rule_based_online_recommendations(user_kps)

    items: list[RecommendationItem] = []
    for sel in selected[:6]:
        r_type = sel.get("type", "video")
        platform = sel.get("platform", PLATFORM_MAP.get(r_type, ("B站", ""))[0])
        items.append(RecommendationItem(
            id=f"rec_{uuid.uuid4().hex[:8]}",
            type=r_type,
            typeLabel=TYPE_LABEL_MAP.get(r_type, "视频"),
            difficulty=sel.get("difficulty", "入门"),
            title=sel.get("title", "学习资源"),
            platform=platform,
            duration=sel.get("duration"),
            reason=sel.get("reason", "针对薄弱知识点推荐"),
            url=sel.get("url", ""),
            thumbnail=sel.get("thumbnail"),
        ))
    return items


def _generate_rule_based_online_recommendations(
    user_kps: list[dict],
) -> list[RecommendationItem]:
    items: list[RecommendationItem] = []
    weak_kps = [k for k in user_kps if k["score"] < 75]
    target_kps = weak_kps[:4] if weak_kps else user_kps[:4]

    for i, kp in enumerate(target_kps):
        name = kp["name"]
        score = kp["score"]
        if score < 40:
            difficulty = "入门"
        elif score < 70:
            difficulty = "中级"
        else:
            difficulty = "进阶"

        if i % 3 == 0:
            platform, url_base = PLATFORM_MAP["video"]
            items.append(RecommendationItem(
                id=f"rule_v_{i}",
                type="video",
                typeLabel="视频",
                difficulty=difficulty,
                title=f"【B站】{name}详解教程",
                platform=platform,
                duration="约30分钟",
                reason=f"你当前「{name}」掌握分数为{score}分，建议通过视频教程系统学习",
                url=f"{url_base}{name}+教程",
                thumbnail=None,
            ))
        elif i % 3 == 1:
            platform, url_base = PLATFORM_MAP["code"]
            items.append(RecommendationItem(
                id=f"rule_c_{i}",
                type="code",
                typeLabel="代码",
                difficulty=difficulty,
                title=f"【VOJ】{name}编程练习",
                platform=platform,
                duration="约45分钟",
                reason=f"针对「{name}」(得分{score})，推荐通过编程练习巩固知识",
                url=f"{url_base}{name}",
                thumbnail=None,
            ))
        else:
            platform, url_base = PLATFORM_MAP["article"]
            items.append(RecommendationItem(
                id=f"rule_a_{i}",
                type="article",
                typeLabel="文章",
                difficulty=difficulty,
                title=f"【CSDN】{name}知识点精讲",
                platform=platform,
                duration=None,
                reason=f"针对「{name}」(得分{score})，推荐阅读相关文章巩固基础",
                url=f"{url_base}{name}+学习",
                thumbnail=None,
            ))

    if len(items) < 3:
        items.append(RecommendationItem(
            id="rule_default_0",
            type="video",
            typeLabel="视频",
            difficulty="入门",
            title="【B站】学习方法与效率提升",
            platform="B站",
            duration="约20分钟",
            reason="推荐学习高效学习方法，提升整体学习效率",
            url="https://search.bilibili.com/all?keyword=高效学习方法",
            thumbnail=None,
        ))

    return items


def _build_recommendation_item(r: Resource, weak_names: list[str]) -> RecommendationItem:
    r_type = r.type.value if r.type else "article"
    tags_dict = r.tags if isinstance(r.tags, dict) else {}
    matched = [w for w in weak_names if w in (r.title or "")]
    if matched:
        reason = f"根据你当前的薄弱知识点「{matched[0]}」，推荐加强学习"
        difficulty = r.difficulty.value if r.difficulty else "中级"
    elif weak_names:
        reason = f"针对薄弱知识点「{weak_names[0]}」，推荐相关练习巩固基础"
        difficulty = "入门"
    else:
        reason = "帮助你巩固知识体系，拓展学习视野"
        difficulty = r.difficulty.value if r.difficulty else "入门"
    return RecommendationItem(
        id=f"res_{r.id}",
        type=r_type,
        typeLabel=TYPE_LABEL_MAP.get(r_type, "文章"),
        difficulty=difficulty,
        title=r.title,
        platform=r.platform,
        duration=tags_dict.get("duration") or tags_dict.get("count"),
        reason=reason,
        url=r.url,
        thumbnail=r.thumbnail,
    )


async def get_recommendations(
    db: AsyncSession, user_id: int
) -> TodayRecommendationsData:
    from app.services.recommendation_service import get_trending_resources, get_mock_resources

    result = await db.execute(
        select(KnowledgePoint.name, UserKnowledge.score)
        .join(UserKnowledge, UserKnowledge.knowledge_id == KnowledgePoint.id)
        .where(UserKnowledge.user_id == user_id)
        .order_by(UserKnowledge.score.asc())
        .limit(10)
    )
    user_kp_rows = result.all()

    all_resources = await db.execute(select(Resource).limit(30))
    resources = all_resources.scalars().all()

    has_knowledge = len(user_kp_rows) > 0
    has_resources = len(resources) > 0

    if not has_knowledge:
        return TodayRecommendationsData(recommendations=[], hasKnowledgeData=False)

    user_kps = [{"name": row[0], "score": round(row[1], 1)} for row in user_kp_rows]

    items: list[RecommendationItem] = []

    if has_resources:
        db_items = await _generate_llm_recommendations(user_kps, resources)
        if db_items:
            items.extend(db_items)

    if len(items) < 3:
        online_items = await _generate_online_recommendations(user_kps)
        for oi in online_items:
            if not any(i.title == oi.title for i in items):
                items.append(oi)

    if not items:
        weak_names = [k["name"] for k in user_kps]
        if has_resources:
            for r in resources[:3]:
                items.append(_build_recommendation_item(r, weak_names))
        else:
            items = _generate_rule_based_online_recommendations(user_kps)

    try:
        await _save_push_history(db, user_id, items, user_kps)
    except Exception as e:
        logger.warning(f"Failed to save push history: {e}")

    return TodayRecommendationsData(recommendations=items, hasKnowledgeData=True)


async def _save_push_history(
    db: AsyncSession,
    user_id: int,
    items: list[RecommendationItem],
    user_kps: list[dict],
) -> None:
    today_str = datetime.now().strftime("%Y-%m-%d")

    existing = await db.execute(
        select(PushHistory).where(
            and_(
                PushHistory.user_id == user_id,
                PushHistory.push_date == today_str,
            )
        )
    )
    existing_record = existing.scalar_one_or_none()

    weak_names = [k["name"] for k in user_kps if k["score"] < 75]
    rec_data = [item.model_dump() for item in items]

    if existing_record:
        existing_record.recommendations = rec_data
        existing_record.weak_points = json.dumps(weak_names, ensure_ascii=False)
        flag_modified(existing_record, "recommendations")
        flag_modified(existing_record, "weak_points")
    else:
        record = PushHistory(
            user_id=user_id,
            push_date=today_str,
            recommendations=rec_data,
            weak_points=json.dumps(weak_names, ensure_ascii=False),
            push_type="daily",
        )
        db.add(record)

    await db.commit()


async def get_push_history(
    db: AsyncSession, user_id: int, limit: int = 7
) -> PushHistoryListData:
    result = await db.execute(
        select(PushHistory)
        .where(PushHistory.user_id == user_id)
        .order_by(desc(PushHistory.push_date))
        .limit(limit)
    )
    records = result.scalars().all()

    items = []
    for record in records:
        recs = record.recommendations or []
        weak = []
        if record.weak_points:
            try:
                weak = json.loads(record.weak_points)
            except (json.JSONDecodeError, TypeError):
                weak = []
        items.append(PushHistoryItem(
            pushDate=record.push_date,
            recommendations=recs,
            weakPoints=weak,
            createdAt=record.created_at.isoformat() if record.created_at else None,
        ))

    return PushHistoryListData(history=items)


async def get_progress(db: AsyncSession, user_id: int) -> TodayProgressData:
    this_week_hours = await _get_weekly_duration(db, user_id, 0)
    last_week_hours = await _get_weekly_duration(db, user_id, -1)

    logger.info(f"get_progress: user_id={user_id}, this_week_hours={this_week_hours}, last_week_hours={last_week_hours}")

    if last_week_hours > 0:
        weekly_growth = round((this_week_hours - last_week_hours) / last_week_hours, 2)
    else:
        weekly_growth = 0.0 if this_week_hours == 0 else 1.0

    knowledge_rate = await _get_knowledge_rate(db, user_id)
    knowledge_growth = 0.02 if this_week_hours > 0 else 0.0

    day_hours = await _get_daily_durations(db, user_id)
    today_dow = datetime.now().weekday()
    trend = []
    for d in range(7):
        trend.append(WeeklyTrendItem(
            day=WEEKDAY_MAP[d],
            hours=day_hours.get(d, 0),
            isToday=(d == today_dow),
        ))

    logger.info(f"get_progress: returning weeklyStudyHours={this_week_hours}, weeklyGrowthRate={weekly_growth}")

    return TodayProgressData(
        weeklyStudyHours=this_week_hours,
        weeklyGrowthRate=max(weekly_growth, -1.0),
        knowledgeRate=knowledge_rate,
        knowledgeGrowthRate=knowledge_growth,
        weeklyTrend=trend,
    )


async def start_study(db: AsyncSession, user_id: int) -> StudySessionData:
    today_str = datetime.now().strftime("%Y%m%d")
    session_id = f"sess_{today_str}_{uuid.uuid4().hex[:6]}"

    session = StudySession(
        user_id=user_id,
        session_id=session_id,
    )
    db.add(session)
    await db.commit()

    logger.info(f"Study session started: user_id={user_id}, session_id={session_id}")
    return StudySessionData(sessionId=session_id)


async def get_today_goals(db: AsyncSession, user_id: int) -> TodayGoalsData:
    result = await db.execute(
        select(StudyPlan)
        .where(StudyPlan.user_id == user_id)
        .order_by(StudyPlan.created_at.desc())
        .limit(1)
    )
    plan = result.scalar_one_or_none()

    result = await db.execute(
        select(KnowledgePoint.name, UserKnowledge.score)
        .join(UserKnowledge, UserKnowledge.knowledge_id == KnowledgePoint.id)
        .where(UserKnowledge.user_id == user_id)
        .order_by(UserKnowledge.score.asc())
        .limit(10)
    )
    user_kp_rows = result.all()
    weak_names = [name for name, score in user_kp_rows if score < 75]
    has_knowledge = len(user_kp_rows) > 0

    today = datetime.now().strftime("%Y-%m-%d")
    today_start = datetime.now().replace(hour=0, minute=0, second=0, microsecond=0)
    today_end = datetime.now().replace(hour=23, minute=59, second=59, microsecond=999999)

    existing_goals_result = await db.execute(
        select(UserGoal)
        .where(
            and_(
                UserGoal.user_id == user_id,
                UserGoal.goal_date >= today_start,
                UserGoal.goal_date <= today_end,
            )
        )
        .order_by(UserGoal.created_at.asc())
    )
    existing_goals = existing_goals_result.scalars().all()

    existing_titles = {g.title for g in existing_goals}

    if has_knowledge and weak_names:
        for name in weak_names[:5]:
            goal_title = f"巩固薄弱知识点：{name}"
            if goal_title not in existing_titles:
                score = next((s for n, s in user_kp_rows if n == name), 0)
                minutes = 30 if score < 40 else 45 if score < 60 else 60
                new_goal = UserGoal(
                    user_id=user_id,
                    title=goal_title,
                    estimated_minutes=minutes,
                    completed=False,
                    goal_date=datetime.now(),
                )
                db.add(new_goal)
                existing_titles.add(goal_title)
        await db.commit()

    if plan:
        plan_data = plan.plan_data or {}
        weeks = plan_data.get("weeks", [])
        if weeks:
            first_week = weeks[0]
            for i, task in enumerate(first_week.get("tasks", [])[:5]):
                goal_title = task.get("content", f"学习任务{i+1}")
                if goal_title not in existing_titles:
                    task_completed = task.get("completed", False)
                    estimated_minutes = task.get("estimatedMinutes", 30)
                    new_goal = UserGoal(
                        user_id=user_id,
                        title=goal_title,
                        estimated_minutes=estimated_minutes,
                        completed=task_completed,
                        goal_date=datetime.now(),
                    )
                    db.add(new_goal)
                    if task_completed:
                        record = UserLearningRecord(
                            user_id=user_id,
                            action=LearningAction.completed,
                            content=goal_title,
                            duration_seconds=estimated_minutes * 60,
                        )
                        db.add(record)
                    existing_titles.add(goal_title)
            await db.commit()

    existing_goals_result = await db.execute(
        select(UserGoal)
        .where(
            and_(
                UserGoal.user_id == user_id,
                UserGoal.goal_date >= today_start,
                UserGoal.goal_date <= today_end,
            )
        )
        .order_by(UserGoal.created_at.asc())
    )
    all_goals = existing_goals_result.scalars().all()

    today_goals = []
    for g in all_goals:
        today_goals.append(TodayGoalItem(
            id=f"goal_custom_{g.id}",
            title=g.title,
            estimatedMinutes=g.estimated_minutes,
            completed=g.completed,
        ))

    study_tips = []
    if has_knowledge and weak_names:
        study_tips.append(f"当前薄弱知识点：{'、'.join(weak_names[:3])}，建议优先攻克")
        study_tips.append("建议先通过视频学习基础概念，再通过练习巩固")
        study_tips.append("每完成一个薄弱知识点的学习，及时做练习检验效果")
    else:
        study_tips = [
            "建议先复习基础知识再做题",
            "注意劳逸结合，每学习45分钟休息10分钟",
            "睡前复习当天学习内容效果更佳",
        ]

    return TodayGoalsData(
        planId=plan.id if plan else None,
        todayGoals=today_goals,
        studyTips=study_tips,
    )


async def add_goal(
    db: AsyncSession, user_id: int, title: str, estimated_minutes: int = 30
) -> TodayGoalItem:
    goal = UserGoal(
        user_id=user_id,
        title=title,
        estimated_minutes=estimated_minutes,
        completed=False,
        goal_date=datetime.now(),
    )
    db.add(goal)
    await db.commit()
    await db.refresh(goal)

    return TodayGoalItem(
        id=f"goal_custom_{goal.id}",
        title=goal.title,
        estimatedMinutes=goal.estimated_minutes,
        completed=goal.completed,
    )


async def edit_goal(
    db: AsyncSession, user_id: int, goal_id: str, title: str = None, estimated_minutes: int = None
) -> bool:
    try:
        parts = goal_id.split("_")
        if len(parts) < 3 or parts[0] != "goal" or parts[1] != "custom":
            return False
        custom_id = int(parts[2])
        result = await db.execute(
            select(UserGoal).where(
                and_(UserGoal.id == custom_id, UserGoal.user_id == user_id)
            )
        )
        goal = result.scalar_one_or_none()
        if not goal:
            return False
        if title is not None:
            goal.title = title
        if estimated_minutes is not None:
            goal.estimated_minutes = estimated_minutes
        await db.commit()
        return True
    except (ValueError, IndexError):
        return False


async def delete_goal(db: AsyncSession, user_id: int, goal_id: str) -> bool:
    try:
        parts = goal_id.split("_")
        if len(parts) < 3 or parts[0] != "goal" or parts[1] != "custom":
            return False
        custom_id = int(parts[2])
        result = await db.execute(
            select(UserGoal).where(
                and_(UserGoal.id == custom_id, UserGoal.user_id == user_id)
            )
        )
        goal = result.scalar_one_or_none()
        if not goal:
            return False
        await db.delete(goal)
        await db.commit()
        return True
    except (ValueError, IndexError):
        return False


async def toggle_goal_completed(db: AsyncSession, user_id: int, goal_id: str) -> bool:
    try:
        logger.info(f"toggle_goal_completed: START - user_id={user_id}, goal_id={goal_id}")
        parts = goal_id.split("_")
        if len(parts) < 3 or parts[0] != "goal" or parts[1] != "custom":
            logger.warning(f"toggle_goal_completed: invalid goal_id format: {goal_id}, parts={parts}")
            return False
        custom_id = int(parts[2])
        logger.info(f"toggle_goal_completed: parsed custom_id={custom_id}")

        result = await db.execute(
            select(UserGoal).where(
                and_(UserGoal.id == custom_id, UserGoal.user_id == user_id)
            )
        )
        goal = result.scalar_one_or_none()

        if not goal:
            logger.warning(f"toggle_goal_completed: goal not found: custom_id={custom_id}, user_id={user_id}")
            return False

        logger.info(f"toggle_goal_completed: found goal - id={goal.id}, title={goal.title}, completed={goal.completed}, estimated_minutes={goal.estimated_minutes}")

        was_completed = bool(goal.completed)
        new_completed_state = not was_completed
        goal.completed = new_completed_state
        logger.info(f"toggle_goal_completed: toggled - was_completed={was_completed}, now_completed={new_completed_state}")

        if new_completed_state and not was_completed:
            existing_record = await db.execute(
                select(UserLearningRecord).where(
                    and_(
                        UserLearningRecord.user_id == user_id,
                        UserLearningRecord.content == goal.title,
                        UserLearningRecord.action == LearningAction.completed,
                    )
                ).order_by(desc(UserLearningRecord.created_at)).limit(1)
            )
            existing = existing_record.scalar_one_or_none()
            if existing:
                logger.info(f"toggle_goal_completed: learning record already exists for this goal, skipping - record.id={existing.id}")
            else:
                estimated_minutes = goal.estimated_minutes or 30
                duration_seconds = estimated_minutes * 60
                logger.info(f"toggle_goal_completed: creating learning record - estimated_minutes={estimated_minutes}, duration_seconds={duration_seconds}")

                record = UserLearningRecord(
                    user_id=user_id,
                    action=LearningAction.completed,
                    content=goal.title,
                    duration_seconds=duration_seconds,
                )
                db.add(record)
                await db.flush()
                logger.info(f"toggle_goal_completed: record created successfully - record.id={record.id}")
            await db.commit()
        else:
            record_to_delete = await db.execute(
                select(UserLearningRecord).where(
                    and_(
                        UserLearningRecord.user_id == user_id,
                        UserLearningRecord.content == goal.title,
                        UserLearningRecord.action == LearningAction.completed,
                    )
                ).order_by(desc(UserLearningRecord.created_at)).limit(1)
            )
            record = record_to_delete.scalar_one_or_none()
            if record:
                logger.info(f"toggle_goal_completed: deleting learning record - record.id={record.id}, duration_seconds={record.duration_seconds}")
                await db.delete(record)
            await db.commit()
            logger.info(f"toggle_goal_completed: goal uncompleted, deleted learning record if exists")

        logger.info(f"toggle_goal_completed: END - returning True")
        return True

    except Exception as e:
        logger.error(f"toggle_goal_completed: EXCEPTION - {type(e).__name__}: {e}")
        import traceback
        logger.error(f"toggle_goal_completed: traceback: {traceback.format_exc()}")
        return False

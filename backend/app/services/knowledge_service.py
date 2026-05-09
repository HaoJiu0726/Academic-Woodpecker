"""Service for syncing analysis results to the knowledge graph."""
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select
from app.models.knowledge import KnowledgePoint, UserKnowledge, KnowledgeStatus
from datetime import datetime


def _score_to_status(score: float) -> KnowledgeStatus:
    if score >= 80:
        return KnowledgeStatus.掌握
    elif score >= 60:
        return KnowledgeStatus.预警
    else:
        return KnowledgeStatus.薄弱


def _fuzzy_match_weak(name: str, weak_names: dict) -> tuple:
    if name in weak_names:
        return name, weak_names[name]

    for weak_name, severity in weak_names.items():
        if weak_name in name or name in weak_name:
            return weak_name, severity

    return None, None


async def _find_or_create_kp(db: AsyncSession, name: str, name_to_kp: dict) -> KnowledgePoint:
    kp = name_to_kp.get(name)
    if not kp:
        for kp_name, kp_obj in name_to_kp.items():
            if name in kp_name or kp_name in name:
                kp = kp_obj
                break
    if not kp:
        kp = KnowledgePoint(
            name=name,
            subject="通用",
            status=KnowledgeStatus.掌握,
            difficulty=3,
        )
        db.add(kp)
        await db.flush()
        name_to_kp[name] = kp
    return kp


def _calculate_score(name: str, confidence: float, weak_names: dict) -> float:
    matched_name, severity = _fuzzy_match_weak(name, weak_names)
    if matched_name is not None:
        if severity == "high":
            return min(confidence * 100, 45.0)
        elif severity == "medium":
            return min(confidence * 100, 60.0)
        else:
            return min(confidence * 100, 70.0)
    else:
        return max(confidence * 100, 70.0)


async def _upsert_user_knowledge(db: AsyncSession, user_id: int, kp_id: int, score: float, now: datetime):
    existing = await db.execute(
        select(UserKnowledge).where(
            UserKnowledge.user_id == user_id,
            UserKnowledge.knowledge_id == kp_id,
        )
    )
    uk = existing.scalar_one_or_none()

    if uk:
        uk.score = round(uk.score * 0.7 + score * 0.3, 1)
        uk.exam_date = now
    else:
        uk = UserKnowledge(
            user_id=user_id,
            knowledge_id=kp_id,
            score=round(score, 1),
            exam_date=now,
        )
        db.add(uk)


async def sync_analysis_to_knowledge(db: AsyncSession, user_id: int, analysis_result: dict):
    extracted = analysis_result.get("extractedKnowledge", [])
    weak = analysis_result.get("weakPoints", [])

    if not extracted and not weak:
        return

    result = await db.execute(select(KnowledgePoint))
    all_kps = result.scalars().all()
    name_to_kp = {kp.name: kp for kp in all_kps}

    weak_names = {w.get("name", ""): w.get("severity", "medium") for w in weak}

    now = datetime.now()

    processed_kp_ids = set()

    for item in extracted:
        name = item.get("name", "")
        confidence = item.get("confidence", 0.5)

        if not name:
            continue

        kp = await _find_or_create_kp(db, name, name_to_kp)
        kp_id = kp.id

        if kp_id in processed_kp_ids:
            continue
        processed_kp_ids.add(kp_id)

        score = _calculate_score(name, confidence, weak_names)

        kp.status = _score_to_status(score)

        await _upsert_user_knowledge(db, user_id, kp_id, score, now)

    processed_weak_names = set()
    for item in extracted:
        name = item.get("name", "")
        if not name:
            continue
        matched_name, _ = _fuzzy_match_weak(name, weak_names)
        if matched_name:
            processed_weak_names.add(matched_name)

    for weak_item in weak:
        weak_name = weak_item.get("name", "")
        severity = weak_item.get("severity", "medium")

        if not weak_name:
            continue

        if weak_name in processed_weak_names:
            continue

        kp = await _find_or_create_kp(db, weak_name, name_to_kp)
        kp_id = kp.id

        if kp_id in processed_kp_ids:
            continue
        processed_kp_ids.add(kp_id)

        if severity == "high":
            score = 35.0
        elif severity == "medium":
            score = 55.0
        else:
            score = 65.0

        kp.status = _score_to_status(score)

        await _upsert_user_knowledge(db, user_id, kp_id, score, now)

    await db.flush()

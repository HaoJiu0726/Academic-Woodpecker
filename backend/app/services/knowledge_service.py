"""Service for syncing analysis results to the knowledge graph."""
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select
from app.models.knowledge import KnowledgePoint, UserKnowledge, KnowledgeStatus
from datetime import datetime


KEYWORD_SUBJECT_RULES = [
    (["排序", "链表", "栈", "队列", "树", "图", "哈希", "二叉", "堆", "数组", "字符串匹配", "查找", "遍历", "递归", "分治", "动态规划", "贪心", "回溯", "最短路径", "最小生成树", "拓扑"], "数据结构"),
    (["算法", "时间复杂度", "空间复杂度", "NP", "近似算法"], "算法"),
    (["编程", "代码", "程序", "编译", "调试", "面向对象", "设计模式", "软件工程", "测试"], "编程"),
    (["操作系统", "进程", "线程", "内存管理", "调度", "死锁", "文件系统", "虚拟内存", "CPU"], "操作系统"),
    (["网络", "TCP", "UDP", "HTTP", "IP", "路由", "协议", "socket", "DNS", "防火墙"], "计算机网络"),
    (["数据库", "SQL", "关系", "索引", "事务", "范式", "查询优化", "存储"], "数据库"),
    (["离散", "逻辑", "命题", "谓词", "集合论", "关系代数", "布尔", "图论", "组合"], "离散数学"),
    (["微积分", "极限", "导数", "积分", "微分", "级数", "泰勒", "多元函数", "偏导"], "微积分"),
    (["线性代数", "矩阵", "向量", "行列式", "特征值", "特征向量", "线性变换", "线性空间"], "线性代数"),
    (["概率", "统计", "随机", "期望", "方差", "分布", "贝叶斯", "假设检验", "回归"], "概率论"),
    (["力学", "运动", "牛顿", "动量", "能量", "功", "力", "加速度", "速度"], "力学"),
    (["电磁", "电场", "磁场", "电路", "电压", "电流", "电阻", "电容", "电感", "麦克斯韦"], "电磁学"),
    (["英语", "词汇", "语法", "阅读", "听力", "写作", "翻译", "口语"], "英语"),
    (["数据结构", "结构"], "数据结构"),
    (["数学", "函数", "方程", "不等式", "数列"], "数学"),
]


def _classify_subject_by_name(name: str) -> str:
    for keywords, subject in KEYWORD_SUBJECT_RULES:
        for kw in keywords:
            if kw in name:
                return subject
    return "未分类"


def _score_to_status(score: float) -> KnowledgeStatus:
    if score >= 80:
        return KnowledgeStatus.掌握
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
        subject = _classify_subject_by_name(name)
        kp = KnowledgePoint(
            name=name,
            subject=subject,
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

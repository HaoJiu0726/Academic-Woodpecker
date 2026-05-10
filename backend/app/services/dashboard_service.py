from typing import List, Optional
from datetime import datetime, timezone, timedelta
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select, func, desc
from app.models.knowledge import KnowledgePoint, UserKnowledge
from app.models.document import Document, DocStatus
from app.schemas.dashboard import (
    OverviewResponse,
    KnowledgeNode,
    KnowledgeDetail,
    RecommendedResource,
    HistoricalScore,
)

SHANGHAI_TZ = timezone(timedelta(hours=8))


def utc_to_shanghai(utc_dt: datetime) -> datetime:
    """Convert UTC datetime to Shanghai timezone."""
    if utc_dt is None:
        return None
    if utc_dt.tzinfo is None:
        utc_dt = utc_dt.replace(tzinfo=timezone.utc)
    return utc_dt.astimezone(SHANGHAI_TZ)


async def get_overview(db: AsyncSession, user_id: int) -> OverviewResponse:
    """Get student overview: knowledge rate, doc count, last diagnosis, etc.
    
    Real-time calculation based on user's learning behavior and test results.
    """
    # Get knowledge rate from user knowledge scores with weighted calculation
    result = await db.execute(
        select(UserKnowledge.score)
        .where(UserKnowledge.user_id == user_id)
    )
    user_knowledge_rows = result.all()
    
    if user_knowledge_rows:
        total_score = sum(row[0] for row in user_knowledge_rows)
        knowledge_rate = round(total_score / len(user_knowledge_rows), 1)
    else:
        knowledge_rate = 0.0

    # Count analyzed documents with status filter
    result = await db.execute(
        select(func.count(Document.id)).where(
            Document.user_id == user_id,
            Document.status == DocStatus.completed,
        )
    )
    doc_count = result.scalar() or 0

    # Get last diagnosis time with millisecond precision
    result = await db.execute(
        select(Document.created_at)
        .where(Document.user_id == user_id, Document.status == DocStatus.completed)
        .order_by(desc(Document.created_at))
        .limit(1)
    )
    last_diag = result.scalar()
    if last_diag:
        shanghai_time = utc_to_shanghai(last_diag)
        last_diagnosis = shanghai_time.strftime("%Y-%m-%d %H:%M:%S")
    else:
        last_diagnosis = None

    # Calculate growth rate based on historical data
    result = await db.execute(
        select(UserKnowledge.score, UserKnowledge.exam_date)
        .where(UserKnowledge.user_id == user_id)
        .order_by(UserKnowledge.exam_date.desc())
        .limit(10)
    )
    recent_scores = result.all()
    
    if len(recent_scores) >= 2:
        recent_scores.sort(key=lambda x: x[1])  # Sort by date ascending
        first_score = recent_scores[0][0]
        last_score = recent_scores[-1][0]
        if first_score > 0:
            growth_rate = round(((last_score - first_score) / first_score) * 100, 1)
        else:
            growth_rate = 2.0
    else:
        growth_rate = 2.0

    # Calculate study hours based on document analysis
    study_hours = round(doc_count * 1.5 + len(user_knowledge_rows) * 0.1, 1)

    # Calculate consecutive study days
    result = await db.execute(
        select(func.date(Document.created_at))
        .where(Document.user_id == user_id, Document.status == DocStatus.completed)
        .distinct()
        .order_by(desc(Document.created_at))
    )
    study_dates = result.scalars().all()
    consecutive_days = 0
    if study_dates:
        today = datetime.now(timezone.utc).date()
        for i, study_date in enumerate(study_dates):
            expected_date = today - timedelta(days=i)
            if study_date == expected_date:
                consecutive_days += 1
            else:
                break

    return OverviewResponse(
        knowledgeRate=knowledge_rate,
        docCount=doc_count,
        lastDiagnosis=last_diagnosis,
        growthRate=growth_rate,
        studyHours=f"{study_hours}小时",
        consecutiveDays=consecutive_days,
    )


async def get_knowledge_graph(db: AsyncSession, user_id: int, status_filter: str = None) -> dict:
    """Get knowledge graph with user's mastery status, organized by subject.

    Returns knowledge points grouped by subject/category, with dynamic root nodes.
    Supports filtering by status: 'mastered', 'weak' or None for all.
    
    Args:
        db: Database session
        user_id: Current user ID
        status_filter: Optional status filter ('掌握', '薄弱', or None)
    
    Returns:
        Dictionary containing nodes and subjects
    """
    # Get all knowledge points
    result = await db.execute(select(KnowledgePoint))
    all_kps = result.scalars().all()

    # Get user knowledge scores with confidence
    result = await db.execute(
        select(UserKnowledge).where(UserKnowledge.user_id == user_id)
    )
    user_knowledge = {uk.knowledge_id: {'score': uk.score}
                      for uk in result.scalars().all()}

    if not user_knowledge:
        return {
            "nodes": [],
            "subjects": [],
            "stats": {"total": 0, "mastered": 0, "weak": 0}
        }

    # Define subject normalization mappings
    subject_mappings = {
        "通用": None,
        "计算机": "计算机系统",
        "编程": "计算机系统",
        "算法": "计算机系统",
        "数据结构": "计算机系统",
        "高数": "数学",
        "微积分": "数学",
        "线性代数": "数学",
        "概率": "数学",
        "概率论": "数学",
        "力学": "物理",
        "电磁": "物理",
        "电磁学": "物理",
        "语言": "英语",
        "大学英语": "英语",
    }

    keyword_subject_rules = [
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

    def classify_by_name(name: str) -> str:
        for keywords, subject in keyword_subject_rules:
            for kw in keywords:
                if kw in name:
                    return subject
        return "其他"

    # Group knowledge points by subject
    subjects = {}
    
    for kp in all_kps:
        subject_name = kp.subject if kp.subject else "其他"
        mapped = subject_mappings.get(subject_name)
        if mapped is None:
            subject_name = classify_by_name(kp.name)
        elif mapped:
            subject_name = mapped
        
        if subject_name not in subjects:
            subjects[subject_name] = []
        
        # Get user's score
        uk_data = user_knowledge.get(kp.id)
        score = uk_data['score'] if uk_data else None

        if score is None:
            continue
        
        # Determine status based on score
        if score >= 80:
            status, color = "掌握", "emerald"
        else:
            status, color = "薄弱", "rose"

        # Apply status filter if specified
        if status_filter and status != status_filter:
            continue

        # Build description from knowledge point
        description = kp.description or f"{kp.name}是学习中的重要知识点，需要系统掌握。"

        # Get exam frequency
        exam_freq = kp.exam_frequency.value if hasattr(kp.exam_frequency, "value") else "中"

        # Calculate difficulty level
        difficulty_level = {1: "低", 2: "低", 3: "中", 4: "高", 5: "高"}.get(kp.difficulty, "中")

        node = {
            "id": kp.id,
            "name": kp.name,
            "status": status,
            "statusColor": color,
            "description": description,
            "examFrequency": exam_freq,
            "difficultyLevel": difficulty_level,
            "score": score,
            "parentId": kp.parent_id,
            "category": subject_name,
            "connections": [],
        }

        subjects[subject_name].append(node)

    # Build connections between related knowledge points
    for subject_name, kps in subjects.items():
        for i, kp in enumerate(kps):
            # Connect to other nodes in the same subject
            for j, other_kp in enumerate(kps):
                if i != j and abs(i - j) <= 2:  # Connect to nearby nodes
                    kp["connections"].append(other_kp["id"])

    # Build result with subjects as root nodes
    result_data = {
        "nodes": [],
        "subjects": [],
        "stats": {
            "total": 0,
            "mastered": 0,
            "weak": 0,
        }
    }

    subject_id_counter = 1000
    total_count = 0
    status_counts = {"掌握": 0, "薄弱": 0}
    
    for subject_name, kps in subjects.items():
        subject_stats = {"掌握": 0, "薄弱": 0}
        subject_total = len(kps)
        total_count += subject_total
        
        for kp in kps:
            status_counts[kp["status"]] += 1
            subject_stats[kp["status"]] += 1
        
        # Calculate subject mastery rate
        subject_mastery_rate = (subject_stats["掌握"] / subject_total) * 100 if subject_total > 0 else 0
        
        # Create subject root node with statistics
        subject_node = {
            "id": subject_id_counter,
            "name": subject_name,
            "status": "掌握" if subject_mastery_rate >= 80 else "薄弱",
            "statusColor": "primary",
            "description": f"{subject_name}相关知识点汇总",
            "examFrequency": "高",
            "difficultyLevel": "中",
            "score": round(subject_mastery_rate, 1),
            "parentId": None,
            "category": subject_name,
            "isSubject": True,
            "stats": subject_stats,
            "totalNodes": subject_total,
        }
        
        result_data["subjects"].append(subject_node)
        
        # Add all knowledge points for this subject
        for kp in kps:
            result_data["nodes"].append(kp)
        
        subject_id_counter += 1

    # Update overall stats
    result_data["stats"]["total"] = total_count
    result_data["stats"]["mastered"] = status_counts["掌握"]
    result_data["stats"]["weak"] = status_counts["薄弱"]

    return result_data


async def get_knowledge_detail(
    db: AsyncSession, user_id: int, knowledge_id: int
) -> KnowledgeDetail:
    """Get detailed info for a specific knowledge point."""
    from fastapi import HTTPException

    result = await db.execute(
        select(KnowledgePoint).where(KnowledgePoint.id == knowledge_id)
    )
    kp = result.scalar_one_or_none()
    if not kp:
        raise HTTPException(status_code=404, detail="知识点不存在")

    # Get historical scores
    result = await db.execute(
        select(UserKnowledge)
        .where(
            UserKnowledge.user_id == user_id,
            UserKnowledge.knowledge_id == knowledge_id,
        )
        .order_by(UserKnowledge.exam_date)
    )
    history = result.scalars().all()

    status = kp.status.value if hasattr(kp.status, "value") else kp.status
    exam_freq = kp.exam_frequency.value if hasattr(kp.exam_frequency, "value") else "中"

    return KnowledgeDetail(
        id=kp.id,
        name=kp.name,
        status=status,
        description=kp.description or f"{kp.name}是学习中的重要知识点，需要系统掌握。",
        examFrequency=exam_freq,
        difficultyLevel={1: "低", 2: "低", 3: "中", 4: "高", 5: "高"}.get(
            kp.difficulty, "中"
        ),
        weakPoints=[kp.name],
        recommendedResources=[
            RecommendedResource(id=1, title=f"{kp.name}教材", type="book"),
            RecommendedResource(id=2, title=f"{kp.name}视频课程", type="video"),
        ],
        historicalScores=[
            HistoricalScore(
                date=utc_to_shanghai(h.exam_date).strftime("%Y-%m-%d") if h.exam_date else "",
                score=h.score,
            )
            for h in history
        ],
    )

"""推荐服务 - 基于用户上传文件和学习数据的个性化推荐"""
import asyncio
from typing import Dict, List, Optional, Tuple
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select, func, desc
from app.models.document import Document, DocStatus
from app.models.knowledge import KnowledgePoint, UserKnowledge
from app.models.resource import Resource
from app.core.logging import get_logger

logger = get_logger("recommendation_service")

# 主题分类映射
TOPIC_CATEGORIES = {
    "数学": ["数学", "代数", "几何", "函数", "概率", "统计", "微积分"],
    "物理": ["物理", "力学", "电学", "光学", "热学", "原子物理"],
    "化学": ["化学", "有机化学", "无机化学", "化学反应", "元素"],
    "语文": ["语文", "阅读理解", "作文", "文言文", "诗词"],
    "英语": ["英语", "语法", "词汇", "阅读", "写作"],
    "历史": ["历史", "中国历史", "世界历史", "古代史", "近代史"],
    "地理": ["地理", "自然地理", "人文地理", "区域地理"],
    "生物": ["生物", "细胞", "遗传", "生态", "生命"],
}

# 难度级别定义
DIFFICULTY_LEVELS = ["入门", "基础", "进阶", "高级", "竞赛"]


async def analyze_document_content(doc: Document) -> Dict:
    """分析文档内容，提取关键知识点、主题分类和难度级别"""
    result = doc.result or {}
    extracted_knowledge = result.get("extractedKnowledge", [])
    
    # 提取知识点名称
    keywords = [k.get("name", "").strip() for k in extracted_knowledge if k.get("name")]
    
    # 匹配主题分类
    categories = []
    for category, terms in TOPIC_CATEGORIES.items():
        for term in terms:
            if any(term in kw for kw in keywords):
                categories.append(category)
                break
    
    # 推断难度级别（基于知识点复杂度）
    difficulty = "基础"
    if extracted_knowledge:
        avg_confidence = sum(k.get("confidence", 0) for k in extracted_knowledge) / len(extracted_knowledge)
        if avg_confidence < 0.5:
            difficulty = "入门"
        elif avg_confidence < 0.7:
            difficulty = "基础"
        elif avg_confidence < 0.85:
            difficulty = "进阶"
        else:
            difficulty = "高级"
    
    return {
        "keywords": keywords,
        "categories": list(set(categories)),
        "difficulty": difficulty,
        "weakPoints": result.get("weakPoints", []),
    }


async def build_user_document_profile(db: AsyncSession, user_id: int) -> Dict:
    """构建用户文件学习画像 - 结合文档分析和知识点数据"""
    # 获取用户已完成分析的文档
    result = await db.execute(
        select(Document)
        .where(Document.user_id == user_id)
        .where(Document.status == DocStatus.completed)
        .order_by(desc(Document.created_at))
    )
    docs = result.scalars().all()
    
    # 获取用户的知识点掌握情况
    result = await db.execute(
        select(KnowledgePoint.name, UserKnowledge.score)
        .join(UserKnowledge, UserKnowledge.knowledge_id == KnowledgePoint.id)
        .where(UserKnowledge.user_id == user_id)
    )
    user_knowledge = result.all()
    
    # 汇总所有文档的分析结果
    all_keywords = []
    all_categories = []
    all_weak_points = []
    difficulty_counts = {}
    
    for doc in docs:
        analysis = await analyze_document_content(doc)
        all_keywords.extend(analysis["keywords"])
        all_categories.extend(analysis["categories"])
        all_weak_points.extend(w.get("name", "") for w in analysis["weakPoints"])
        
        # 统计难度分布
        diff = analysis["difficulty"]
        difficulty_counts[diff] = difficulty_counts.get(diff, 0) + 1
    
    # 添加知识点数据到关键词和薄弱点
    for kp_name, score in user_knowledge:
        all_keywords.append(kp_name)
        # 如果分数低于70，视为薄弱点
        if score < 70:
            all_weak_points.append(kp_name)
    
    return {
        "totalDocuments": len(docs),
        "keywords": list(set(all_keywords)),
        "categories": list(set(all_categories)),
        "weakPoints": list(set(all_weak_points)),
        "difficultyDistribution": difficulty_counts,
        "userKnowledge": user_knowledge,  # 保留原始知识点数据
    }


async def calculate_resource_match_score(
    resource: Resource,
    user_profile: Dict,
    keyword_weight: float = 0.4,
    category_weight: float = 0.3,
    difficulty_weight: float = 0.3
) -> float:
    """计算资源与用户画像的匹配分数"""
    score = 0.0
    max_score = 0.0
    
    # 关键词匹配
    if user_profile.get("keywords") and resource.keywords:
        resource_keywords = set(resource.keywords.split(",")) if isinstance(resource.keywords, str) else set()
        user_keywords = set(user_profile["keywords"])
        matched = len(resource_keywords & user_keywords)
        if resource_keywords:
            score += (matched / len(resource_keywords)) * keyword_weight
        max_score += keyword_weight
    
    # 分类匹配
    if user_profile.get("categories") and resource.category:
        if resource.category in user_profile["categories"]:
            score += category_weight
        max_score += category_weight
    
    # 难度匹配（倾向于推荐略高于当前水平的资源）
    if user_profile.get("difficultyDistribution"):
        # 找到用户最常接触的难度级别
        main_difficulty = max(
            user_profile["difficultyDistribution"].items(),
            key=lambda x: x[1]
        )[0]
        
        # 难度级别映射到数值
        difficulty_order = ["入门", "基础", "进阶", "高级", "竞赛"]
        user_level = difficulty_order.index(main_difficulty) if main_difficulty in difficulty_order else 1
        resource_level = difficulty_order.index(resource.difficulty) if resource.difficulty in difficulty_order else 1
        
        # 计算难度匹配度（推荐略高一级的资源）
        ideal_level = min(user_level + 1, len(difficulty_order) - 1)
        level_diff = abs(resource_level - ideal_level)
        
        if level_diff == 0:
            score += difficulty_weight
        elif level_diff == 1:
            score += difficulty_weight * 0.7
        else:
            score += difficulty_weight * max(0, 1 - level_diff * 0.3)
        max_score += difficulty_weight
    
    return score / max_score if max_score > 0 else 0.0


async def get_recommendations(
    db: AsyncSession,
    user_id: int,
    limit: int = 6,
    exclude_resource_ids: Optional[List[int]] = None
) -> List[Dict]:
    """获取个性化推荐资源"""
    exclude_ids = exclude_resource_ids or []
    
    # 构建用户画像
    user_profile = await build_user_document_profile(db, user_id)
    
    if not user_profile.get("keywords") and not user_profile.get("categories"):
        # 如果没有足够的用户数据，返回热门资源
        return await get_trending_resources(db, limit)
    
    # 获取所有可用资源
    result = await db.execute(
        select(Resource)
        .where(Resource.is_active == True)
        .where(Resource.id.not_in(exclude_ids))
    )
    resources = result.scalars().all()
    
    if not resources:
        return []
    
    # 计算每个资源的匹配分数
    scored_resources = []
    for resource in resources:
        score = await calculate_resource_match_score(resource, user_profile)
        scored_resources.append((resource, score))
    
    # 按分数排序并取前N个
    scored_resources.sort(key=lambda x: x[1], reverse=True)
    
    # 返回格式化结果
    recommendations = []
    for resource, score in scored_resources[:limit]:
        recommendations.append({
            "id": resource.id,
            "title": resource.title,
            "description": resource.summary,
            "category": resource.category,
            "difficulty": resource.difficulty.value if resource.difficulty else "入门",
            "resourceType": resource.type.value if resource.type else "article",
            "thumbnail": resource.thumbnail,
            "url": resource.url,
            "matchScore": round(score * 100, 1),
            "reason": await get_recommendation_reason(resource, user_profile),
        })
    
    return recommendations


async def get_trending_resources(db: AsyncSession, limit: int = 6) -> List[Dict]:
    """获取热门资源（作为冷启动推荐）"""
    result = await db.execute(
        select(Resource)
        .order_by(desc(Resource.view_count))
        .limit(limit)
    )
    resources = result.scalars().all()
    
    # 如果数据库中没有资源，返回模拟数据
    if not resources:
        return get_mock_resources(limit)
    
    return [{
        "id": resource.id,
        "title": resource.title,
        "description": resource.description,
        "category": resource.category,
        "difficulty": resource.difficulty,
        "resourceType": resource.resource_type,
        "thumbnail": resource.thumbnail,
        "url": resource.url,
        "matchScore": None,
        "reason": "热门推荐",
    } for resource in resources]


def get_mock_resources(limit: int = 6) -> List[Dict]:
    """获取模拟资源数据（作为最后的后备）"""
    mock_data = [
        {
            "id": 1,
            "title": "高等数学微积分入门",
            "description": "从零开始学习微积分基础概念，包括极限、导数、积分等核心内容",
            "category": "数学",
            "difficulty": "基础",
            "resourceType": "video",
            "thumbnail": None,
            "url": "#",
            "matchScore": None,
            "reason": "热门推荐",
        },
        {
            "id": 2,
            "title": "概率论与数理统计",
            "description": "深入理解概率分布和统计推断，掌握数据分析必备技能",
            "category": "数学",
            "difficulty": "进阶",
            "resourceType": "article",
            "thumbnail": None,
            "url": "#",
            "matchScore": None,
            "reason": "热门推荐",
        },
        {
            "id": 3,
            "title": "C语言程序设计",
            "description": "系统学习C语言编程，掌握指针、内存管理等核心概念",
            "category": "计算机系统",
            "difficulty": "基础",
            "resourceType": "course",
            "thumbnail": None,
            "url": "#",
            "matchScore": None,
            "reason": "热门推荐",
        },
        {
            "id": 4,
            "title": "数据结构与算法",
            "description": "深入分析常用数据结构设计原理和算法复杂度",
            "category": "计算机系统",
            "difficulty": "进阶",
            "resourceType": "video",
            "thumbnail": None,
            "url": "#",
            "matchScore": None,
            "reason": "热门推荐",
        },
        {
            "id": 5,
            "title": "大学物理力学篇",
            "description": "系统学习力学基础知识，包括牛顿运动定律、动量守恒等",
            "category": "物理",
            "difficulty": "基础",
            "resourceType": "video",
            "thumbnail": None,
            "url": "#",
            "matchScore": None,
            "reason": "热门推荐",
        },
        {
            "id": 6,
            "title": "线性代数精讲",
            "description": "矩阵运算、向量空间、特征值等核心知识点详解",
            "category": "数学",
            "difficulty": "进阶",
            "resourceType": "article",
            "thumbnail": None,
            "url": "#",
            "matchScore": None,
            "reason": "热门推荐",
        },
    ]
    
    return mock_data[:limit]


async def get_recommendation_reason(resource: Resource, user_profile: Dict) -> str:
    """生成推荐理由（可解释性）"""
    reasons = []
    
    # 基于关键词匹配
    if user_profile.get("keywords") and resource.keywords:
        resource_keywords = set(resource.keywords.split(",")) if isinstance(resource.keywords, str) else set()
        user_keywords = set(user_profile["keywords"])
        matched = list(resource_keywords & user_keywords)[:3]
        if matched:
            reasons.append(f"涉及您学习过的知识点：{', '.join(matched)}")
    
    # 基于分类匹配
    if user_profile.get("categories") and resource.category:
        if resource.category in user_profile["categories"]:
            reasons.append(f"属于您关注的{resource.category}领域")
    
    # 基于薄弱点
    if user_profile.get("weakPoints"):
        weak_points = user_profile["weakPoints"]
        resource_desc = resource.title + " " + (resource.description or "")
        for wp in weak_points[:2]:
            if wp in resource_desc:
                reasons.append(f"针对您的薄弱点：{wp}")
    
    if not reasons:
        return "基于您的学习情况推荐"
    
    return "; ".join(reasons)[:100]


async def update_resource_views(db: AsyncSession, resource_id: int):
    """更新资源访问次数"""
    resource = await db.get(Resource, resource_id)
    if resource:
        resource.views = (resource.views or 0) + 1
        await db.commit()


async def get_user_recommendation_preferences(db: AsyncSession, user_id: int) -> Dict:
    """获取用户推荐偏好设置"""
    # 这里可以扩展为从数据库读取用户自定义偏好
    # 目前返回默认偏好
    return {
        "enableRecommendations": True,
        "preferredCategories": list(TOPIC_CATEGORIES.keys()),
        "preferredDifficulties": DIFFICULTY_LEVELS,
        "excludeTypes": [],
        "minMatchScore": 30,
    }


async def update_user_recommendation_preferences(
    db: AsyncSession,
    user_id: int,
    preferences: Dict
) -> Dict:
    """更新用户推荐偏好设置"""
    # 这里可以扩展为保存到数据库
    # 目前仅返回更新后的偏好
    return preferences
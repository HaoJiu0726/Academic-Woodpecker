# 学业啄木鸟 - 后端接口需求文档

## 一、项目概述

### 1.1 项目简介
**项目名称**：学业啄木鸟 - 智能学习分析平台  
**项目类型**：教育科技类Web应用  
**核心功能**：通过AI技术分析学生学习数据，诊断知识薄弱点，推荐个性化学习资源，提供智能问答服务  
**目标用户**：中学生、大学生及自学者

### 1.2 技术架构建议
- **后端框架**：Python (FastAPI) / Node.js (Express/Koa)
- **数据库**：MySQL + Redis
- **AI服务**：OpenAI GPT-4 / 文心一言 / 通义千问
- **文件存储**：阿里云OSS / 七牛云
- **搜索引擎**：Elasticsearch（可选）

---

## 二、功能模块分析

### 2.1 个人学情仪表盘（Dashboard）
#### 功能点：
- 展示知识掌握率、已分析文档数、最近诊断时间
- 动态知识图谱（放射状节点图）
- 点击薄弱知识点查看详情
- 快捷入口（新文档分析、今日推送）

#### 数据需求：
- 用户基本信息
- 知识点掌握状态数据
- 薄弱知识点详情
- 推荐资源列表

---

## 三、API接口设计

### 3.1 用户认证模块

#### 3.1.1 用户登录
```
POST /api/auth/login
```

**请求参数**：
```json
{
  "username": "string",
  "password": "string"
}
```

**响应数据**：
```json
{
  "code": 200,
  "message": "登录成功",
  "data": {
    "token": "string",
    "userInfo": {
      "id": "integer",
      "username": "string",
      "nickname": "string",
      "avatar": "string",
      "role": "student | teacher"
    }
  }
}
```

#### 3.1.2 用户注册
```
POST /api/auth/register
```

**请求参数**：
```json
{
  "username": "string",
  "password": "string",
  "nickname": "string",
  "email": "string",
  "studentId": "string"
}
```

#### 3.1.3 获取当前用户信息
```
GET /api/auth/current-user
```

**请求头**：
```
Authorization: Bearer <token>
```

---

### 3.2 学情数据模块（Dashboard）

#### 3.2.1 获取学情概览
```
GET /api/dashboard/overview
```

**响应数据**：
```json
{
  "code": 200,
  "data": {
    "知识掌握率": 78,
    "已分析文档数": 12,
    "最近诊断时间": "2026-04-26 14:30",
    "周增长率": 2.0,
    "学习时长": "12.5小时",
    "连续学习天数": 7
  }
}
```

#### 3.2.2 获取知识图谱数据
```
GET /api/dashboard/knowledge-graph
```

**响应数据**：
```json
{
  "code": 200,
  "data": {
    "nodes": [
      {
        "id": 1,
        "name": "高等数学",
        "status": "掌握",
        "statusColor": "emerald",
        "children": [
          { "id": 11, "name": "微积分", "status": "掌握" },
          { "id": 12, "name": "线性代数", "status": "预警" },
          { "id": 13, "name": "概率论", "status": "薄弱" }
        ]
      },
      {
        "id": 2,
        "name": "大学物理",
        "status": "掌握",
        "statusColor": "emerald",
        "children": [
          { "id": 21, "name": "力学", "status": "掌握" },
          { "id": 22, "name": "电磁学", "status": "预警" }
        ]
      },
      {
        "id": 3,
        "name": "计算机科学",
        "status": "预警",
        "statusColor": "amber",
        "children": [
          { "id": 31, "name": "数据结构", "status": "掌握" },
          { "id": 32, "name": "算法", "status": "薄弱" },
          { "id": 33, "name": "操作系统", "status": "预警" }
        ]
      }
    ]
  }
}
```

#### 3.2.3 获取薄弱知识点详情
```
GET /api/dashboard/knowledge/{knowledgeId}
```

**响应数据**：
```json
{
  "code": 200,
  "data": {
    "id": 13,
    "name": "概率论",
    "status": "薄弱",
    "description": "概率论是研究随机现象数量规律的数学分支...",
    "examFrequency": "高",
    "difficultyLevel": "高",
    "易错点": [
      "条件概率",
      "贝叶斯定理",
      "随机变量的数字特征"
    ],
    "推荐资源": [
      { "id": 1, "title": "概率论与数理统计教材", "type": "book" },
      { "id": 2, "title": "B站视频课程", "type": "video" }
    ],
    "历史成绩": [
      { "date": "2026-04-20", "score": 65 },
      { "date": "2026-03-15", "score": 58 },
      { "date": "2026-02-10", "score": 72 }
    ]
  }
}
```

---

### 3.3 数据上传与解析模块（Analysis）

#### 3.3.1 文件上传
```
POST /api/analysis/upload
Content-Type: multipart/form-data
```

**请求参数**：
- `file`: 文件（PDF、图片、JPG、PNG）
- `fileType`: string（成绩单 | 笔记 | 试卷）

**响应数据**：
```json
{
  "code": 200,
  "data": {
    "fileId": "string",
    "fileName": "string",
    "fileSize": "string",
    "uploadStatus": "success | processing",
    "previewUrl": "string"
  }
}
```

#### 3.3.2 获取解析进度
```
GET /api/analysis/progress/{fileId}
```

**响应数据**：
```json
{
  "code": 200,
  "data": {
    "fileId": "string",
    "status": "parsing | completed | failed",
    "stage": "正在提取文本...",
    "progress": 75,
    "stages": [
      { "name": "文本提取", "status": "completed" },
      { "name": "大纲匹配", "status": "completed" },
      { "name": "薄弱项识别", "status": "processing" },
      { "name": "报告生成", "status": "pending" }
    ]
  }
}
```

#### 3.3.3 获取解析结果
```
GET /api/analysis/result/{fileId}
```

**响应数据**：
```json
{
  "code": 200,
  "data": {
    "fileId": "string",
    "originalFile": {
      "url": "string",
      "name": "string"
    },
    "extractedKnowledge": [
      { "name": "高等数学", "confidence": 0.95 },
      { "name": "线性代数", "confidence": 0.88 },
      { "name": "概率论", "confidence": 0.92 }
    ],
    "weakPoints": [
      { "name": "傅里叶变换", "severity": "high" },
      { "name": "矩阵运算", "severity": "medium" },
      { "name": "随机变量", "severity": "high" }
    ],
    "suggestions": [
      "加强基础练习",
      "理解概念定义",
      "多做应用题"
    ],
    "summary": "通过分析，您在概率论和算法方面需要加强...",
    "analyzedAt": "2026-04-27 10:30:00"
  }
}
```

#### 3.3.4 获取历史分析记录
```
GET /api/analysis/history
```

**查询参数**：
- `page`: integer（默认1）
- `pageSize`: integer（默认10）

**响应数据**：
```json
{
  "code": 200,
  "data": {
    "total": 25,
    "page": 1,
    "pageSize": 10,
    "records": [
      {
        "id": 1,
        "fileName": "2024-2025学年第一学期期末成绩单",
        "uploadTime": "2026-04-20 14:30:00",
        "status": "已分析",
        "thumbnail": "string"
      }
    ]
  }
}
```

#### 3.3.5 手动校正解析结果
```
PUT /api/analysis/result/{fileId}
```

**请求参数**：
```json
{
  "extractedKnowledge": [...],
  "weakPoints": [...],
  "suggestions": [...]
}
```

---

### 3.4 资源推荐模块（Resource Hub）

#### 3.4.1 获取推荐资源列表
```
GET /api/resources
```

**查询参数**：
- `type`: string（video | article | course | code）
- `difficulty`: string（入门 | 中级 | 进阶 | 高级）
- `tag`: string
- `page`: integer
- `pageSize`: integer

**响应数据**：
```json
{
  "code": 200,
  "data": {
    "total": 100,
    "resources": [
      {
        "id": 1,
        "title": "B站 - 概率论与数理统计精讲",
        "platform": "Bilibili",
        "platformColor": "pink",
        "type": "video",
        "rating": 4.8,
        "reason": "该视频对核心概念的动态演示非常直观...",
        "summary": "本系列视频深入浅出讲解概率论...",
        "tags": ["概率论", "视频课程", "入门"],
        "difficulty": "入门",
        "url": "https://...",
        "thumbnail": "string",
        "aiRecommend": true
      }
    ]
  }
}
```

#### 3.4.2 获取资源详情
```
GET /api/resources/{resourceId}
```

**响应数据**：
```json
{
  "code": 200,
  "data": {
    "id": 1,
    "title": "B站 - 概率论与数理统计精讲",
    "platform": "Bilibili",
    "type": "video",
    "rating": 4.8,
    "reason": "该视频对核心概念的动态演示非常直观...",
    "summary": "本系列视频深入浅出讲解概率论...",
    "tags": ["概率论", "视频课程", "入门"],
    "difficulty": "入门",
    "url": "https://...",
    "thumbnail": "string",
    "viewCount": 150000,
    "createdAt": "2024-01-15"
  }
}
```

#### 3.4.3 搜索资源
```
GET /api/resources/search
```

**查询参数**：
- `keyword`: string
- `page`: integer
- `pageSize`: integer

#### 3.4.4 收藏资源
```
POST /api/resources/{resourceId}/favorite
```

#### 3.4.5 获取我的收藏
```
GET /api/resources/favorites
```

---

### 3.5 AI助手模块（AIMentor）

#### 3.5.1 发送消息
```
POST /api/mentor/chat
```

**请求参数**：
```json
{
  "message": "这个题怎么做？",
  "context": {
    "weakPoints": ["概率论", "算法"],
    "currentTopic": "贝叶斯定理"
  },
  "suggestedAction": "帮我制定一个复习计划"
}
```

**响应数据**：
```json
{
  "code": 200,
  "data": {
    "messageId": "string",
    "content": "这是一个很好的问题！让我从基础概念为你解答...",
    "timestamp": "2026-04-27 10:30:00",
    "suggestedQuestions": [
      "这个题怎么做？",
      "请解释这个概念",
      "给我一个例子"
    ],
    "relatedResources": [
      { "id": 1, "title": "贝叶斯定理详解", "type": "video" }
    ]
  }
}
```

#### 3.5.2 获取聊天历史
```
GET /api/mentor/history
```

**查询参数**：
- `page`: integer
- `pageSize`: integer

**响应数据**：
```json
{
  "code": 200,
  "data": {
    "total": 50,
    "messages": [
      {
        "id": "string",
        "role": "user | assistant",
        "content": "string",
        "timestamp": "2026-04-27 10:30:00"
      }
    ]
  }
}
```

#### 3.5.3 清空聊天历史
```
DELETE /api/mentor/history
```

#### 3.5.4 获取引导式问题
```
GET /api/mentor/suggested-actions
```

**响应数据**：
```json
{
  "code": 200,
  "data": [
    { "id": 1, "text": "帮我制定一个复习计划", "icon": "plan" },
    { "id": 2, "text": "总结我最近的易错类型", "icon": "chart" },
    { "id": 3, "text": "解释一下贝叶斯定理", "icon": "book" },
    { "id": 4, "text": "推荐一些练习题", "icon": "practice" }
  ]
}
```

---

### 3.6 学习计划模块

#### 3.6.1 生成学习计划
```
POST /api/plan/generate
```

**请求参数**：
```json
{
  "targetDate": "2026-05-30",
  "focusAreas": ["概率论", "算法"],
  "dailyHours": 3
}
```

**响应数据**：
```json
{
  "code": 200,
  "data": {
    "planId": "string",
    "weeks": [
      {
        "weekNumber": 1,
        "theme": "概率论基础",
        "tasks": [
          { "day": 1, "content": "概率基本概念", "resources": [...] },
          { "day": 2, "content": "条件概率", "resources": [...] }
        ]
      }
    ],
    "createdAt": "2026-04-27"
  }
}
```

#### 3.6.2 获取学习计划
```
GET /api/plan/current
```

#### 3.6.3 更新学习计划进度
```
PUT /api/plan/{planId}/progress
```

---

## 四、数据模型设计

### 4.1 用户表（users）
| 字段名 | 类型 | 说明 |
|--------|------|------|
| id | INT | 主键 |
| username | VARCHAR(50) | 用户名 |
| password | VARCHAR(255) | 密码（加密） |
| nickname | VARCHAR(50) | 昵称 |
| email | VARCHAR(100) | 邮箱 |
| student_id | VARCHAR(20) | 学号 |
| avatar | VARCHAR(255) | 头像URL |
| role | ENUM | 角色（student/teacher） |
| created_at | DATETIME | 创建时间 |
| updated_at | DATETIME | 更新时间 |

### 4.2 知识点表（knowledge_points）
| 字段名 | 类型 | 说明 |
|--------|------|------|
| id | INT | 主键 |
| name | VARCHAR(100) | 知识点名称 |
| parent_id | INT | 父级ID |
| subject | VARCHAR(50) | 所属学科 |
| status | ENUM | 状态（掌握/预警/薄弱） |
| difficulty | INT | 难度等级（1-5） |
| exam_frequency | ENUM | 考频（高/中/低） |

### 4.3 文档分析表（documents）
| 字段名 | 类型 | 说明 |
|--------|------|------|
| id | INT | 主键 |
| user_id | INT | 用户ID |
| file_name | VARCHAR(255) | 文件名 |
| file_url | VARCHAR(255) | 文件存储路径 |
| file_type | ENUM | 文件类型 |
| status | ENUM | 分析状态 |
| result | JSON | 分析结果 |
| created_at | DATETIME | 上传时间 |

### 4.4 资源表（resources）
| 字段名 | 类型 | 说明 |
|--------|------|------|
| id | INT | 主键 |
| title | VARCHAR(255) | 标题 |
| platform | VARCHAR(50) | 平台 |
| type | ENUM | 类型 |
| url | VARCHAR(500) | 链接 |
| thumbnail | VARCHAR(255) | 封面图 |
| rating | DECIMAL(2,1) | 评分 |
| reason | TEXT | 推荐理由 |
| summary | TEXT | 摘要 |
| difficulty | ENUM | 难度 |
| view_count | INT | 浏览量 |

### 4.5 聊天记录表（chat_messages）
| 字段名 | 类型 | 说明 |
|--------|------|------|
| id | INT | 主键 |
| user_id | INT | 用户ID |
| role | ENUM | 角色（user/assistant） |
| content | TEXT | 消息内容 |
| context | JSON | 上下文信息 |
| created_at | DATETIME | 创建时间 |

---

## 五、AI服务集成

### 5.1 AI模型选择
- **主模型**：GPT-4 / 文心一言4.0 / 通义千问2.0
- **Embedding模型**：text-embedding-ada-002
- **语音识别**：Whisper API（可选）

### 5.2 Prompt设计要点

#### 学情分析Prompt
```
你是一个专业的教育AI助手。请分析学生上传的文档，提取其中的知识点，识别薄弱环节，并给出学习建议。

分析维度：
1. 知识点提取
2. 薄弱点识别
3. 考频分析
4. 学习建议
```

#### 智能问答Prompt
```
你是一个智能学习助手，正在与学生进行一对一辅导。

学生背景：
- 当前薄弱知识点：{weakPoints}
- 正在学习的主题：{currentTopic}
- 历史问答记录：{chatHistory}

请根据学生背景，提供个性化、有针对性的解答。
```

---

## 六、安全性要求

### 6.1 认证授权
- JWT Token认证
- Token有效期：7天
- 刷新Token机制

### 6.2 数据安全
- 密码加密存储（bcrypt）
- 文件上传类型校验
- SQL注入防护
- XSS攻击防护

### 6.3 接口安全
- 请求频率限制（Rate Limiting）
- 接口签名验证
- CORS跨域配置

---

## 七、性能要求

### 7.1 响应时间
- 页面接口：< 200ms
- 文件上传：< 3s
- AI响应：< 5s

### 7.2 并发能力
- 支持1000+并发用户
- 数据库连接池管理

### 7.3 缓存策略
- Redis缓存热点数据
- 知识图谱数据缓存
- AI回复缓存

---

## 八、部署架构

### 8.1 推荐架构
```
Nginx (负载均衡)
    ↓
API Gateway
    ↓
┌─────────────┬─────────────┬─────────────┐
│  Web服务集群 │  AI服务集群  │ 文件存储服务  │
└─────────────┴─────────────┴─────────────┘
         ↓              ↓
    ┌──────────┐   ┌──────────┐
    │  MySQL   │   │  Redis   │
    └──────────┘   └──────────┘
```

### 8.2 环境配置
- 开发环境：本地Docker
- 测试环境：云服务器
- 生产环境：Kubernetes集群

---

## 九、开发建议

### 9.1 敏捷开发
建议采用敏捷开发模式，分阶段交付：
1. **Phase 1**：基础框架 + 用户认证 + Dashboard
2. **Phase 2**：文档分析功能
3. **Phase 3**：资源推荐功能
4. **Phase 4**：AI助手功能
5. **Phase 5**：优化与扩展

### 9.2 技术选型建议
- **快速原型**：Python FastAPI + SQLite
- **企业级**：Java Spring Boot + MySQL
- **全栈JS**：Node.js + Express + MongoDB

### 9.3 测试策略
- 单元测试覆盖率 > 80%
- API接口自动化测试
- AI回复质量评估

---

## 十、附录

### 10.1 错误码定义
| 错误码 | 说明 |
|--------|------|
| 200 | 成功 |
| 400 | 请求参数错误 |
| 401 | 未授权 |
| 403 | 禁止访问 |
| 404 | 资源不存在 |
| 500 | 服务器内部错误 |

### 10.2 状态码说明
| 状态 | 说明 |
|------|------|
| pending | 待处理 |
| processing | 处理中 |
| completed | 已完成 |
| failed | 失败 |

---

**文档版本**：v1.0  
**创建时间**：2026-04-27  
**维护团队**：学业啄木鸟开发团队

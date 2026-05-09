# 学业啄木鸟 — Apifox 测试流程指南

## 前置准备

### 1. 初始化测试数据
启动后端服务后，先运行 seed 脚本填充基础数据：
```bash
cd backend
python seed_data.py
```
这会创建：
- 管理员账户 `admin / admin123`
- 演示账户 `demo / demo123`
- 3 个学科 + 13 个子知识点（含掌握度评分）
- 8 条推荐学习资源

### 2. Apifox 环境变量配置
新建环境，设置以下变量：

| 变量名 | 初始值 | 说明 |
|--------|--------|------|
| `{{base_url}}` | `http://localhost:8765` | 后端地址 |
| `{{token}}` | （空，登录后自动填充） | JWT Token |
| `{{file_id}}` | （空，上传后自动填充） | 文件ID |
| `{{resource_id}}` | 1 | 资源ID |
| `{{knowledge_id}}` | 11 | 知识点ID |
| `{{plan_id}}` | （空，创建后自动填充） | 计划ID |
| `{{record_id}}` | （空，创建后自动填充） | 学习记录ID |

> ⚠ Token 推荐用 Apifox 的 **「后操作」脚本**自动提取：
> ```javascript
> // 登录接口的后操作
> const json = pm.response.json();
> pm.environment.set("token", json.data.token);
> ```

---

## 测试流程（按依赖顺序分 5 轮）

### 第 1 轮：基础可用性 + 认证（无需 token）

| 步骤 | 接口 | 说明 |
|------|------|------|
| **1.1** | `GET {{base_url}}/health` | 检查服务是否存活 |
| **1.2** | `POST {{base_url}}/api/auth/register` | 注册新用户 |
| **1.3** | `POST {{base_url}}/api/auth/login` | 登录获取 token |

#### 1.1 — 健康检查
```
GET {{base_url}}/health
```
**预期**：`{ "status": "ok", "service": "学业啄木鸟" }`

#### 1.2 — 注册
```
POST {{base_url}}/api/auth/register
Content-Type: application/json

{
  "username": "test_apifox",
  "password": "test123456",
  "nickname": "Apifox测试",
  "email": "test@example.com"
}
```
**预期**：返回 `code: 200`，包含用户信息

#### 1.3 — 登录（获取 token）
```
POST {{base_url}}/api/auth/login
Content-Type: application/json

{
  "username": "demo",
  "password": "demo123"
}
```
**预期**：返回 `data.token`（在下文所有需认证的接口中，在 Header 添加 `Authorization: Bearer {{token}}`）

---

### 第 2 轮：学情仪表盘（需 token）

#### 2.1 — 学情概览
```
GET {{base_url}}/api/dashboard/overview
Authorization: Bearer {{token}}
```
**预期**：返回 `knowledgeRate`、`docCount`、`lastDiagnosis` 等字段

#### 2.2 — 知识图谱
```
GET {{base_url}}/api/dashboard/knowledge-graph
Authorization: Bearer {{token}}
```
**预期**：返回三级学科树（高等数学 → 微积分/线性代数/概率论）

#### 2.3 — 知识点详情
```
GET {{base_url}}/api/dashboard/knowledge/{{knowledge_id}}
Authorization: Bearer {{token}}
```
**参数**：`knowledge_id` 取上一步响应中的子节点 ID，例如 `11`（微积分）或 `12`（线性代数）
**预期**：返回 `status`、`examFrequency`、`difficultyLevel`、`historicalScores`

---

### 第 3 轮：文件上传与解析（需 token）

> ⚠ 先调 3.1 上传获取 `file_id`，等待几秒让后台分析完成后，再调 3.3 获取解析结果。

#### 3.1 — 上传文件
```
POST {{base_url}}/api/analysis/upload
Authorization: Bearer {{token}}
Content-Type: multipart/form-data

file: (选择文件)
fileType: 成绩单
```
| 测试文件 | 类型 | 预期效果 |
|---------|------|---------|
| `成绩单.txt` | TXT | AI 直接分析文本 |
| `成绩单.pdf` | PDF | PyPDF2 提取后分析 |
| `试卷照片.png` | 图片 | EasyOCR 识别后分析 |

**后操作脚本**（自动提取 file_id）：
```javascript
const json = pm.response.json();
pm.environment.set("file_id", json.data.fileId);
```

#### 3.2 — 获取解析进度
```
GET {{base_url}}/api/analysis/progress/{{file_id}}
Authorization: Bearer {{token}}
```
**预期**：返回 `status: "parsing"` 或 `"completed"`，以及 4 个阶段状态

#### 3.3 — 获取解析结果
```
GET {{base_url}}/api/analysis/result/{{file_id}}
Authorization: Bearer {{token}}
```
**预期**：返回 `extractedKnowledge`、`weakPoints`、`suggestions`、`summary`

#### 3.4 — 手动校正
```
PUT {{base_url}}/api/analysis/result/{{file_id}}
Authorization: Bearer {{token}}
Content-Type: application/json

{
  "extractedKnowledge": [
    { "name": "高等数学", "confidence": 0.95 },
    { "name": "线性代数", "confidence": 0.88 }
  ],
  "weakPoints": [
    { "name": "傅里叶变换", "severity": "high" }
  ],
  "suggestions": ["加强基础练习"]
}
```
**预期**：`{ "code": 200, "message": "校正成功" }`

#### 3.5 — 历史分析记录
```
GET {{base_url}}/api/analysis/history?page=1&pageSize=10
Authorization: Bearer {{token}}
```
**预期**：返回分页的历史分析记录列表

---

### 第 4 轮：资源与学习记录（部分需 token）

#### 4.1 — 资源列表（无需 token）
```
GET {{base_url}}/api/resources?type=video&difficulty=入门
```
**预期**：返回筛选后的视频类入门资源

#### 4.2 — 资源详情（无需 token）
```
GET {{base_url}}/api/resources/{{resource_id}}
```
**预期**：返回资源完整信息，`viewCount` 会 +1

#### 4.3 — 搜索资源（无需 token）
```
GET {{base_url}}/api/resources/search?keyword=概率论
```
**预期**：返回标题/摘要/推荐理由中包含"概率论"的资源

#### 4.4 — 收藏/取消收藏（需 token）
```
POST {{base_url}}/api/resources/{{resource_id}}/favorite
Authorization: Bearer {{token}}
```
**预期**：首次调用返回 `favorited: true`，再次调用返回 `favorited: false`

#### 4.5 — 获取收藏列表（需 token）
```
GET {{base_url}}/api/resources/favorites
Authorization: Bearer {{token}}
```
**预期**：返回已收藏的资源列表

#### 4.6 — 创建学习记录（需 token）
```
POST {{base_url}}/api/learning/records
Authorization: Bearer {{token}}
Content-Type: application/json

{
  "resource_id": {{resource_id}},
  "action": "studied",
  "duration_seconds": 1800
}
```
**预期**：返回创建的记录，包含 `id`、`action: "studied"`

**后操作脚本**：
```javascript
const json = pm.response.json();
pm.environment.set("record_id", json.data.id);
```

#### 4.7 — 学习记录列表（需 token）
```
GET {{base_url}}/api/learning/records?page=1&page_size=10
Authorization: Bearer {{token}}
```
**预期**：返回分页记录，包含资源标题

#### 4.8 — 学习统计（需 token）
```
GET {{base_url}}/api/learning/stats
Authorization: Bearer {{token}}
```
**预期**：返回 `total_viewed`、`total_duration_minutes`、`today_records`、`streak_days`

---

### 第 5 轮：AI 助手与学习计划（需 token）

#### 5.1 — 引导式问题（无需 token）
```
GET {{base_url}}/api/mentor/suggested-actions
```
**预期**：返回 4 个预设快捷问题

#### 5.2 — 发送消息
```
POST {{base_url}}/api/mentor/chat
Authorization: Bearer {{token}}
Content-Type: application/json

{
  "message": "帮我解释一下贝叶斯定理",
  "context": {
    "weakPoints": ["概率论"],
    "currentTopic": "贝叶斯定理"
  }
}
```
**预期**：返回包含了 AI 回复的 `content`、`suggestedQuestions`、`relatedResources`

#### 5.3 — 流式聊天
```
POST {{base_url}}/api/mentor/chat/stream?thread_id=test_001
Authorization: Bearer {{token}}
Content-Type: application/json

{
  "message": "什么是假设检验？",
  "context": {
    "weakPoints": ["概率论"]
  }
}
```
**预期**：SSE 流式响应，逐 token 返回文本（Apifox 中查看 Raw 响应体）

> ⚠ **thread_id 说明**：传递相同 `thread_id` 可实现多轮对话记忆。首次不传则自动生成。

#### 5.4 — 聊天历史
```
GET {{base_url}}/api/mentor/history?page=1&pageSize=10
Authorization: Bearer {{token}}
```
**预期**：返回分页的历史消息

#### 5.5 — 清空聊天历史
```
DELETE {{base_url}}/api/mentor/history
Authorization: Bearer {{token}}
```
**预期**：`{ "code": 200, "message": "聊天历史已清空" }`

#### 5.6 — 生成学习计划
```
POST {{base_url}}/api/plan/generate
Authorization: Bearer {{token}}
Content-Type: application/json

{
  "targetDate": "2026-06-30",
  "focusAreas": ["概率论", "算法"],
  "dailyHours": 3
}
```
**预期**：返回 4 周的详细学习计划（AI 生成或 fallback 模板）

**后操作脚本**：
```javascript
const json = pm.response.json();
if (json.data && json.data.planId) {
  pm.environment.set("plan_id", json.data.planId);
}
```

#### 5.7 — 获取当前计划
```
GET {{base_url}}/api/plan/current
Authorization: Bearer {{token}}
```
**预期**：返回最新的学习计划

#### 5.8 — 更新计划进度
```
PUT {{base_url}}/api/plan/{{plan_id}}/progress
Authorization: Bearer {{token}}
Content-Type: application/json

{
  "weekNumber": 1,
  "day": 1,
  "completed": true
}
```
**预期**：`{ "code": 200, "message": "进度已更新" }`

---

## 异常场景测试

| 场景 | 接口 | 预期行为 |
|------|------|---------|
| 重复注册 | `POST /api/auth/register`（用已存在的用户名） | `code: 400` |
| 错误密码登录 | `POST /api/auth/login`（`password: wrong`） | `code: 401` |
| 无 token 访问 | `GET /api/dashboard/overview`（不加 Authorization） | `code: 403` |
| 不存在的资源 | `GET /api/resources/99999` | `code: 404` |
| 不存在的知识点 | `GET /api/dashboard/knowledge/999` | `code: 404` |
| 未完成的文件结果 | `GET /api/analysis/result/{{processing_file_id}}` | `code: 400` |

---

## Apifox 自动化测试建议

### 推荐目录结构

在 Apifox 中按模块建目录：
```
学业啄木鸟/
├── 1-基础与认证/
│   ├── 健康检查
│   ├── 注册
│   └── 登录
├── 2-学情仪表盘/
│   ├── 概览
│   ├── 知识图谱
│   └── 知识点详情
├── 3-文档分析/
│   ├── 上传
│   ├── 进度查询
│   ├── 结果查询
│   ├── 手动校正
│   └── 历史记录
├── 4-资源中心/
│   ├── 资源列表
│   ├── 资源详情
│   ├── 搜索
│   ├── 收藏/取消
│   └── 收藏列表
├── 5-学习记录/
│   ├── 创建记录
│   ├── 记录列表
│   └── 学习统计
├── 6-AI助手/
│   ├── 引导问题
│   ├── 发送消息
│   ├── 流式聊天
│   ├── 聊天历史
│   └── 清空历史
├── 7-学习计划/
│   ├── 生成计划
│   ├── 当前计划
│   └── 更新进度
└── 8-异常场景/
    ├── 重复注册
    ├── 错误密码
    ├── 无token访问
    ├── 资源404
    └── 知识点404
```

### 批量测试

Apifox 支持「测试场景」功能，将上述 5 轮按顺序编排成一个场景，点击一次即可顺序执行全部接口，并自动传递 token 和 ID 变量。

---

**文档版本**：v1.0  
**创建时间**：2026-04-30  
**适用后端版本**：学业啄木鸟 1.0.0  
**服务器端口**：8765（Docker 映射）

import React, { useState, useEffect, useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import '../Dashboard.scss';
import DailyPush from '../components/DailyPush';
import { dashboardApi } from '../api';

const Dashboard = () => {
  const navigate = useNavigate();
  const [selectedNode, setSelectedNode] = useState(null);
  const [animatedProgress, setAnimatedProgress] = useState(0);
  const [activeView, setActiveView] = useState('analysis');
  const [isLoading, setIsLoading] = useState(true);
  const [overviewData, setOverviewData] = useState({
    knowledgeRate: 0,
    docCount: 0,
    lastDiagnosis: null
  });
  const [knowledgeGraph, setKnowledgeGraph] = useState([]);
  const [subjects, setSubjects] = useState([]); // 新增：存储科目信息
  const [graphOffset, setGraphOffset] = useState({ x: 0, y: 0 });
  const [isDragging, setIsDragging] = useState(false);
  const [dragStart, setDragStart] = useState({ x: 0, y: 0 });
  const [hoveredNode, setHoveredNode] = useState(null);
  const [tooltipPosition, setTooltipPosition] = useState({ x: 0, y: 0 });
  const [selectedStatus, setSelectedStatus] = useState(null);
  const [nodePositions, setNodePositions] = useState({});
  const graphContainerRef = useRef(null);

  useEffect(() => {
    fetchDashboardData();
  }, []);

  useEffect(() => {
    if (overviewData?.knowledgeRate && overviewData.knowledgeRate > 0) {
      const timer = setTimeout(() => {
        setAnimatedProgress(overviewData.knowledgeRate);
      }, 300);
      return () => clearTimeout(timer);
    }
  }, [overviewData]);

  const fetchDashboardData = async (statusFilter = null) => {
    setIsLoading(true);
    try {
      const [overviewRes, graphRes] = await Promise.all([
        dashboardApi.getOverview(),
        dashboardApi.getKnowledgeGraph(statusFilter)
      ]);

      if (overviewRes?.code === 401 || graphRes?.code === 401) {
        navigate('/login');
        return;
      }

      if (overviewRes?.data) {
        setOverviewData(overviewRes.data);
      }

      if (graphRes?.data?.nodes && Array.isArray(graphRes.data.nodes)) {
        setKnowledgeGraph(graphRes.data.nodes);
        setSubjects(graphRes.data.subjects || []);
      }
    } catch (error) {
      console.error('获取数据失败:', error);
      if (error.message?.includes('401') || error.message?.includes('未认证') || error.message?.includes('Not authenticated')) {
        navigate('/login');
        return;
      }
    } finally {
      setIsLoading(false);
    }
  };

  // 状态筛选按钮点击处理
  const handleStatusFilter = (status) => {
    setSelectedStatus(status);
    // 清空节点位置缓存，以便重新布局
    setNodePositions({});
    fetchDashboardData(status);
  };

  const getKnowledgeStatus = (rate) => {
    if (rate >= 80) return { status: '掌握', color: 'bg-emerald-gradient' };
    if (rate >= 60) return { status: '预警', color: 'bg-amber-gradient' };
    return { status: '薄弱', color: 'bg-rose-gradient' };
  };

  const handleMouseDown = (e) => {
    if (e.target.closest('.knowledge-node')) return;
    setIsDragging(true);
    setDragStart({ x: e.clientX - graphOffset.x, y: e.clientY - graphOffset.y });
  };

  const handleMouseMove = (e) => {
    if (isDragging) {
      setGraphOffset({
        x: e.clientX - dragStart.x,
        y: e.clientY - dragStart.y
      });
    }
    if (hoveredNode) {
      const rect = graphContainerRef.current?.getBoundingClientRect();
      if (rect) {
        setTooltipPosition({
          x: e.clientX - rect.left + 10,
          y: e.clientY - rect.top + 10
        });
      }
    }
  };

  const handleMouseUp = () => {
    setIsDragging(false);
  };

  const handleNodeHover = (node, e) => {
    if (node) {
      const rect = graphContainerRef.current?.getBoundingClientRect();
      if (rect) {
        setTooltipPosition({
          x: e.clientX - rect.left + 10,
          y: e.clientY - rect.top + 10
        });
      }
    }
    setHoveredNode(node);
  };

  const handleResetView = () => {
    setGraphOffset({ x: 0, y: 0 });
  };

  const getStatusTextColor = (status) => {
    switch (status) {
      case '掌握': return 'text-emerald-600';
      case '预警': return 'text-amber-600';
      case '薄弱': return 'text-rose-600';
      default: return 'text-gray-600';
    }
  };

  const [isDetailLoading, setIsDetailLoading] = useState(false);

  const handleNodeClick = async (node) => {
    if (node.status === '薄弱' || node.status === 'weak') {
      setIsDetailLoading(true);
      try {
        const response = await dashboardApi.getKnowledgeDetail(node.id);
        if (response.data) {
          setSelectedNode({
            ...node,
            description: response.data.description,
            examFrequency: response.data.examFrequency,
            errorRate: response.data.difficultyLevel === '高' ? '高' : response.data.difficultyLevel === '中' ? '中' : '低',
            commonErrors: response.data.weakPoints || [],
            resources: response.data.recommendedResources ? response.data.recommendedResources.map(r => r.title) : []
          });
        } else {
          setSelectedNode(node);
        }
      } catch (error) {
        console.error('获取知识点详情失败:', error);
        setSelectedNode(node);
      } finally {
        setIsDetailLoading(false);
      }
    } else {
      setSelectedNode(node);
    }
  };

  const getNodeColorClass = (status) => {
    switch (status) {
      case '掌握':
      case 'mastered':
        return 'bg-emerald-gradient';
      case '预警':
      case 'warning':
        return 'bg-amber-gradient';
      case '薄弱':
      case 'weak':
        return 'bg-rose-gradient';
      default:
        return 'bg-gray-gradient';
    }
  };

  // 获取节点位置 - 使用缓存防止抖动
  const getNodePosition = (nodeId, index, total) => {
    // 如果已经有缓存的位置，直接返回
    if (nodePositions[nodeId]) {
      return nodePositions[nodeId];
    }
    
    if (total === 0) return { x: 50, y: 50 };
    
    // 使用极坐标系统生成自然分布
    const angle = (index / total) * Math.PI * 2 - Math.PI / 2; // 从顶部开始
    const radius = 25 + Math.random() * 10; // 在25%-35%范围内随机
    
    // 添加轻微的随机偏移，使布局更自然
    const offsetX = (Math.random() - 0.5) * 8;
    const offsetY = (Math.random() - 0.5) * 8;
    
    const x = 50 + Math.cos(angle) * radius + offsetX;
    const y = 50 + Math.sin(angle) * radius + offsetY;
    
    const position = { 
      x: Math.max(12, Math.min(88, x)), // 限制在可见区域内
      y: Math.max(12, Math.min(88, y))
    };
    
    // 缓存位置
    setNodePositions(prev => ({ ...prev, [nodeId]: position }));
    
    return position;
  };

  // 过滤后的知识点
  const filteredGraph = knowledgeGraph.filter(node => {
    if (!selectedStatus) return true;
    const nodeStatus = node.status === 'weak' ? '薄弱' : node.status === 'warning' ? '预警' : node.status === 'mastered' ? '掌握' : node.status;
    return nodeStatus === selectedStatus;
  });

  // 获取连接线颜色
  const getNodeConnectionColor = (status) => {
    switch (status) {
      case '掌握':
      case 'mastered':
        return 'rgba(52, 211, 153, 0.4)'; // 绿色
      case '预警':
      case 'warning':
        return 'rgba(245, 158, 11, 0.4)'; // 橙色
      case '薄弱':
      case 'weak':
        return 'rgba(244, 63, 94, 0.4)'; // 红色
      default:
        return 'rgba(156, 163, 175, 0.4)'; // 灰色
    }
  };

  // 新增：缺失的节点光晕样式函数
  const getNodeGlowClass = (status) => {
    switch (status) {
      case '掌握':
      case 'mastered':
        return 'knowledge-node-glow-success';
      case '预警':
      case 'warning':
        return 'knowledge-node-glow-warning';
      case '薄弱':
      case 'weak':
        return 'knowledge-node-glow-danger';
      default:
        return '';
    }
  };

  return (
    <div className="dashboard-page">
      <div className="dashboard-header">
        <div className="absolute inset-0 bg-gradient-to-r from-primary-500/10 via-primary-400/5 to-transparent"></div>
        <div className="absolute top-0 right-0 w-96 h-96 bg-primary-500/5 rounded-full blur-3xl -translate-y-1/2 translate-x-1/2"></div>
        <div className="relative">
          <h1 className="text-3xl font-bold text-dark-800">学情概览</h1>
          <p className="text-dark-400 mt-1">实时跟踪你的学习进度与知识掌握情况</p>
        </div>
      </div>

      <div className="dashboard-cards">
        <div className="dashboard-stat-card">
          <div className="absolute top-0 right-0 w-32 h-32 bg-gradient-to-br from-primary-500/20 to-transparent rounded-bl-full"></div>
          <div className="absolute -bottom-8 -right-8 w-24 h-24 bg-primary-500/10 rounded-full blur-2xl group-hover:bg-primary-500/20 transition-all duration-500"></div>
          <div className="relative">
            <div className="flex items-center justify-between mb-4">
              <div className="dashboard-stat-card-icon dashboard-stat-card-icon-primary">
                <svg className="w-7 h-7 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 19v-6a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2a2 2 0 002-2zm0 0V9a2 2 0 012-2h2a2 2 0 012 2v10m-6 0a2 2 0 002 2h2a2 2 0 002-2m0 0V5a2 2 0 012-2h2a2 2 0 012 2v14a2 2 0 01-2 2h-2a2 2 0 01-2-2z" />
                </svg>
              </div>
              <span className="dashboard-stat-card-trend">{overviewData?.growthRate > 0 ? `+${overviewData.growthRate}%` : `${overviewData?.growthRate || 0}%`}</span>
            </div>
            <h3 className="text-sm font-medium text-dark-400 mb-1">知识掌握率</h3>
            <div className="flex items-baseline gap-2">
              <span className="text-5xl font-bold bg-gradient-to-r from-dark-800 to-dark-600 bg-clip-text text-transparent">{overviewData?.knowledgeRate || 0}</span>
              <span className="text-lg text-dark-400">%</span>
            </div>
            <div className="mt-4 h-2.5 bg-dark-100 rounded-full overflow-hidden shadow-inner">
              <div className="h-full bg-gradient-to-r from-primary-500 via-primary-400 to-primary-500 rounded-full transition-all duration-1000 ease-out shadow-lg shadow-primary-500/30" style={{ width: `${animatedProgress}%` }}></div>
            </div>
          </div>
        </div>

        <div className="dashboard-stat-card dashboard-stat-card-secondary">
          <div className="absolute top-0 right-0 w-32 h-32 bg-gradient-to-br from-secondary-500/20 to-transparent rounded-bl-full"></div>
          <div className="absolute -bottom-8 -right-8 w-24 h-24 bg-secondary-500/10 rounded-full blur-2xl group-hover:bg-secondary-500/20 transition-all duration-500"></div>
          <div className="relative">
            <div className="flex items-center justify-between mb-4">
              <div className="dashboard-stat-card-icon dashboard-stat-card-icon-secondary">
                <svg className="w-7 h-7 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
                </svg>
              </div>
              <span className="dashboard-stat-card-trend dashboard-stat-card-trend-secondary">{overviewData?.docCount || 0} 份</span>
            </div>
            <h3 className="text-sm font-medium text-dark-400 mb-1">已分析文档数</h3>
            <div className="flex items-baseline gap-2">
              <span className="text-5xl font-bold bg-gradient-to-r from-dark-800 to-dark-600 bg-clip-text text-transparent">{overviewData?.docCount || 0}</span>
              <span className="text-lg text-dark-400">份</span>
            </div>
            <div className="mt-4 flex items-center gap-3">
              <div className="avatar-group">
                {[1,2,3].map(i => (
                  <div key={i} className="avatar-group-item">
                    <span className="avatar-group-text">{i}</span>
                  </div>
                ))}
              </div>
              <span className="text-sm text-dark-400 font-medium">近期活跃</span>
            </div>
          </div>
        </div>

        <div className="dashboard-stat-card dashboard-stat-card-warning">
          <div className="absolute top-0 right-0 w-32 h-32 bg-gradient-to-br from-warning-500/20 to-transparent rounded-bl-full"></div>
          <div className="absolute -bottom-8 -right-8 w-24 h-24 bg-warning-500/10 rounded-full blur-2xl group-hover:bg-warning-500/20 transition-all duration-500"></div>
          <div className="relative">
            <div className="flex items-center justify-between mb-4">
              <div className="dashboard-stat-card-icon dashboard-stat-card-icon-warning">
                <svg className="w-7 h-7 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" />
                </svg>
              </div>
              <span className="dashboard-stat-card-trend dashboard-stat-card-trend-warning">最新</span>
            </div>
            <h3 className="text-sm font-medium text-dark-400 mb-1">最近诊断时间</h3>
            <div className="flex items-baseline gap-2">
              <span className="text-3xl font-bold bg-gradient-to-r from-dark-800 to-dark-600 bg-clip-text text-transparent">
                {overviewData?.lastDiagnosis?.split(' ')[0] || '-'}
              </span>
            </div>
            <p className="mt-4 text-sm text-dark-400 font-medium">
              {overviewData?.lastDiagnosis?.split(' ')[1] || ''}
            </p>
          </div>
        </div>
      </div>

      <div className="dashboard-quick-actions">
        <button
          className={`dashboard-quick-action ${activeView === 'analysis' ? 'dashboard-quick-action-primary' : 'dashboard-quick-action-secondary'}`}
          onClick={() => setActiveView('analysis')}
        >
          <div className="absolute inset-0 bg-gradient-to-r from-primary-600 via-primary-500 to-primary-400 opacity-0 group-hover:opacity-100 transition-opacity duration-500"></div>
          <div className="absolute -top-12 -right-12 w-32 h-32 bg-white/10 rounded-full blur-2xl group-hover:bg-white/20 transition-all duration-700"></div>
          <div className="absolute -bottom-8 -left-8 w-24 h-24 bg-primary-400/20 rounded-full blur-2xl"></div>
          <div className="relative flex items-center gap-5">
            <div className={`dashboard-quick-action-icon ${activeView === 'analysis' ? 'dashboard-quick-action-icon-light' : 'dashboard-quick-action-icon-gradient'}`}>
              <svg className="w-7 h-7" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M7 16a4 4 0 01-.88-7.903A5 5 0 1115.9 6L16 6a5 5 0 011 9.9M15 13l-3-3m0 0l-3 3m3-3v12" />
              </svg>
            </div>
            <div className="text-left">
              <div className="flex items-center gap-2">
                <span className="block text-xl font-bold">知识点分析</span>
              </div>
              <span className="text-sm opacity-80">查看薄弱知识点</span>
            </div>
          </div>
          <div className="dashboard-quick-action-arrow">
            <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17 8l4 4m0 0l-4 4m4-4H3" />
            </svg>
          </div>
        </button>
        <button
          className={`dashboard-quick-action ${activeView === 'dailyPush' ? 'dashboard-quick-action-primary' : 'dashboard-quick-action-secondary'}`}
          onClick={() => setActiveView('dailyPush')}
        >
          <div className="absolute inset-0 bg-gradient-to-r from-secondary-600 via-secondary-500 to-secondary-400 opacity-0 group-hover:opacity-100 transition-opacity duration-500"></div>
          <div className="absolute -top-12 -right-12 w-32 h-32 bg-white/10 rounded-full blur-2xl group-hover:bg-white/20 transition-all duration-700"></div>
          <div className="absolute -bottom-8 -left-8 w-24 h-24 bg-secondary-400/20 rounded-full blur-2xl"></div>
          <div className="relative flex items-center gap-5">
            <div className={`dashboard-quick-action-icon ${activeView === 'dailyPush' ? 'dashboard-quick-action-icon-light' : 'dashboard-quick-action-icon-secondary-gradient'}`}>
              <svg className="w-7 h-7" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 17h5l-1.405-1.405A2.032 2.032 0 0118 14.158V11a6.002 6.002 0 00-4-5.659V5a2 2 0 10-4 0v.341C7.67 6.165 6 8.388 6 11v3.159c0 .538-.214 1.055-.595 1.436L4 17h5m6 0v1a3 3 0 11-6 0v-1m6 0H9" />
              </svg>
            </div>
            <div className="text-left">
              <div className="flex items-center gap-2">
                <span className="block text-xl font-bold">查看今日推送</span>
              </div>
              <span className="text-sm opacity-70">个性化学习建议</span>
            </div>
          </div>
          <div className="dashboard-quick-action-arrow dashboard-quick-action-arrow-secondary">
            <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17 8l4 4m0 0l-4 4m4-4H3" />
            </svg>
          </div>
        </button>
      </div>

      {activeView === 'dailyPush' ? (
        <DailyPush />
      ) : (
        <div className="dashboard-content">
        <div className="dashboard-graph">
          <div className="absolute top-0 right-0 w-64 h-64 bg-primary-500/5 rounded-full blur-3xl -translate-y-1/2 translate-x-1/2"></div>
          <div className="dashboard-graph-header">
            <div>
              <h3 className="text-xl font-bold text-dark-800">知识图谱</h3>
              <p className="text-sm text-dark-400 mt-1">点击知识点查看详情</p>
            </div>
            <div className="dashboard-graph-badge">
              <span className="dashboard-graph-badge-dot"></span>
              <span>实时更新</span>
            </div>
          </div>
          
          {/* 状态筛选按钮 */}
          <div className="dashboard-graph-filter">
            <button
              onClick={() => handleStatusFilter('掌握')}
              className={`px-4 py-2 rounded-lg text-sm font-medium transition-all ${
                selectedStatus === '掌握'
                  ? 'bg-emerald-500 text-white shadow-lg shadow-emerald-200'
                  : 'bg-white text-dark-600 hover:bg-dark-50 border border-dark-200'
              }`}
            >
              <span className="inline-block w-2 h-2 rounded-full bg-emerald-400 mr-2"></span>
              掌握
            </button>
            <button
              onClick={() => handleStatusFilter('预警')}
              className={`px-4 py-2 rounded-lg text-sm font-medium transition-all ${
                selectedStatus === '预警'
                  ? 'bg-amber-500 text-white shadow-lg shadow-amber-200'
                  : 'bg-white text-dark-600 hover:bg-dark-50 border border-dark-200'
              }`}
            >
              <span className="inline-block w-2 h-2 rounded-full bg-amber-400 mr-2"></span>
              预警
            </button>
            <button
              onClick={() => handleStatusFilter('薄弱')}
              className={`px-4 py-2 rounded-lg text-sm font-medium transition-all ${
                selectedStatus === '薄弱'
                  ? 'bg-rose-500 text-white shadow-lg shadow-rose-200'
                  : 'bg-white text-dark-600 hover:bg-dark-50 border border-dark-200'
              }`}
            >
              <span className="inline-block w-2 h-2 rounded-full bg-rose-400 mr-2"></span>
              薄弱
            </button>
            <button
              onClick={() => handleStatusFilter(null)}
              className={`px-4 py-2 rounded-lg text-sm font-medium transition-all ${
                selectedStatus === null
                  ? 'bg-primary-500 text-white shadow-lg shadow-primary-200'
                  : 'bg-white text-dark-600 hover:bg-dark-50 border border-dark-200'
              }`}
            >
              <span className="inline-block w-2 h-2 rounded-full bg-primary-400 mr-2"></span>
              全部
            </button>
          </div>
          
          <div
            className="dashboard-graph-chart"
            ref={graphContainerRef}
            onMouseDown={handleMouseDown}
            onMouseMove={handleMouseMove}
            onMouseUp={handleMouseUp}
            onMouseLeave={handleMouseUp}
            style={{ cursor: isDragging ? 'grabbing' : 'grab' }}
          >
            <div className="absolute inset-0 opacity-40">
              <div className="absolute top-1/4 left-1/4 w-32 h-32 bg-primary-200 rounded-full blur-3xl"></div>
              <div className="absolute bottom-1/4 right-1/4 w-24 h-24 bg-secondary-200 rounded-full blur-2xl"></div>
            </div>

            <div
              className="relative w-full h-full transition-transform duration-75"
              style={{ transform: `translate(${graphOffset.x}px, ${graphOffset.y}px)` }}
            >
              {/* 知识图谱连接线 */}
              <svg className="absolute inset-0 w-full h-full pointer-events-none" style={{ zIndex: 1 }}>
                {filteredGraph.map((node, index) => {
                  const connections = node.connections || [];
                  return connections.map((connId) => {
                    const targetNode = filteredGraph.find(n => n.id === connId);
                    if (!targetNode) return null;
                    
                    const nodePos = getNodePosition(node.id, index, filteredGraph.length);
                    const targetPos = getNodePosition(targetNode.id, filteredGraph.findIndex(n => n.id === connId), filteredGraph.length);
                    
                    // 计算从中心节点到两个节点的连线
                    const centerX = 50;
                    const centerY = 50;
                    
                    return (
                      <g key={`${node.id}-${connId}`}>
                        {/* 从中心到当前节点 */}
                        <line
                          x1={`${centerX}%`}
                          y1={`${centerY}%`}
                          x2={`${nodePos.x}%`}
                          y2={`${nodePos.y}%`}
                          stroke="rgba(147, 112, 219, 0.3)"
                          strokeWidth="1"
                          strokeDasharray="4,4"
                          className="animate-pulse-slow"
                        />
                        {/* 从中心到目标节点 */}
                        <line
                          x1={`${centerX}%`}
                          y1={`${centerY}%`}
                          x2={`${targetPos.x}%`}
                          y2={`${targetPos.y}%`}
                          stroke="rgba(147, 112, 219, 0.3)"
                          strokeWidth="1"
                          strokeDasharray="4,4"
                          className="animate-pulse-slow"
                        />
                      </g>
                    );
                  });
                })}
                {/* 中心到所有节点的连接线 */}
                {filteredGraph.map((node, index) => {
                  const nodePos = getNodePosition(node.id, index, filteredGraph.length);
                  return (
                    <line
                      key={`center-${node.id}`}
                      x1="50%"
                      y1="50%"
                      x2={`${nodePos.x}%`}
                      y2={`${nodePos.y}%`}
                      stroke={getNodeConnectionColor(node.status)}
                      strokeWidth="2"
                      className="transition-all duration-500"
                    />
                  );
                })}
              </svg>

              {/* 中心节点 - 使用第一个科目或默认"知识体系" */}
              <div className="absolute top-1/2 left-1/2 transform -translate-x-1/2 -translate-y-1/2 z-20">
                <div className="knowledge-node-circle-center flex items-center justify-center animate-float">
                  <div className="w-24 h-24 rounded-full backdrop-blur-sm flex items-center justify-center">
                    <span className="font-bold text-white text-sm">{subjects.length > 0 ? subjects[0].name : '知识体系'}</span>
                  </div>
                </div>
              </div>

              {filteredGraph.map((node, index) => {
                const nodePos = getNodePosition(node.id, index, filteredGraph.length);

                return (
                  <div
                    key={node.id}
                    className={`knowledge-node ${node.status === '薄弱' || node.status === 'weak' ? 'knowledge-node-weak' : ''} ${node.status === 'warning' || node.status === '预警' ? 'knowledge-node-warning' : ''}`}
                    style={{ 
                      top: `${nodePos.y}%`, 
                      left: `${nodePos.x}%`,
                      transform: 'translate(-50%, -50%)'
                    }}
                    onClick={() => handleNodeClick(node)}
                    onMouseEnter={(e) => handleNodeHover(node, e)}
                    onMouseLeave={() => setHoveredNode(null)}
                  >
                    <div className={`knowledge-node-circle ${getNodeColorClass(node.status)} flex items-center justify-center shadow-lg transition-all duration-300 group-hover:scale-110 group-hover:shadow-xl ${node.status === '薄弱' || node.status === 'weak' ? 'ring-4 ring-rose-200 animate-pulse-soft' : ''} ${node.status === 'warning' || node.status === '预警' ? 'ring-4 ring-amber-200 animate-pulse-soft-warning' : ''}`}>
                      <span
                        className="text-white text-xs font-semibold px-2 text-center leading-tight"
                        style={{
                          wordBreak: 'break-word',
                          whiteSpace: 'normal',
                          maxWidth: '100px',
                          overflow: 'hidden',
                          textOverflow: 'ellipsis',
                          display: '-webkit-box',
                          WebkitLineClamp: 2,
                          WebkitBoxOrient: 'vertical'
                        }}
                        title={node.name}
                      >
                        {node.name}
                      </span>
                    </div>
                    <div className="knowledge-node-label">
                      <span className={`text-xs font-medium ${getStatusTextColor(node.status)}`}>
                        {node.status === 'weak' ? '薄弱' : node.status === 'warning' ? '预警' : node.status === 'mastered' ? '掌握' : node.status}
                        {node.score !== undefined && node.score !== null && ` (${node.score}分)`}
                      </span>
                    </div>
                    {/* 节点光晕效果 */}
                    <div className={`knowledge-node-glow ${getNodeGlowClass(node.status)}`}></div>
                  </div>
                );
              })}
            </div>

            {hoveredNode && (
              <div
                className="absolute z-50 bg-dark-800 text-white p-3 rounded-lg shadow-xl max-w-xs pointer-events-none"
                style={{ top: tooltipPosition.y, left: tooltipPosition.x }}
              >
                <div className="font-bold text-sm mb-1">{hoveredNode.name}</div>
                <div className="text-xs text-dark-300">
                  状态: {hoveredNode.status === 'weak' ? '薄弱' : hoveredNode.status === 'warning' ? '预警' : hoveredNode.status === 'mastered' ? '掌握' : hoveredNode.status}
                </div>
                {hoveredNode.description && (
                  <div className="text-xs text-dark-300 mt-1 line-clamp-2">{hoveredNode.description}</div>
                )}
                {hoveredNode.examFrequency && (
                  <div className="text-xs text-dark-300">考试频率: {hoveredNode.examFrequency}</div>
                )}
              </div>
            )}

            <button
              onClick={handleResetView}
              className="absolute bottom-4 right-4 px-3 py-1.5 bg-white border border-dark-200 rounded-lg text-xs font-medium text-dark-600 hover:bg-dark-50 transition-colors shadow-sm"
            >
              重置视图
            </button>
          </div>
          
          <div className="dashboard-graph-legend">
            <div className="dashboard-graph-legend-item">
              <div className="dashboard-graph-legend-item-dot dashboard-graph-legend-item-dot-success"></div>
              <span className="text-sm text-dark-500 font-medium">掌握</span>
            </div>
            <div className="dashboard-graph-legend-item">
              <div className="dashboard-graph-legend-item-dot dashboard-graph-legend-item-dot-warning"></div>
              <span className="text-sm text-dark-500 font-medium">预警</span>
            </div>
            <div className="dashboard-graph-legend-item">
              <div className="dashboard-graph-legend-item-dot dashboard-graph-legend-item-dot-danger"></div>
              <span className="text-sm text-dark-500 font-medium">薄弱</span>
            </div>
          </div>
        </div>

        <div className="dashboard-analysis">
          <h3 className="text-xl font-bold text-dark-800 mb-6">知识点分析</h3>

          {selectedNode ? (
            <div className="analysis-detail animate-fade-in-up">
              {isDetailLoading && (
                <div className="absolute inset-0 bg-white/80 backdrop-blur-sm flex items-center justify-center rounded-xl z-10">
                  <div className="w-8 h-8 border-4 border-primary-500 border-t-transparent rounded-full animate-spin"></div>
                </div>
              )}
              <div className="analysis-detail-header">
                <div>
                  <h4 className="text-xl font-bold text-dark-800">{selectedNode.name}</h4>
                  <div className="flex items-center gap-2 mt-2">
                    <span className={`w-3 h-3 rounded-full ${getNodeColorClass(selectedNode.status)} animate-pulse-soft`}></span>
                    <span className={`text-sm font-medium ${getStatusTextColor(selectedNode.status)}`}>{selectedNode.status === 'weak' ? '薄弱' : selectedNode.status === 'warning' ? '预警' : selectedNode.status === 'mastered' ? '掌握' : selectedNode.status}</span>
                  </div>
                </div>
                {(selectedNode.status === '薄弱' || selectedNode.status === 'weak') && (
                  <span className="analysis-detail-tag">待加强</span>
                )}
              </div>

              {selectedNode.description && (
                <div className="space-y-5">
                  <div className="analysis-detail-section p-4 bg-gradient-to-br from-dark-50 to-dark-100/50 rounded-xl">
                    <div className="flex items-center gap-2 mb-2">
                      <svg className="w-4 h-4 text-dark-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
                      </svg>
                      <h5 className="text-sm font-semibold text-dark-600">知识描述</h5>
                    </div>
                    <p className="text-sm text-dark-500 leading-relaxed">{selectedNode.description}</p>
                  </div>

                  {selectedNode.examFrequency && (
                    <div className="analysis-detail-grid">
                      <div className="analysis-detail-stat analysis-detail-stat-warning">
                        <div className="flex items-center gap-2 mb-1">
                          <svg className="w-4 h-4 text-warning-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
                          </svg>
                          <h5 className="text-xs font-semibold text-warning-700">考试频率</h5>
                        </div>
                        <p className="text-lg font-bold text-warning-700">{selectedNode.examFrequency}</p>
                      </div>
                      <div className="analysis-detail-stat analysis-detail-stat-danger">
                        <div className="flex items-center gap-2 mb-1">
                          <svg className="w-4 h-4 text-rose-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
                          </svg>
                          <h5 className="text-xs font-semibold text-rose-700">易错程度</h5>
                        </div>
                        <p className="text-lg font-bold text-rose-700">{selectedNode.errorRate || '高'}</p>
                      </div>
                    </div>
                  )}

                  {selectedNode.commonErrors && selectedNode.commonErrors.length > 0 && (
                    <div className="analysis-detail-section">
                      <h5 className="text-sm font-semibold text-dark-600 mb-3 flex items-center gap-2">
                        <svg className="w-4 h-4 text-danger-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4m0 4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
                        </svg>
                        常见易错点
                      </h5>
                      <div className="flex flex-wrap gap-2">
                        {selectedNode.commonErrors.map((item, index) => (
                          <span key={index} className="analysis-detail-tag-item">{item}</span>
                        ))}
                      </div>
                    </div>
                  )}

                  {selectedNode.resources && selectedNode.resources.length > 0 && (
                    <div className="analysis-detail-section">
                      <h5 className="text-sm font-semibold text-dark-600 mb-3 flex items-center gap-2">
                        <svg className="w-4 h-4 text-secondary-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 6.253v13m0-13C10.832 5.477 9.246 5 7.5 5S4.168 5.477 3 6.253v13C4.168 18.477 5.754 18 7.5 18s3.332.477 4.5 1.253m0-13C13.168 5.477 14.754 5 16.5 5c1.747 0 3.332.477 4.5 1.253v13C19.832 18.477 18.247 18 16.5 18c-1.746 0-3.332.477-4.5 1.253" />
                        </svg>
                        推荐资源
                      </h5>
                      <div className="space-y-2">
                        {selectedNode.resources.map((item, index) => (
                          <div key={index} className="analysis-detail-resource">
                            <svg className="w-4 h-4 text-secondary-500" fill="currentColor" viewBox="0 0 20 20">
                              <path fillRule="evenodd" d="M12.316 3.051a1 1 0 01.633 1.265l-4 12a1 1 0 11-1.898-.632l4-12a1 1 0 011.265-.633zM5.707 6.293a1 1 0 010 1.414L3.414 10l2.293 2.293a1 1 0 11-1.414 1.414l-3-3a1 1 0 010-1.414l3-3a1 1 0 011.414 0zm8.586 0a1 1 0 011.414 0l3 3a1 1 0 010 1.414l-3 3a1 1 0 11-1.414-1.414L16.586 10l-2.293-2.293a1 1 0 010-1.414z" clipRule="evenodd" />
                            </svg>
                            <span className="text-sm text-secondary-700 font-medium group-hover:text-secondary-800 transition-colors">{item}</span>
                          </div>
                        ))}
                      </div>
                    </div>
                  )}
                </div>
              )}
            </div>
          ) : (
            <div className="dashboard-empty-state">
              <div className="w-20 h-20 rounded-full bg-gradient-to-br from-dark-100 to-dark-200 flex items-center justify-center mb-4 shadow-inner">
                <svg className="w-10 h-10 text-dark-300" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9.663 17h4.673M12 3v1m6.364 1.636l-.707.707M21 12h-1M4 12H3m3.343-5.657l-.707-.707m2.828 9.9a5 5 0 117.072 0l-.548.547A3.374 3.374 0 0014 18.469V19a2 2 0 11-4 0v-.531c0-.895-.356-1.754-.988-2.386l-.548-.547z" />
                </svg>
              </div>
              <h4 className="text-lg font-semibold text-dark-600 mb-2">选择薄弱知识点</h4>
              <p className="text-sm text-dark-400 max-w-xs">点击左侧知识图谱中的红色节点，查看该知识点的详细分析和推荐资源</p>
            </div>
          )}
        </div>

    </div>
    )}
  </div>
);
};

export default Dashboard;

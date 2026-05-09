import React, { useState, useEffect } from 'react';
import { useNavigate, useLocation } from 'react-router-dom';
import '../DailyPush.scss';
import { todayApi, resourcesApi } from '../api';

const DailyPush = () => {
  const navigate = useNavigate();
  const location = useLocation();
  const [activeTab, setActiveTab] = useState('recommendations');
  const [pushData, setPushData] = useState(null);
  const [recommendations, setRecommendations] = useState([]);
  const [progress, setProgress] = useState(null);
  const [goals, setGoals] = useState([]);
  const [studyTips, setStudyTips] = useState([]);
  const [isLoading, setIsLoading] = useState(true);
  const [favorites, setFavorites] = useState(new Set());
  const [selectedRecommendation, setSelectedRecommendation] = useState(null);
  const [lastUpdateTime, setLastUpdateTime] = useState(null);

  useEffect(() => {
    fetchAllData();
    fetchFavorites();
  }, []);

  useEffect(() => {
    const params = new URLSearchParams(location.search);
    const resourceId = params.get('resourceId');
    if (resourceId) {
      fetchResourceDetail(resourceId);
    }
  }, [location.search]);

  const fetchAllData = async () => {
    setIsLoading(true);
    try {
      const [pushRes, recRes, progressRes, goalsRes] = await Promise.all([
        todayApi.getPush(),
        todayApi.getRecommendations(),
        todayApi.getProgress(),
        todayApi.getGoals(),
      ]);

      if (pushRes.data) {
        setPushData(pushRes.data);
      }
      if (recRes.data && recRes.data.recommendations) {
        setRecommendations(recRes.data.recommendations);
      }
      if (progressRes.data) {
        setProgress(progressRes.data);
      }
      if (goalsRes.data) {
        setGoals(goalsRes.data.todayGoals || []);
        setStudyTips(goalsRes.data.studyTips || []);
      }
      setLastUpdateTime(new Date());
    } catch (error) {
      console.error('获取今日推送数据失败:', error);
    } finally {
      setIsLoading(false);
    }
  };

  const fetchFavorites = async () => {
    try {
      const response = await resourcesApi.getFavorites();
      if (response.data && response.data.resources) {
        const favoriteIds = new Set(response.data.resources.map(r => r.id));
        setFavorites(favoriteIds);
      }
    } catch (error) {
      console.error('获取收藏失败:', error);
    }
  };

  const fetchResourceDetail = async (resourceId) => {
    try {
      const response = await resourcesApi.getDetail(resourceId);
      if (response.data) {
        setSelectedRecommendation(response.data);
      }
    } catch (error) {
      console.error('获取资源详情失败:', error);
    }
  };

  const handleToggleFavorite = async (resourceId, e) => {
    if (e) e.stopPropagation();
    try {
      const response = await resourcesApi.toggleFavorite(resourceId);
      if (response.data) {
        const newFavorites = new Set(favorites);
        if (response.data.favorited) {
          newFavorites.add(resourceId);
        } else {
          newFavorites.delete(resourceId);
        }
        setFavorites(newFavorites);
      }
    } catch (error) {
      console.error('收藏失败:', error);
    }
  };

  const handleGoalToggle = async (goalId) => {
    try {
      await todayApi.updateGoal(goalId);
      setGoals(prev => prev.map(goal =>
        goal.id === goalId ? { ...goal, completed: !goal.completed } : goal
      ));
    } catch (error) {
      console.error('更新目标失败:', error);
    }
  };

  const handleStartLearning = (item) => {
    if (item.url) {
      window.open(item.url, '_blank');
    } else {
      navigate(`/resources?resourceId=${item.id}`);
    }
  };

  const handleViewResource = (item) => {
    navigate(`/resources?resourceId=${item.id}`);
  };

  const handleMainStartLearning = () => {
    if (recommendations.length > 0) {
      const firstItem = recommendations[0];
      handleStartLearning(firstItem);
    } else {
      navigate('/resources');
    }
  };

  const getTypeIcon = (type) => {
    switch (type) {
      case 'video': return '🎬';
      case '练习': return '✏️';
      case 'exercise': return '✏️';
      case '文章': return '📝';
      case 'article': return '📝';
      case '课程': return '📚';
      case 'course': return '📚';
      default: return '📚';
    }
  };

  const getTypeLabel = (type) => {
    const typeMap = {
      'video': '视频',
      '练习': '练习',
      'exercise': '练习',
      '文章': '文章',
      'article': '文章',
      '课程': '课程',
      'course': '课程',
    };
    return typeMap[type] || type;
  };

  const getDifficultyColor = (difficulty) => {
    switch (difficulty) {
      case '入门': return 'beginner';
      case '初级': return 'beginner';
      case '中级': return 'intermediate';
      case '进阶': return 'advanced';
      case '高级': return 'advanced';
      default: return '';
    }
  };

  const formatUpdateTime = (date) => {
    if (!date) return '';
    return date.toLocaleString('zh-CN', {
      month: '2-digit',
      day: '2-digit',
      hour: '2-digit',
      minute: '2-digit',
      timeZone: 'Asia/Shanghai'
    });
  };

  if (isLoading) {
    return (
      <div className="daily-push-page">
        <div className="flex items-center justify-center h-64">
          <div className="text-center">
            <div className="w-12 h-12 border-4 border-primary-500 border-t-transparent rounded-full animate-spin mx-auto mb-4"></div>
            <p className="text-dark-400">加载中...</p>
          </div>
        </div>
      </div>
    );
  }

  const knowledgeRate = progress?.knowledgeRate;

  return (
    <div className="daily-push-page">
      <div className="daily-push-header">
        <div className="daily-push-header-left">
          <div className="daily-push-header-icon">
            <svg className="w-6 h-6 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 17h5l-1.405-1.405A2.032 2.032 0 0118 14.158V11a6.002 6.002 0 00-4-5.659V5a2 2 0 10-4 0v.341C7.67 6.165 6 8.388 6 11v3.159c0 .538-.214 1.055-.595 1.436L4 17h5m6 0v1a3 3 0 11-6 0v-1m6 0H9" />
            </svg>
          </div>
          <div>
            <h2 className="daily-push-title">今日推送</h2>
            {lastUpdateTime && (
              <span className="daily-push-update-time">
                数据更新时间: {lastUpdateTime.toLocaleTimeString()}
              </span>
            )}
            <p className="daily-push-subtitle">{pushData?.date || new Date().toISOString().split('T')[0]} · 个性化学习建议</p>
          </div>
        </div>
        {lastUpdateTime && (
          <div className="daily-push-header-time">
            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" />
            </svg>
            <span>更新于 {formatUpdateTime(lastUpdateTime)}</span>
          </div>
        )}
      </div>

      <div className="daily-push-overview">
        <div className="daily-push-overview-item">
          <div className="daily-push-overview-icon sun">
            <span>☀️</span>
          </div>
          <div className="daily-push-overview-info">
            <span className="daily-push-overview-label">天气</span>
            <span className="daily-push-overview-value">{pushData?.weather || '晴'}</span>
          </div>
        </div>
        <div className="daily-push-overview-item">
          <div className="daily-push-overview-icon clock">
            <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" />
            </svg>
          </div>
          <div className="daily-push-overview-info">
            <span className="daily-push-overview-label">建议学习</span>
            <span className="daily-push-overview-value">{pushData?.suggestedStudyHours || 3}小时</span>
          </div>
        </div>
        <div className="daily-push-overview-item">
          <div className="daily-push-overview-icon status">
            <span>✨</span>
          </div>
          <div className="daily-push-overview-info">
            <span className="daily-push-overview-label">状态</span>
            <span className="daily-push-overview-value">{pushData?.status || '最佳'}</span>
          </div>
        </div>
        <div className="daily-push-overview-item">
          <div className="daily-push-overview-icon trend">
            <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 7h8m0 0v8m0-8l-8 8-4-4-6 6" />
            </svg>
          </div>
          <div className="daily-push-overview-info">
            <span className="daily-push-overview-label">知识点掌握率</span>
            <span className="daily-push-overview-value daily-push-overview-value-success">
              {knowledgeRate !== undefined ? `${(knowledgeRate * 100).toFixed(0)}%` : '--'}
            </span>
          </div>
        </div>
      </div>

      <div className="daily-push-tabs">
        <button
          className={`daily-push-tab ${activeTab === 'recommendations' ? 'active' : ''}`}
          onClick={() => setActiveTab('recommendations')}
        >
          📚 推荐内容
        </button>
        <button
          className={`daily-push-tab ${activeTab === 'plan' ? 'active' : ''}`}
          onClick={() => setActiveTab('plan')}
        >
          📋 复习计划
        </button>
        <button
          className={`daily-push-tab ${activeTab === 'progress' ? 'active' : ''}`}
          onClick={() => setActiveTab('progress')}
        >
          📊 进步追踪
        </button>
      </div>

      <div className="daily-push-content">
        {activeTab === 'recommendations' && (
          <div className="daily-push-recommendations">
            {recommendations.length === 0 ? (
              <div className="daily-push-empty">
                <div className="daily-push-empty-icon">
                  <svg className="w-12 h-12" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M20 13V6a2 2 0 00-2-2H6a2 2 0 00-2 2v7m16 0v5a2 2 0 01-2 2H6a2 2 0 01-2-2v-5m16 0h-2.586a1 1 0 00-.707.293l-2.414 2.414a1 1 0 01-.707.293h-3.172a1 1 0 01-.707-.293l-2.414-2.414A1 1 0 006.586 13H4" />
                  </svg>
                </div>
                <h3 className="daily-push-empty-title">暂无推荐内容</h3>
                <p className="daily-push-empty-text">上传成绩单或试卷后获取个性化推荐</p>
                <button
                  onClick={() => navigate('/analysis')}
                  className="daily-push-empty-btn"
                >
                  <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-8l-4-4m0 0L8 8m4-4v12" />
                  </svg>
                  前往上传成绩单
                </button>
              </div>
            ) : (
              recommendations.map((item, index) => (
                <div key={index} className="daily-push-recommendation-card">
                  <div className="daily-push-recommendation-header">
                    <div className="daily-push-recommendation-type">
                      <span className="daily-push-recommendation-type-icon">{getTypeIcon(item.type || item.类型)}</span>
                      <span className="daily-push-recommendation-type-label">{getTypeLabel(item.type || item.类型)}</span>
                    </div>
                    <div className="flex items-center gap-2">
                      <span className={`daily-push-difficulty daily-push-difficulty-${getDifficultyColor(item.difficulty)}`}>
                        {item.difficulty}
                      </span>
                      <button
                        onClick={(e) => handleToggleFavorite(item.id, e)}
                        className={`daily-push-favorite-btn ${favorites.has(item.id) ? 'active' : ''}`}
                      >
                        <svg className="w-4 h-4" fill={favorites.has(item.id) ? 'currentColor' : 'none'} stroke="currentColor" viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4.318 6.318a4.5 4.5 0 000 6.364L12 20.364l7.682-7.682a4.5 4.5 0 00-6.364-6.364L12 7.636l-1.318-1.318a4.5 4.5 0 00-6.364 0z" />
                        </svg>
                      </button>
                    </div>
                  </div>

                  <h4 className="daily-push-recommendation-title">{item.title}</h4>

                  <div className="daily-push-recommendation-meta">
                    {item.platform && (
                      <span className="daily-push-recommendation-meta-item">
                        <svg className="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 12a9 9 0 01-9 9m9-9a9 9 0 00-9-9m9 9H3m9 9a9 9 0 01-9-9m9 9c1.657 0 3-4.03 3-9s-1.343-9-3-9m0 18c-1.657 0-3-4.03-3-9s1.343-9 3-9m-9 9a9 9 0 019-9" />
                        </svg>
                        {item.platform}
                      </span>
                    )}
                    {item.duration && (
                      <span className="daily-push-recommendation-meta-item">
                        <svg className="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" />
                        </svg>
                        {item.duration}
                      </span>
                    )}
                    {item.题目数 && (
                      <span className="daily-push-recommendation-meta-item">
                        <svg className="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2" />
                        </svg>
                        {item.题目数}题
                      </span>
                    )}
                    {item.source && (
                      <span className="daily-push-recommendation-meta-item">
                        <svg className="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M7 7h.01M7 3h5c.512 0 1.024.195 1.414.586l7 7a2 2 0 010 2.828l-7 7a2 2 0 01-2.828 0l-7-7A1.994 1.994 0 013 12V7a4 4 0 014-4z" />
                        </svg>
                        {item.source}
                      </span>
                    )}
                  </div>

                  <div className="daily-push-recommendation-reason">
                    <div className="daily-push-recommendation-reason-icon">
                      <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 10V3L4 14h7v7l9-11h-7z" />
                      </svg>
                    </div>
                    <div className="daily-push-recommendation-reason-content">
                      <span className="daily-push-recommendation-reason-label">推荐理由</span>
                      <p className="daily-push-recommendation-reason-text">{item.reason}</p>
                    </div>
                  </div>

                  <div className="daily-push-recommendation-tags">
                    {item.tags && item.tags.slice(0, 3).map((tag, tagIndex) => (
                      <span key={tagIndex} className="daily-push-recommendation-tag">{tag}</span>
                    ))}
                  </div>

                  <div className="daily-push-recommendation-actions">
                    <button
                      className="daily-push-recommendation-action primary"
                      onClick={() => handleStartLearning(item)}
                    >
                      <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M14.752 11.168l-3.197-2.132A1 1 0 0010 9.87v4.263a1 1 0 001.555.832l3.197-2.132a1 1 0 000-1.664z" />
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
                      </svg>
                      开始学习
                    </button>
                    <button
                      className="daily-push-recommendation-action secondary"
                      onClick={() => handleViewResource(item)}
                    >
                      查看详情
                    </button>
                  </div>
                </div>
              ))
            )}
          </div>
        )}

        {activeTab === 'plan' && (
          <div className="daily-push-plan">
            <div className="daily-push-plan-section">
              <div className="daily-push-plan-header">
                <h3 className="daily-push-plan-title">今日目标</h3>
                <span className="daily-push-plan-badge">{goals.filter(g => g.completed).length}/{goals.length}</span>
              </div>
              <div className="daily-push-plan-tasks">
                {goals.length === 0 ? (
                  <div className="daily-push-empty-inline">
                    <p className="text-dark-500">暂无学习目标</p>
                    <button
                      onClick={() => navigate('/analysis')}
                      className="daily-push-link-btn"
                    >
                      上传成绩单生成学习计划
                    </button>
                  </div>
                ) : (
                  goals.map((task) => (
                    <div key={task.id} className="daily-push-plan-task">
                      <label className="daily-push-checkbox">
                        <input
                          type="checkbox"
                          checked={task.completed}
                          onChange={() => handleGoalToggle(task.id)}
                        />
                        <span className="daily-push-checkbox-mark"></span>
                      </label>
                      <div className="daily-push-plan-task-info">
                        <span className={`daily-push-plan-task-content ${task.completed ? 'completed' : ''}`}>
                          {task.title}
                        </span>
                        <span className="daily-push-plan-task-duration">
                          <svg className="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" />
                          </svg>
                          预计 {task.estimatedMinutes}分钟
                        </span>
                      </div>
                      {task.completed && (
                        <span className="daily-push-plan-task-check">
                          <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                          </svg>
                        </span>
                      )}
                    </div>
                  ))
                )}
              </div>
            </div>
            <div className="daily-push-plan-section">
              <div className="daily-push-plan-header">
                <h3 className="daily-push-plan-title">💡 学习建议</h3>
              </div>
              <ul className="daily-push-tips">
                {studyTips.length === 0 ? (
                  <li className="daily-push-tip">
                    <span className="daily-push-tip-highlight">上传成绩单</span>获取个性化学习建议
                  </li>
                ) : (
                  studyTips.map((tip, index) => (
                    <li key={index} className="daily-push-tip">{tip}</li>
                  ))
                )}
              </ul>
            </div>
          </div>
        )}

        {activeTab === 'progress' && (
          <div className="daily-push-progress">
            <div className="daily-push-progress-header">
              <h3 className="daily-push-progress-title">学习数据概览</h3>
              {lastUpdateTime && (
                <span className="daily-push-progress-update">
                  更新于 {formatUpdateTime(lastUpdateTime)}
                </span>
              )}
            </div>
            <div className="daily-push-progress-grid">
              <div className="daily-push-progress-card">
                <div className="daily-push-progress-icon">
                  <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" />
                  </svg>
                </div>
                <div className="daily-push-progress-info">
                  <span className="daily-push-progress-label">本周学习时长</span>
                  <span className="daily-push-progress-value">
                    {progress?.weeklyStudyHours !== undefined ? `${progress.weeklyStudyHours}小时` : '--'}
                  </span>
                </div>
              </div>
              <div className="daily-push-progress-card">
                <div className="daily-push-progress-icon success">
                  <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 7h8m0 0v8m0-8l-8 8-4-4-6 6" />
                  </svg>
                </div>
                <div className="daily-push-progress-info">
                  <span className="daily-push-progress-label">较上周增长</span>
                  <span className="daily-push-progress-value success">
                    {progress?.weeklyGrowthRate !== undefined
                      ? `${(progress.weeklyGrowthRate * 100).toFixed(0)}%`
                      : '+25%'}
                  </span>
                </div>
              </div>
              <div className="daily-push-progress-card">
                <div className="daily-push-progress-icon primary">
                  <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 19v-6a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2a2 2 0 002-2zm0 0V9a2 2 0 012-2h2a2 2 0 012 2v10m-6 0a2 2 0 002 2h2a2 2 0 002-2m0 0V5a2 2 0 012-2h2a2 2 0 012 2v14a2 2 0 01-2 2h-2a2 2 0 01-2-2z" />
                  </svg>
                </div>
                <div className="daily-push-progress-info">
                  <span className="daily-push-progress-label">知识点掌握率</span>
                  <div className="daily-push-progress-value-row">
                    <span className="daily-push-progress-value">
                      {knowledgeRate !== undefined ? `${(knowledgeRate * 100).toFixed(0)}%` : '--'}
                    </span>
                    <div className="daily-push-progress-bar">
                      <div
                        className="daily-push-progress-bar-fill"
                        style={{ width: knowledgeRate !== undefined ? `${knowledgeRate * 100}%` : '0%' }}
                      ></div>
                    </div>
                  </div>
                </div>
              </div>
              <div className="daily-push-progress-card">
                <div className="daily-push-progress-icon warning">
                  <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 7h8m0 0v8m0-8l-8 8-4-4-6 6" />
                  </svg>
                </div>
                <div className="daily-push-progress-info">
                  <span className="daily-push-progress-label">较上周提升</span>
                  <span className="daily-push-progress-value success">
                    {progress?.knowledgeGrowthRate !== undefined
                      ? `+${(progress.knowledgeGrowthRate * 100).toFixed(1)}%`
                      : '+2%'}
                  </span>
                </div>
              </div>
            </div>
            <div className="daily-push-progress-chart">
              <h3 className="daily-push-progress-chart-title">本周学习趋势</h3>
              <div className="daily-push-progress-chart-bars">
                {(progress?.weeklyTrend || ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'].map(day => ({ day, hours: 0, isToday: false }))).map((item) => (
                  <div key={item.day} className="daily-push-progress-chart-bar-container">
                    <div
                      className={`daily-push-progress-chart-bar ${item.isToday ? 'today' : ''}`}
                      style={{ height: `${Math.max((item.hours || 0) * 15, 10)}%` }}
                    ></div>
                    <span className={`daily-push-progress-chart-label ${item.isToday ? 'today' : ''}`}>{item.day}</span>
                  </div>
                ))}
              </div>
            </div>
          </div>
        )}
      </div>

      <div className="daily-push-footer">
        <button
          className="daily-push-btn-primary"
          onClick={handleMainStartLearning}
        >
          <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M14.752 11.168l-3.197-2.132A1 1 0 0010 9.87v4.263a1 1 0 001.555.832l3.197-2.132a1 1 0 000-1.664z" />
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
          </svg>
          开始今日学习
        </button>
      </div>

      {selectedRecommendation && (
        <div className="daily-push-modal" onClick={() => setSelectedRecommendation(null)}>
          <div className="daily-push-modal-content" onClick={(e) => e.stopPropagation()}>
            <div className="daily-push-modal-header">
              <div>
                <div className="flex items-center gap-3 mb-2">
                  <span className="daily-push-modal-badge">
                    {selectedRecommendation.platform || '未知'}
                  </span>
                  <span className="daily-push-modal-type">{getTypeLabel(selectedRecommendation.type || selectedRecommendation.类型)}</span>
                </div>
                <h3 className="daily-push-modal-title">{selectedRecommendation.title}</h3>
              </div>
              <div className="flex items-center gap-2">
                <button
                  onClick={() => handleToggleFavorite(selectedRecommendation.id)}
                  className={`daily-push-modal-favorite ${favorites.has(selectedRecommendation.id) ? 'active' : ''}`}
                >
                  <svg className="w-5 h-5" fill={favorites.has(selectedRecommendation.id) ? 'currentColor' : 'none'} stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4.318 6.318a4.5 4.5 0 000 6.364L12 20.364l7.682-7.682a4.5 4.5 0 00-6.364-6.364L12 7.636l-1.318-1.318a4.5 4.5 0 00-6.364 0z" />
                  </svg>
                </button>
                <button onClick={() => setSelectedRecommendation(null)} className="daily-push-modal-close">
                  <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                  </svg>
                </button>
              </div>
            </div>

            <div className="daily-push-modal-body">
              <div className="daily-push-modal-reason">
                <div className="daily-push-modal-reason-header">
                  <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 10V3L4 14h7v7l9-11h-7z" />
                  </svg>
                  <h4>AI 推荐理由</h4>
                </div>
                <p>{selectedRecommendation.reason}</p>
              </div>

              <div className="daily-push-modal-section">
                <h4 className="daily-push-modal-section-title">内容摘要</h4>
                <p className="daily-push-modal-section-text">{selectedRecommendation.summary || selectedRecommendation.description || '暂无摘要'}</p>
              </div>

              <div className="daily-push-modal-tags">
                {selectedRecommendation.tags && selectedRecommendation.tags.map((tag, index) => (
                  <span key={index} className="daily-push-modal-tag">{tag}</span>
                ))}
              </div>

              <div className="daily-push-modal-meta">
                <div className="daily-push-modal-meta-item">
                  <svg className="w-5 h-5 text-warning-500" fill="currentColor" viewBox="0 0 20 20">
                    <path d="M9.049 2.927c.3-.921 1.603-.921 1.902 0l1.07 3.292a1 1 0 00.95.69h3.462c.969 0 1.371 1.24.588 1.81l-2.8 2.034a1 1 0 00-.364 1.118l1.07 3.292c.3.921-.755 1.688-1.54 1.118l-2.8-2.034a1 1 0 00-1.175 0l-2.8 2.034c-.784.57-1.838-.197-1.539-1.118l1.07-3.292a1 1 0 00-.364-1.118L2.98 8.72c-.783-.57-.38-1.81.588-1.81h3.461a1 1 0 00.951-.69l1.07-3.292z" />
                  </svg>
                  <span className="font-bold">{selectedRecommendation.rating || 0}</span>
                </div>
                <span className={`daily-push-modal-difficulty daily-push-difficulty-${getDifficultyColor(selectedRecommendation.difficulty)}`}>
                  {selectedRecommendation.difficulty || '初级'}
                </span>
                <span className="daily-push-modal-views">{selectedRecommendation.viewCount || 0} 次浏览</span>
              </div>

              {selectedRecommendation.url && (
                <a
                  href={selectedRecommendation.url}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="daily-push-modal-action"
                >
                  <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10 6H6a2 2 0 00-2 2v10a2 2 0 002 2h10a2 2 0 002-2v-4M14 4h6m0 0v6m0-6L10 14" />
                  </svg>
                  前往学习
                </a>
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default DailyPush;
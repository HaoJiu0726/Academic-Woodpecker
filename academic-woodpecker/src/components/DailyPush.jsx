import React, { useState, useEffect, useRef } from 'react';
import { useNavigate, useLocation } from 'react-router-dom';
import { useSelector } from 'react-redux';
import '../DailyPush.scss';
import { todayApi, resourcesApi } from '../api';

const PLATFORM_STYLES = {
  'B站': { color: '#FB7299', gradient: 'linear-gradient(135deg, #FB7299 0%, #fc8bab 100%)', bg: '#fff0f5', border: '#ffd6e7', icon: '🎬' },
  'Virtual Online Judge': { color: '#4CAF50', gradient: 'linear-gradient(135deg, #4CAF50 0%, #66BB6A 100%)', bg: '#f0faf0', border: '#c8e6c9', icon: '💻' },
  'CSDN': { color: '#FC5531', gradient: 'linear-gradient(135deg, #FC5531 0%, #ff7b5f 100%)', bg: '#fff5f2', border: '#ffd9d0', icon: '📝' },
};

const getPlatformStyle = (platform) => PLATFORM_STYLES[platform] || { color: '#0ea5e9', gradient: 'linear-gradient(135deg, #0ea5e9 0%, #6366f1 100%)', bg: '#f0f9ff', border: '#bae6fd', icon: '📚' };

const CACHE_KEY_PREFIX = 'daily_push_cache_';

const getCachedData = (key) => {
  try {
    const raw = localStorage.getItem(key);
    if (!raw) return null;
    const parsed = JSON.parse(raw);
    const today = new Date().toISOString().split('T')[0];
    if (parsed.date !== today) {
      localStorage.removeItem(key);
      return null;
    }
    return parsed.data;
  } catch {
    return null;
  }
};

const setCachedData = (key, data) => {
  try {
    localStorage.setItem(key, JSON.stringify({
      date: new Date().toISOString().split('T')[0],
      data,
    }));
  } catch {}
};

const DailyPush = () => {
  const navigate = useNavigate();
  const location = useLocation();
  const userId = useSelector((state) => state.user.userInfo?.id);
  const prevUserIdRef = useRef(userId);
  const [activeTab, setActiveTab] = useState('recommendations');
  const [pushData, setPushData] = useState(null);
  const [recommendations, setRecommendations] = useState([]);
  const [hasKnowledgeData, setHasKnowledgeData] = useState(false);
  const [progress, setProgress] = useState(null);
  const [goals, setGoals] = useState([]);
  const [studyTips, setStudyTips] = useState([]);
  const [isLoading, setIsLoading] = useState(true);
  const [favorites, setFavorites] = useState(new Set());
  const [selectedRecommendation, setSelectedRecommendation] = useState(null);
  const [lastUpdateTime, setLastUpdateTime] = useState(null);
  const [pushHistory, setPushHistory] = useState([]);
  const [showHistory, setShowHistory] = useState(false);
  const [error, setError] = useState(null);
  const [editingGoal, setEditingGoal] = useState(null);
  const [editGoalTitle, setEditGoalTitle] = useState('');
  const [editGoalMinutes, setEditGoalMinutes] = useState(30);
  const [showAddGoal, setShowAddGoal] = useState(false);
  const [newGoalTitle, setNewGoalTitle] = useState('');
  const [newGoalMinutes, setNewGoalMinutes] = useState(30);
  const [totalStudyMinutes, setTotalStudyMinutes] = useState(0);

  useEffect(() => {
    if (prevUserIdRef.current !== userId) {
      setRecommendations([]);
      setHasKnowledgeData(false);
      setPushData(null);
      setProgress(null);
      setGoals([]);
      setStudyTips([]);
      setPushHistory([]);
      setFavorites(new Set());
      setSelectedRecommendation(null);
      setError(null);
      localStorage.removeItem(CACHE_KEY_PREFIX + 'recommendations');
      localStorage.removeItem(CACHE_KEY_PREFIX + 'push');
      prevUserIdRef.current = userId;
    }
    fetchAllData();
    fetchFavorites();
  }, [userId]);

  useEffect(() => {
    const params = new URLSearchParams(location.search);
    const resourceId = params.get('resourceId');
    if (resourceId) {
      fetchResourceDetail(resourceId);
    }
  }, [location.search]);

  const fetchAllData = async () => {
    setIsLoading(true);
    setError(null);

    const cachedRecs = getCachedData(CACHE_KEY_PREFIX + 'recommendations');
    const cachedPush = getCachedData(CACHE_KEY_PREFIX + 'push');

    if (cachedRecs && cachedPush) {
      setRecommendations(cachedRecs.recommendations || []);
      setHasKnowledgeData(cachedRecs.hasKnowledgeData || false);
      setPushData(cachedPush);
      setLastUpdateTime(new Date());

      const [progressRes, goalsRes] = await Promise.all([
        todayApi.getProgress().catch(e => ({ data: null })),
        todayApi.getGoals().catch(e => ({ data: null })),
      ]);
      if (progressRes.data) setProgress(progressRes.data);
      if (goalsRes.data) {
        setGoals(goalsRes.data.todayGoals || []);
        setStudyTips(goalsRes.data.studyTips || []);
      }
      setIsLoading(false);
      return;
    }

    try {
      const [pushRes, recRes, progressRes, goalsRes] = await Promise.all([
        todayApi.getPush().catch(e => ({ data: null })),
        todayApi.getRecommendations().catch(e => ({ data: null })),
        todayApi.getProgress().catch(e => ({ data: null })),
        todayApi.getGoals().catch(e => ({ data: null })),
      ]);

      if (pushRes.data) {
        setPushData(pushRes.data);
        setHasKnowledgeData(pushRes.data.hasKnowledgeData || false);
        setCachedData(CACHE_KEY_PREFIX + 'push', pushRes.data);
      }
      if (recRes.data) {
        setRecommendations(recRes.data.recommendations || []);
        if (recRes.data.hasKnowledgeData !== undefined) {
          setHasKnowledgeData(recRes.data.hasKnowledgeData);
        }
        setCachedData(CACHE_KEY_PREFIX + 'recommendations', {
          recommendations: recRes.data.recommendations || [],
          hasKnowledgeData: recRes.data.hasKnowledgeData || false,
        });
      }
      if (progressRes.data) {
        setProgress(progressRes.data);
      }
      if (goalsRes.data) {
        setGoals(goalsRes.data.todayGoals || []);
        setStudyTips(goalsRes.data.studyTips || []);
      }
      setLastUpdateTime(new Date());
    } catch (err) {
      console.error('获取今日推送数据失败:', err);
      setError('获取数据失败，请稍后重试');
    } finally {
      setIsLoading(false);
    }
  };

  const fetchFavorites = async () => {
    try {
      const [resourceRes, recFavRes] = await Promise.all([
        resourcesApi.getFavorites().catch(e => ({ data: null })),
        resourcesApi.getRecommendedFavorites().catch(e => ({ data: null })),
      ]);
      const favIds = new Set();
      if (resourceRes.data && resourceRes.data.resources) {
        resourceRes.data.resources.forEach(r => favIds.add(String(r.id)));
      }
      if (recFavRes.data && recFavRes.data.resources) {
        recFavRes.data.resources.forEach(r => favIds.add(r.id));
      }
      setFavorites(favIds);
    } catch (error) {
      console.error('获取收藏失败:', error);
    }
  };

  const fetchPushHistory = async () => {
    try {
      const response = await todayApi.getPushHistory(7);
      if (response.data && response.data.history) {
        setPushHistory(response.data.history);
      }
    } catch (error) {
      console.error('获取推送历史失败:', error);
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

  const handleToggleFavorite = async (resourceId, resourceData = null, e) => {
    if (e) e.stopPropagation();
    try {
      if (resourceData && typeof resourceId === 'string' && !resourceId.match(/^\d+$/)) {
        const response = await resourcesApi.toggleRecommendedFavorite({
          recId: resourceId,
          title: resourceData.title || '',
          platform: resourceData.platform || '',
          type: resourceData.type || '',
          difficulty: resourceData.difficulty || '入门',
          reason: resourceData.reason || '',
          url: resourceData.url || '',
          thumbnail: resourceData.thumbnail || null,
        });
        if (response.data) {
          const newFavorites = new Set(favorites);
          if (response.data.favorited) {
            newFavorites.add(resourceId);
          } else {
            newFavorites.delete(resourceId);
          }
          setFavorites(newFavorites);
        }
      } else {
        const response = await resourcesApi.toggleFavorite(resourceId);
        if (response.data) {
          const newFavorites = new Set(favorites);
          if (response.data.favorited) {
            newFavorites.add(String(resourceId));
          } else {
            newFavorites.delete(String(resourceId));
          }
          setFavorites(newFavorites);
        }
      }
    } catch (error) {
      console.error('收藏失败:', error);
    }
  };

  const handleGoalToggle = async (goalId) => {
    try {
      await todayApi.updateGoal(goalId);
      setGoals(prev => {
        const updated = prev.map(goal =>
          goal.id === goalId ? { ...goal, completed: !goal.completed } : goal
        );
        const toggledGoal = prev.find(g => g.id === goalId);
        if (toggledGoal && !toggledGoal.completed) {
          recordGoalStudyTime(toggledGoal.estimatedMinutes);
        }
        return updated;
      });
    } catch (error) {
      console.error('更新目标失败:', error);
    }
  };

  const recordGoalStudyTime = async (minutes) => {
    try {
      await todayApi.startStudy();
      if (progress) {
        const todayDow = new Date().getDay();
        const adjustedDow = todayDow === 0 ? 6 : todayDow - 1;
        setProgress(prev => {
          if (!prev) return prev;
          const newTrend = prev.weeklyTrend.map((item, idx) => {
            if (idx === adjustedDow) {
              return { ...item, hours: Math.round((item.hours + minutes / 60) * 10) / 10 };
            }
            return item;
          });
          const totalHours = Math.round(newTrend.reduce((sum, item) => sum + item.hours, 0) * 10) / 10;
          return { ...prev, weeklyStudyHours: totalHours, weeklyTrend: newTrend };
        });
      }
    } catch (error) {
      console.error('记录学习时长失败:', error);
    }
  };

  const handleAddGoal = async () => {
    if (!newGoalTitle.trim()) return;
    try {
      const response = await todayApi.addGoal(newGoalTitle.trim(), newGoalMinutes);
      if (response.data) {
        setGoals(prev => [...prev, response.data]);
        setNewGoalTitle('');
        setNewGoalMinutes(30);
        setShowAddGoal(false);
      }
    } catch (error) {
      console.error('添加目标失败:', error);
    }
  };

  const handleEditGoal = async (goalId) => {
    try {
      await todayApi.editGoal(goalId, editGoalTitle.trim(), editGoalMinutes);
      setGoals(prev => prev.map(goal =>
        goal.id === goalId ? { ...goal, title: editGoalTitle.trim(), estimatedMinutes: editGoalMinutes } : goal
      ));
      setEditingGoal(null);
    } catch (error) {
      console.error('编辑目标失败:', error);
    }
  };

  const handleDeleteGoal = async (goalId) => {
    try {
      await todayApi.deleteGoal(goalId);
      setGoals(prev => prev.filter(goal => goal.id !== goalId));
    } catch (error) {
      console.error('删除目标失败:', error);
    }
  };

  const startEditGoal = (goal) => {
    setEditingGoal(goal.id);
    setEditGoalTitle(goal.title);
    setEditGoalMinutes(goal.estimatedMinutes);
  };

  const cancelEditGoal = () => {
    setEditingGoal(null);
    setEditGoalTitle('');
    setEditGoalMinutes(30);
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
    if (hasKnowledgeData) {
      navigate('/resources');
    } else {
      navigate('/analysis');
    }
  };

  const handleShowHistory = () => {
    if (!showHistory) {
      fetchPushHistory();
    }
    setShowHistory(!showHistory);
  };

  const handleRetry = () => {
    localStorage.removeItem(CACHE_KEY_PREFIX + 'recommendations');
    localStorage.removeItem(CACHE_KEY_PREFIX + 'push');
    fetchAllData();
  };

  const handleRefreshRecommendations = async () => {
    setIsLoading(true);
    localStorage.removeItem(CACHE_KEY_PREFIX + 'recommendations');
    try {
      const recRes = await todayApi.getRecommendations();
      if (recRes.data) {
        setRecommendations(recRes.data.recommendations || []);
        if (recRes.data.hasKnowledgeData !== undefined) {
          setHasKnowledgeData(recRes.data.hasKnowledgeData);
        }
        setCachedData(CACHE_KEY_PREFIX + 'recommendations', {
          recommendations: recRes.data.recommendations || [],
          hasKnowledgeData: recRes.data.hasKnowledgeData || false,
        });
      }
      setLastUpdateTime(new Date());
    } catch (err) {
      console.error('刷新推荐失败:', err);
      setError('刷新推荐失败，请稍后重试');
    } finally {
      setIsLoading(false);
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
      case 'code': return '💻';
      case '代码': return '💻';
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
      'code': '代码',
      '代码': '代码',
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
        <div className="flex items-center gap-3">
          <button
            onClick={handleShowHistory}
            className="daily-push-history-btn"
            title="推送历史"
          >
            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" />
            </svg>
            <span>历史</span>
          </button>
          {lastUpdateTime && (
            <div className="daily-push-header-time">
              <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" />
              </svg>
              <span>更新于 {formatUpdateTime(lastUpdateTime)}</span>
            </div>
          )}
        </div>
      </div>

      {error && (
        <div className="daily-push-error-banner">
          <svg className="w-5 h-5 text-red-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-2.5L13.732 4c-.77-.833-1.964-.833-2.732 0L4.082 16.5c-.77.833.192 2.5 1.732 2.5z" />
          </svg>
          <span className="text-red-600 text-sm">{error}</span>
          <button onClick={handleRetry} className="daily-push-retry-btn">重试</button>
        </div>
      )}

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
          <div className="daily-push-recommendations-wrapper">
            {recommendations.length > 0 && (
              <div className="flex items-center justify-between py-2">
                <span className="text-sm text-dark-400 font-medium">共 {recommendations.length} 条推荐</span>
                <button
                  onClick={handleRefreshRecommendations}
                  disabled={isLoading}
                  className="flex items-center gap-1.5 px-4 py-2 bg-gradient-to-r from-slate-50 to-slate-100 border border-slate-200 rounded-xl text-sm font-semibold text-slate-600 cursor-pointer transition-all duration-300 hover:from-sky-500 hover:to-indigo-500 hover:text-white hover:border-transparent hover:shadow-lg disabled:opacity-50 disabled:cursor-not-allowed"
                >
                  <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" />
                  </svg>
                  换一批
                </button>
              </div>
            )}
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
            {recommendations.length === 0 ? (
              <div className="col-span-full flex flex-col items-center justify-center py-16 px-8 bg-gradient-to-br from-amber-50 via-amber-100/50 to-purple-50 rounded-2xl border-2 border-dashed border-amber-300 relative overflow-hidden">
                <div className="w-24 h-24 bg-white rounded-3xl flex items-center justify-center mb-8 shadow-lg shadow-amber-200/50 relative z-10">
                  <svg className="w-12 h-12 text-amber-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M20 13V6a2 2 0 00-2-2H6a2 2 0 00-2 2v7m16 0v5a2 2 0 01-2 2H6a2 2 0 01-2-2v-5m16 0h-2.586a1 1 0 00-.707.293l-2.414 2.414a1 1 0 01-.707.293h-3.172a1 1 0 01-.707-.293l-2.414-2.414A1 1 0 006.586 13H4" />
                  </svg>
                </div>
                {hasKnowledgeData ? (
                  <>
                    <h3 className="text-xl font-bold text-amber-800 mb-3 relative z-10">正在生成推荐</h3>
                    <p className="text-amber-600 mb-6 relative z-10">系统正在根据你的学习情况生成个性化推荐，请稍后再试</p>
                    <button
                      onClick={handleRetry}
                      className="px-6 py-3 bg-gradient-to-r from-amber-500 to-amber-600 text-white rounded-xl font-semibold hover:from-amber-600 hover:to-amber-700 transition-all duration-300 shadow-lg shadow-amber-500/30 flex items-center gap-2 relative z-10"
                    >
                      <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" />
                      </svg>
                      刷新推荐
                    </button>
                  </>
                ) : (
                  <>
                    <h3 className="text-xl font-bold text-amber-800 mb-3 relative z-10">请去上传资源</h3>
                    <p className="text-amber-600 mb-6 relative z-10">上传成绩单或试卷后，即可获取个性化学习推荐</p>
                    <button
                      onClick={() => navigate('/analysis')}
                      className="px-6 py-3 bg-gradient-to-r from-amber-500 to-amber-600 text-white rounded-xl font-semibold hover:from-amber-600 hover:to-amber-700 transition-all duration-300 shadow-lg shadow-amber-500/30 flex items-center gap-2 relative z-10"
                    >
                      <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-8l-4-4m0 0L8 8m4-4v12" />
                      </svg>
                      前往上传资源
                    </button>
                  </>
                )}
              </div>
            ) : (
              recommendations.map((item, index) => {
                const pStyle = getPlatformStyle(item.platform);
                const isFav = favorites.has(item.id);
                return (
                <div key={index} className="group bg-white/80 backdrop-blur-xl rounded-2xl shadow-soft overflow-hidden border border-white/50 hover:shadow-medium transition-all duration-300 hover:-translate-y-1">
                  <div className="h-2" style={{ background: `linear-gradient(to right, ${pStyle.color}, ${pStyle.color}cc)` }}></div>
                  <div className="p-6">
                    <div className="flex items-start justify-between mb-4">
                      <div
                        className="px-3 py-1 rounded-lg text-xs font-semibold text-white"
                        style={{ background: `linear-gradient(135deg, ${pStyle.color}, ${pStyle.color}bb)` }}
                      >
                        {pStyle.icon} {item.platform}
                      </div>
                      <div className="flex items-center gap-1">
                        {item.id && (
                          <button
                            onClick={(e) => handleToggleFavorite(item.id, item, e)}
                            className={`w-8 h-8 rounded-lg flex items-center justify-center transition-all duration-300 ${isFav ? 'bg-rose-100 text-rose-500' : 'bg-dark-100 text-dark-400 hover:bg-rose-50 hover:text-rose-500'}`}
                          >
                            <svg className="w-4 h-4" fill={isFav ? 'currentColor' : 'none'} stroke="currentColor" viewBox="0 0 24 24">
                              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4.318 6.318a4.5 4.5 0 000 6.364L12 20.364l7.682-7.682a4.5 4.5 0 00-6.364-6.364L12 7.636l-1.318-1.318a4.5 4.5 0 00-6.364 0z" />
                            </svg>
                          </button>
                        )}
                      </div>
                    </div>

                    <h3 className="text-lg font-bold text-dark-800 mb-3 line-clamp-2 group-hover:text-warning-600 transition-colors duration-300">{item.title}</h3>

                    <div className="flex items-center gap-2 mb-4">
                      <span className={`px-2.5 py-1 text-xs font-medium rounded-full border ${getDifficultyColor(item.difficulty)}`}>
                        {item.difficulty}
                      </span>
                      <span
                        className="px-2.5 py-1 text-xs font-medium rounded-full border"
                        style={{ color: pStyle.color, borderColor: `${pStyle.color}44`, backgroundColor: `${pStyle.color}11` }}
                      >
                        {getTypeLabel(item.type || item.类型)}
                      </span>
                      {item.duration && (
                        <span className="flex items-center gap-1 text-xs text-dark-400">
                          <svg className="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" />
                          </svg>
                          {item.duration}
                        </span>
                      )}
                    </div>

                    <div className="p-4 rounded-xl mb-4" style={{ backgroundColor: `${pStyle.color}08`, border: `1px solid ${pStyle.color}18` }}>
                      <p className="text-sm text-dark-600 leading-relaxed line-clamp-3">{item.reason}</p>
                    </div>

                    {item.tags && item.tags.length > 0 && (
                      <div className="flex flex-wrap gap-2 mb-4">
                        {item.tags.slice(0, 3).map((tag, tagIndex) => (
                          <span key={tagIndex} className="px-2 py-1 text-xs text-dark-500 bg-dark-100 rounded-md">{tag}</span>
                        ))}
                      </div>
                    )}

                    <div className="flex gap-2">
                      <button
                        onClick={() => handleViewResource(item)}
                        className="flex-1 py-3 bg-gradient-to-r from-warning-50 to-warning-100/50 text-warning-600 font-semibold rounded-xl hover:from-warning-100 hover:to-warning-50 transition-all duration-300 border border-warning-200"
                      >
                        查看详情
                      </button>
                      {item.url && (
                        <a
                          href={item.url}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="flex-1 py-3 text-white font-semibold rounded-xl text-center transition-all duration-300 shadow-lg"
                          style={{ background: `linear-gradient(135deg, ${pStyle.color}, ${pStyle.color}cc)`, boxShadow: `0 4px 14px ${pStyle.color}44` }}
                        >
                          前往学习
                        </a>
                      )}
                    </div>
                  </div>
                </div>
                );
              })
            )}

            {showHistory && pushHistory.length > 0 && (
              <div className="daily-push-history-section">
                <div className="daily-push-history-header">
                  <h3 className="daily-push-history-title">推送历史</h3>
                  <button onClick={() => setShowHistory(false)} className="daily-push-history-close">
                    <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                    </svg>
                  </button>
                </div>
                {pushHistory.map((record, idx) => (
                  <div key={idx} className="daily-push-history-record">
                    <div className="daily-push-history-date">
                      <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z" />
                      </svg>
                      {record.pushDate}
                      {record.weakPoints && record.weakPoints.length > 0 && (
                        <span className="daily-push-history-weak-count">
                          {record.weakPoints.length}个薄弱点
                        </span>
                      )}
                    </div>
                    <div className="daily-push-history-items">
                      {record.recommendations.slice(0, 3).map((rec, recIdx) => (
                        <div key={recIdx} className="daily-push-history-item">
                          <span className="daily-push-history-item-type">
                            {getTypeIcon(rec.type)} {getTypeLabel(rec.type)}
                          </span>
                          <span className="daily-push-history-item-title">{rec.title}</span>
                          {rec.url && (
                            <a
                              href={rec.url}
                              target="_blank"
                              rel="noopener noreferrer"
                              className="daily-push-history-item-link"
                              onClick={(e) => e.stopPropagation()}
                            >
                              <svg className="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10 6H6a2 2 0 00-2 2v10a2 2 0 002 2h10a2 2 0 002-2v-4M14 4h6m0 0v6m0-6L10 14" />
                              </svg>
                            </a>
                          )}
                        </div>
                      ))}
                      {record.recommendations.length > 3 && (
                        <span className="daily-push-history-more">
                          还有{record.recommendations.length - 3}个推荐
                        </span>
                      )}
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
          </div>
        )}

        {activeTab === 'plan' && (
          <div className="daily-push-plan">
            <div className="daily-push-plan-section">
              <div className="daily-push-plan-header">
                <h3 className="daily-push-plan-title">今日目标</h3>
                <div className="daily-push-plan-header-right">
                  <span className="daily-push-plan-study-time">
                    <svg className="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" />
                    </svg>
                    已完成 {goals.filter(g => g.completed).reduce((sum, g) => sum + g.estimatedMinutes, 0)} / {goals.reduce((sum, g) => sum + g.estimatedMinutes, 0)} 分钟
                  </span>
                  <span className="daily-push-plan-badge">{goals.filter(g => g.completed).length}/{goals.length}</span>
                  <button
                    className="daily-push-plan-add-btn"
                    onClick={() => setShowAddGoal(true)}
                    title="添加目标"
                  >
                    <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />
                    </svg>
                  </button>
                </div>
              </div>

              {showAddGoal && (
                <div className="daily-push-plan-add-form">
                  <input
                    type="text"
                    className="daily-push-plan-add-input"
                    placeholder="输入学习目标..."
                    value={newGoalTitle}
                    onChange={(e) => setNewGoalTitle(e.target.value)}
                    onKeyDown={(e) => e.key === 'Enter' && handleAddGoal()}
                    autoFocus
                  />
                  <div className="daily-push-plan-add-row">
                    <div className="daily-push-plan-add-duration">
                      <svg className="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" />
                      </svg>
                      <input
                        type="number"
                        min="5"
                        max="300"
                        value={newGoalMinutes}
                        onChange={(e) => setNewGoalMinutes(parseInt(e.target.value) || 30)}
                        className="daily-push-plan-add-duration-input"
                      />
                      <span>分钟</span>
                    </div>
                    <div className="daily-push-plan-add-actions">
                      <button onClick={handleAddGoal} className="daily-push-plan-add-confirm">确认</button>
                      <button onClick={() => { setShowAddGoal(false); setNewGoalTitle(''); setNewGoalMinutes(30); }} className="daily-push-plan-add-cancel">取消</button>
                    </div>
                  </div>
                </div>
              )}

              <div className="daily-push-plan-tasks">
                {goals.length === 0 && !showAddGoal ? (
                  <div className="daily-push-empty-inline">
                    <p className="text-dark-500">
                      {hasKnowledgeData ? '暂无学习目标，系统将根据你的学习情况自动生成' : '暂无学习目标'}
                    </p>
                    {!hasKnowledgeData && (
                      <button
                        onClick={() => navigate('/analysis')}
                        className="daily-push-link-btn"
                      >
                        上传成绩单生成学习计划
                      </button>
                    )}
                  </div>
                ) : (
                  goals.map((task) => (
                    <div key={task.id} className={`daily-push-plan-task ${task.completed ? 'completed' : ''}`}>
                      <label className="daily-push-checkbox">
                        <input
                          type="checkbox"
                          checked={task.completed}
                          onChange={() => handleGoalToggle(task.id)}
                        />
                        <span className="daily-push-checkbox-mark"></span>
                      </label>
                      <div className="daily-push-plan-task-info">
                        {editingGoal === task.id ? (
                          <div className="daily-push-plan-task-edit">
                            <input
                              type="text"
                              value={editGoalTitle}
                              onChange={(e) => setEditGoalTitle(e.target.value)}
                              className="daily-push-plan-task-edit-input"
                              autoFocus
                            />
                            <div className="daily-push-plan-task-edit-row">
                              <svg className="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" />
                              </svg>
                              <input
                                type="number"
                                min="5"
                                max="300"
                                value={editGoalMinutes}
                                onChange={(e) => setEditGoalMinutes(parseInt(e.target.value) || 30)}
                                className="daily-push-plan-task-edit-duration"
                              />
                              <span>分钟</span>
                              <button onClick={() => handleEditGoal(task.id)} className="daily-push-plan-task-edit-save">保存</button>
                              <button onClick={cancelEditGoal} className="daily-push-plan-task-edit-cancel">取消</button>
                            </div>
                          </div>
                        ) : (
                          <>
                            <span className={`daily-push-plan-task-content ${task.completed ? 'completed' : ''}`}>
                              {task.title}
                            </span>
                            <span className="daily-push-plan-task-duration">
                              <svg className="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" />
                              </svg>
                              {task.completed ? '已完成' : '预计'} {task.estimatedMinutes}分钟
                            </span>
                          </>
                        )}
                      </div>
                      {editingGoal !== task.id && (
                        <div className="daily-push-plan-task-actions">
                          {task.completed && (
                            <span className="daily-push-plan-task-check">
                              <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                              </svg>
                            </span>
                          )}
                          <button
                            onClick={() => startEditGoal(task)}
                            className="daily-push-plan-task-action-btn edit"
                            title="编辑"
                          >
                            <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z" />
                            </svg>
                          </button>
                          <button
                            onClick={() => handleDeleteGoal(task.id)}
                            className="daily-push-plan-task-action-btn delete"
                            title="删除"
                          >
                            <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
                            </svg>
                          </button>
                        </div>
                      )}
                    </div>
                  ))
                )}
              </div>
            </div>
            <div className="daily-push-plan-section">
              <div className="daily-push-plan-header">
                <h3 className="daily-push-plan-title">学习建议</h3>
              </div>
              <div className="daily-push-tips">
                {studyTips.map((tip, index) => (
                  <div key={index} className="daily-push-tip">
                    <div className="daily-push-tip-icon">
                      <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9.663 17h4.673M12 3v1m6.364 1.636l-.707.707M21 12h-1M4 12H3m3.343-5.657l-.707-.707m2.828 9.9a5 5 0 117.072 0l-.548.547A3.374 3.374 0 0014 18.469V19a2 2 0 11-4 0v-.531c0-.895-.356-1.754-.988-2.386l-.548-.547z" />
                      </svg>
                    </div>
                    <p className="daily-push-tip-text">{tip}</p>
                  </div>
                ))}
                {!hasKnowledgeData && (
                  <div className="daily-push-tip">
                    <div className="daily-push-tip-icon highlight">
                      <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M7 16a4 4 0 01-.88-7.903A5 5 0 1115.9 6L16 6a5 5 0 011 9.9M15 13l-3-3m0 0l-3 3m3-3v12" />
                      </svg>
                    </div>
                    <p className="daily-push-tip-text">
                      <span className="daily-push-tip-highlight">上传成绩单</span>获取个性化学习建议
                    </p>
                  </div>
                )}
              </div>
            </div>
          </div>
        )}

        {activeTab === 'progress' && (
          <div className="daily-push-progress">
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
                    {progress?.weeklyStudyHours !== undefined ? `${Number(progress.weeklyStudyHours).toFixed(1)}小时` : '--'}
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
                {selectedRecommendation.id && (
                  <button
                    onClick={() => handleToggleFavorite(selectedRecommendation.id, selectedRecommendation)}
                    className={`daily-push-modal-favorite ${favorites.has(selectedRecommendation.id) ? 'active' : ''}`}
                  >
                    <svg className="w-5 h-5" fill={favorites.has(selectedRecommendation.id) ? 'currentColor' : 'none'} stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4.318 6.318a4.5 4.5 0 000 6.364L12 20.364l7.682-7.682a4.5 4.5 0 00-6.364-6.364L12 7.636l-1.318-1.318a4.5 4.5 0 00-6.364 0z" />
                    </svg>
                  </button>
                )}
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
                {selectedRecommendation.rating && (
                  <div className="daily-push-modal-meta-item">
                    <svg className="w-5 h-5 text-warning-500" fill="currentColor" viewBox="0 0 20 20">
                      <path d="M9.049 2.927c.3-.921 1.603-.921 1.902 0l1.07 3.292a1 1 0 00.95.69h3.462c.969 0 1.371 1.24.588 1.81l-2.8 2.034a1 1 0 00-.364 1.118l1.07 3.292c.3.921-.755 1.688-1.54 1.118l-2.8-2.034a1 1 0 00-1.175 0l-2.8 2.034c-.784.57-1.838-.197-1.539-1.118l1.07-3.292a1 1 0 00-.364-1.118L2.98 8.72c-.783-.57-.38-1.81.588-1.81h3.461a1 1 0 00.951-.69l1.07-3.292z" />
                    </svg>
                    <span className="font-bold">{selectedRecommendation.rating}</span>
                  </div>
                )}
                <span className={`daily-push-modal-difficulty daily-push-difficulty-${getDifficultyColor(selectedRecommendation.difficulty)}`}>
                  {selectedRecommendation.difficulty || '初级'}
                </span>
                {selectedRecommendation.viewCount && (
                  <span className="daily-push-modal-views">{selectedRecommendation.viewCount} 次浏览</span>
                )}
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

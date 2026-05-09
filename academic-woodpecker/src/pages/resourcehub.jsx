import React, { useState, useEffect, useCallback } from 'react';
import { useLocation } from 'react-router-dom';
import '../ResourceHub.scss';
import { resourcesApi, todayApi, analysisApi } from '../api';

const RESOURCE_PLATFORM_STYLES = {
  'B站': { color: '#FB7299', gradient: 'from-[#FB7299] to-[#fc8bab]', bg: 'bg-pink-50', border: 'border-pink-200', text: 'text-pink-600', icon: '🎬' },
  'Virtual Online Judge': { color: '#4CAF50', gradient: 'from-[#4CAF50] to-[#66BB6A]', bg: 'bg-green-50', border: 'border-green-200', text: 'text-green-600', icon: '💻' },
  'CSDN': { color: '#FC5531', gradient: 'from-[#FC5531] to-[#ff7b5f]', bg: 'bg-red-50', border: 'border-red-200', text: 'text-red-600', icon: '📝' },
};

const TYPE_FILTER_MAP = {
  '全部': null,
  '视频': 'video',
  '代码': 'code',
  '文章': 'article',
};

const getPlatformStyleForResource = (platform) => RESOURCE_PLATFORM_STYLES[platform] || { color: '#0ea5e9', gradient: 'from-sky-500 to-indigo-500', bg: 'bg-sky-50', border: 'border-sky-200', text: 'text-sky-600', icon: '📚' };

const ResourceHub = () => {
  const location = useLocation();
  const [activeTab, setActiveTab] = useState('recommendations');
  const [selectedResource, setSelectedResource] = useState(null);
  const [activeFilter, setActiveFilter] = useState('全部');
  const [resources, setResources] = useState([]);
  const [isLoading, setIsLoading] = useState(true);
  const [searchKeyword, setSearchKeyword] = useState('');
  const [total, setTotal] = useState(0);
  const [currentPage, setCurrentPage] = useState(1);
  const [favorites, setFavorites] = useState(new Set());
  const [documents, setDocuments] = useState([]);
  const [docsLoading, setDocsLoading] = useState(true);
  const [editingDoc, setEditingDoc] = useState(null);
  const [showDeleteConfirm, setShowDeleteConfirm] = useState(null);
  const [favoriteDocumentIds, setFavoriteDocumentIds] = useState(new Set());
  const [selectedDocIds, setSelectedDocIds] = useState(new Set());
  const [batchDeleteConfirm, setBatchDeleteConfirm] = useState(false);
  const [isRefreshing, setIsRefreshing] = useState(false);

  useEffect(() => {
    fetchRecommendations();
    fetchFavorites();
    fetchDocuments();
  }, []);

  useEffect(() => {
    const params = new URLSearchParams(location.search);
    const resourceId = params.get('resourceId');
    if (resourceId) {
      fetchResourceDetail(resourceId);
    }
  }, [location.search]);

  const fetchRecommendations = async () => {
    setIsLoading(true);
    try {
      const response = await todayApi.getRecommendations();
      if (response.data && response.data.recommendations) {
        setResources(response.data.recommendations);
        setTotal(response.data.recommendations.length);
      } else {
        setResources([]);
        setTotal(0);
      }
    } catch (error) {
      console.error('获取推荐资源失败:', error);
      setResources([]);
      setTotal(0);
    } finally {
      setIsLoading(false);
    }
  };

  const fetchFavorites = async () => {
    try {
      const [resourceRes, docRes, recFavRes] = await Promise.all([
        resourcesApi.getFavorites(),
        analysisApi.getFavoriteDocuments(),
        resourcesApi.getRecommendedFavorites(),
      ]);
      
      if (resourceRes.data && resourceRes.data.resources) {
        const favoriteIds = new Set(resourceRes.data.resources.map(r => String(r.id)));
        setFavorites(prev => new Set([...prev, ...favoriteIds]));
      }

      if (recFavRes.data && recFavRes.data.resources) {
        const recFavIds = new Set(recFavRes.data.resources.map(r => r.id));
        setFavorites(prev => new Set([...prev, ...recFavIds]));
      }
      
      if (docRes.data && docRes.data.documents) {
        const docIds = new Set(docRes.data.documents.map(d => d.id));
        setFavoriteDocumentIds(docIds);
      }
    } catch (error) {
      console.error('获取收藏失败:', error);
    }
  };

  const fetchDocuments = async () => {
    setDocsLoading(true);
    try {
      const response = await analysisApi.getHistory();
      if (response.data && response.data.records) {
        setDocuments(response.data.records);
      } else {
        setDocuments([]);
      }
    } catch (error) {
      console.error('获取文件历史失败:', error);
      setDocuments([]);
    } finally {
      setDocsLoading(false);
    }
  };

  const fetchResourceDetail = async (resourceId) => {
    try {
      const response = await resourcesApi.getDetail(resourceId);
      if (response.data) {
        setSelectedResource(response.data);
      }
    } catch (error) {
      console.error('获取资源详情失败:', error);
    }
  };

  const handleSearch = async (keyword) => {
    setSearchKeyword(keyword);
    if (keyword.trim()) {
      setIsLoading(true);
      try {
        const response = await resourcesApi.search(keyword);
        if (response.data && response.data.resources && Array.isArray(response.data.resources)) {
          setResources(response.data.resources);
          setTotal(response.data.total || 0);
        } else {
          setResources([]);
          setTotal(0);
        }
      } catch (error) {
        console.error('搜索资源失败:', error);
        setResources([]);
        setTotal(0);
      } finally {
        setIsLoading(false);
      }
    } else {
      fetchRecommendations();
    }
  };

  const handleRefreshRecommendations = async () => {
    setIsRefreshing(true);
    try {
      const response = await todayApi.getRecommendations();
      if (response.data && response.data.recommendations) {
        setResources(response.data.recommendations);
        setTotal(response.data.recommendations.length);
      }
    } catch (error) {
      console.error('刷新推荐资源失败:', error);
    } finally {
      setIsRefreshing(false);
    }
  };

  const handleFilterChange = (filter) => {
    setActiveFilter(filter);
  };

  const handleToggleFavorite = async (resourceId, resourceData = null) => {
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

  const handleToggleDocumentFavorite = async (docId) => {
    try {
      const response = await analysisApi.toggleDocumentFavorite(docId);
      if (response.data) {
        const newFavoriteDocs = new Set(favoriteDocumentIds);
        if (response.data.favorited) {
          newFavoriteDocs.add(docId);
        } else {
          newFavoriteDocs.delete(docId);
        }
        setFavoriteDocumentIds(newFavoriteDocs);
      }
    } catch (error) {
      console.error('文件收藏失败:', error);
    }
  };

  const handleDeleteDocument = async (docId) => {
    try {
      const response = await analysisApi.deleteDocument(docId);
      if (response.code === 200) {
        setDocuments(prev => prev.filter(doc => doc.id !== docId));
        setShowDeleteConfirm(null);
      }
    } catch (error) {
      console.error('删除文件失败:', error);
    }
  };

  const handleSelectDoc = (docId) => {
    setSelectedDocIds(prev => {
      const newSet = new Set(prev);
      if (newSet.has(docId)) {
        newSet.delete(docId);
      } else {
        newSet.add(docId);
      }
      return newSet;
    });
  };

  const handleSelectAllDocs = () => {
    if (selectedDocIds.size === displayedDocuments.length) {
      setSelectedDocIds(new Set());
    } else {
      setSelectedDocIds(new Set(displayedDocuments.map(doc => doc.id)));
    }
  };

  const handleBatchDelete = async () => {
    try {
      const response = await analysisApi.batchDeleteDocuments(Array.from(selectedDocIds));
      if (response.code === 200) {
        setDocuments(prev => prev.filter(doc => !selectedDocIds.has(doc.id)));
        setSelectedDocIds(new Set());
        setBatchDeleteConfirm(false);
      }
    } catch (error) {
      console.error('批量删除文件失败:', error);
    }
  };

  const handleEditDocument = (doc) => {
    setEditingDoc(doc);
  };

  const handleSaveEdit = async () => {
    if (editingDoc && editingDoc.fileName.trim()) {
      try {
        const response = await analysisApi.updateDocument(editingDoc.id, { fileName: editingDoc.fileName });
        if (response.code === 200 || response.data) {
          setEditingDoc(null);
          fetchDocuments();
        }
      } catch (error) {
        console.error('更新文件失败:', error);
        alert('重命名失败，请重试');
      }
    }
  };

  const getDifficultyColor = (level) => {
    const levelMap = {
      '入门': 'bg-emerald-50 text-emerald-600 border-emerald-200',
      '初级': 'bg-emerald-50 text-emerald-600 border-emerald-200',
      '中级': 'bg-amber-50 text-amber-600 border-amber-200',
      '进阶': 'bg-blue-50 text-blue-600 border-blue-200',
      '高级': 'bg-purple-50 text-purple-600 border-purple-200',
    };
    return levelMap[level] || 'bg-gray-50 text-gray-600 border-gray-200';
  };

  const getResourceDisplay = (resource) => {
    const platform = resource.platform || resource.source || '未知';
    const platformStyle = getPlatformStyleForResource(platform);
    return {
      id: resource.id || String(resource.id || ''),
      title: resource.title,
      platform: platform,
      platformColor: platformStyle.gradient,
      platformStyle: platformStyle,
      type: resource.type || resource.类型 || '其他',
      rating: resource.rating || 0,
      reason: resource.reason || resource.recommendation || '暂无推荐理由',
      summary: resource.summary || resource.description || '暂无摘要',
      tags: resource.tags || [],
      difficulty: resource.difficulty || '初级',
      url: resource.url || '',
      viewCount: resource.viewCount || 0,
      thumbnail: resource.thumbnail || null,
    };
  };

  const getStatusColor = (status) => {
    const statusMap = {
      '待处理': 'bg-gray-100 text-gray-600',
      '处理中': 'bg-blue-100 text-blue-600',
      '已分析': 'bg-green-100 text-green-600',
      '失败': 'bg-red-100 text-red-600',
    };
    return statusMap[status] || 'bg-gray-100 text-gray-600';
  };

  const filteredResources = activeFilter === '全部'
    ? resources
    : resources.filter(r => {
        const typeValue = TYPE_FILTER_MAP[activeFilter];
        return r.type === typeValue || r.type === activeFilter || r.类型 === activeFilter || r.类型 === typeValue;
      });

  const displayedDocuments = documents;

  return (
    <div className="space-y-8 animate-fade-in">
      <div className="relative overflow-hidden">
        <div className="absolute inset-0 bg-gradient-to-r from-warning-500/10 via-warning-400/5 to-transparent"></div>
        <div className="absolute top-0 right-0 w-96 h-96 bg-warning-500/5 rounded-full blur-3xl -translate-y-1/2 translate-x-1/2"></div>
        <div className="relative">
          <h1 className="text-3xl font-bold text-dark-800">个性化推送与资源库</h1>
          <p className="text-dark-400 mt-1">AI推荐优质资源，因材施教提升效率</p>
        </div>
      </div>

      <div className="flex gap-2 bg-white/50 backdrop-blur-xl rounded-xl p-1">
        <button
          onClick={() => setActiveTab('recommendations')}
          className={`flex-1 py-2.5 px-4 rounded-lg font-medium transition-all duration-300 ${activeTab === 'recommendations' ? 'bg-gradient-to-r from-warning-500 to-warning-600 text-white shadow-glow' : 'text-dark-600 hover:bg-dark-50'}`}
        >
          📚 推荐资源
        </button>
        <button
          onClick={() => setActiveTab('files')}
          className={`flex-1 py-2.5 px-4 rounded-lg font-medium transition-all duration-300 ${activeTab === 'files' ? 'bg-gradient-to-r from-warning-500 to-warning-600 text-white shadow-glow' : 'text-dark-600 hover:bg-dark-50'}`}
        >
          📁 我的文件
        </button>
      </div>

      {activeTab === 'recommendations' && (
        <>
          <div className="relative max-w-2xl flex gap-3">
            <div className="relative flex-1">
              <div className="absolute inset-y-0 left-0 pl-4 flex items-center pointer-events-none">
                <svg className="w-5 h-5 text-dark-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
                </svg>
              </div>
              <input
                type="text"
                placeholder="搜索资源..."
                value={searchKeyword}
                onChange={(e) => handleSearch(e.target.value)}
                className="w-full pl-12 pr-4 py-3 bg-white/80 backdrop-blur-xl rounded-xl border border-dark-100/50 focus:outline-none focus:border-warning-400 focus:ring-2 focus:ring-warning-100 transition-all duration-300 shadow-soft"
              />
            </div>
            <button
              onClick={handleRefreshRecommendations}
              disabled={isRefreshing}
              className="px-5 py-3 bg-white/80 backdrop-blur-xl rounded-xl border border-dark-100/50 hover:border-warning-200 hover:bg-warning-50 font-medium text-dark-600 hover:text-warning-600 transition-all duration-300 shadow-soft flex items-center gap-2 whitespace-nowrap disabled:opacity-50"
            >
              <svg className={`w-4 h-4 ${isRefreshing ? 'animate-spin' : ''}`} fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" />
              </svg>
              换一批
            </button>
          </div>

          <div className="flex flex-wrap gap-3">
            {['全部', '视频', '代码', '文章'].map((filter) => {
              const platformInfo = filter === '全部' ? null : 
                filter === '视频' ? RESOURCE_PLATFORM_STYLES['B站'] :
                filter === '代码' ? RESOURCE_PLATFORM_STYLES['Virtual Online Judge'] :
                filter === '文章' ? RESOURCE_PLATFORM_STYLES['CSDN'] : null;
              return (
                <button
                  key={filter}
                  onClick={() => handleFilterChange(filter)}
                  className={`px-5 py-2.5 rounded-xl font-medium transition-all duration-300 ${activeFilter === filter ? 'bg-gradient-to-r from-warning-500 to-warning-600 text-white shadow-glow' : 'bg-white/80 backdrop-blur-xl text-dark-600 hover:bg-warning-50 border border-dark-100/50 hover:border-warning-200'}`}
                >
                  {filter}
                  {platformInfo && activeFilter !== filter && (
                    <span className="ml-1.5 text-xs opacity-60" style={{ color: platformInfo.color }}>●</span>
                  )}
                </button>
              );
            })}
          </div>

          {isLoading ? (
            <div className="flex items-center justify-center h-64">
              <div className="text-center">
                <div className="w-12 h-12 border-4 border-warning-500 border-t-transparent rounded-full animate-spin mx-auto mb-4"></div>
                <p className="text-dark-400">加载中...</p>
              </div>
            </div>
          ) : resources.length === 0 ? (
            <div className="flex flex-col items-center justify-center h-64 bg-white/50 backdrop-blur-xl rounded-2xl border border-dark-100/50">
              <div className="w-20 h-20 mb-6 rounded-full bg-warning-50 flex items-center justify-center">
                <svg className="w-10 h-10 text-warning-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M20 13V6a2 2 0 00-2-2H6a2 2 0 00-2 2v7m16 0v5a2 2 0 01-2 2H6a2 2 0 01-2-2v-5m16 0h-2.586a1 1 0 00-.707.293l-2.414 2.414a1 1 0 01-.707.293h-3.172a1 1 0 01-.707-.293l-2.414-2.414A1 1 0 006.586 13H4" />
                </svg>
              </div>
              <h3 className="text-xl font-bold text-dark-700 mb-2">暂时还没有数据</h3>
              <p className="text-dark-400 mb-6">去尝试搜索或上传吧</p>
              <button
                onClick={() => window.location.href = '/analysis'}
                className="px-6 py-3 bg-gradient-to-r from-warning-500 to-warning-600 text-white rounded-xl font-semibold hover:from-warning-600 hover:to-warning-700 transition-all duration-300 shadow-lg shadow-warning-500/30"
              >
                前往上传
              </button>
            </div>
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
              {filteredResources.map((resource) => {
                const display = getResourceDisplay(resource);
                const isFavorited = favorites.has(display.id);
                const pStyle = display.platformStyle;
                return (
                  <div
                    key={display.id}
                    className="group bg-white/80 backdrop-blur-xl rounded-2xl shadow-soft overflow-hidden border border-white/50 hover:shadow-medium transition-all duration-300 hover:-translate-y-1"
                  >
                    <div className="h-2 bg-gradient-to-r" style={{ background: `linear-gradient(to right, ${pStyle.color}, ${pStyle.color}cc)` }}></div>
                    <div className="p-6">
                      <div className="flex items-start justify-between mb-4">
                        <div
                          className="px-3 py-1 rounded-lg text-xs font-semibold text-white"
                          style={{ background: `linear-gradient(135deg, ${pStyle.color}, ${pStyle.color}bb)` }}
                        >
                          {pStyle.icon} {display.platform}
                        </div>
                        <div className="flex items-center gap-1">
                          <button
                            onClick={() => handleToggleFavorite(display.id, display)}
                            className={`w-8 h-8 rounded-lg flex items-center justify-center transition-all duration-300 ${isFavorited ? 'bg-rose-100 text-rose-500' : 'bg-dark-100 text-dark-400 hover:bg-rose-50 hover:text-rose-500'}`}
                          >
                            <svg className="w-4 h-4" fill={isFavorited ? 'currentColor' : 'none'} stroke="currentColor" viewBox="0 0 24 24">
                              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4.318 6.318a4.5 4.5 0 000 6.364L12 20.364l7.682-7.682a4.5 4.5 0 00-6.364-6.364L12 7.636l-1.318-1.318a4.5 4.5 0 00-6.364 0z" />
                            </svg>
                          </button>
                        </div>
                      </div>

                      <div className="flex items-center gap-1 mb-3">
                        <svg className="w-4 h-4 text-warning-500" fill="currentColor" viewBox="0 0 20 20">
                          <path d="M9.049 2.927c.3-.921 1.603-.921 1.902 0l1.07 3.292a1 1 0 00.95.69h3.462c.969 0 1.371 1.24.588 1.81l-2.8 2.034a1 1 0 00-.364 1.118l1.07 3.292c.3.921-.755 1.688-1.54 1.118l-2.8-2.034a1 1 0 00-1.175 0l-2.8 2.034c-.784.57-1.838-.197-1.539-1.118l1.07-3.292a1 1 0 00-.364-1.118L2.98 8.72c-.783-.57-.38-1.81.588-1.81h3.461a1 1 0 00.951-.69l1.07-3.292z" />
                        </svg>
                        <span className="text-sm font-bold text-dark-700">{display.rating}</span>
                        <span className="text-xs text-dark-400 ml-2">{display.viewCount} 浏览</span>
                      </div>

                      <h3 className="text-lg font-bold text-dark-800 mb-3 line-clamp-2 group-hover:text-warning-600 transition-colors duration-300">{display.title}</h3>

                      <div className="flex items-center gap-2 mb-4">
                        <span className={`px-2.5 py-1 text-xs font-medium rounded-full border ${getDifficultyColor(display.difficulty)}`}>
                          {display.difficulty}
                        </span>
                        <span
                          className="px-2.5 py-1 text-xs font-medium rounded-full border"
                          style={{ color: pStyle.color, borderColor: `${pStyle.color}44`, backgroundColor: `${pStyle.color}11` }}
                        >
                          {display.type}
                        </span>
                      </div>

                      <div className="p-4 rounded-xl mb-4" style={{ backgroundColor: `${pStyle.color}08`, border: `1px solid ${pStyle.color}18` }}>
                        <p className="text-sm text-dark-600 leading-relaxed line-clamp-3">{display.reason}</p>
                      </div>

                      <div className="flex flex-wrap gap-2 mb-4">
                        {display.tags.map((tag, index) => (
                          <span key={index} className="px-2 py-1 text-xs text-dark-500 bg-dark-100 rounded-md">
                            {tag}
                          </span>
                        ))}
                      </div>

                      <div className="flex gap-2">
                        <button
                          onClick={() => setSelectedResource(display)}
                          className="flex-1 py-3 bg-gradient-to-r from-warning-50 to-warning-100/50 text-warning-600 font-semibold rounded-xl hover:from-warning-100 hover:to-warning-50 transition-all duration-300 border border-warning-200"
                        >
                          查看详情
                        </button>
                        {display.url && (
                          <a
                            href={display.url}
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
              })}
            </div>
          )}
        </>
      )}

      {activeTab === 'files' && (
        <div className="bg-white/50 backdrop-blur-xl rounded-2xl border border-dark-100/50 overflow-hidden">
          <div className="p-4 border-b border-dark-100/50">
            <div className="flex items-center justify-between mb-4">
              <h3 className="font-bold text-dark-800">我的文件</h3>
              {selectedDocIds.size > 0 && (
                <button
                  onClick={() => setBatchDeleteConfirm(true)}
                  className="px-4 py-2 bg-red-500 text-white rounded-lg font-medium hover:bg-red-600 transition-all duration-300"
                >
                  删除已选 ({selectedDocIds.size})
                </button>
              )}
              <button
                onClick={() => window.location.href = '/analysis'}
                className="px-4 py-2 bg-gradient-to-r from-warning-500 to-warning-600 text-white rounded-lg font-medium hover:from-warning-600 hover:to-warning-700 transition-all duration-300"
              >
                + 上传文件
              </button>
            </div>
            {displayedDocuments.length > 0 && (
              <div className="flex items-center gap-2 mb-2">
                <input
                  type="checkbox"
                  checked={selectedDocIds.size === displayedDocuments.length && displayedDocuments.length > 0}
                  onChange={handleSelectAllDocs}
                  className="w-4 h-4 text-warning-500 rounded border-dark-200 focus:ring-warning-500"
                />
                <span className="text-sm text-dark-400">全选</span>
              </div>
            )}
          </div>
          {docsLoading ? (
            <div className="flex items-center justify-center h-40">
              <div className="w-8 h-8 border-4 border-warning-500 border-t-transparent rounded-full animate-spin"></div>
            </div>
          ) : displayedDocuments.length === 0 ? (
            <div className="flex flex-col items-center justify-center h-40">
              <div className="w-16 h-16 mb-4 rounded-full bg-dark-100 flex items-center justify-center">
                <svg className="w-8 h-8 text-dark-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M7 21h10a2 2 0 002-2V9.414a1 1 0 00-.293-.707l-5.414-5.414A1 1 0 0012.586 3H7a2 2 0 00-2 2v14a2 2 0 002 2z" />
                </svg>
              </div>
              <p className="text-dark-400">暂无上传的文件</p>
            </div>
          ) : (
            <div className="divide-y divide-dark-100/50">
              {displayedDocuments.map((doc) => (
                <div key={doc.id} className="p-4 hover:bg-dark-50/50 transition-colors">
                  {editingDoc?.id === doc.id ? (
                    <div className="space-y-3">
                      <input
                        type="text"
                        value={editingDoc.fileName}
                        onChange={(e) => setEditingDoc({ ...editingDoc, fileName: e.target.value })}
                        className="w-full px-4 py-2 border border-dark-200 rounded-lg focus:outline-none focus:border-warning-400"
                      />
                      <div className="flex gap-2">
                        <button
                          onClick={handleSaveEdit}
                          className="px-4 py-2 bg-warning-500 text-white rounded-lg font-medium"
                        >
                          保存
                        </button>
                        <button
                          onClick={() => setEditingDoc(null)}
                          className="px-4 py-2 bg-dark-100 text-dark-600 rounded-lg font-medium"
                        >
                          取消
                        </button>
                      </div>
                    </div>
                  ) : (
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-3">
                        <input
                          type="checkbox"
                          checked={selectedDocIds.has(doc.id)}
                          onChange={() => handleSelectDoc(doc.id)}
                          className="w-4 h-4 text-warning-500 rounded border-dark-200 focus:ring-warning-500"
                        />
                        <div className="w-10 h-10 rounded-lg bg-dark-100 flex items-center justify-center">
                          <svg className="w-5 h-5 text-dark-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 10v6m0 0l-3-3m3 3l3-3m2 8H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
                          </svg>
                        </div>
                        <div>
                          <p className="font-medium text-dark-800">{doc.fileName}</p>
                          <p className="text-sm text-dark-400">{doc.uploadTime}</p>
                        </div>
                      </div>
                      <div className="flex items-center gap-2">
                        <span className={`px-2 py-1 text-xs font-medium rounded-full ${getStatusColor(doc.status)}`}>
                          {doc.status}
                        </span>
                        <button
                          onClick={() => handleToggleDocumentFavorite(doc.id)}
                          className={`w-8 h-8 rounded-lg flex items-center justify-center transition-all duration-300 ${favoriteDocumentIds.has(doc.id) ? 'bg-rose-100 text-rose-500' : 'bg-dark-100 text-dark-400 hover:bg-rose-50 hover:text-rose-500'}`}
                        >
                          <svg className="w-4 h-4" fill={favoriteDocumentIds.has(doc.id) ? 'currentColor' : 'none'} stroke="currentColor" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4.318 6.318a4.5 4.5 0 000 6.364L12 20.364l7.682-7.682a4.5 4.5 0 00-6.364-6.364L12 7.636l-1.318-1.318a4.5 4.5 0 00-6.364 0z" />
                          </svg>
                        </button>
                        <button
                          onClick={() => handleEditDocument(doc)}
                          className="w-8 h-8 rounded-lg bg-dark-100 hover:bg-dark-200 flex items-center justify-center transition-colors"
                        >
                          <svg className="w-4 h-4 text-dark-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z" />
                          </svg>
                        </button>
                        <button
                          onClick={() => setShowDeleteConfirm(doc.id)}
                          className="w-8 h-8 rounded-lg bg-red-50 hover:bg-red-100 flex items-center justify-center transition-colors"
                        >
                          <svg className="w-4 h-4 text-red-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
                          </svg>
                        </button>
                      </div>
                    </div>
                  )}
                </div>
              ))}
            </div>
          )}
        </div>
      )}

      {selectedResource && (
        <div className="fixed inset-0 bg-black/40 backdrop-blur-sm z-50 flex items-center justify-center p-4 animate-fade-in" onClick={() => setSelectedResource(null)}>
          <div className="bg-white rounded-2xl shadow-medium max-w-2xl w-full max-h-[80vh] overflow-y-auto animate-fade-in-up" onClick={(e) => e.stopPropagation()}>
            {(() => {
              const detailStyle = selectedResource.platformStyle || getPlatformStyleForResource(selectedResource.platform);
              return (
                <>
                  <div className="sticky top-0 bg-white border-b border-dark-100 p-6 flex items-start justify-between">
                    <div>
                      <div className="flex items-center gap-3 mb-2">
                        <span
                          className="px-3 py-1 rounded-lg text-xs font-semibold text-white"
                          style={{ background: `linear-gradient(135deg, ${detailStyle.color}, ${detailStyle.color}bb)` }}
                        >
                          {detailStyle.icon} {selectedResource.platform}
                        </span>
                        <span
                          className="px-2.5 py-1 text-xs font-medium rounded-full border"
                          style={{ color: detailStyle.color, borderColor: `${detailStyle.color}44`, backgroundColor: `${detailStyle.color}11` }}
                        >
                          {selectedResource.type}
                        </span>
                      </div>
                      <h3 className="text-2xl font-bold text-dark-800">{selectedResource.title}</h3>
                    </div>
                    <div className="flex items-center gap-2">
                      <button
                        onClick={() => handleToggleFavorite(selectedResource.id, selectedResource)}
                        className={`w-10 h-10 rounded-xl flex items-center justify-center transition-all duration-300 ${favorites.has(selectedResource.id) ? 'bg-rose-100 text-rose-500' : 'bg-dark-100 text-dark-400 hover:bg-rose-50 hover:text-rose-500'}`}
                      >
                        <svg className="w-5 h-5" fill={favorites.has(selectedResource.id) ? 'currentColor' : 'none'} stroke="currentColor" viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4.318 6.318a4.5 4.5 0 000 6.364L12 20.364l7.682-7.682a4.5 4.5 0 00-6.364-6.364L12 7.636l-1.318-1.318a4.5 4.5 0 00-6.364 0z" />
                        </svg>
                      </button>
                      <button onClick={() => setSelectedResource(null)} className="w-10 h-10 rounded-xl hover:bg-dark-100 flex items-center justify-center transition-colors">
                        <svg className="w-6 h-6 text-dark-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                        </svg>
                      </button>
                    </div>
                  </div>

                  <div className="p-6 space-y-6">
                    <div className="p-4 rounded-xl border" style={{ backgroundColor: `${detailStyle.color}08`, borderColor: `${detailStyle.color}20` }}>
                      <div className="flex items-center gap-2 mb-2">
                        <svg className="w-5 h-5" style={{ color: detailStyle.color }} fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 10V3L4 14h7v7l9-11h-7z" />
                        </svg>
                        <h4 className="font-bold" style={{ color: detailStyle.color }}>AI 推荐理由</h4>
                      </div>
                      <p className="text-dark-600 leading-relaxed">{selectedResource.reason}</p>
                    </div>

                    <div>
                      <h4 className="font-bold text-dark-800 mb-3 flex items-center gap-2">
                        <svg className="w-5 h-5 text-secondary-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
                        </svg>
                        内容摘要
                      </h4>
                      <p className="text-dark-600 leading-relaxed">{selectedResource.summary}</p>
                    </div>

                    <div className="flex flex-wrap gap-2">
                      {selectedResource.tags.map((tag, index) => (
                        <span key={index} className="px-3 py-1.5 text-sm text-dark-500 bg-dark-100 rounded-lg">
                          {tag}
                        </span>
                      ))}
                    </div>

                    <div className="flex items-center gap-4 pt-4 border-t border-dark-100">
                      <div className="flex items-center gap-2">
                        <svg className="w-5 h-5 text-warning-500" fill="currentColor" viewBox="0 0 20 20">
                          <path d="M9.049 2.927c.3-.921 1.603-.921 1.902 0l1.07 3.292a1 1 0 00.95.69h3.462c.969 0 1.371 1.24.588 1.81l-2.8 2.034a1 1 0 00-.364 1.118l1.07 3.292c.3.921-.755 1.688-1.54 1.118l-2.8-2.034a1 1 0 00-1.175 0l-2.8 2.034c-.784.57-1.838-.197-1.539-1.118l1.07-3.292a1 1 0 00-.364-1.118L2.98 8.72c-.783-.57-.38-1.81.588-1.81h3.461a1 1 0 00.951-.69l1.07-3.292z" />
                        </svg>
                        <span className="font-bold text-dark-700">{selectedResource.rating}</span>
                      </div>
                      <span className={`px-3 py-1 text-sm font-medium rounded-full border ${getDifficultyColor(selectedResource.difficulty)}`}>
                        {selectedResource.difficulty}
                      </span>
                      <span className="text-sm text-dark-400">{selectedResource.viewCount} 次浏览</span>
                    </div>

                    {selectedResource.url && (
                      <a
                        href={selectedResource.url}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="block w-full py-3 text-white rounded-xl font-semibold text-center transition-all duration-300 shadow-lg"
                        style={{ background: `linear-gradient(135deg, ${detailStyle.color}, ${detailStyle.color}cc)`, boxShadow: `0 4px 14px ${detailStyle.color}44` }}
                      >
                        前往学习
                      </a>
                    )}
                  </div>
                </>
              );
            })()}
          </div>
        </div>
      )}

      {showDeleteConfirm && (
        <div className="fixed inset-0 bg-black/40 backdrop-blur-sm z-50 flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl p-6 max-w-sm w-full shadow-medium">
            <div className="w-16 h-16 mx-auto mb-4 rounded-full bg-red-100 flex items-center justify-center">
              <svg className="w-8 h-8 text-red-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4m0 4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
              </svg>
            </div>
            <h3 className="text-xl font-bold text-dark-800 text-center mb-2">确认删除</h3>
            <p className="text-dark-500 text-center mb-6">删除后无法恢复，确定要删除吗？</p>
            <div className="flex gap-3">
              <button
                onClick={() => setShowDeleteConfirm(null)}
                className="flex-1 py-3 bg-dark-100 text-dark-600 rounded-xl font-medium hover:bg-dark-200 transition-colors"
              >
                取消
              </button>
              <button
                onClick={() => handleDeleteDocument(showDeleteConfirm)}
                className="flex-1 py-3 bg-red-500 text-white rounded-xl font-medium hover:bg-red-600 transition-colors"
              >
                删除
              </button>
            </div>
          </div>
        </div>
      )}

      {batchDeleteConfirm && (
        <div className="fixed inset-0 bg-black/40 backdrop-blur-sm z-50 flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl p-6 max-w-sm w-full shadow-medium">
            <div className="w-16 h-16 mx-auto mb-4 rounded-full bg-red-100 flex items-center justify-center">
              <svg className="w-8 h-8 text-red-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4m0 4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
              </svg>
            </div>
            <h3 className="text-xl font-bold text-dark-800 text-center mb-2">批量确认删除</h3>
            <p className="text-dark-500 text-center mb-6">确定要删除选中的 {selectedDocIds.size} 个文件吗？删除后无法恢复。</p>
            <div className="flex gap-3">
              <button
                onClick={() => setBatchDeleteConfirm(false)}
                className="flex-1 py-3 bg-dark-100 text-dark-600 rounded-xl font-medium hover:bg-dark-200 transition-colors"
              >
                取消
              </button>
              <button
                onClick={handleBatchDelete}
                className="flex-1 py-3 bg-red-500 text-white rounded-xl font-medium hover:bg-red-600 transition-colors"
              >
                批量删除
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default ResourceHub;
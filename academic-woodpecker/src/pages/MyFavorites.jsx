import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import '../ResourceHub.scss';
import { resourcesApi, analysisApi } from '../api';

const MyFavorites = () => {
  const navigate = useNavigate();
  const [favorites, setFavorites] = useState([]);
  const [isLoading, setIsLoading] = useState(true);
  const [currentPage, setCurrentPage] = useState(1);
  const [total, setTotal] = useState(0);
  const [pageSize] = useState(12);
  const [selectedResource, setSelectedResource] = useState(null);
  const [localFavorites, setLocalFavorites] = useState(new Set());
  const [totalPages, setTotalPages] = useState(1);
  const [activeTab, setActiveTab] = useState('resources');

  useEffect(() => {
    fetchFavorites();
  }, [currentPage, activeTab]);

  const fetchFavorites = async () => {
    setIsLoading(true);
    try {
      if (activeTab === 'resources') {
        const response = await resourcesApi.getFavorites();
        if (response.data && response.data.resources) {
          const formattedFavorites = response.data.resources.map(r => ({
            ...r,
            type: 'resource'
          }));
          setFavorites(formattedFavorites);
          setTotal(response.data.total || 0);
          setTotalPages(Math.ceil((response.data.total || 0) / pageSize));
          const favoriteIds = new Set(response.data.resources.map(r => r.id));
          setLocalFavorites(favoriteIds);
        } else {
          setFavorites([]);
          setTotal(0);
          setTotalPages(1);
        }
      } else {
        const response = await analysisApi.getFavoriteDocuments();
        if (response.data && response.data.documents) {
          const formattedDocs = response.data.documents.map(d => ({
            id: d.id,
            title: d.fileName,
            type: 'document',
            uploadTime: d.uploadTime,
            status: d.status,
            platform: '我的文件'
          }));
          setFavorites(formattedDocs);
          setTotal(response.data.total || 0);
          setTotalPages(Math.ceil((response.data.total || 0) / pageSize));
          const favoriteIds = new Set(response.data.documents.map(d => d.id));
          setLocalFavorites(favoriteIds);
        } else {
          setFavorites([]);
          setTotal(0);
          setTotalPages(1);
        }
      }
    } catch (error) {
      console.error('获取收藏失败:', error);
      setFavorites([]);
      setTotal(0);
    } finally {
      setIsLoading(false);
    }
  };

  const handleToggleFavorite = async (id, e, favoriteType) => {
    if (e) e.stopPropagation();
    try {
      if (favoriteType === 'document') {
        const response = await analysisApi.toggleDocumentFavorite(id);
        if (response.data) {
          if (!response.data.favorited) {
            setFavorites(prev => prev.filter(r => r.id !== id));
            setTotal(prev => Math.max(0, prev - 1));
            const newLocalFavorites = new Set(localFavorites);
            newLocalFavorites.delete(id);
            setLocalFavorites(newLocalFavorites);
          }
        }
      } else {
        const response = await resourcesApi.toggleFavorite(id);
        if (response.data) {
          if (response.data.favorited) {
            const newLocalFavorites = new Set(localFavorites);
            newLocalFavorites.add(id);
            setLocalFavorites(newLocalFavorites);
          } else {
            const newLocalFavorites = new Set(localFavorites);
            newLocalFavorites.delete(id);
            setLocalFavorites(newLocalFavorites);
            setFavorites(prev => prev.filter(r => r.id !== id));
            setTotal(prev => Math.max(0, prev - 1));
          }
        }
      }
    } catch (error) {
      console.error('操作收藏失败:', error);
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
    return {
      id: resource.id,
      title: resource.title,
      platform: resource.platform || '未知',
      platformColor: resource.platformColor || 'from-gray-500 to-gray-600',
      type: resource.type || '其他',
      rating: resource.rating || 0,
      reason: resource.reason || '暂无推荐理由',
      summary: resource.summary || '暂无摘要',
      tags: resource.tags || [],
      difficulty: resource.difficulty || '初级',
      url: resource.url || '',
      viewCount: resource.viewCount || 0,
    };
  };

  const handlePageChange = (page) => {
    if (page >= 1 && page <= totalPages) {
      setCurrentPage(page);
    }
  };

  const renderPagination = () => {
    if (totalPages <= 1) return null;

    const pages = [];
    const maxVisiblePages = 5;
    let startPage = Math.max(1, currentPage - Math.floor(maxVisiblePages / 2));
    let endPage = Math.min(totalPages, startPage + maxVisiblePages - 1);

    if (endPage - startPage + 1 < maxVisiblePages) {
      startPage = Math.max(1, endPage - maxVisiblePages + 1);
    }

    for (let i = startPage; i <= endPage; i++) {
      pages.push(i);
    }

    return (
      <div className="flex items-center justify-center gap-2 mt-8">
        <button
          onClick={() => handlePageChange(currentPage - 1)}
          disabled={currentPage === 1}
          className="w-10 h-10 rounded-xl bg-white/80 backdrop-blur-xl border border-dark-100/50 text-dark-600 font-medium hover:bg-warning-50 hover:border-warning-200 disabled:opacity-50 disabled:cursor-not-allowed transition-all duration-300 flex items-center justify-center"
        >
          <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
          </svg>
        </button>

        {startPage > 1 && (
          <>
            <button
              onClick={() => handlePageChange(1)}
              className="w-10 h-10 rounded-xl bg-white/80 backdrop-blur-xl border border-dark-100/50 text-dark-600 font-medium hover:bg-warning-50 hover:border-warning-200 transition-all duration-300"
            >
              1
            </button>
            {startPage > 2 && <span className="text-dark-400">...</span>}
          </>
        )}

        {pages.map(page => (
          <button
            key={page}
            onClick={() => handlePageChange(page)}
            className={`w-10 h-10 rounded-xl font-medium transition-all duration-300 ${
              page === currentPage
                ? 'bg-gradient-to-r from-warning-500 to-warning-600 text-white shadow-glow'
                : 'bg-white/80 backdrop-blur-xl border border-dark-100/50 text-dark-600 hover:bg-warning-50 hover:border-warning-200'
            }`}
          >
            {page}
          </button>
        ))}

        {endPage < totalPages && (
          <>
            {endPage < totalPages - 1 && <span className="text-dark-400">...</span>}
            <button
              onClick={() => handlePageChange(totalPages)}
              className="w-10 h-10 rounded-xl bg-white/80 backdrop-blur-xl border border-dark-100/50 text-dark-600 font-medium hover:bg-warning-50 hover:border-warning-200 transition-all duration-300"
            >
              {totalPages}
            </button>
          </>
        )}

        <button
          onClick={() => handlePageChange(currentPage + 1)}
          disabled={currentPage === totalPages}
          className="w-10 h-10 rounded-xl bg-white/80 backdrop-blur-xl border border-dark-100/50 text-dark-600 font-medium hover:bg-warning-50 hover:border-warning-200 disabled:opacity-50 disabled:cursor-not-allowed transition-all duration-300 flex items-center justify-center"
        >
          <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
          </svg>
        </button>
      </div>
    );
  };

  if (isLoading) {
    return (
      <div className="space-y-8 animate-fade-in">
        <div className="relative overflow-hidden">
          <div className="absolute inset-0 bg-gradient-to-r from-rose-500/10 via-rose-400/5 to-transparent"></div>
          <div className="absolute top-0 right-0 w-96 h-96 bg-rose-500/5 rounded-full blur-3xl -translate-y-1/2 translate-x-1/2"></div>
          <div className="relative">
            <h1 className="text-3xl font-bold text-dark-800">我的收藏</h1>
            <p className="text-dark-400 mt-1">管理您收藏的学习资源</p>
          </div>
        </div>
        <div className="flex items-center justify-center h-64">
          <div className="text-center">
            <div className="w-12 h-12 border-4 border-rose-500 border-t-transparent rounded-full animate-spin mx-auto mb-4"></div>
            <p className="text-dark-400">加载中...</p>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-8 animate-fade-in">
      <div className="relative overflow-hidden">
        <div className="absolute inset-0 bg-gradient-to-r from-rose-500/10 via-rose-400/5 to-transparent"></div>
        <div className="absolute top-0 right-0 w-96 h-96 bg-rose-500/5 rounded-full blur-3xl -translate-y-1/2 translate-x-1/2"></div>
        <div className="relative flex items-center justify-between">
          <div>
            <h1 className="text-3xl font-bold text-dark-800">我的收藏</h1>
            <p className="text-dark-400 mt-1">管理您收藏的学习资源，共 {total} 个收藏</p>
          </div>
          <button
            onClick={() => navigate('/resources')}
            className="px-5 py-2.5 bg-gradient-to-r from-rose-500 to-rose-600 text-white rounded-xl font-medium hover:from-rose-600 hover:to-rose-700 transition-all duration-300 shadow-lg shadow-rose-500/30 flex items-center gap-2"
          >
            <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 6.253v13m0-13C10.832 5.477 9.246 5 7.5 5S4.168 5.477 3 6.253v13C4.168 18.477 5.754 18 7.5 18s3.332.477 4.5 1.253m0-13C13.168 5.477 14.754 5 16.5 5c1.747 0 3.332.477 4.5 1.253v13C19.832 18.477 18.247 18 16.5 18c-1.746 0-3.332.477-4.5 1.253" />
            </svg>
            浏览资源库
          </button>
        </div>
      </div>

      <div className="flex gap-2 bg-white/50 backdrop-blur-xl rounded-xl p-1 border border-dark-100/50">
        <button
          onClick={() => setActiveTab('resources')}
          className={`flex-1 py-3 px-4 rounded-lg font-medium transition-all duration-300 ${
            activeTab === 'resources'
              ? 'bg-gradient-to-r from-rose-500 to-rose-600 text-white shadow-lg'
              : 'text-dark-600 hover:bg-dark-100'
          }`}
        >
          学习资源
        </button>
        <button
          onClick={() => setActiveTab('documents')}
          className={`flex-1 py-3 px-4 rounded-lg font-medium transition-all duration-300 ${
            activeTab === 'documents'
              ? 'bg-gradient-to-r from-rose-500 to-rose-600 text-white shadow-lg'
              : 'text-dark-600 hover:bg-dark-100'
          }`}
        >
          我的文件
        </button>
      </div>

      {favorites.length === 0 ? (
        <div className="flex flex-col items-center justify-center h-64 bg-white/50 backdrop-blur-xl rounded-2xl border border-dark-100/50">
          <div className="w-20 h-20 mb-6 rounded-full bg-rose-50 flex items-center justify-center">
            <svg className="w-10 h-10 text-rose-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4.318 6.318a4.5 4.5 0 000 6.364L12 20.364l7.682-7.682a4.5 4.5 0 00-6.364-6.364L12 7.636l-1.318-1.318a4.5 4.5 0 00-6.364 0z" />
            </svg>
          </div>
          <h3 className="text-xl font-bold text-dark-700 mb-2">还没有收藏任何资源</h3>
          <p className="text-dark-400 mb-6">去资源库看看吧，发现感兴趣的就开始学习</p>
          <button
            onClick={() => navigate('/resources')}
            className="px-6 py-3 bg-gradient-to-r from-rose-500 to-rose-600 text-white rounded-xl font-semibold hover:from-rose-600 hover:to-rose-700 transition-all duration-300 shadow-lg shadow-rose-500/30"
          >
            前往资源库
          </button>
        </div>
      ) : (
        <>
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
            {favorites.map((resource) => {
              const isDocument = resource.type === 'document';
              const isFavorited = localFavorites.has(resource.id);

              if (isDocument) {
                return (
                  <div
                    key={resource.id}
                    className="group bg-white/80 backdrop-blur-xl rounded-2xl shadow-soft overflow-hidden border border-white/50 hover:shadow-medium transition-all duration-300 hover:-translate-y-1"
                  >
                    <div className="h-2 bg-gradient-to-r from-rose-500 via-rose-400 to-rose-500"></div>
                    <div className="p-6">
                      <div className="flex items-start justify-between mb-4">
                        <div className="px-3 py-1 rounded-lg text-xs font-semibold bg-gradient-to-r from-gray-500 to-gray-600 text-white">
                          我的文件
                        </div>
                        <button
                          onClick={(e) => handleToggleFavorite(resource.id, e, 'document')}
                          className={`w-8 h-8 rounded-lg flex items-center justify-center transition-all duration-300 ${isFavorited ? 'bg-rose-100 text-rose-500' : 'bg-dark-100 text-dark-400 hover:bg-rose-50 hover:text-rose-500'}`}
                        >
                          <svg className="w-4 h-4" fill={isFavorited ? 'currentColor' : 'none'} stroke="currentColor" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4.318 6.318a4.5 4.5 0 000 6.364L12 20.364l7.682-7.682a4.5 4.5 0 00-6.364-6.364L12 7.636l-1.318-1.318a4.5 4.5 0 00-6.364 0z" />
                          </svg>
                        </button>
                      </div>

                      <div className="flex items-center gap-1 mb-3">
                        <svg className="w-4 h-4 text-warning-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
                        </svg>
                        <span className="text-sm font-bold text-dark-700">{resource.status}</span>
                        <span className="text-xs text-dark-400 ml-2">{resource.uploadTime}</span>
                      </div>

                      <h3 className="text-lg font-bold text-dark-800 mb-3 line-clamp-2 group-hover:text-rose-600 transition-colors duration-300">{resource.title}</h3>

                      <div className="flex gap-2">
                        <button
                          onClick={() => setSelectedResource(resource)}
                          className="flex-1 py-3 bg-gradient-to-r from-rose-50 to-rose-100/50 text-rose-600 font-semibold rounded-xl hover:from-rose-100 hover:to-rose-50 transition-all duration-300 border border-rose-200"
                        >
                          查看详情
                        </button>
                      </div>
                    </div>
                  </div>
                );
              }

              const display = getResourceDisplay(resource);
              return (
                <div
                  key={display.id}
                  className="group bg-white/80 backdrop-blur-xl rounded-2xl shadow-soft overflow-hidden border border-white/50 hover:shadow-medium transition-all duration-300 hover:-translate-y-1"
                >
                  <div className="h-2 bg-gradient-to-r from-rose-500 via-rose-400 to-rose-500"></div>
                  <div className="p-6">
                    <div className="flex items-start justify-between mb-4">
                      <div className={`px-3 py-1 rounded-lg text-xs font-semibold bg-gradient-to-r ${display.platformColor} text-white`}>
                        {display.platform}
                      </div>
                      <button
                        onClick={(e) => handleToggleFavorite(display.id, e, 'resource')}
                        className={`w-8 h-8 rounded-lg flex items-center justify-center transition-all duration-300 ${isFavorited ? 'bg-rose-100 text-rose-500' : 'bg-dark-100 text-dark-400 hover:bg-rose-50 hover:text-rose-500'}`}
                      >
                        <svg className="w-4 h-4" fill={isFavorited ? 'currentColor' : 'none'} stroke="currentColor" viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4.318 6.318a4.5 4.5 0 000 6.364L12 20.364l7.682-7.682a4.5 4.5 0 00-6.364-6.364L12 7.636l-1.318-1.318a4.5 4.5 0 00-6.364 0z" />
                        </svg>
                      </button>
                    </div>

                    <div className="flex items-center gap-1 mb-3">
                      <svg className="w-4 h-4 text-warning-500" fill="currentColor" viewBox="0 0 20 20">
                        <path d="M9.049 2.927c.3-.921 1.603-.921 1.902 0l1.07 3.292a1 1 0 00.95.69h3.462c.969 0 1.371 1.24.588 1.81l-2.8 2.034a1 1 0 00-.364 1.118l1.07 3.292c.3.921-.755 1.688-1.54 1.118l-2.8-2.034a1 1 0 00-1.175 0l-2.8 2.034c-.784.57-1.838-.197-1.539-1.118l1.07-3.292a1 1 0 00-.364-1.118L2.98 8.72c-.783-.57-.38-1.81.588-1.81h3.461a1 1 0 00.951-.69l1.07-3.292z" />
                      </svg>
                      <span className="text-sm font-bold text-dark-700">{display.rating}</span>
                      <span className="text-xs text-dark-400 ml-2">{display.viewCount} 浏览</span>
                    </div>

                    <h3 className="text-lg font-bold text-dark-800 mb-3 line-clamp-2 group-hover:text-rose-600 transition-colors duration-300">{display.title}</h3>

                    <div className="flex items-center gap-2 mb-4">
                      <span className={`px-2.5 py-1 text-xs font-medium rounded-full border ${getDifficultyColor(display.difficulty)}`}>
                        {display.difficulty}
                      </span>
                      <span className="text-xs text-dark-400">{display.type}</span>
                    </div>

                    <div className="p-4 bg-gradient-to-br from-dark-50 to-dark-100/50 rounded-xl mb-4">
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
                        className="flex-1 py-3 bg-gradient-to-r from-rose-50 to-rose-100/50 text-rose-600 font-semibold rounded-xl hover:from-rose-100 hover:to-rose-50 transition-all duration-300 border border-rose-200"
                      >
                        查看详情
                      </button>
                      {display.url && (
                        <a
                          href={display.url}
                          target="_blank"
                          rel="noopener noreferrer"
                          onClick={(e) => e.stopPropagation()}
                          className="flex-1 py-3 bg-gradient-to-r from-rose-500 to-rose-600 text-white font-semibold rounded-xl hover:from-rose-600 hover:to-rose-700 transition-all duration-300 shadow-lg shadow-rose-500/30 text-center"
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

          {renderPagination()}
        </>
      )}

      {selectedResource && (
        <div className="fixed inset-0 bg-black/40 backdrop-blur-sm z-50 flex items-center justify-center p-4 animate-fade-in" onClick={() => setSelectedResource(null)}>
          <div className="bg-white rounded-2xl shadow-medium max-w-2xl w-full max-h-[80vh] overflow-y-auto animate-fade-in-up" onClick={(e) => e.stopPropagation()}>
            <div className="sticky top-0 bg-white border-b border-dark-100 p-6 flex items-start justify-between">
              <div>
                <div className="flex items-center gap-3 mb-2">
                  <span className={`px-3 py-1 rounded-lg text-xs font-semibold bg-gradient-to-r ${selectedResource.platformColor} text-white`}>
                    {selectedResource.platform}
                  </span>
                  <span className="text-sm text-dark-400">{selectedResource.type}</span>
                </div>
                <h3 className="text-2xl font-bold text-dark-800">{selectedResource.title}</h3>
              </div>
              <div className="flex items-center gap-2">
                <button
                  onClick={() => handleToggleFavorite(selectedResource.id)}
                  className={`w-10 h-10 rounded-xl flex items-center justify-center transition-all duration-300 ${localFavorites.has(selectedResource.id) ? 'bg-rose-100 text-rose-500' : 'bg-dark-100 text-dark-400 hover:bg-rose-50 hover:text-rose-500'}`}
                >
                  <svg className="w-5 h-5" fill={localFavorites.has(selectedResource.id) ? 'currentColor' : 'none'} stroke="currentColor" viewBox="0 0 24 24">
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
              <div className="p-4 bg-gradient-to-br from-rose-50 to-rose-100/50 rounded-xl border border-rose-100">
                <div className="flex items-center gap-2 mb-2">
                  <svg className="w-5 h-5 text-rose-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 10V3L4 14h7v7l9-11h-7z" />
                  </svg>
                  <h4 className="font-bold text-rose-800">AI 推荐理由</h4>
                </div>
                <p className="text-rose-700 leading-relaxed">{selectedResource.reason}</p>
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
                  className="block w-full py-3 bg-gradient-to-r from-rose-500 to-rose-600 text-white rounded-xl font-semibold text-center hover:from-rose-600 hover:to-rose-700 transition-all duration-300 shadow-lg shadow-rose-500/30"
                >
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

export default MyFavorites;
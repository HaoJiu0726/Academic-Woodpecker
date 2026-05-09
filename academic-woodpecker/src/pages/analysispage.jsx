import React, { useState, useEffect, useCallback } from 'react';
import '../AnalysisPage.scss';
import { analysisApi } from '../api';

const AnalysisPage = () => {
  const [isDragging, setIsDragging] = useState(false);
  const [uploadedFile, setUploadedFile] = useState(null);
  const [uploadResponse, setUploadResponse] = useState(null);
  const [parseStage, setParseStage] = useState(null);
  const [parsedData, setParsedData] = useState(null);
  const [history, setHistory] = useState([]);
  const [isLoadingHistory, setIsLoadingHistory] = useState(true);
  const [selectedRecord, setSelectedRecord] = useState(null);
  const [isLoadingResult, setIsLoadingResult] = useState(false);

  useEffect(() => {
    fetchHistory();
  }, []);

  const fetchHistory = async () => {
    setIsLoadingHistory(true);
    try {
      const response = await analysisApi.getHistory();
      if (response.data && response.data.records) {
        setHistory(response.data.records);
      } else if (Array.isArray(response.data)) {
        setHistory(response.data);
      } else {
        setHistory([]);
      }
    } catch (error) {
      console.error('获取历史记录失败:', error);
      setHistory([]);
    } finally {
      setIsLoadingHistory(false);
    }
  };

  const handleDragOver = (e) => {
    e.preventDefault();
    setIsDragging(true);
  };

  const handleDragLeave = () => {
    setIsDragging(false);
  };

  const handleDrop = (e) => {
    e.preventDefault();
    setIsDragging(false);
    const file = e.dataTransfer.files[0];
    if (file) {
      handleFileUpload(file);
    }
  };

  const handleFileSelect = (e) => {
    const file = e.target.files[0];
    if (file) {
      handleFileUpload(file);
    }
  };

  const getFileType = (file) => {
    const ext = file.name.split('.').pop().toLowerCase();
    if (['jpg', 'jpeg', 'png'].includes(ext)) return 'image';
    if (ext === 'pdf') return 'pdf';
    if (ext === 'txt') return 'text';
    return 'document';
  };

  const handleFileUpload = async (file) => {
    setUploadedFile(file);
    setParsedData(null);
    setUploadResponse(null);
    setParseStage('正在上传文件...');

    try {
      const fileType = getFileType(file);
      const response = await analysisApi.uploadFile(file, fileType);
      const data = response.data;

      setUploadResponse(data);
      setParseStage('文件上传成功，正在解析...');

      pollForProgress(data.fileId);
    } catch (error) {
      console.error('上传文件失败:', error);
      setParseStage('上传失败，请重试');
    }
  };

  const pollForProgress = useCallback(async (fileId) => {
    const maxAttempts = 60;
    let attempts = 0;

    const poll = async () => {
      try {
        const response = await analysisApi.getProgress(fileId);
        const data = response.data;

        if (data.stage) {
          setParseStage(data.stage);
        }

        if (data.status === 'completed') {
          fetchResult(fileId);
          return;
        } else if (data.status === 'failed') {
          setParseStage('解析失败，请重试');
          return;
        }

        attempts++;
        if (attempts < maxAttempts) {
          setTimeout(poll, 2000);
        } else {
          setParseStage('解析超时，请重试');
        }
      } catch (error) {
        console.error('获取进度失败:', error);
        attempts++;
        if (attempts < maxAttempts) {
          setTimeout(poll, 2000);
        }
      }
    };

    poll();
  }, []);

  const fetchResult = async (fileId) => {
    setIsLoadingResult(true);
    try {
      const response = await analysisApi.getResult(fileId);
      const data = response.data;

      const result = {
        知识点: data.extractedKnowledge?.map(k => k.name) || [],
        薄弱项: data.weakPoints?.map(w => w.name) || [],
        建议: data.suggestions || [],
        summary: data.summary || '',
        fileName: data.originalFile?.name || uploadedFile?.name || '未知文件',
        analyzedAt: data.analyzedAt,
      };

      setParsedData(result);
      setParseStage('解析完成');
      fetchHistory();
    } catch (error) {
      console.error('获取结果失败:', error);
      setParseStage('获取结果失败');
    } finally {
      setIsLoadingResult(false);
    }
  };

  const handleHistoryClick = async (item) => {
    setSelectedRecord(item);
    setUploadedFile(null);
    setParsedData(null);
    setParseStage(null);

    if (item.status === '已分析') {
      try {
        const response = await analysisApi.getResult(item.id);
        const data = response.data;

        const result = {
          知识点: data.extractedKnowledge?.map(k => k.name) || [],
          薄弱项: data.weakPoints?.map(w => w.name) || [],
          建议: data.suggestions || [],
          summary: data.summary || '',
          fileName: data.originalFile?.name || item.fileName || '未知文件',
          analyzedAt: data.analyzedAt,
        };

        setParsedData(result);
      } catch (error) {
        console.error('获取历史记录结果失败:', error);
      }
    }
  };

  const handleBackToUpload = () => {
    setSelectedRecord(null);
    setParsedData(null);
    setParseStage(null);
    setUploadedFile(null);
    setUploadResponse(null);
  };

  return (
    <div className="space-y-8 animate-fade-in">
      <div className="relative overflow-hidden">
        <div className="absolute inset-0 bg-gradient-to-r from-secondary-500/10 via-secondary-400/5 to-transparent"></div>
        <div className="absolute top-0 right-0 w-96 h-96 bg-secondary-500/5 rounded-full blur-3xl -translate-y-1/2 translate-x-1/2"></div>
        <div className="relative flex items-center gap-4">
          {selectedRecord && (
            <button
              onClick={handleBackToUpload}
              className="p-2 rounded-xl bg-white/80 backdrop-blur-xl shadow-sm border border-white/50 hover:bg-dark-50 transition-colors"
            >
              <svg className="w-5 h-5 text-dark-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
              </svg>
            </button>
          )}
          <div>
            <h1 className="text-3xl font-bold text-dark-800">多维数据上传与解析</h1>
            <p className="text-dark-400 mt-1">智能分析学业数据，精准定位薄弱环节</p>
          </div>
        </div>
      </div>

      {selectedRecord ? (
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
          <div className="bg-white/80 backdrop-blur-xl rounded-2xl shadow-soft p-6 border border-white/50">
            <div className="flex items-center gap-4 mb-4">
              <div className="w-12 h-12 rounded-xl bg-gradient-to-br from-secondary-100 to-secondary-200 flex items-center justify-center">
                <svg className="w-6 h-6 text-secondary-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
                </svg>
              </div>
              <div className="flex-1">
                <h4 className="font-semibold text-dark-800">{selectedRecord.fileName}</h4>
                <p className="text-sm text-dark-400">{selectedRecord.uploadTime}</p>
              </div>
              <span className="px-3 py-1 bg-emerald-50 text-emerald-600 text-xs font-medium rounded-full border border-emerald-100">
                {selectedRecord.status}
              </span>
            </div>

            {parsedData?.summary && (
              <div className="p-4 bg-secondary-50 rounded-xl border border-secondary-100 mb-4">
                <h5 className="font-semibold text-secondary-800 mb-2">分析总结</h5>
                <p className="text-sm text-secondary-700 leading-relaxed">{parsedData.summary}</p>
              </div>
            )}

            {parseStage && (
              <div className="flex items-center gap-3 p-4 bg-emerald-50 rounded-xl border border-emerald-100">
                <div className="w-8 h-8 rounded-full bg-emerald-500 flex items-center justify-center">
                  <svg className="w-4 h-4 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                  </svg>
                </div>
                <span className="text-sm font-semibold text-emerald-700">{parseStage}</span>
              </div>
            )}
          </div>

          <div className="space-y-6">
            {parsedData?.知识点?.length > 0 && (
              <div className="bg-white/80 backdrop-blur-xl rounded-2xl shadow-soft p-6 border border-white/50">
                <div className="flex items-center justify-between mb-6">
                  <h3 className="text-xl font-bold text-dark-800">提取的知识点</h3>
                  <span className="text-xs font-medium text-secondary-600 bg-secondary-50 px-3 py-1 rounded-full border border-secondary-100">AI 已识别</span>
                </div>
                <div className="space-y-3 max-h-[320px] overflow-y-auto pr-2 scrollbar-thin">
                  {parsedData.知识点.map((item, index) => (
                    <div key={index} className="flex items-center gap-3 p-4 bg-gradient-to-r from-emerald-50 to-emerald-100/50 rounded-xl border border-emerald-100">
                      <div className="w-8 h-8 rounded-lg bg-gradient-to-br from-emerald-400 to-emerald-600 flex items-center justify-center flex-shrink-0">
                        <svg className="w-4 h-4 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                        </svg>
                      </div>
                      <span className="text-dark-700 font-medium">{item}</span>
                    </div>
                  ))}
                </div>
              </div>
            )}

            {parsedData?.薄弱项?.length > 0 && (
              <div className="bg-white/80 backdrop-blur-xl rounded-2xl shadow-soft p-6 border border-white/50">
                <div className="flex items-center justify-between mb-6">
                  <h3 className="text-xl font-bold text-dark-800">薄弱知识点</h3>
                  <span className="text-xs font-medium text-rose-600 bg-rose-50 px-3 py-1 rounded-full border border-rose-100">需加强</span>
                </div>
                <div className="space-y-3 max-h-[320px] overflow-y-auto pr-2 scrollbar-thin">
                  {parsedData.薄弱项.map((item, index) => (
                    <div key={index} className="flex items-center gap-3 p-4 bg-gradient-to-r from-rose-50 to-rose-100/50 rounded-xl border border-rose-100">
                      <div className="w-8 h-8 rounded-lg bg-gradient-to-br from-rose-400 to-rose-600 flex items-center justify-center flex-shrink-0">
                        <svg className="w-4 h-4 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
                        </svg>
                      </div>
                      <span className="text-dark-700 font-medium">{item}</span>
                    </div>
                  ))}
                </div>
              </div>
            )}
          </div>
        </div>
      ) : (
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
          <div className="space-y-6">
            <div
              className={`relative border-2 border-dashed rounded-2xl p-12 transition-all duration-300 ${isDragging ? 'border-secondary-500 bg-secondary-50/50' : 'border-dark-200 hover:border-secondary-300 hover:bg-dark-50/50'}`}
              onDragOver={handleDragOver}
              onDragLeave={handleDragLeave}
              onDrop={handleDrop}
            >
              <div className="flex flex-col items-center justify-center text-center">
                <div className={`w-20 h-20 rounded-2xl bg-gradient-to-br from-secondary-400 to-secondary-600 flex items-center justify-center mb-6 shadow-glow transition-all duration-300 ${isDragging ? 'scale-110 shadow-secondary-glow' : ''}`}>
                  <svg className="w-10 h-10 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M7 16a4 4 0 01-.88-7.903A5 5 0 1115.9 6L16 6a5 5 0 011 9.9M15 13l-3-3m0 0l-3 3m3-3v12" />
                  </svg>
                </div>
                <h3 className="text-xl font-bold text-dark-800 mb-2">拖拽文件到此处</h3>
                <p className="text-dark-400 mb-6">或点击下方按钮选择文件</p>
                <label className="px-6 py-3 bg-gradient-to-r from-secondary-500 to-secondary-600 text-white font-semibold rounded-xl cursor-pointer hover:shadow-glow hover:shadow-secondary-500/30 transition-all duration-300">
                  <span>选择文件</span>
                  <input type="file" className="hidden" accept=".pdf,.jpg,.jpeg,.png,.txt" onChange={handleFileSelect} />
                </label>
                <p className="text-sm text-dark-400 mt-4">支持 PDF、图片、文本文件</p>
              </div>
            </div>

            {uploadedFile && (
              <div className="bg-white/80 backdrop-blur-xl rounded-2xl shadow-soft p-6 border border-white/50 animate-fade-in-up">
                <div className="flex items-center gap-4 mb-4">
                  <div className="w-12 h-12 rounded-xl bg-gradient-to-br from-secondary-100 to-secondary-200 flex items-center justify-center">
                    <svg className="w-6 h-6 text-secondary-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
                    </svg>
                  </div>
                  <div className="flex-1">
                    <h4 className="font-semibold text-dark-800">{uploadedFile.name}</h4>
                    <p className="text-sm text-dark-400">{(uploadedFile.size / 1024 / 1024).toFixed(2)} MB</p>
                  </div>
                </div>

                {parseStage && !parsedData && (
                  <div className="space-y-3">
                    <div className="flex items-center gap-3 p-4 bg-dark-50 rounded-xl">
                      <div className="w-6 h-6 rounded-full bg-secondary-500 flex items-center justify-center animate-pulse">
                        <svg className="w-3 h-3 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" />
                        </svg>
                      </div>
                      <span className="text-sm font-medium text-dark-600">{parseStage}</span>
                    </div>
                    <div className="h-2 bg-dark-100 rounded-full overflow-hidden">
                      <div className="h-full bg-gradient-to-r from-secondary-500 to-secondary-400 rounded-full animate-shimmer" style={{ backgroundSize: '200% 100%' }}></div>
                    </div>
                  </div>
                )}

                {parsedData && parseStage === '解析完成' && (
                  <div className="flex items-center gap-3 p-4 bg-emerald-50 rounded-xl border border-emerald-100">
                    <div className="w-8 h-8 rounded-full bg-emerald-500 flex items-center justify-center">
                      <svg className="w-4 h-4 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                      </svg>
                    </div>
                    <span className="text-sm font-semibold text-emerald-700">解析完成</span>
                  </div>
                )}
              </div>
            )}
          </div>

          <div className="space-y-6">
            {parsedData?.知识点?.length > 0 && (
              <div className="bg-white/80 backdrop-blur-xl rounded-2xl shadow-soft p-6 border border-white/50">
                <div className="flex items-center justify-between mb-6">
                  <h3 className="text-xl font-bold text-dark-800">提取的知识点</h3>
                  <span className="text-xs font-medium text-secondary-600 bg-secondary-50 px-3 py-1 rounded-full border border-secondary-100">AI 已识别</span>
                </div>
                <div className="space-y-3">
                  {parsedData.知识点.map((item, index) => (
                    <div key={index} className="flex items-center gap-3 p-4 bg-gradient-to-r from-emerald-50 to-emerald-100/50 rounded-xl border border-emerald-100">
                      <div className="w-8 h-8 rounded-lg bg-gradient-to-br from-emerald-400 to-emerald-600 flex items-center justify-center">
                        <svg className="w-4 h-4 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                        </svg>
                      </div>
                      <span className="text-dark-700 font-medium">{item}</span>
                    </div>
                  ))}
                </div>
              </div>
            )}

            {parsedData?.薄弱项?.length > 0 && (
              <div className="bg-white/80 backdrop-blur-xl rounded-2xl shadow-soft p-6 border border-white/50">
                <div className="flex items-center justify-between mb-6">
                  <h3 className="text-xl font-bold text-dark-800">薄弱知识点</h3>
                  <span className="text-xs font-medium text-rose-600 bg-rose-50 px-3 py-1 rounded-full border border-rose-100">需加强</span>
                </div>
                <div className="space-y-3">
                  {parsedData.薄弱项.map((item, index) => (
                    <div key={index} className="flex items-center gap-3 p-4 bg-gradient-to-r from-rose-50 to-rose-100/50 rounded-xl border border-rose-100">
                      <div className="w-8 h-8 rounded-lg bg-gradient-to-br from-rose-400 to-rose-600 flex items-center justify-center">
                        <svg className="w-4 h-4 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
                        </svg>
                      </div>
                      <span className="text-dark-700 font-medium">{item}</span>
                    </div>
                  ))}
                </div>
              </div>
            )}
          </div>
        </div>
      )}

      <div className="bg-white/80 backdrop-blur-xl rounded-2xl shadow-soft p-6 border border-white/50">
        <div className="flex items-center justify-between mb-6">
          <div>
            <h3 className="text-xl font-bold text-dark-800">历史档案库</h3>
            <p className="text-sm text-dark-400 mt-1">查看以往的分析记录</p>
          </div>
          {!isLoadingHistory && (
            <div className="flex items-center gap-2 text-xs text-dark-400 bg-dark-50 px-3 py-1.5 rounded-full">
              <span className="w-2 h-2 rounded-full bg-emerald-500"></span>
              共 {history.length} 条记录
            </div>
          )}
        </div>

        {isLoadingHistory ? (
          <div className="flex items-center justify-center h-32">
            <div className="w-8 h-8 border-2 border-secondary-500 border-t-transparent rounded-full animate-spin"></div>
          </div>
        ) : history.length === 0 ? (
          <div className="flex flex-col items-center justify-center h-32 bg-dark-50/50 rounded-xl">
            <div className="w-14 h-14 mb-4 rounded-full bg-secondary-50 flex items-center justify-center">
              <svg className="w-7 h-7 text-secondary-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 13h6m-3-3v6m5 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
              </svg>
            </div>
            <p className="text-dark-500 font-medium mb-1">暂无分析记录</p>
            <p className="text-sm text-dark-400">快去上传一份吧</p>
          </div>
        ) : (
          <div className="space-y-3">
            {history.map((item) => (
              <div
                key={item.id}
                onClick={() => handleHistoryClick(item)}
                className="flex items-center justify-between p-4 bg-gradient-to-r from-dark-50 to-dark-100/50 rounded-xl border border-dark-100/50 hover:from-dark-100 hover:to-dark-50 transition-all duration-300 group cursor-pointer"
              >
                <div className="flex items-center gap-4">
                  <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-primary-100 to-primary-200 flex items-center justify-center group-hover:from-primary-200 group-hover:to-primary-300 transition-all duration-300">
                    <svg className="w-5 h-5 text-primary-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
                    </svg>
                  </div>
                  <div>
                    <h4 className="font-semibold text-dark-700">{item.fileName}</h4>
                    <p className="text-sm text-dark-400">{item.uploadTime}</p>
                  </div>
                </div>
                <div className="flex items-center gap-3">
                  <span className={`px-3 py-1 text-xs font-medium rounded-full border ${
                    item.status === '已分析'
                      ? 'bg-emerald-50 text-emerald-600 border-emerald-100'
                      : item.status === '处理中'
                      ? 'bg-amber-50 text-amber-600 border-amber-100'
                      : 'bg-dark-100 text-dark-500 border-dark-200'
                  }`}>
                    {item.status}
                  </span>
                  <button className="w-8 h-8 rounded-lg bg-dark-100 flex items-center justify-center hover:bg-primary-100 hover:text-primary-600 transition-all duration-300">
                    <svg className="w-4 h-4 text-dark-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
                    </svg>
                  </button>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
};

export default AnalysisPage;
import React, { useState, useRef, useEffect } from 'react';
import { useSelector, useDispatch } from 'react-redux';
import ReactMarkdown from 'react-markdown';
import remarkGfm from 'remark-gfm';
import { mentorApi, dashboardApi } from '../api';
import { addMessage, setIsTyping, setThreadId, clearMessages } from '../store/mentorSlice';
import '../AIMentor.scss';

const AIMentor = () => {
  const dispatch = useDispatch();
  const { messages, threadId, isTyping } = useSelector(state => state.mentor);
  const { userInfo } = useSelector(state => state.user);
  const [inputValue, setInputValue] = useState('');
  const [userContext, setUserContext] = useState({
    weakPoints: [],
    recentDocuments: [],
    knowledgeOverview: null
  });
  const messagesEndRef = useRef(null);

  const displayName = userInfo?.nickname || userInfo?.username || 'U';

  const quickQuestions = [
    '这个题怎么做？',
    '请解释这个概念',
    '给我一个例子',
    '下一步应该怎么做？',
  ];

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages]);

  useEffect(() => {
    fetchUserContext();
  }, []);

  const fetchUserContext = async () => {
    try {
      const [overviewRes, graphRes] = await Promise.all([
        dashboardApi.getOverview().catch(() => null),
        dashboardApi.getKnowledgeGraph().catch(() => null)
      ]);

      const weakPoints = [];
      if (graphRes?.data?.nodes) {
        graphRes.data.nodes.forEach(node => {
          if (node.status === 'weak' || node.status === '薄弱' || (node.score !== undefined && node.score < 75)) {
            weakPoints.push({ name: node.name, score: node.score });
          }
        });
      }

      setUserContext({
        weakPoints,
        recentDocuments: [],
        knowledgeOverview: overviewRes?.data || null
      });
    } catch (error) {
      console.error('获取用户上下文失败:', error);
    }
  };

  const handleSend = async () => {
    if (!inputValue.trim()) return;

    const userContent = inputValue;
    dispatch(addMessage({ role: 'user', content: userContent }));
    setInputValue('');
    dispatch(setIsTyping(true));

    try {
      const response = await mentorApi.sendMessage(userContent, userContext, threadId);
      const aiContent = response.data?.content || '抱歉，我暂时无法回答这个问题。';

      if (response.data?.threadId) {
        dispatch(setThreadId(response.data.threadId));
      }

      dispatch(addMessage({ role: 'assistant', content: aiContent }));
    } catch (error) {
      console.error('发送消息失败:', error);
      dispatch(addMessage({ role: 'assistant', content: '发送消息失败，请稍后重试。' }));
    } finally {
      dispatch(setIsTyping(false));
    }
  };

  const handleQuickQuestion = (question) => {
    setInputValue(question);
  };

  const handleClearChat = () => {
    dispatch(clearMessages());
  };

  return (
    <div className="h-[calc(100vh-180px)] flex flex-col animate-fade-in">
      <div className="flex items-center justify-between mb-6">
        <div className="flex items-center gap-3">
          <div className="flex items-center gap-2 px-4 py-2 bg-gradient-to-r from-secondary-50 to-secondary-100/50 rounded-xl border border-secondary-200">
            <div className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse"></div>
            <span className="text-sm font-medium text-secondary-700">AI 助手已了解你的学情</span>
          </div>
          {threadId && (
            <span className="text-xs text-dark-400 px-2 py-1 bg-dark-50 rounded-lg">
              对话ID: {threadId.slice(0, 8)}...
            </span>
          )}
        </div>
        <button
          onClick={handleClearChat}
          className="px-3 py-1.5 text-xs text-dark-400 hover:text-rose-500 transition-colors"
          title="清空对话"
        >
          <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
          </svg>
        </button>
      </div>

      <div className="flex-1 overflow-y-auto space-y-6 mb-6 pr-2">
        {messages.map((message) => (
          <div key={message.id} className={`flex ${message.role === 'user' ? 'justify-end' : 'justify-start'}`}>
            <div className={`flex items-start gap-4 max-w-[80%] ${message.role === 'user' ? 'flex-row' : ''}`}>
              {message.role === 'assistant' && (
                <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-secondary-500 to-secondary-600 flex items-center justify-center shadow-glow flex-shrink-0">
                  <svg className="w-5 h-5 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9.663 17h4.673M12 3v1m6.364 1.636l-.707.707M21 12h-1M4 12H3m3.343-5.657l-.707-.707m2.828 9.9a5 5 0 117.072 0l-.548.547A3.374 3.374 0 0014 18.469V19a2 2 0 11-4 0v-.531c0-.895-.356-1.754-.988-2.386l-.548-.547z" />
                  </svg>
                </div>
              )}
              <div className={`rounded-2xl p-5 ${message.role === 'user' ? 'bg-gradient-to-br from-primary-500 to-primary-600 text-white shadow-glow' : 'bg-white/80 backdrop-blur-xl border border-white/50 shadow-soft'}`}>
                {message.role === 'assistant' ? (
                  <ReactMarkdown
                    remarkPlugins={[remarkGfm]}
                    components={{
                      h1: ({children}) => <h1 className="text-xl font-bold mb-2 mt-4">{children}</h1>,
                      h2: ({children}) => <h2 className="text-lg font-bold mb-2 mt-4">{children}</h2>,
                      h3: ({children}) => <h3 className="text-base font-semibold mb-2 mt-3">{children}</h3>,
                      p: ({node, children}) => {
                        const hasBlockChild = node?.children?.some(
                          child => child.type === 'element' && ['ul', 'ol', 'pre', 'blockquote', 'table'].includes(child.tagName)
                        );
                        if (hasBlockChild) {
                          return <div className="my-2">{children}</div>;
                        }
                        return <p className="mb-2 text-sm leading-relaxed text-dark-700 whitespace-pre-wrap">{children}</p>;
                      },
                      ul: ({children}) => <ul className="list-disc list-inside mb-3 ml-2 space-y-1 text-dark-700 text-sm">{children}</ul>,
                      ol: ({children}) => <ol className="list-decimal list-inside mb-3 ml-2 space-y-1 text-dark-700 text-sm">{children}</ol>,
                      li: ({children}) => <li className="text-dark-700">{children}</li>,
                      code: ({node, inline, className, children, ...props}) => {
                        if (inline) {
                          return <code className="bg-dark-100 px-1.5 py-0.5 rounded text-primary-600 text-xs font-mono" {...props}>{children}</code>;
                        }
                        return <code className="block bg-dark-800 text-dark-50 p-3 rounded-lg overflow-x-auto text-xs font-mono mb-2" {...props}>{children}</code>;
                      },
                      pre: ({children}) => <pre className="bg-dark-800 rounded-lg overflow-hidden mb-2 text-sm">{children}</pre>,
                      strong: ({children}) => <strong className="font-bold text-primary-600">{children}</strong>,
                      em: ({children}) => <em className="italic">{children}</em>,
                      blockquote: ({children}) => <blockquote className="border-l-4 border-secondary-300 pl-4 italic text-dark-600 my-3 text-sm">{children}</blockquote>,
                      table: ({children}) => <table className="w-full border-collapse border border-dark-200 my-3 text-xs">{children}</table>,
                      th: ({children}) => <th className="border border-dark-200 bg-dark-50 p-2 text-left font-semibold">{children}</th>,
                      td: ({children}) => <td className="border border-dark-200 p-2">{children}</td>,
                    }}
                  >
                    {message.content}
                  </ReactMarkdown>
                ) : (
                  <p className="text-sm leading-relaxed text-white whitespace-pre-wrap">
                    {message.content}
                  </p>
                )}
                <p className={`text-xs mt-2 ${message.role === 'user' ? 'text-primary-100' : 'text-dark-400'}`}>
                  {new Date(message.timestamp).toLocaleTimeString('zh-CN', { hour: '2-digit', minute: '2-digit' })}
                </p>
              </div>
              {message.role === 'user' && (
                <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-primary-400 to-primary-600 flex items-center justify-center shadow-sm flex-shrink-0 overflow-hidden">
                  {userInfo?.avatar ? (
                    <img src={userInfo.avatar} alt="avatar" className="w-full h-full object-cover" />
                  ) : (
                    <span className="text-white font-bold text-sm">{displayName.charAt(0).toUpperCase()}</span>
                  )}
                </div>
              )}
            </div>
          </div>
        ))}

        {isTyping && (
          <div className="flex items-start gap-4">
            <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-secondary-500 to-secondary-600 flex items-center justify-center shadow-glow">
              <svg className="w-5 h-5 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9.663 17h4.673M12 3v1m6.364 1.636l-.707.707M21 12h-1M4 12H3m3.343-5.657l-.707-.707m2.828 9.9a5 5 0 117.072 0l-.548.547A3.374 3.374 0 0014 18.469V19a2 2 0 11-4 0v-.531c0-.895-.356-1.754-.988-2.386l-.548-.547z" />
              </svg>
            </div>
            <div className="bg-white/80 backdrop-blur-xl border border-white/50 rounded-2xl p-5 shadow-soft">
              <div className="flex items-center gap-2">
                <div className="w-2 h-2 rounded-full bg-secondary-500 animate-bounce"></div>
                <div className="w-2 h-2 rounded-full bg-secondary-500 animate-bounce" style={{ animationDelay: '0.2s' }}></div>
                <div className="w-2 h-2 rounded-full bg-secondary-500 animate-bounce" style={{ animationDelay: '0.4s' }}></div>
              </div>
            </div>
          </div>
        )}
        <div ref={messagesEndRef} />
      </div>

      <div className="bg-white/80 backdrop-blur-xl rounded-2xl shadow-soft p-4 border border-white/50">
        <div className="flex flex-wrap gap-2 mb-4">
          {quickQuestions.map((question, index) => (
            <button
              key={index}
              onClick={() => handleQuickQuestion(question)}
              className="px-3 py-1.5 text-xs text-dark-500 bg-dark-50 rounded-lg hover:bg-primary-50 hover:text-primary-600 transition-colors border border-dark-100/50"
            >
              {question}
            </button>
          ))}
        </div>

        <div className="flex gap-3">
          <input
            type="text"
            value={inputValue}
            onChange={(e) => setInputValue(e.target.value)}
            onKeyPress={(e) => e.key === 'Enter' && handleSend()}
            placeholder="输入你的问题..."
            className="flex-1 px-5 py-4 bg-dark-50 rounded-xl text-dark-700 placeholder-dark-400 focus:outline-none focus:ring-2 focus:ring-primary-500/50 focus:bg-white transition-all duration-300"
          />
          <button
            onClick={handleSend}
            disabled={!inputValue.trim() || isTyping}
            className="px-6 py-4 bg-gradient-to-r from-primary-500 to-primary-600 text-white font-semibold rounded-xl hover:shadow-glow hover:shadow-primary-500/30 transition-all duration-300 disabled:opacity-50 disabled:cursor-not-allowed disabled:hover:shadow-none"
          >
            <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 19l9 2-9-18-9 18 9-2zm0 0v-8" />
            </svg>
          </button>
        </div>
      </div>
    </div>
  );
};

export default AIMentor;
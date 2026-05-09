import React, { useState } from 'react';
import { Link, useLocation, Outlet, useNavigate } from 'react-router-dom';
import { useSelector, useDispatch } from 'react-redux';
import { logout } from '../store/userSlice';
import { clearAuthToken } from '../api/config';

const MainLayout = () => {
  const location = useLocation();
  const navigate = useNavigate();
  const dispatch = useDispatch();
  const [isSidebarOpen, setIsSidebarOpen] = useState(false);
  const [showLogoutModal, setShowLogoutModal] = useState(false);
  const isActive = (path) => location.pathname === path;
  const { isLoggedIn, userInfo } = useSelector((state) => state.user);
  const displayName = userInfo.nickname || userInfo.username || '未登录';

  const handleLogout = () => {
    dispatch(logout());
    clearAuthToken();
    navigate('/login');
  };

  const navItems = [
    { path: '/', label: '仪表盘', icon: 'M3 12l2-2m0 0l7-7 7 7M5 10v10a1 1 0 001 1h3m10-11l2 2m-2-2v10a1 1 0 01-1 1h-3m-6 0a1 1 0 001-1v-4a1 1 0 011-1h2a1 1 0 011 1v4a1 1 0 001 1m-6 0h6' },
    { path: '/analysis', label: '数据解析', icon: 'M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z' },
    { path: '/resources', label: '资源库', icon: 'M12 6.253v13m0-13C10.832 5.477 9.246 5 7.5 5S4.168 5.477 3 6.253v13C4.168 18.477 5.754 18 7.5 18s3.332.477 4.5 1.253m0-13C13.168 5.477 14.754 5 16.5 5c1.747 0 3.332.477 4.5 1.253v13C19.832 18.477 18.247 18 16.5 18c-1.746 0-3.332.477-4.5 1.253' },
    { path: '/favorites', label: '我的收藏', icon: 'M4.318 6.318a4.5 4.5 0 000 6.364L12 20.364l7.682-7.682a4.5 4.5 0 00-6.364-6.364L12 7.636l-1.318-1.318a4.5 4.5 0 00-6.364 0z' },
    { path: '/mentor', label: 'AI助手', icon: 'M8 12h.01M12 12h.01M16 12h.01M21 12c0 4.418-4.03 8-9 8a9.863 9.863 0 01-4.255-.949L3 20l1.395-3.72C3.512 15.042 3 13.574 3 12c0-4.418 4.03-8 9-8s9 3.582 9 8z' }
  ];

  return (
    <div className="flex h-screen bg-gradient-to-br from-dark-50 via-white to-primary-50/20 overflow-hidden">
      <aside className="hidden md:flex w-72 bg-white/90 backdrop-blur-xl shadow-medium flex-col fixed md:relative z-20 h-full border-r border-dark-100/50">
        <div className="p-6 border-b border-dark-100/50">
          <div className="flex items-center gap-3">
            <div className="w-12 h-12 rounded-2xl bg-gradient-to-br from-primary-500 to-primary-600 flex items-center justify-center shadow-glow">
              <i className="iconfont icon-zhuomuniao text-2xl text-white"></i>
            </div>
            <div>
              <h1 className="text-xl font-bold bg-gradient-to-r from-dark-800 to-dark-600 bg-clip-text text-transparent">学业啄木鸟</h1>
              <p className="text-xs text-dark-400 mt-0.5">智能学习分析平台</p>
            </div>
          </div>
        </div>

        <nav className="flex-1 p-4 space-y-2 overflow-y-auto">
          {navItems.map((item) => (
            <Link 
              key={item.path}
              to={item.path} 
              className={`flex items-center gap-3 p-4 rounded-xl transition-all duration-300 group ${isActive(item.path) ? 'bg-gradient-to-r from-primary-500 to-primary-600 text-white shadow-glow' : 'hover:bg-dark-50 text-dark-600'}`}
            >
              <div className={`w-10 h-10 rounded-xl flex items-center justify-center transition-all duration-300 ${isActive(item.path) ? 'bg-white/20' : 'bg-dark-100 group-hover:bg-primary-100'}`}>
                <svg className={`w-5 h-5 ${isActive(item.path) ? 'text-white' : 'text-dark-500 group-hover:text-primary-600'}`} fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d={item.icon} />
                </svg>
              </div>
              <span className="font-medium">{item.label}</span>
            </Link>
          ))}
        </nav>

        <div className="p-4 border-t border-dark-100/50">
          <div 
            className="flex items-center gap-3 p-3 bg-gradient-to-r from-dark-50 to-dark-100/50 rounded-xl cursor-pointer hover:from-primary-50 hover:to-primary-100/50 transition-all duration-300"
            onClick={() => setShowLogoutModal(true)}
          >
            <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-primary-500 to-primary-600 flex items-center justify-center text-white font-bold shadow-sm cursor-pointer hover:shadow-lg transition-all duration-300 overflow-hidden">
              {userInfo.avatar ? (
                <img src={userInfo.avatar} alt="avatar" className="w-full h-full object-cover" />
              ) : (
                (userInfo.nickname || userInfo.username || 'U').charAt(0).toUpperCase()
              )}
            </div>
            <div className="flex-1">
              <p className="font-semibold text-dark-700 text-sm">{displayName}</p>
              <p className="text-xs text-dark-400">{isLoggedIn ? `ID: ${userInfo.username || '-'}` : '点击登录'}</p>
            </div>
          </div>
        </div>
      </aside>

      {isSidebarOpen && (
        <div className="fixed inset-0 bg-black/30 backdrop-blur-sm z-10 md:hidden animate-fade-in" onClick={() => setIsSidebarOpen(false)}></div>
      )}

      <aside className={`fixed top-0 left-0 h-full w-72 bg-white/95 backdrop-blur-xl shadow-xl z-20 transform transition-all duration-300 md:hidden ${isSidebarOpen ? 'translate-x-0' : '-translate-x-full'}`}>
        <div className="p-6 border-b border-dark-100/50">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              <div className="w-12 h-12 rounded-2xl bg-gradient-to-br from-primary-500 to-primary-600 flex items-center justify-center shadow-glow">
                <i className="iconfont icon-zhuomuniao text-2xl text-white"></i>
              </div>
              <div>
                <h1 className="text-xl font-bold text-dark-800">学业啄木鸟</h1>
                <p className="text-xs text-dark-400 mt-0.5">智能学习分析平台</p>
              </div>
            </div>
            <button onClick={() => setIsSidebarOpen(false)} className="w-10 h-10 rounded-xl hover:bg-dark-100 flex items-center justify-center transition-colors">
              <svg className="w-6 h-6 text-dark-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
              </svg>
            </button>
          </div>
        </div>

        <nav className="flex-1 p-4 space-y-2 overflow-y-auto">
          {navItems.map((item) => (
            <Link 
              key={item.path}
              to={item.path} 
              className={`flex items-center gap-3 p-4 rounded-xl transition-all duration-300 group ${isActive(item.path) ? 'bg-gradient-to-r from-primary-500 to-primary-600 text-white shadow-glow' : 'hover:bg-dark-50 text-dark-600'}`}
              onClick={() => setIsSidebarOpen(false)}
            >
              <div className={`w-10 h-10 rounded-xl flex items-center justify-center transition-all duration-300 ${isActive(item.path) ? 'bg-white/20' : 'bg-dark-100 group-hover:bg-primary-100'}`}>
                <svg className={`w-5 h-5 ${isActive(item.path) ? 'text-white' : 'text-dark-500 group-hover:text-primary-600'}`} fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d={item.icon} />
                </svg>
              </div>
              <span className="font-medium">{item.label}</span>
            </Link>
          ))}
        </nav>
      </aside>
      
      <div className="flex-1 flex flex-col overflow-hidden">
        <header className="bg-white/80 backdrop-blur-xl shadow-soft p-4 md:p-6 flex justify-between items-center relative z-10 border-b border-dark-100/50">
          <div className="flex items-center">
            <button className="md:hidden mr-4 w-10 h-10 rounded-xl hover:bg-dark-100 flex items-center justify-center transition-colors" onClick={() => setIsSidebarOpen(true)}>
              <svg className="w-6 h-6 text-dark-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 6h16M4 12h16M4 18h16" />
              </svg>
            </button>
            <div>
              <h2 className="text-xl md:text-2xl font-bold bg-gradient-to-r from-dark-800 to-dark-600 bg-clip-text text-transparent">{getPageTitle(location.pathname)}</h2>
              <p className="text-sm text-dark-400 mt-1 hidden md:block">{getPageDescription(location.pathname)}</p>
            </div>
          </div>
          <div className="flex items-center gap-3">
            <div 
              className="px-4 py-2 rounded-xl text-primary-700 font-bold text-xl cursor-pointer hover:bg-primary-50 transition-all duration-300"
              onClick={() => setShowLogoutModal(true)}
            >
              {displayName}
            </div>
            <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-primary-500 to-primary-600 flex items-center justify-center text-white font-bold shadow-sm overflow-hidden cursor-pointer hover:shadow-lg transition-all duration-300" onClick={() => setShowLogoutModal(true)}>
              {userInfo.avatar ? (
                <img src={userInfo.avatar} alt="avatar" className="w-full h-full object-cover" />
              ) : (
                (userInfo.nickname || userInfo.username || 'U').charAt(0).toUpperCase()
              )}
            </div>
          </div>
        </header>
        
        <main className="flex-1 overflow-y-auto p-4 md:p-8 bg-gradient-to-br from-dark-50/50 via-white/50 to-primary-50/30">
          <Outlet />
        </main>

        {showLogoutModal && (
          <div className="fixed inset-0 bg-black/50 backdrop-blur-sm z-50 flex items-center justify-center" onClick={() => setShowLogoutModal(false)}>
            <div className="bg-white rounded-2xl p-6 w-full max-w-sm shadow-xl animate-fade-in-up" onClick={(e) => e.stopPropagation()}>
              <div className="text-center">
                <div className="w-16 h-16 mx-auto mb-4 rounded-full bg-rose-100 flex items-center justify-center">
                  <svg className="w-8 h-8 text-rose-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17 16l4-4m0 0l-4-4m4 4H7m6 4v1a3 3 0 01-3 3H6a3 3 0 01-3-3V7a3 3 0 013-3h4a3 3 0 013 3v1" />
                  </svg>
                </div>
                <h3 className="text-xl font-bold text-dark-800 mb-2">确认退出登录</h3>
                <p className="text-dark-400 mb-6">确定要退出当前账号吗？</p>
                <div className="flex gap-3">
                  <button
                    className="flex-1 px-4 py-3 bg-dark-100 text-dark-700 rounded-xl font-semibold hover:bg-dark-200 transition-colors"
                    onClick={() => setShowLogoutModal(false)}
                  >
                    取消
                  </button>
                  <button
                    className="flex-1 px-4 py-3 bg-gradient-to-r from-rose-500 to-rose-600 text-white rounded-xl font-semibold hover:from-rose-600 hover:to-rose-700 transition-colors shadow-lg shadow-rose-500/30"
                    onClick={handleLogout}
                  >
                    确认退出
                  </button>
                </div>
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
};

const getPageTitle = (path) => {
  switch (path) {
    case '/': return '个人学情仪表盘';
    case '/analysis': return '多维数据上传与解析';
    case '/resources': return '个性化推送与资源库';
    case '/favorites': return '我的收藏';
    case '/mentor': return '智能交互对话';
    default: return '';
  }
};

const getPageDescription = (path) => {
  switch (path) {
    case '/': return '实时掌握学习进度，科学规划复习策略';
    case '/analysis': return '智能分析学业数据，精准定位薄弱环节';
    case '/resources': return 'AI推荐优质资源，因材施教提升效率';
    case '/favorites': return '管理您收藏的学习资源';
    case '/mentor': return '随时答疑解惑，全程陪伴学习成长';
    default: return '';
  }
};

export default MainLayout;

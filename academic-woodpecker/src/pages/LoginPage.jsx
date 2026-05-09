import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useDispatch } from 'react-redux';
import { authApi } from '../api';
import { loginSuccess, setUserInfo } from '../store/userSlice';
import '../LoginPage.scss';

const LoginPage = () => {
  const navigate = useNavigate();
  const dispatch = useDispatch();
  const [isLogin, setIsLogin] = useState(true);
  const [registerStep, setRegisterStep] = useState(1);
  const [isLoading, setIsLoading] = useState(false);
  const [formData, setFormData] = useState({
    username: '',
    nickname: '',
    password: '',
    confirmPassword: ''
  });
  const [errors, setErrors] = useState({});

  const handleChange = (e) => {
    const { name, value } = e.target;
    setFormData(prev => ({ ...prev, [name]: value }));
    if (errors[name]) {
      setErrors(prev => ({ ...prev, [name]: '' }));
    }
  };

  const validateLogin = () => {
    const newErrors = {};
    if (!formData.username.trim()) {
      newErrors.username = '请输入用户名';
    }
    if (!formData.password) {
      newErrors.password = '请输入密码';
    }
    setErrors(newErrors);
    return Object.keys(newErrors).length === 0;
  };

  const validateStep = (step) => {
    const newErrors = {};
    if (step === 1 && !formData.username.trim()) {
      newErrors.username = '请输入用户名';
    }
    if (step === 2 && !formData.nickname.trim()) {
      newErrors.nickname = '请输入昵称';
    }
    if (step === 3) {
      if (!formData.password) {
        newErrors.password = '请输入密码';
      } else if (formData.password.length < 6) {
        newErrors.password = '密码至少6个字符';
      }
    }
    if (step === 4 && formData.password !== formData.confirmPassword) {
      newErrors.confirmPassword = '两次密码不一致';
    }
    setErrors(newErrors);
    return Object.keys(newErrors).length === 0;
  };

  const handleNextStep = async () => {
    if (validateStep(registerStep)) {
      if (registerStep < 4) {
        setRegisterStep(prev => prev + 1);
      } else if (registerStep === 4) {
        setIsLoading(true);
        try {
          const response = await authApi.register({
            username: formData.username,
            password: formData.password,
            nickname: formData.nickname,
            email: formData.email || '',
            studentId: formData.studentId || ''
          });
          dispatch(loginSuccess({
            token: response.data?.token,
            user: response.data?.user,
            username: formData.username,
            nickname: formData.nickname
          }));
          const userResponse = await authApi.getCurrentUser();
          if (userResponse.data) {
            dispatch(setUserInfo(userResponse.data));
          }
          alert('注册成功！');
          navigate('/');
        } catch (error) {
          setErrors({ confirmPassword: error.message || '注册失败，请重试' });
        } finally {
          setIsLoading(false);
        }
      }
    }
  };

  const handlePrevStep = () => {
    if (registerStep > 1) {
      setRegisterStep(prev => prev - 1);
      setErrors({});
    }
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (isLogin) {
      if (validateLogin()) {
        setIsLoading(true);
        try {
          const response = await authApi.login(formData.username, formData.password);
          dispatch(loginSuccess({
            token: response.data?.token,
            user: response.data?.user,
            username: formData.username
          }));
          const userResponse = await authApi.getCurrentUser();
          if (userResponse.data) {
            dispatch(setUserInfo(userResponse.data));
          }
          alert('登录成功！');
          navigate('/');
        } catch (error) {
          setErrors({ password: error.message || '登录失败，请检查用户名和密码' });
        } finally {
          setIsLoading(false);
        }
      }
    } else {
      if (validateStep(registerStep) && registerStep === 4) {
        setIsLoading(true);
        try {
          const response = await authApi.register({
            username: formData.username,
            password: formData.password,
            nickname: formData.nickname,
          });
          dispatch(loginSuccess({
            token: response.data?.token,
            user: response.data?.user,
            username: formData.username,
            nickname: formData.nickname
          }));
          const userResponse = await authApi.getCurrentUser();
          if (userResponse.data) {
            dispatch(setUserInfo(userResponse.data));
          }
          alert('注册成功！');
          navigate('/');
        } catch (error) {
          setErrors({ confirmPassword: error.message || '注册失败，请重试' });
        } finally {
          setIsLoading(false);
        }
      } else if (registerStep < 4) {
        alert('请完成所有注册步骤');
      }
    }
  };

  const handleTabChange = (tab) => {
    setIsLogin(tab === 'login');
    if (tab === 'register') {
      setRegisterStep(1);
    }
    setErrors({});
    setFormData({ username: '', nickname: '', password: '', confirmPassword: '' });
  };

  const renderInputIcon = (iconPath) => (
    <div className="login-page-input-icon-wrapper">
      <svg className="login-page-input-icon" fill="none" stroke="currentColor" viewBox="0 0 24 24">
        {iconPath}
      </svg>
    </div>
  );

  const renderRegisterForm = () => {
    const steps = [
      { num: 1, label: '用户名' },
      { num: 2, label: '昵称' },
      { num: 3, label: '密码' },
      { num: 4, label: '确认' }
    ];

    const inputIcons = {
      1: <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M16 7a4 4 0 11-8 0 4 4 0 018 0zM12 14a7 7 0 00-7 7h14a7 7 0 00-7-7z" />,
      2: <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M14.828 14.828a4 4 0 01-5.656 0M9 10h.01M15 10h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />,
      3: <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 15v2m-6 4h12a2 2 0 002-2v-6a2 2 0 00-2-2H6a2 2 0 00-2 2v6a2 2 0 002 2zm10-10V7a4 4 0 00-8 0v4h8z" />,
      4: <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4m5.618-4.016A11.955 11.955 0 0112 2.944a11.955 11.955 0 01-8.618 3.04A12.02 12.02 0 003 9c0 5.591 3.824 10.29 9 11.623 5.176-1.332 9-6.03 9-11.622 0-1.042-.133-2.052-.382-3.016z" />
    };

    const placeholders = {
      1: '请输入用户名',
      2: '请输入昵称',
      3: '请输入密码（至少6位）',
      4: '请再次输入密码'
    };

    const fieldNames = { 1: 'username', 2: 'nickname', 3: 'password', 4: 'confirmPassword' };
    const fieldLabels = { 1: '用户名', 2: '昵称', 3: '密码', 4: '确认密码' };

    return (
      <div className="register-form-container">
        <div className="register-steps">
          {steps.map((step) => (
            <div
              key={step.num}
              className={`register-step ${registerStep >= step.num ? 'active' : ''} ${registerStep === step.num ? 'current' : ''}`}
            >
              <div className="register-step-circle">
                {registerStep > step.num ? (
                  <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={3} d="M5 13l4 4L19 7" />
                  </svg>
                ) : (
                  step.num
                )}
              </div>
              <span className="register-step-label">{step.label}</span>
            </div>
          ))}
          <div className="register-step-line">
            <div
              className="register-step-line-fill"
              style={{ width: `${((registerStep - 1) / 3) * 100}%` }}
            ></div>
          </div>
        </div>

        <form className="register-form" onSubmit={handleSubmit}>
          <div className="register-form-content">
            <div className="login-page-form-group">
              <label className="login-page-label">{fieldLabels[registerStep]}</label>
              <div className="login-page-input-wrapper">
                {renderInputIcon(inputIcons[registerStep])}
                <input
                  type={registerStep >= 3 ? 'password' : 'text'}
                  name={fieldNames[registerStep]}
                  className={`login-page-input ${errors[fieldNames[registerStep]] ? 'error' : ''}`}
                  placeholder={placeholders[registerStep]}
                  value={formData[fieldNames[registerStep]]}
                  onChange={handleChange}
                  autoFocus
                />
              </div>
              {errors[fieldNames[registerStep]] && <span className="login-page-error">{errors[fieldNames[registerStep]]}</span>}
            </div>
          </div>

          <div className="register-buttons">
            {registerStep > 1 && (
              <button type="button" className="register-btn-back" onClick={handlePrevStep}>
                上一步
              </button>
            )}
            <button type="button" className="register-btn-next" onClick={handleNextStep} disabled={isLoading}>
              {isLoading ? '处理中...' : (registerStep === 4 ? '完 成' : '下一步')}
            </button>
          </div>
        </form>
      </div>
    );
  };

  return (
    <div className="login-page">
      <div className="login-page-container">
        <div className="login-page-illustration">
          <div className="login-page-illustration-content">
            <div className="login-page-illustration-main">
              <div className="login-page-scene">
                <div className="login-page-scene-desk"></div>
                <div className="login-page-scene-laptop">
                  <div className="login-page-scene-screen"></div>
                  <div className="login-page-scene-keyboard"></div>
                </div>
                <div className="login-page-scene-book book-1"></div>
                <div className="login-page-scene-book book-2"></div>
                <div className="login-page-scene-plant"></div>
                <div className="login-page-scene-coffee"></div>
              </div>
              <div className="login-page-float-elements">
                <div className="login-page-float-element element-1">📚</div>
                <div className="login-page-float-element element-2">🎓</div>
                <div className="login-page-float-element element-3">✨</div>
                <div className="login-page-float-element element-4">💡</div>
                <div className="login-page-float-element element-5">📖</div>
              </div>
            </div>
            <div className="login-page-illustration-text">
              <h2>开启智能学习之旅</h2>
              <p>精准分析 · 个性推荐 · 高效提升</p>
            </div>
          </div>
        </div>

        <div className="login-page-form-section">
          <div className="login-page-form-card">
            <div className="login-page-logo">
              <div className="login-page-logo-icon">
                <i className="iconfont icon-zhuomuniao"></i>
              </div>
              <span>学业啄木鸟</span>
            </div>

            <div className="login-page-tabs">
              <button
                className={`login-page-tab ${isLogin ? 'active' : ''}`}
                onClick={() => handleTabChange('login')}
              >
                登录
              </button>
              <button
                className={`login-page-tab ${!isLogin ? 'active' : ''}`}
                onClick={() => handleTabChange('register')}
              >
                注册
              </button>
            </div>

            {isLogin ? (
              <form className="login-page-form login-form" onSubmit={handleSubmit}>
                <div className="login-page-form-group">
                  <label className="login-page-label">用户名</label>
                  <div className="login-page-input-wrapper">
                    {renderInputIcon(<path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M16 7a4 4 0 11-8 0 4 4 0 018 0zM12 14a7 7 0 00-7 7h14a7 7 0 00-7-7z" />)}
                    <input
                      type="text"
                      name="username"
                      className={`login-page-input ${errors.username ? 'error' : ''}`}
                      placeholder="请输入用户名"
                      value={formData.username}
                      onChange={handleChange}
                    />
                  </div>
                  {errors.username && <span className="login-page-error">{errors.username}</span>}
                </div>

                <div className="login-page-form-group">
                  <label className="login-page-label">密码</label>
                  <div className="login-page-input-wrapper">
                    {renderInputIcon(<path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 15v2m-6 4h12a2 2 0 002-2v-6a2 2 0 00-2-2H6a2 2 0 00-2 2v6a2 2 0 002 2zm10-10V7a4 4 0 00-8 0v4h8z" />)}
                    <input
                      type="password"
                      name="password"
                      className={`login-page-input ${errors.password ? 'error' : ''}`}
                      placeholder="请输入密码"
                      value={formData.password}
                      onChange={handleChange}
                    />
                  </div>
                  {errors.password && <span className="login-page-error">{errors.password}</span>}
                </div>

                <div className="login-page-options">
                  <label className="login-page-checkbox">
                    <input type="checkbox" />
                    <span className="login-page-checkbox-mark"></span>
                    <span>记住我</span>
                  </label>
                  <a href="#" className="login-page-link">忘记密码？</a>
                </div>

                <button type="submit" className="login-page-submit" disabled={isLoading}>
                  {isLoading ? '登录中...' : '登 录'}
                </button>
              </form>
            ) : (
              renderRegisterForm()
            )}

            <div className="login-page-footer">
              <span>{isLogin ? '还没有账号？' : '已有账号？'}</span>
              <button
                className="login-page-footer-link"
                onClick={() => handleTabChange(isLogin ? 'register' : 'login')}
              >
                {isLogin ? '立即注册' : '去登录'}
              </button>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};

export default LoginPage;

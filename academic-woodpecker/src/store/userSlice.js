import { createSlice } from '@reduxjs/toolkit';

const userSlice = createSlice({
  name: 'user',
  initialState: {
    isLoggedIn: false,
    token: null,
    userInfo: {
      id: null,
      username: '',
      nickname: '',
      email: '',
      avatar: '',
      role: 'student'
    }
  },
  reducers: {
    loginSuccess: (state, action) => {
      state.isLoggedIn = true;
      state.token = action.payload.token;
      state.userInfo = {
        ...state.userInfo,
        id: action.payload.user?.id || action.payload.id || null,
        username: action.payload.user?.username || action.payload.username || '',
        nickname: action.payload.user?.nickname || action.payload.nickname || '',
        email: action.payload.user?.email || '',
        avatar: action.payload.user?.avatar || '',
        role: action.payload.user?.role || 'student'
      };
    },
    setUserInfo: (state, action) => {
      state.userInfo = {
        ...state.userInfo,
        ...action.payload
      };
    },
    logout: (state) => {
      state.isLoggedIn = false;
      state.token = null;
      state.userInfo = {
        id: null,
        username: '',
        nickname: '',
        email: '',
        avatar: '',
        role: 'student'
      };
    },
    updateUserInfo: (state, action) => {
      state.userInfo = {
        ...state.userInfo,
        ...action.payload
      };
    }
  }
});

export const { loginSuccess, logout, updateUserInfo, setUserInfo } = userSlice.actions;
export default userSlice.reducer;

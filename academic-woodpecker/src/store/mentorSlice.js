import { createSlice } from '@reduxjs/toolkit';

const mentorSlice = createSlice({
  name: 'mentor',
  initialState: {
    messages: [
      {
        id: 1,
        role: 'assistant',
        content: '你好！我是你的AI学习助手。根据你最近的学情分析，我注意到你在"概率论"和"算法"方面需要加强。今天想聊些什么呢？',
        timestamp: new Date().toISOString(),
      }
    ],
    threadId: null,
    isTyping: false,
  },
  reducers: {
    addMessage: (state, action) => {
      state.messages.push({
        id: Date.now(),
        role: action.payload.role,
        content: action.payload.content,
        timestamp: new Date().toISOString(),
      });
    },
    setMessages: (state, action) => {
      state.messages = action.payload;
    },
    setThreadId: (state, action) => {
      state.threadId = action.payload;
    },
    setIsTyping: (state, action) => {
      state.isTyping = action.payload;
    },
    clearMessages: (state) => {
      state.messages = [
        {
          id: Date.now(),
          role: 'assistant',
          content: '你好！我是你的AI学习助手。今天想聊些什么呢？',
          timestamp: new Date().toISOString(),
        }
      ];
      state.threadId = null;
    },
  }
});

export const { addMessage, setMessages, setThreadId, setIsTyping, clearMessages } = mentorSlice.actions;
export default mentorSlice.reducer;
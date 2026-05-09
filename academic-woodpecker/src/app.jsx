import React from 'react'
import { BrowserRouter, Routes, Route } from 'react-router-dom'
import { Provider } from 'react-redux'
import { PersistGate } from 'redux-persist/integration/react'
import { store, persistor } from './store'
import MainLayout from './layouts/MainLayout'
import Dashboard from './pages/Dashboard'
import AnalysisPage from './pages/AnalysisPage'
import ResourceHub from './pages/ResourceHub'
import MyFavorites from './pages/MyFavorites'
import AIMentor from './pages/AIMentor'
import LoginPage from './pages/LoginPage'
import ProtectedRoute from './components/ProtectedRoute'

function App() {
  return (
    <Provider store={store}>
      <PersistGate loading={null} persistor={persistor}>
        <BrowserRouter>
          <Routes>
            <Route path="/login" element={<LoginPage />} />
            <Route path="/" element={
              <ProtectedRoute>
                <MainLayout />
              </ProtectedRoute>
            }>
              <Route index element={<Dashboard />} />
              <Route path="analysis" element={<AnalysisPage />} />
              <Route path="resources" element={<ResourceHub />} />
              <Route path="favorites" element={<MyFavorites />} />
              <Route path="mentor" element={<AIMentor />} />
            </Route>
          </Routes>
        </BrowserRouter>
      </PersistGate>
    </Provider>
  )
}

export default App

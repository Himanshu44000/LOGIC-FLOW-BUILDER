import { Navigate, Route, Routes } from 'react-router-dom'
import DashboardPage from './pages/DashboardPage'
import BuilderPage from './pages/BuilderPage'
import GuidePage from './pages/GuidePage'

export default function App() {
  return (
    <Routes>
      <Route path="/" element={<DashboardPage />} />
      <Route path="/guide" element={<GuidePage />} />
      <Route path="/builder/:flowId" element={<BuilderPage />} />
      <Route path="*" element={<Navigate to="/" replace />} />
    </Routes>
  )
}

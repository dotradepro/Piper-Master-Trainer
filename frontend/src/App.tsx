import { BrowserRouter, Routes, Route } from 'react-router-dom'
import { AppShell } from '@/components/layout/AppShell'
import { DashboardPage } from '@/pages/DashboardPage'
import { DownloadPage } from '@/pages/DownloadPage'
import { TranscriptionPage } from '@/pages/TranscriptionPage'
import { DatasetPage } from '@/pages/DatasetPage'
import { TrainingPage } from '@/pages/TrainingPage'
import { ExportPage } from '@/pages/ExportPage'
import { TestPage } from '@/pages/TestPage'

function App() {
  return (
    <BrowserRouter>
      <Routes>
        <Route element={<AppShell />}>
          <Route path="/" element={<DashboardPage />} />
          <Route path="/project/:projectId/download" element={<DownloadPage />} />
          <Route path="/project/:projectId/transcription" element={<TranscriptionPage />} />
          <Route path="/project/:projectId/dataset" element={<DatasetPage />} />
          <Route path="/project/:projectId/training" element={<TrainingPage />} />
          <Route path="/project/:projectId/export" element={<ExportPage />} />
          <Route path="/project/:projectId/test" element={<TestPage />} />
        </Route>
      </Routes>
    </BrowserRouter>
  )
}

export default App

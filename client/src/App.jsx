import React from 'react';
import { Routes, Route, Navigate } from 'react-router-dom';

import LandingPage from './pages/LandingPage';
import CreateInterviewPage from './pages/CreateInterviewPage';
import JoinInterviewPage from './pages/JoinInterviewPage';
import InterviewRoomPage from './pages/InterviewRoomPage';
import InterviewReportPage from './pages/InterviewReportPage';

export default function App() {
  return (
    <div className="min-h-screen bg-slate-950 text-slate-100 font-sans">
      <Routes>
        <Route path="/" element={<LandingPage />} />
        <Route path="/create" element={<CreateInterviewPage />} />
        <Route path="/join" element={<JoinInterviewPage />} />
        <Route path="/interview/:roomId" element={<InterviewRoomPage />} />
        <Route path="/report/:roomId" element={<InterviewReportPage />} />
        <Route path="*" element={<Navigate to="/" replace />} />
      </Routes>
    </div>
  );
}

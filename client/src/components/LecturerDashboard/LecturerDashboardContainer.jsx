import React from 'react';
import useLecturerDashboard from './useLecturerDashboard';
import LecturerDashboardView from './LecturerDashboardView';

export default function LecturerDashboardContainer() {
  const { sessions, isLoading } = useLecturerDashboard();
  return <LecturerDashboardView sessions={sessions} isLoading={isLoading} />;
}

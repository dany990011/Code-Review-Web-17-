import useLecturerDashboard from './useLecturerDashboard';
import LecturerDashboardView from './LecturerDashboardView';

// Container: connects the useLecturerDashboard hook to the presentational view.
export default function LecturerDashboardContainer() {
  const { sessions, isLoading, deleteProject, inviteLecturer } = useLecturerDashboard();
  return <LecturerDashboardView sessions={sessions} isLoading={isLoading} deleteProject={deleteProject} inviteLecturer={inviteLecturer} />;
}

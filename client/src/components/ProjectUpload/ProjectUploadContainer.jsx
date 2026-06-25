import useProjectUpload from './useProjectUpload';
import ProjectUploadView from './ProjectUploadView';

// Container: connects the useProjectUpload hook to the presentational view.
export default function ProjectUploadContainer() {
  const logic = useProjectUpload();
  return <ProjectUploadView {...logic} />;
}

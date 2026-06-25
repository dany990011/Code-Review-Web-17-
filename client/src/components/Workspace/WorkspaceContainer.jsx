import useWorkspace from './useWorkspace';
import WorkspaceView from './WorkspaceView';

// Container: connects the composed useWorkspace hook to the presentational view.
export default function WorkspaceContainer() {
  const logic = useWorkspace();
  return <WorkspaceView {...logic} />;
}

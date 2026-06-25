import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { api } from '../../services/api';

/**
 * State + submit logic for the project upload form. On success, navigates
 * straight into the new project's workspace.
 */
export default function useProjectUpload() {
  const [githubUrl, setGithubUrl] = useState('');
  const [requirementsDoc, setRequirementsDoc] = useState(null);
  const [isLoading, setIsLoading] = useState(false);
  const navigate = useNavigate();

  const handleUrlChange = (e) => setGithubUrl(e.target.value);
  const handleFileChange = (e) => {
    if (e.target.files && e.target.files[0]) {
      setRequirementsDoc(e.target.files[0]);
    }
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!githubUrl || !requirementsDoc) return;
    
    setIsLoading(true);
    try {
      // Multipart body: the GitHub URL + the requirements file.
      const formData = new FormData();
      formData.append('githubUrl', githubUrl);
      formData.append('requirementsDoc', requirementsDoc);

      const data = await api.uploadProject(formData);
      navigate(`/workspace/${data.projectId}`);
    } catch (error) {
      console.error('Error uploading project:', error);
      alert('Upload failed. Is the server running?');
    } finally {
      setIsLoading(false);
    }
  };

  return {
    githubUrl,
    requirementsDoc,
    isLoading,
    handleUrlChange,
    handleFileChange,
    handleSubmit
  };
}

import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { useUser, useAuth } from '@clerk/clerk-react';

export default function useLogin() {
  const [role, setRole] = useState('student');
  const navigate = useNavigate();
  const { isSignedIn } = useUser();

  useEffect(() => {
    if (isSignedIn) {
      navigate('/dashboard');
    }
  }, [isSignedIn, navigate]);

  const handleRoleChange = (newRole) => {
    setRole(newRole);
  };

  const handleLogin = (e) => {
    e.preventDefault();
    if (role === 'lecturer') {
      // LoginView handles rendering Clerk SignIn
    } else {
      navigate('/upload');
    }
  };

  return {
    role,
    handleRoleChange,
    handleLogin
  };
}

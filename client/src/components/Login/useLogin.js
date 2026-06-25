import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { useUser } from '@clerk/clerk-react';

/**
 * Login screen logic. Two roles:
 *  - student : no auth — "Continue" just routes to the upload page.
 *  - lecturer: authenticates via Clerk's <SignIn> (rendered by the view).
 * Once Clerk reports a signed-in user, we redirect to the dashboard.
 */
export default function useLogin() {
  const [role, setRole] = useState('student');
  const navigate = useNavigate();
  const { isSignedIn } = useUser();

  // A successful Clerk sign-in (lecturer) lands on the dashboard.
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
      // No-op: the view renders Clerk's <SignIn>, and the effect above handles
      // the post-sign-in redirect.
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

import useLogin from './useLogin';
import LoginView from './LoginView';

// Container: owns no markup — wires the useLogin hook's state/handlers into the
// presentational LoginView. (Container/View/Hook pattern used across the app.)
export default function LoginContainer() {
  const loginLogic = useLogin();
  return <LoginView {...loginLogic} />;
}

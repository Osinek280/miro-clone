import { Outlet } from "react-router-dom";
import { useAuthStatus } from "../../features/auth/hooks/useAuthStatus";

export const AppLayout = () => {
  useAuthStatus();
  return <Outlet />;
};

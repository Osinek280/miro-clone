import { createBrowserRouter } from "react-router-dom";
import { PublicRoute } from "./PublicRoute";
import { ProtectedRoute } from "./ProtectedRoute";
import { AppLayout } from "../layouts/AppLayout";
import { LoginForm } from "../../features/auth/components/LoginForm";
import { RegisterForm } from "../../features/auth/components/RegisterForm";
import { HomePage } from "../../pages/HomePage";
import { DashboardPage } from "../../pages/DashboardPage";

export const router = createBrowserRouter([
  {
    element: <AppLayout />,
    children: [
      {
        element: <PublicRoute />,
        children: [
          {
            path: "/login",
            element: <LoginForm />,
          },
          {
            path: "/register",
            element: <RegisterForm />,
          },
        ],
      },
      {
        element: <ProtectedRoute />,
        children: [
          {
            children: [
              {
                path: "/dashboard",
                element: <DashboardPage />,
              },
            ],
          },
        ],
      },
      {
        path: "*",
        element: <HomePage />,
      },
    ],
  },
]);

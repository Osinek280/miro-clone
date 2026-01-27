import { createBrowserRouter } from "react-router-dom";
import { PublicRoute } from "./PublicRoute";
import { ProtectedRoute } from "./ProtectedRoute";
import { AppLayout } from "../layouts/AppLayout";

export const router = createBrowserRouter([
  {
    element: <AppLayout />,
    children: [
      {
        element: <PublicRoute />,
        children: [
          {
            path: "/login",
            element: <h1>Login Page</h1>,
          },
          {
            path: "/register",
            element: <h1>Register Page</h1>,
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
                element: <h1>Dashboard Page</h1>,
              },
            ],
          },
        ],
      },
      {
        path: "*",
        element: (
          <>
            <ProtectedRoute /> <PublicRoute />
          </>
        ),
      },
    ],
  },
]);

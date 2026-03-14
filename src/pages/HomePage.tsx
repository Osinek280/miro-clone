import { Link } from 'react-router-dom';
import { useAuthStore } from '../features/auth/store/auth.store';

export const HomePage = () => {
  const isAuthenticated = useAuthStore((state) => state.isAuthenticated);

  return (
    <div className="flex flex-col items-center justify-center min-h-screen from-blue-50 to-white p-4">
      <div className="max-w-2xl text-center space-y-8">
        <h1 className="text-5xl font-bold text-gray-900">Welcome to our app</h1>
        <p className="text-xl text-gray-600">
          Manage your tasks effectively and simply
        </p>

        <div className="flex gap-4 justify-center mt-8">
          {isAuthenticated ? (
            <Link
              to="/dashboard"
              className="px-8 py-3 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors text-lg font-semibold"
            >
              Go to Dashboard
            </Link>
          ) : (
            <>
              <Link
                to="/login"
                className="px-8 py-3 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors text-lg font-semibold"
              >
                Log in
              </Link>
              <Link
                to="/register"
                className="px-8 py-3 bg-white text-blue-600 border-2 border-blue-600 rounded-lg hover:bg-blue-50 transition-colors text-lg font-semibold"
              >
                Sign up
              </Link>
            </>
          )}
        </div>
      </div>
    </div>
  );
};

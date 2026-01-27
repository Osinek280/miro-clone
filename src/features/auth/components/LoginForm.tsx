/* eslint-disable @typescript-eslint/no-explicit-any */
import { useState } from "react";
import { useLogin } from "../hooks/useLogin";
import { useNavigate } from "react-router-dom";

export const LoginForm = () => {
  const { login } = useLogin();
  const navigate = useNavigate();

  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    setIsLoading(true);

    try {
      await login(email, password);
      navigate("/dashboard", { replace: true });
    } catch (err: any) {
      setError(
        err?.response?.data?.message ??
          "Nie udało się zalogować. Spróbuj ponownie.",
      );
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <form
      onSubmit={handleSubmit}
      className="mx-auto mt-24 w-full max-w-md rounded-2xl bg-white p-8 shadow-lg"
    >
      <h2 className="mb-6 text-center text-2xl font-semibold text-gray-800">
        Zaloguj się
      </h2>

      {error && (
        <p className="mb-4 rounded-lg bg-red-100 px-4 py-2 text-sm text-red-700">
          {error}
        </p>
      )}

      <div className="mb-4">
        <label className="mb-1 block text-sm font-medium text-gray-700">
          Email
        </label>
        <input
          // type="email"
          value={email}
          onChange={(e) => setEmail(e.target.value)}
          required
          autoComplete="email"
          className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm focus:border-blue-500 focus:outline-none focus:ring-2 focus:ring-blue-200"
        />
      </div>

      <div className="mb-6">
        <label className="mb-1 block text-sm font-medium text-gray-700">
          Hasło
        </label>
        <input
          type="password"
          value={password}
          onChange={(e) => setPassword(e.target.value)}
          required
          autoComplete="current-password"
          className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm focus:border-blue-500 focus:outline-none focus:ring-2 focus:ring-blue-200"
        />
      </div>

      <button
        type="submit"
        disabled={isLoading}
        className="w-full rounded-lg bg-blue-600 py-2 text-sm font-medium text-white transition hover:bg-blue-700 disabled:cursor-not-allowed disabled:opacity-60"
      >
        {isLoading ? "Logowanie..." : "Zaloguj się"}
      </button>
    </form>
  );
};

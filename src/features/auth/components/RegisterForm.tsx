/* eslint-disable @typescript-eslint/no-explicit-any */
import { useState } from "react";
import { useNavigate, Link } from "react-router-dom";
import { useRegister } from "../hooks/useRegister";

export const RegisterForm = () => {
  const { register } = useRegister();
  const navigate = useNavigate();

  const [formData, setFormData] = useState({
    firstname: "",
    lastname: "",
    email: "",
    password: "",
    confirmPassword: "",
  });

  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [passwordError, setPasswordError] = useState<string | null>(null);

  const handleChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const { name, value } = e.target;
    setFormData((prev) => ({
      ...prev,
      [name]: value,
    }));

    // Clear password match error when user starts typing
    if ((name === "password" || name === "confirmPassword") && passwordError) {
      setPasswordError(null);
    }
  };

  const validateForm = (): boolean => {
    // Check if passwords match
    if (formData.password !== formData.confirmPassword) {
      setPasswordError("Hasła nie są identyczne");
      return false;
    }

    // Check password strength (optional)
    if (formData.password.length < 6) {
      setPasswordError("Hasło musi mieć co najmniej 6 znaków");
      return false;
    }

    return true;
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    setPasswordError(null);

    if (!validateForm()) {
      return;
    }

    setIsLoading(true);

    try {
      // Extract only the fields needed for backend
      const { firstname, lastname, email, password } = formData;
      await register(firstname, lastname, email, password);

      // Redirect to login or dashboard after successful registration
      navigate("/login", {
        replace: true,
        state: {
          message:
            "Rejestracja zakończona sukcesem. Możesz się teraz zalogować.",
        },
      });
    } catch (err: any) {
      setError(
        err?.response?.data?.message ??
          "Nie udało się zarejestrować. Spróbuj ponownie.",
      );
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <form
      onSubmit={handleSubmit}
      className="mx-auto mt-16 w-full max-w-md rounded-2xl bg-white p-8 shadow-lg"
    >
      <h2 className="mb-6 text-center text-2xl font-semibold text-gray-800">
        Zarejestruj się
      </h2>

      {error && (
        <p className="mb-4 rounded-lg bg-red-100 px-4 py-2 text-sm text-red-700">
          {error}
        </p>
      )}

      <div className="mb-4 grid grid-cols-2 gap-4">
        <div>
          <label className="mb-1 block text-sm font-medium text-gray-700">
            Imię *
          </label>
          <input
            type="text"
            name="firstname"
            value={formData.firstname}
            onChange={handleChange}
            required
            autoComplete="given-name"
            className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm focus:border-blue-500 focus:outline-none focus:ring-2 focus:ring-blue-200"
          />
        </div>

        <div>
          <label className="mb-1 block text-sm font-medium text-gray-700">
            Nazwisko *
          </label>
          <input
            type="text"
            name="lastname"
            value={formData.lastname}
            onChange={handleChange}
            required
            autoComplete="family-name"
            className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm focus:border-blue-500 focus:outline-none focus:ring-2 focus:ring-blue-200"
          />
        </div>
      </div>

      <div className="mb-4">
        <label className="mb-1 block text-sm font-medium text-gray-700">
          Email *
        </label>
        <input
          type="email"
          name="email"
          value={formData.email}
          onChange={handleChange}
          required
          autoComplete="email"
          className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm focus:border-blue-500 focus:outline-none focus:ring-2 focus:ring-blue-200"
        />
      </div>

      <div className="mb-4">
        <label className="mb-1 block text-sm font-medium text-gray-700">
          Hasło *
        </label>
        <input
          type="password"
          name="password"
          value={formData.password}
          onChange={handleChange}
          required
          autoComplete="new-password"
          className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm focus:border-blue-500 focus:outline-none focus:ring-2 focus:ring-blue-200"
        />
      </div>

      <div className="mb-6">
        <label className="mb-1 block text-sm font-medium text-gray-700">
          Potwierdź hasło *
        </label>
        <input
          type="password"
          name="confirmPassword"
          value={formData.confirmPassword}
          onChange={handleChange}
          required
          autoComplete="new-password"
          className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm focus:border-blue-500 focus:outline-none focus:ring-2 focus:ring-blue-200"
        />
        {passwordError && (
          <p className="mt-1 text-sm text-red-600">{passwordError}</p>
        )}
      </div>

      <button
        type="submit"
        disabled={isLoading}
        className="mb-4 w-full rounded-lg bg-blue-600 py-2 text-sm font-medium text-white transition hover:bg-blue-700 disabled:cursor-not-allowed disabled:opacity-60"
      >
        {isLoading ? "Rejestrowanie..." : "Zarejestruj się"}
      </button>

      <p className="text-center text-sm text-gray-600">
        Masz już konto?{" "}
        <Link
          to="/login"
          className="font-medium text-blue-600 hover:text-blue-500"
        >
          Zaloguj się
        </Link>
      </p>
    </form>
  );
};

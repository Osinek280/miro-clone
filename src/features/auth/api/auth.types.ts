export type LoginRequest = {
  email: string;
  password: string;
};

export type RegisterRequest = {
  firstname: string;
  lastname: string;
  email: string;
  password: string;
};

export type LoginResponse = {
  accessToken: string;
};

export type RegisterResponse = {
  accessToken: string;
};

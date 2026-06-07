export type LoginRequest = {
  email: string;
  password: string;
};

export type RegisterRequest = {
  name: string;
  email: string;
  password: string;
};

export type LoginResponse = {
  accessToken: string;
};

export type RegisterResponse = {
  accessToken: string;
};

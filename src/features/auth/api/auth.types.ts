export type LoginRequest = {
  email: string;
  password: string;
};

export type RegisterRequest = {
  name: string;
  email: string;
  password: string;
};

export type UserDto = {
  id: string;
  email: string;
  name: string;
  profileUrl: string | null;
};

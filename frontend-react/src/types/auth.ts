export interface AuthUser {
  id: string;
  userName: string;
  email: string;
}

export interface AuthResponse {
  token: string;
  user: AuthUser;
}

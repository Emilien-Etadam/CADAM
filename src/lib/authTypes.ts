export interface LocalUser {
  id: string;
  email: string;
}

export interface LocalSession {
  user: LocalUser;
}

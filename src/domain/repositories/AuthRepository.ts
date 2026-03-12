import type { ID } from '../types/common';

export interface AuthSession {
  userId: ID;
}

export interface AuthRepository {
  getCurrentSession(): Promise<AuthSession | null>;
  saveSession(session: AuthSession): Promise<void>;
  clearSession(): Promise<void>;
}

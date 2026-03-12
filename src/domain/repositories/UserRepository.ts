import type { User } from '../entities/User';
import type { ID } from '../types/common';

export interface UserRepository {
  getById(id: ID): Promise<User | null>;
  getByEmail(email: string): Promise<User | null>;
  listAll(): Promise<User[]>;
  save(user: User): Promise<void>;
}

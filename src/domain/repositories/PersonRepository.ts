import type { Person } from '../entities/Person';
import type { ID } from '../types/common';

export interface PersonRepository {
  getById(id: ID): Promise<Person | null>;
  getByUserId(userId: ID): Promise<Person | null>;
  save(person: Person): Promise<void>;
}

import type { Person } from '../../../domain/entities/Person';
import type { PersonRepository } from '../../../domain/repositories/PersonRepository';
import type { ID } from '../../../domain/types/common';
import type { StorageDriver } from '../../storage/local-storage/driver';
import { STORAGE_KEYS } from '../../storage/local-storage/keys';

export class LocalStoragePersonRepository implements PersonRepository {
  constructor(private readonly storage: StorageDriver) {}

  async getById(id: ID): Promise<Person | null> {
    return this.readAll().find((person) => person.id === id) ?? null;
  }

  async getByUserId(userId: ID): Promise<Person | null> {
    return this.readAll().find((person) => person.userId === userId) ?? null;
  }

  async save(person: Person): Promise<void> {
    const people = this.readAll();
    const index = people.findIndex((current) => current.id === person.id);

    if (index >= 0) {
      people[index] = person;
    } else {
      people.push(person);
    }

    this.storage.setItem<Person[]>(STORAGE_KEYS.people, people);
  }

  private readAll(): Person[] {
    return this.storage.getItem<Person[]>(STORAGE_KEYS.people) ?? [];
  }
}

import type { Person } from '../../domain/entities/Person';
import type { PersonRepository } from '../../domain/repositories/PersonRepository';
import type { CompleteWelcomeProfileInputDTO } from '../dto/WelcomeSetupDTO';

export class CompleteWelcomeProfileUseCase {
  constructor(private readonly personRepository: PersonRepository) {}

  async execute(input: CompleteWelcomeProfileInputDTO): Promise<Person> {
    const name = input.name.trim();
    const phone = input.phone?.trim() || undefined;

    if (!name) {
      throw new Error('Nome e obrigatorio.');
    }

    const existingPerson = await this.personRepository.getByUserId(input.userId);

    const person: Person = {
      id: existingPerson?.id ?? crypto.randomUUID(),
      userId: input.userId,
      name,
      personType: input.personType,
      phone,
      createdAt: existingPerson?.createdAt ?? new Date().toISOString(),
    };

    await this.personRepository.save(person);
    return person;
  }
}

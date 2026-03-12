import type { PersonRepository } from '../../domain/repositories/PersonRepository';
import type { ControlCenterRepository } from '../../domain/repositories/ControlCenterRepository';
import type { ID } from '../../domain/types/common';
import type { WelcomeSetupDTO } from '../dto/WelcomeSetupDTO';

export class GetWelcomeSetupUseCase {
  constructor(
    private readonly personRepository: PersonRepository,
    private readonly controlCenterRepository: ControlCenterRepository,
  ) {}

  async execute(userId: ID): Promise<WelcomeSetupDTO> {
    const [person, centers] = await Promise.all([
      this.personRepository.getByUserId(userId),
      this.controlCenterRepository.listByUser(userId),
    ]);

    const controlCenter = centers.find((center) => center.ownerUserId === userId) ?? null;

    return {
      person,
      controlCenter,
    };
  }
}

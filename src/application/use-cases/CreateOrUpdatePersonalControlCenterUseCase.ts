import type { ControlCenter } from '../../domain/entities/ControlCenter';
import type { ControlCenterMembershipRepository } from '../../domain/repositories/ControlCenterMembershipRepository';
import type { ControlCenterRepository } from '../../domain/repositories/ControlCenterRepository';
import type { CreateOrUpdatePersonalControlCenterInputDTO } from '../dto/WelcomeSetupDTO';

export class CreateOrUpdatePersonalControlCenterUseCase {
  constructor(
    private readonly controlCenterRepository: ControlCenterRepository,
    private readonly membershipRepository: ControlCenterMembershipRepository,
  ) {}

  async execute(input: CreateOrUpdatePersonalControlCenterInputDTO): Promise<ControlCenter> {
    const name = input.name.trim();

    if (!name) {
      throw new Error('Nome do centro de controle e obrigatorio.');
    }

    const centers = await this.controlCenterRepository.listByUser(input.userId);
    const existingCenter = centers.find((center) => center.ownerUserId === input.userId) ?? null;

    const center: ControlCenter = {
      id: existingCenter?.id ?? crypto.randomUUID(),
      ownerUserId: input.userId,
      personId: input.personId,
      name,
      currency: existingCenter?.currency ?? 'BRL',
      createdAt: existingCenter?.createdAt ?? new Date().toISOString(),
    };

    await this.controlCenterRepository.save(center);

    if (!existingCenter) {
      await this.membershipRepository.save({
        userId: input.userId,
        controlCenterId: center.id,
        role: 'owner',
      });
    }

    return center;
  }
}

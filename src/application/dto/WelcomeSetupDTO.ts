import type { Person, PersonType } from '../../domain/entities/Person';
import type { ControlCenter } from '../../domain/entities/ControlCenter';
import type { ID } from '../../domain/types/common';

export interface CompleteWelcomeProfileInputDTO {
  userId: ID;
  name: string;
  personType: PersonType;
  phone?: string;
}

export interface CreateOrUpdatePersonalControlCenterInputDTO {
  userId: ID;
  personId: ID;
  name: string;
}

export interface WelcomeSetupDTO {
  person: Person | null;
  controlCenter: ControlCenter | null;
}

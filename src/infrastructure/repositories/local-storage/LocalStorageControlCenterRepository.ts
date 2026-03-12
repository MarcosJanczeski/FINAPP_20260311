import type { ControlCenter } from '../../../domain/entities/ControlCenter';
import type { ControlCenterMembership } from '../../../domain/entities/ControlCenterMembership';
import type { ControlCenterMembershipRepository } from '../../../domain/repositories/ControlCenterMembershipRepository';
import type { ControlCenterRepository } from '../../../domain/repositories/ControlCenterRepository';
import type { ID } from '../../../domain/types/common';
import type { StorageDriver } from '../../storage/local-storage/driver';
import { STORAGE_KEYS } from '../../storage/local-storage/keys';

export class LocalStorageControlCenterRepository implements ControlCenterRepository {
  constructor(
    private readonly storage: StorageDriver,
    private readonly membershipRepository: ControlCenterMembershipRepository,
  ) {}

  async getById(id: ID): Promise<ControlCenter | null> {
    const centers = this.readAll();
    return centers.find((center) => center.id === id) ?? null;
  }

  async listByUser(userId: ID): Promise<ControlCenter[]> {
    const memberships = await this.membershipRepository.listByUser(userId);
    if (!memberships.length) {
      return [];
    }

    const allowedIds = new Set(memberships.map((membership) => membership.controlCenterId));
    return this.readAll().filter((center) => allowedIds.has(center.id));
  }

  async save(center: ControlCenter): Promise<void> {
    const centers = this.readAll();
    const index = centers.findIndex((current) => current.id === center.id);

    if (index >= 0) {
      centers[index] = center;
    } else {
      centers.push(center);
    }

    this.storage.setItem<ControlCenter[]>(STORAGE_KEYS.controlCenters, centers);
  }

  async delete(id: ID): Promise<void> {
    const centers = this.readAll().filter((center) => center.id !== id);
    this.storage.setItem<ControlCenter[]>(STORAGE_KEYS.controlCenters, centers);
  }

  private readAll(): ControlCenter[] {
    return this.storage.getItem<ControlCenter[]>(STORAGE_KEYS.controlCenters) ?? [];
  }
}

export class LocalStorageControlCenterMembershipRepository implements ControlCenterMembershipRepository {
  constructor(private readonly storage: StorageDriver) {}

  async listByUser(userId: ID): Promise<ControlCenterMembership[]> {
    return this.readAll().filter((membership) => membership.userId === userId);
  }

  async listByControlCenter(controlCenterId: ID): Promise<ControlCenterMembership[]> {
    return this.readAll().filter((membership) => membership.controlCenterId === controlCenterId);
  }

  async save(membership: ControlCenterMembership): Promise<void> {
    const memberships = this.readAll();
    const index = memberships.findIndex(
      (current) =>
        current.userId === membership.userId &&
        current.controlCenterId === membership.controlCenterId,
    );

    if (index >= 0) {
      memberships[index] = membership;
    } else {
      memberships.push(membership);
    }

    this.storage.setItem<ControlCenterMembership[]>(
      STORAGE_KEYS.controlCenterMemberships,
      memberships,
    );
  }

  private readAll(): ControlCenterMembership[] {
    return (
      this.storage.getItem<ControlCenterMembership[]>(STORAGE_KEYS.controlCenterMemberships) ?? []
    );
  }
}

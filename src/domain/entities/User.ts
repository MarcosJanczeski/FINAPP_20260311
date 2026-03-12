import type { ID, ISODateString } from '../types/common';

export interface User {
  id: ID;
  email: string;
  password: string;
  createdAt: ISODateString;
  updatedAt: ISODateString;
}

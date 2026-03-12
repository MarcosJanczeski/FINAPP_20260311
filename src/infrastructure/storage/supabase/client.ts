export interface SupabaseClientPlaceholder {
  readonly status: 'not-configured';
}

export function createSupabaseClientPlaceholder(): SupabaseClientPlaceholder {
  return { status: 'not-configured' };
}

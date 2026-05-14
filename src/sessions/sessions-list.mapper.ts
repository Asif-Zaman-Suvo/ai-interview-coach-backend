import { asDate } from '../common/as-date';
import type { RoleDocument } from '../roles/role.schema';
import type { SessionDocument } from './session.schema';

/** Map role _id hex → display name */
export function buildRoleNameMap(roles: RoleDocument[]): Map<string, string> {
  const m = new Map<string, string>();
  for (const r of roles) {
    const label = r.name?.trim() || '';
    m.set(String(r._id), label || 'Unknown');
  }
  return m;
}

/** Unique non-empty session.roleId strings */
export function uniqueRoleIdsFromSessions(sessions: SessionDocument[]): string[] {
  const ids = new Set<string>();
  for (const s of sessions) {
    const rid = String(s.roleId ?? '').trim();
    if (rid) ids.add(rid);
  }
  return [...ids];
}

export function summarizeSessionForListRow(
  session: SessionDocument,
  roleNames: Map<string, string>,
): {
  id: string;
  role: string;
  date: string;
  duration: number;
  score: number;
  status: 'completed' | 'in_progress';
  difficulty: string;
} {
  const createdAt = asDate(session.createdAt as unknown);
  const endsAt =
    session.status === 'completed' && session.updatedAt != null
      ? asDate(session.updatedAt as unknown).getTime()
      : Date.now();
  const durationMinutes = Math.max(
    0,
    Math.floor((endsAt - createdAt.getTime()) / (1000 * 60)),
  );
  const rid = String(session.roleId ?? '').trim();
  let roleLabel = rid ? roleNames.get(rid) : undefined;
  if (!roleLabel?.trim()) {
    roleLabel = 'Unknown';
  }

  return {
    id: String(session._id),
    role: roleLabel,
    date: createdAt.toISOString(),
    duration: durationMinutes,
    score: session.score,
    status: session.status === 'completed' ? 'completed' : 'in_progress',
    difficulty: session.difficulty,
  };
}

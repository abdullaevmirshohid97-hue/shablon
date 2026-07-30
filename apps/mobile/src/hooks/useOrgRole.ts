import { useEffect, useState } from 'react';
import { loadOrgRole, type OrgRoleInfo } from '../lib/data/orgRole';

const UNKNOWN: OrgRoleInfo = { role: null, canWrite: false, fromCache: true };

/**
 * Read-only until proven otherwise: `canWrite` starts false and only flips
 * once the role actually resolves, so the entry button never flashes into
 * existence for a manager while the query is in flight.
 */
export function useOrgRole(): OrgRoleInfo & { isLoading: boolean } {
  const [info, setInfo] = useState<OrgRoleInfo>(UNKNOWN);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    let cancelled = false;

    void loadOrgRole().then((next) => {
      if (cancelled) return;
      setInfo(next);
      setIsLoading(false);
    });

    return () => {
      cancelled = true;
    };
  }, []);

  return { ...info, isLoading };
}

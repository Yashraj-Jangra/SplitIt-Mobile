import { GroupListItem } from '../services/group.service';

export type GroupSortOption =
  | 'last_usage'
  | 'name_asc'
  | 'name_desc'
  | 'owed_desc'
  | 'owed_asc'
  | 'owes_desc'
  | 'owes_asc';

/**
 * Standard group sorting utility shared across Groups and Home dashboard screens.
 * Implements identical sorting rules:
 * - 'last_usage': Most recently active / updated / created first
 * - 'name_asc': Alphabetical A-Z
 * - 'name_desc': Reverse alphabetical Z-A
 * - 'owed_desc': Circles where user is owed the most first
 * - 'owed_asc': Circles where user is owed the least first
 * - 'owes_desc': Circles where user owes the most first
 * - 'owes_asc': Circles where user owes the least first
 */
export function sortGroups(
  groups: GroupListItem[],
  sortBy: GroupSortOption = 'last_usage'
): GroupListItem[] {
  return [...groups].sort((a, b) => {
    switch (sortBy) {
      case 'name_asc':
        return a.name.localeCompare(b.name, undefined, { sensitivity: 'base' });
      case 'name_desc':
        return b.name.localeCompare(a.name, undefined, { sensitivity: 'base' });
      case 'owed_desc':
        return (b.userNetBalance || 0) - (a.userNetBalance || 0);
      case 'owed_asc':
        return (a.userNetBalance || 0) - (b.userNetBalance || 0);
      case 'owes_desc':
        return (a.userNetBalance || 0) - (b.userNetBalance || 0);
      case 'owes_asc':
        return (b.userNetBalance || 0) - (a.userNetBalance || 0);
      case 'last_usage':
      default: {
        const timeA = a.updatedAt
          ? new Date(a.updatedAt).getTime()
          : a.createdAt
          ? new Date(a.createdAt).getTime()
          : 0;
        const timeB = b.updatedAt
          ? new Date(b.updatedAt).getTime()
          : b.createdAt
          ? new Date(b.createdAt).getTime()
          : 0;
        if (timeA !== timeB) {
          return timeB - timeA;
        }
        return a.name.localeCompare(b.name);
      }
    }
  });
}

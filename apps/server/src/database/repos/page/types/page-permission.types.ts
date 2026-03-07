export type PagePermissionMember =
  | {
      id: string;
      name: string;
      email: string;
      avatarUrl: string;
      type: 'user';
      role: string;
      createdAt: Date;
    }
  | {
      id: string;
      name: string;
      memberCount: number;
      isDefault: boolean;
      type: 'group';
      role: string;
      createdAt: Date;
    };

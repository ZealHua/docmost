export enum PagePermissionRole {
  READER = "reader",
  WRITER = "writer",
}

export type IAddPagePermission = {
  pageId: string;
  role: PagePermissionRole;
  userId?: string;
  groupId?: string;
};

export type IRemovePagePermission = {
  pageId: string;
  userId?: string;
  groupId?: string;
};

export type IUpdatePagePermissionRole = {
  pageId: string;
  role: PagePermissionRole;
  userId?: string;
  groupId?: string;
};

export type IPageRestrictionInfo = {
  hasDirectRestriction: boolean;
  hasInheritedRestriction: boolean;
  hasAnyRestriction: boolean;
  canAccess: boolean;
  canEdit: boolean;
  inheritedFrom?: {
    slugId: string;
    title: string;
  };
};

type IPagePermissionBase = {
  id: string;
  name: string;
  role: string;
  createdAt: string;
};

export type IPagePermissionUser = IPagePermissionBase & {
  type: "user";
  email: string;
  avatarUrl: string;
};

export type IPagePermissionGroup = IPagePermissionBase & {
  type: "group";
  memberCount: number;
  isDefault: boolean;
};

export type IPagePermissionMember = IPagePermissionUser | IPagePermissionGroup;

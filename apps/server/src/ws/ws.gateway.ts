import {
  MessageBody,
  OnGatewayConnection,
  SubscribeMessage,
  WebSocketGateway,
  WebSocketServer,
} from '@nestjs/websockets';
import { Server, Socket } from 'socket.io';
import { TokenService } from '../core/auth/services/token.service';
import { JwtPayload, JwtType } from '../core/auth/dto/jwt-payload';
import { OnModuleDestroy } from '@nestjs/common';
import { SpaceMemberRepo } from '@docmost/db/repos/space/space-member.repo';
import * as cookie from 'cookie';
import { PagePermissionRepo } from '@docmost/db/repos/page/page-permission.repo';

@WebSocketGateway({
  cors: { origin: '*' },
  transports: ['websocket'],
})
export class WsGateway implements OnGatewayConnection, OnModuleDestroy {
  @WebSocketServer()
  server: Server;

  private static readonly CACHE_TTL_MS = 30_000;

  private restrictedSpaceCache = new Map<
    string,
    { value: boolean; expiresAt: number }
  >();
  private restrictedAncestorCache = new Map<
    string,
    { value: boolean; expiresAt: number }
  >();
  private userPageAccessCache = new Map<
    string,
    { value: boolean; expiresAt: number }
  >();

  constructor(
    private tokenService: TokenService,
    private spaceMemberRepo: SpaceMemberRepo,
    private pagePermissionRepo: PagePermissionRepo,
  ) {}

  async handleConnection(client: Socket, ...args: any[]): Promise<void> {
    try {
      const cookies = cookie.parse(client.handshake.headers.cookie);
      const token: JwtPayload = await this.tokenService.verifyJwt(
        cookies['authToken'],
        JwtType.ACCESS,
      );

      const userId = token.sub;
      const workspaceId = token.workspaceId;

      client.data.userId = userId;
      client.data.workspaceId = workspaceId;

      const userSpaceIds = await this.spaceMemberRepo.getUserSpaceIds(userId);

      const userRoom = `user-${userId}`;
      const workspaceRoom = `workspace-${workspaceId}`;
      const spaceRooms = userSpaceIds.map((id) => this.getSpaceRoomName(id));

      client.join([userRoom, workspaceRoom, ...spaceRooms]);
    } catch (err) {
      client.emit('Unauthorized');
      client.disconnect();
    }
  }

  @SubscribeMessage('message')
  async handleMessage(client: Socket, data: any): Promise<void> {
    const spaceEvents = [
      'updateOne',
      'addTreeNode',
      'moveTreeNode',
      'deleteTreeNode',
    ];

    if (spaceEvents.includes(data?.operation) && data?.spaceId) {
      const room = this.getSpaceRoomName(data.spaceId);

      const hasRestrictionsInSpace = await this.getCachedBoolean(
        this.restrictedSpaceCache,
        data.spaceId,
        () => this.pagePermissionRepo.hasRestrictedPagesInSpace(data.spaceId),
      );

      if (!hasRestrictionsInSpace) {
        client.broadcast.to(room).emit('message', data);
        return;
      }

      const pageId = this.extractPageIdFromEvent(data);
      if (!pageId) {
        client.broadcast.to(room).emit('message', data);
        return;
      }

      const hasRestrictedAncestor = await this.getCachedBoolean(
        this.restrictedAncestorCache,
        pageId,
        () => this.pagePermissionRepo.hasRestrictedAncestor(pageId),
      );

      if (!hasRestrictedAncestor) {
        client.broadcast.to(room).emit('message', data);
        return;
      }

      const senderUserId = client.data?.userId as string | undefined;
      if (senderUserId) {
        const senderCanAccess = await this.getCachedPageAccess(
          senderUserId,
          pageId,
        );
        if (!senderCanAccess) {
          return;
        }
      }

      await this.broadcastToAuthorizedUsers(
        room,
        (client.data?.userId as string | undefined) ?? null,
        pageId,
        data,
      );
      return;
    }

    client.broadcast.emit('message', data);
  }

  async emitCommentEvent(
    spaceId: string,
    pageId: string,
    data: any,
  ): Promise<void> {
    const room = this.getSpaceRoomName(spaceId);

    const hasRestrictionsInSpace = await this.getCachedBoolean(
      this.restrictedSpaceCache,
      spaceId,
      () => this.pagePermissionRepo.hasRestrictedPagesInSpace(spaceId),
    );

    if (!hasRestrictionsInSpace) {
      this.server.to(room).emit('message', data);
      return;
    }

    const hasRestrictedAncestor = await this.getCachedBoolean(
      this.restrictedAncestorCache,
      pageId,
      () => this.pagePermissionRepo.hasRestrictedAncestor(pageId),
    );

    if (!hasRestrictedAncestor) {
      this.server.to(room).emit('message', data);
      return;
    }

    await this.broadcastToAuthorizedUsers(room, null, pageId, data);
  }

  private async broadcastToAuthorizedUsers(
    room: string,
    excludeUserId: string | null,
    pageId: string,
    data: any,
  ): Promise<void> {
    const sockets = await this.server.in(room).fetchSockets();
    const accessByUser = new Map<string, boolean>();

    await Promise.all(
      sockets.map(async (socket) => {
        const socketUserId = socket.data?.userId as string | undefined;
        if (!socketUserId) {
          return;
        }

        if (excludeUserId && socketUserId === excludeUserId) {
          return;
        }

        if (!accessByUser.has(socketUserId)) {
          const canAccess = await this.getCachedPageAccess(socketUserId, pageId);
          accessByUser.set(socketUserId, canAccess);
        }

        if (accessByUser.get(socketUserId)) {
          socket.emit('message', data);
        }
      }),
    );
  }

  private extractPageIdFromEvent(data: any): string | undefined {
    if (data?.operation === 'updateOne' && data?.entity?.[0] === 'pages') {
      return data?.id;
    }

    if (data?.operation === 'addTreeNode') {
      return data?.payload?.data?.id;
    }

    if (data?.operation === 'moveTreeNode') {
      return data?.payload?.id;
    }

    if (data?.operation === 'deleteTreeNode') {
      return data?.payload?.node?.id;
    }

    return undefined;
  }

  private async getCachedPageAccess(
    userId: string,
    pageId: string,
  ): Promise<boolean> {
    return this.getCachedBoolean(
      this.userPageAccessCache,
      `${userId}:${pageId}`,
      () => this.pagePermissionRepo.canUserAccessPage(userId, pageId),
    );
  }

  private async getCachedBoolean(
    cache: Map<string, { value: boolean; expiresAt: number }>,
    key: string,
    resolver: () => Promise<boolean>,
  ): Promise<boolean> {
    const now = Date.now();
    const cached = cache.get(key);

    if (cached && cached.expiresAt > now) {
      return cached.value;
    }

    const value = await resolver();
    cache.set(key, {
      value,
      expiresAt: now + WsGateway.CACHE_TTL_MS,
    });

    return value;
  }

  invalidateSpaceRestrictionCache(spaceId: string): void {
    this.restrictedSpaceCache.delete(spaceId);
  }

  invalidatePageRestrictionCache(pageId: string): void {
    this.restrictedAncestorCache.delete(pageId);

    for (const key of this.userPageAccessCache.keys()) {
      if (key.endsWith(`:${pageId}`)) {
        this.userPageAccessCache.delete(key);
      }
    }
  }

  notifyPagePermissionChanged(spaceId: string, pageId: string): void {
    const room = this.getSpaceRoomName(spaceId);

    this.server.to(room).emit('message', {
      operation: 'refetchRootTreeNodeEvent',
      spaceId,
    });

    this.server.to(room).emit('message', {
      operation: 'invalidate',
      spaceId,
      entity: ['pages'],
      id: pageId,
    });
  }

  @SubscribeMessage('join-room')
  handleJoinRoom(client: Socket, @MessageBody() roomName: string): void {
    // if room is a space, check if user has permissions
    //client.join(roomName);
  }

  @SubscribeMessage('leave-room')
  handleLeaveRoom(client: Socket, @MessageBody() roomName: string): void {
    client.leave(roomName);
  }

  onModuleDestroy() {
    if (this.server) {
      this.server.close();
    }
  }

  getSpaceRoomName(spaceId: string): string {
    return `space-${spaceId}`;
  }
}

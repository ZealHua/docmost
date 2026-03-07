import { CanActivate, ExecutionContext, ValidationPipe } from '@nestjs/common';
import { Test } from '@nestjs/testing';
import * as request from 'supertest';
import { AttachmentController } from './attachment.controller';
import { AttachmentType } from './attachment.constants';
import { JwtAuthGuard } from '../../common/guards/jwt-auth.guard';
import { AttachmentService } from './services/attachment.service';
import { StorageService } from '../../integrations/storage/storage.service';
import WorkspaceAbilityFactory from '../casl/abilities/workspace-ability.factory';
import SpaceAbilityFactory from '../casl/abilities/space-ability.factory';
import { PageRepo } from '@docmost/db/repos/page/page.repo';
import { AttachmentRepo } from '@docmost/db/repos/attachment/attachment.repo';
import { EnvironmentService } from '../../integrations/environment/environment.service';
import { TokenService } from '../auth/services/token.service';
import { PageAccessService } from '../page/page-access/page-access.service';
import { FastifyAdapter, NestFastifyApplication } from '@nestjs/platform-fastify';

class MockJwtAuthGuard implements CanActivate {
  canActivate(context: ExecutionContext): boolean {
    const req = context.switchToHttp().getRequest();
    req.user = {
      user: { id: 'user-1' },
      workspace: { id: 'workspace-1' },
    };
    return true;
  }
}

describe('AttachmentController (http)', () => {
  let app: NestFastifyApplication;

  const attachmentRepo = {
    findById: jest.fn(),
  };

  const pageRepo = {
    findById: jest.fn(),
  };

  const pageAccessService = {
    validateCanView: jest.fn(),
    validateCanEdit: jest.fn(),
  };

  beforeAll(async () => {
    const moduleBuilder = Test.createTestingModule({
      controllers: [AttachmentController],
      providers: [
        { provide: AttachmentService, useValue: {} },
        { provide: StorageService, useValue: {} },
        { provide: WorkspaceAbilityFactory, useValue: {} },
        { provide: SpaceAbilityFactory, useValue: {} },
        { provide: PageRepo, useValue: pageRepo },
        { provide: AttachmentRepo, useValue: attachmentRepo },
        { provide: EnvironmentService, useValue: {} },
        { provide: TokenService, useValue: {} },
        { provide: PageAccessService, useValue: pageAccessService },
      ],
    });

    moduleBuilder.overrideGuard(JwtAuthGuard).useValue(new MockJwtAuthGuard());

    const moduleRef = await moduleBuilder.compile();

    app = moduleRef.createNestApplication<NestFastifyApplication>(
      new FastifyAdapter(),
    );
    app.useGlobalPipes(
      new ValidationPipe({
        whitelist: true,
        transform: true,
      }),
    );

    await app.init();
    await app.getHttpAdapter().getInstance().ready();
  });

  beforeEach(() => {
    jest.clearAllMocks();
  });

  afterAll(async () => {
    if (app) {
      await app.close();
    }
  });

  it('POST /files/info returns attachment when accessible', async () => {
    const attachment = {
      id: '11111111-1111-4111-8111-111111111111',
      pageId: '22222222-2222-4222-8222-222222222222',
      workspaceId: 'workspace-1',
      type: AttachmentType.File,
      fileName: 'image.png',
    };

    attachmentRepo.findById.mockResolvedValue(attachment);
    pageRepo.findById.mockResolvedValue({ id: attachment.pageId });
    pageAccessService.validateCanView.mockResolvedValue(undefined);

    const response = await request(app.getHttpServer())
      .post('/files/info')
      .send({ attachmentId: attachment.id })
      .expect(200);

    expect(response.body.id).toBe(attachment.id);
    expect(attachmentRepo.findById).toHaveBeenCalledWith(attachment.id);
    expect(pageRepo.findById).toHaveBeenCalledWith(attachment.pageId);
  });

  it('POST /files/info returns 404 for missing attachment', async () => {
    attachmentRepo.findById.mockResolvedValue(null);

    await request(app.getHttpServer())
      .post('/files/info')
      .send({ attachmentId: '11111111-1111-4111-8111-111111111111' })
      .expect(404);

    expect(pageRepo.findById).not.toHaveBeenCalled();
  });

  it('POST /files/info returns 400 for invalid uuid payload', async () => {
    await request(app.getHttpServer())
      .post('/files/info')
      .send({ attachmentId: 'not-a-uuid' })
      .expect(400);

    expect(attachmentRepo.findById).not.toHaveBeenCalled();
  });
});

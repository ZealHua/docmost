import { Test, TestingModule } from '@nestjs/testing';
import { getQueueToken } from '@nestjs/bullmq';
import { CommentRepo } from '@docmost/db/repos/comment/comment.repo';
import { PageRepo } from '@docmost/db/repos/page/page.repo';
import { WsGateway } from '../../ws/ws.gateway';
import { QueueName } from '../../integrations/queue/constants';
import { CommentService } from './comment.service';

describe('CommentService', () => {
  let service: CommentService;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        CommentService,
        {
          provide: CommentRepo,
          useValue: {},
        },
        {
          provide: PageRepo,
          useValue: {},
        },
        {
          provide: WsGateway,
          useValue: {
            emitCommentEvent: jest.fn(),
          },
        },
        {
          provide: getQueueToken(QueueName.GENERAL_QUEUE),
          useValue: { add: jest.fn() },
        },
        {
          provide: getQueueToken(QueueName.NOTIFICATION_QUEUE),
          useValue: { add: jest.fn() },
        },
      ],
    }).compile();

    service = module.get<CommentService>(CommentService);
  });

  it('should be defined', () => {
    expect(service).toBeDefined();
  });
});

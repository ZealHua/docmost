import { Test, TestingModule } from '@nestjs/testing';
import { ModuleRef } from '@nestjs/core';
import { SearchController } from './search.controller';
import { SearchService } from './search.service';
import SpaceAbilityFactory from '../casl/abilities/space-ability.factory';
import { EnvironmentService } from '../../integrations/environment/environment.service';
import { JwtAuthGuard } from '../../common/guards/jwt-auth.guard';

describe('SearchController', () => {
  let controller: SearchController;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      controllers: [SearchController],
      providers: [
        {
          provide: SearchService,
          useValue: {
            searchPage: jest.fn(),
            searchSuggestions: jest.fn(),
          },
        },
        {
          provide: SpaceAbilityFactory,
          useValue: {
            createForUser: jest.fn(),
          },
        },
        {
          provide: EnvironmentService,
          useValue: {
            getSearchDriver: jest.fn().mockReturnValue('postgres'),
          },
        },
        {
          provide: ModuleRef,
          useValue: {
            get: jest.fn(),
          },
        },
        {
          provide: JwtAuthGuard,
          useValue: {
            canActivate: jest.fn().mockReturnValue(true),
          },
        },
      ],
    }).compile();

    controller = module.get<SearchController>(SearchController);
  });

  it('should be defined', () => {
    expect(controller).toBeDefined();
  });
});

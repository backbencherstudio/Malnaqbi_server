import { Test, TestingModule } from '@nestjs/testing';
import { CreatePlaceService } from './create-place.service';

describe('CreatePlaceService', () => {
  let service: CreatePlaceService;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [CreatePlaceService],
    }).compile();

    service = module.get<CreatePlaceService>(CreatePlaceService);
  });

  it('should be defined', () => {
    expect(service).toBeDefined();
  });
});

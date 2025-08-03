import { Test, TestingModule } from '@nestjs/testing';
import { CreatePlaceController } from './create-place.controller';
import { CreatePlaceService } from './create-place.service';

describe('CreatePlaceController', () => {
  let controller: CreatePlaceController;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      controllers: [CreatePlaceController],
      providers: [CreatePlaceService],
    }).compile();

    controller = module.get<CreatePlaceController>(CreatePlaceController);
  });

  it('should be defined', () => {
    expect(controller).toBeDefined();
  });
});

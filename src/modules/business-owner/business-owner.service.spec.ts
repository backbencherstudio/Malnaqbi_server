import { Test, TestingModule } from '@nestjs/testing';
import { BusinessOwnerService } from './business-owner.service';

describe('BusinessOwnerService', () => {
  let service: BusinessOwnerService;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [BusinessOwnerService],
    }).compile();

    service = module.get<BusinessOwnerService>(BusinessOwnerService);
  });

  it('should be defined', () => {
    expect(service).toBeDefined();
  });
});

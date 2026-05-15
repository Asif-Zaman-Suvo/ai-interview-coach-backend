import { IsIn } from 'class-validator';

export class DummyPurchaseDto {
  @IsIn(['pack_10', 'pack_30'])
  plan!: 'pack_10' | 'pack_30';
}

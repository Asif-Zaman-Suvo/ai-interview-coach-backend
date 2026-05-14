import { Module } from '@nestjs/common';
import { MarketingController } from './marketing.controller';
import { SessionsModule } from '../sessions/sessions.module';

@Module({
  imports: [SessionsModule],
  controllers: [MarketingController],
})
export class MarketingModule {}

import { Module } from '@nestjs/common';
import { MongooseModule } from '@nestjs/mongoose';
import { loadDatabaseConfig } from './database.config';

@Module({
  imports: [
    MongooseModule.forRootAsync({
      useFactory: () => {
        const cfg = loadDatabaseConfig();
        return {
          uri: cfg.uri,
          ...(cfg.dbName ? { dbName: cfg.dbName } : {}),
        };
      },
    }),
  ],
})
export class DatabaseModule {}

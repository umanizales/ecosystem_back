import { Module, forwardRef } from '@nestjs/common';
import { ActivitiesConfigService } from './activities-config.service';
import { ActivitiesConfigResolver } from './activities-config.resolver';
import { MongooseModule } from '@nestjs/mongoose';
import {
  ActivitiesConfig,
  ActivitiesConfigSchema,
} from './entities/activities-config.entity';
import { AuthModule } from 'src/auth/auth.module';
import { LoggerModule } from 'src/logger/logger.module';
import { ExpertModule } from 'src/expert/expert.module';
import { UsersModule } from 'src/users/users.module';
import { StartupModule } from 'src/startup/startup.module';
import { TypesEventsModule } from '../events/types-events/types-events.module';
import { EventsModule } from 'src/events/events.module';
import { ReportsModule } from 'src/reports/reports.module';

@Module({
  imports: [
    MongooseModule.forFeature([
      { name: ActivitiesConfig.name, schema: ActivitiesConfigSchema },
    ]),
    AuthModule,
    LoggerModule,
    forwardRef(() => ExpertModule),
    forwardRef(() => StartupModule),
    forwardRef(() => UsersModule),
    forwardRef(() => EventsModule),
    forwardRef(() => TypesEventsModule),
    forwardRef(() => ReportsModule),
  ],
  providers: [ActivitiesConfigResolver, ActivitiesConfigService],
  exports: [ActivitiesConfigService],
})
export class ActivitiesConfigModule {}

import {
  Resolver,
  Query,
  Mutation,
  Args,
  Int,
  ResolveField,
  Parent,
} from '@nestjs/graphql';
import { ActivitiesConfigService } from './activities-config.service';
import { ActivitiesConfig, Assign } from './entities/activities-config.entity';
import { CreateActivitiesConfigInput } from './dto/create-activities-config.input';
import { UpdateActivitiesConfigInput } from './dto/update-activities-config.input';
import { GraphQLJSONObject } from 'graphql-scalars';
import { Hours } from './outputs/hours.model';
import { UrlType } from 'src/shared/models/url';
/**
 * @ignore
 */
@Resolver(() => ActivitiesConfig)
export class ActivitiesConfigResolver {
  constructor(
    private readonly activitiesConfigService: ActivitiesConfigService,
  ) {}

  @Mutation(() => ActivitiesConfig)
  createActivitiesConfig(
    @Args('createActivitiesConfigInput')
    createActivitiesConfigInput: CreateActivitiesConfigInput,
  ) {
    return this.activitiesConfigService.create(createActivitiesConfigInput);
  }

  @Query(() => ActivitiesConfig, { name: 'activitiesConfigPhase' })
  findAll(@Args('phase', { type: () => String }) phase: string) {
    return this.activitiesConfigService.findByPhase(phase);
  }

  @Query(() => ActivitiesConfig, { name: 'activitiesConfig' })
  findOne(@Args('id', { type: () => String }) id: string) {
    return this.activitiesConfigService.findOne(id);
  }

  @Query(() => UrlType, { name: 'activitiesConfigReport', nullable: true })
  generateReportView(@Args('batch', { type: () => String }) batch: string) {
    return this.activitiesConfigService.generateViewHours(batch);
  }

  @Query(() => Hours, { name: 'activitiesConfigPhasePerStartup' })
  findOneStartup(
    @Args('phase', { type: () => String }) phase: string,
    @Args('startup', { type: () => String }) startup: string,
  ) {
    return this.activitiesConfigService.findByPhaseAndStartup(phase, startup);
  }

  @Mutation(() => ActivitiesConfig)
  updateActivitiesConfig(
    @Args('updateActivitiesConfigInput')
    updateActivitiesConfigInput: UpdateActivitiesConfigInput,
  ) {
    return this.activitiesConfigService.update(
      updateActivitiesConfigInput._id,
      updateActivitiesConfigInput,
    );
  }

  @Mutation(() => ActivitiesConfig)
  removeActivitiesConfig(@Args('id', { type: () => String }) id: string) {
    return this.activitiesConfigService.remove(id);
  }

  @ResolveField('calcHours', () => GraphQLJSONObject)
  resolveExpertHours(@Parent() config: Omit<ActivitiesConfig, 'calcHours'>) {
    return this.activitiesConfigService.calcHours(config);
  }
}

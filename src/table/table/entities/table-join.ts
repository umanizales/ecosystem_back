import { Field, InputType, ObjectType } from '@nestjs/graphql';
import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { IsOptional, IsString } from 'class-validator';
import GraphQLJSON from 'graphql-type-json';
import { TableColumn } from 'src/shared/models/table-column';
/**
 * joins between tables
 */
@Schema()
@InputType()
@ObjectType()
export class TableJoin {
  @IsString()
  @Field()
  @Prop()
  name: string;

  @IsString()
  @Field()
  @Prop()
  key: string;

  @IsString()
  @Field()
  @Prop()
  form: string;

  @Field(() => GraphQLJSON)
  @IsOptional()
  @Prop({ default: [] })
  extraColumns: TableColumn[];

  @Field(() => Date, {
    description: 'If set, The date the entity was deleted.',
    nullable: true,
  })
  @Prop()
  deletedAt: Date;
}
/**
 * @ignore
 */
export const TableJoinSchema = SchemaFactory.createForClass(TableJoin);

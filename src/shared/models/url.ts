import { ObjectType, Field } from '@nestjs/graphql';

@ObjectType()
export class UrlType {
  @Field()
  url: string;
}

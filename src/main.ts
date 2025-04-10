import { NestFactory } from '@nestjs/core';
import { AppModule } from './app.module';
import { ValidationPipe } from '@nestjs/common';
import * as bodyParser from 'body-parser';
import { join } from 'path';
import { NestExpressApplication } from '@nestjs/platform-express';
/**
 * main config app
 */
async function bootstrap() {
  const app = await NestFactory.create<NestExpressApplication>(AppModule, {
    cors: true,
  });
  app.enableCors({
    origin: '*',
    methods: 'GET, HEAD, PUT, PATCH, POST, DELETE, OPTIONS',
    credentials: true,
  });
  app.useGlobalPipes(
    new ValidationPipe({
      whitelist: true,
      forbidNonWhitelisted: true,
      // Used to combine class validator with graphql nullable fields and allow missing graphql fields but not null
      // This works good to allow partial updates with proper endpoint validation since graphql doesnt handle undefined
      skipUndefinedProperties: true,
    }),
  );
  app.use(bodyParser.json({ limit: '10mb' }));
  
  app.useStaticAssets(join(__dirname, '..', 'storage'), {
    prefix: '/storage',
  });

  const port = process.env.PORT ?? 3000;
  await app.listen(port, () => {
    console.log(`Server running on port ${port}`);
  });
}
bootstrap();

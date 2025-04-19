import { Body, Controller, Param, Post, Get, Query } from '@nestjs/common';
import { StorageService } from './models/storage-service';
import {
  UploadedFile,
  UseInterceptors,
  BadRequestException,
} from '@nestjs/common';
import { FileInterceptor } from '@nestjs/platform-express';
import { File as MulterFile } from 'multer';

/**
 * upload files endpoints
 */
@Controller('storage')
export class StorageController {
  constructor(private readonly storageService: StorageService) {}

  @Post()
  @UseInterceptors(FileInterceptor('file'))
  async create(@UploadedFile() file: MulterFile, @Body('name') key: string): Promise<any> {
    if (!file || !key) {
      throw new BadRequestException('Archivo o clave (key) no proporcionados');
    }

    const result = await this.storageService.createPresignedUrl(key, file.buffer);
    return { url: result };
  }

  @Get()
  async get(@Query() query): Promise<any> {
    const result = await this.storageService.getPresignedUrl(query.key);
    return { url: result };
  }
}

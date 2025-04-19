import { Body, Controller, Param, Post, Get, Query } from '@nestjs/common';
import { StorageService } from './models/storage-service';
import {
  UploadedFile,
  UseInterceptors,
  BadRequestException,
} from '@nestjs/common';
import { FileInterceptor } from '@nestjs/platform-express';
import { File as MulterFile } from 'multer';
import { createReadStream, existsSync } from 'fs';
import { join } from 'path';
import * as mime from 'mime-types';
import { Request, Response } from 'express';

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

  @Get('*')
  async serveFile(@Param() params, @Query() query, @Body() body, @Query() req: Request, @Body() res: Response) {
    const requestedPath = req.originalUrl.replace('/storage/', '');
    const fullPath = join(process.env.UPLOADS_PATH || './storage', requestedPath);

    if (!existsSync(fullPath)) {
      return res.status(404).json({ message: 'Archivo no encontrado' });
    }

    try {
      const mimeType = mime.lookup(fullPath) || 'application/octet-stream';
      const fileStream = createReadStream(fullPath);

      res.setHeader('Content-Type', mimeType);
      fileStream.pipe(res);

      fileStream.on('error', (err) => {
        console.error(`Error al leer el archivo: ${err.message}`);
        return res.status(500).json({ message: 'Error al leer el archivo' });
      });
    } catch (error) {
      console.error(`Error general: ${error.message}`);
      return res.status(500).json({ message: 'Error al procesar la solicitud' });
    }
  }
}

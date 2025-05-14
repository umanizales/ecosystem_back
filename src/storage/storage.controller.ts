import {
  Controller,
  Post,
  Get,
  Query,
  Req,
  Res,
  UploadedFile,
  UseInterceptors,
  BadRequestException,
  Delete,
} from '@nestjs/common';
import { StorageService } from './models/storage-service';
import { FileInterceptor } from '@nestjs/platform-express';
import { File as MulterFile } from 'multer';
import { createReadStream, existsSync } from 'fs';
import { join, normalize, sep } from 'path';
import * as mime from 'mime-types';
import { Request, Response } from 'express';

/**
 * Local storage controller
 */
@Controller('storage')
export class StorageController {
  constructor(private readonly storageService: StorageService) {}

  @Post('upload')
  @UseInterceptors(FileInterceptor('file'))
  async uploadFile(
    @Query('key') key: string,
    @UploadedFile() file: MulterFile
  ) {
    if (!file || !key) {
      throw new BadRequestException('Archivo o clave (key) no proporcionados');
    }

    const url = await this.storageService.uploadFile(key, file.buffer);
    return { url };
  }

  @Get('*')
  async serveFile(@Req() req: Request, @Res() res: Response) {
    const requestedPath = req.originalUrl.replace(/^\/storage\//, '');
    const basePath = join(process.env.UPLOADS_PATH || './storage');
    const normalizedPath = normalize(requestedPath);
    const fullPath = join(basePath, normalizedPath);

    if (!fullPath.startsWith(basePath + sep)) {
      return res.status(403).json({ message: 'Acceso denegado' });
    }

    if (!existsSync(fullPath)) {
      return res.status(404).json({ message: 'Archivo no encontrado' });
    }

    try {
      const mimeType = mime.lookup(fullPath) || 'application/octet-stream';
      const fileStream = createReadStream(fullPath);

      res.setHeader('Access-Control-Allow-Origin', '*');
      res.setHeader('Cross-Origin-Resource-Policy', 'cross-origin');
      res.setHeader('Cross-Origin-Embedder-Policy', 'require-corp');
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

  @Delete('*')
  async deleteFile(@Req() req: Request) {
    const requestedPath = req.originalUrl.replace(/^\/storage\//, '');
    const basePath = join(process.env.UPLOADS_PATH || './storage');
    const normalizedPath = normalize(requestedPath);
    const fullPath = join(basePath, normalizedPath);

    if (!fullPath.startsWith(basePath + sep)) {
      return { message: 'Acceso denegado' };
    }

    await this.storageService.deleteFile(normalizedPath);
    return { message: 'Archivo eliminado correctamente' };
  }
}
import { Body, Controller, Param, Post, Get, Query, Req, Res } from '@nestjs/common';
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
  async create(@Body('name') key: string, @Body('publicFile') publicFile?: boolean): Promise<any> {
    if (!key) {
      throw new BadRequestException('Clave (key) no proporcionada');
    }

    const result = await this.storageService.createPresignedUrl(key);
    return { url: result };
  }

  @Post('upload')
  @UseInterceptors(FileInterceptor('file'))
  async uploadFromPresigned(@Query('key') key: string, @UploadedFile() file: MulterFile) {
    if (!file || !key) {
      throw new BadRequestException('Archivo o clave (key) no proporcionados');
    }

    const result = await this.storageService.createPresignedUrl(key, file.buffer);
    return { url: result };
  }

  @Get('*')
  async serveFile(@Req() req: Request, @Res() res: Response) {
    const requestedPath = req.originalUrl.replace(/^\/storage\//, '');
    const fullPath = join(process.env.UPLOADS_PATH || './storage', requestedPath);

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

  @Post('*')
  async uploadSimulatedS3(@Req() req: Request, @Res() res: Response) {
    const key = req.originalUrl.replace(/^\/storage\//, '');
    const chunks: Uint8Array[] = [];

    req.on('data', (chunk) => {
      chunks.push(chunk);
    });

    req.on('end', async () => {
      const buffer = Buffer.concat(chunks);
      try {
        await this.storageService.createPresignedUrl(key, buffer);
        res.status(200).json({ message: 'Archivo subido correctamente' });
      } catch (err) {
        console.error('Error guardando archivo simulado tipo S3:', err);
        res.status(500).json({ message: 'Error guardando archivo' });
      }
    });

    req.on('error', (err) => {
      console.error('Error leyendo datos:', err);
      res.status(500).json({ message: 'Error leyendo datos del archivo' });
    });
  }
}

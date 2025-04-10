import { Injectable, InternalServerErrorException } from '@nestjs/common';
import { StorageService } from '../models/storage-service';
import { writeFileSync, existsSync, mkdirSync } from 'fs';
import { join } from 'path';
import { Request } from 'express';

@Injectable()
export class AwsService implements StorageService {
  private readonly baseUploadPath: string;
  private readonly publicUrlBase: string;

  constructor() {
    this.baseUploadPath = process.env.UPLOADS_PATH || './storage';
    this.publicUrlBase = process.env.UPLOADS_PUBLIC_URL || 'http://190.121.154.48:3500/storage';
  }

  private ensureDirectoryExists(path: string): void {
    if (!existsSync(path)) {
      mkdirSync(path, { recursive: true });
    }
  }

  private getFilePath(key: string): string {
    return join(this.baseUploadPath, key);
  }

  private getFileUrl(key: string): string {
    return `${this.publicUrlBase}/${key.replace(/\\/g, '/')}`;
  }

  async uploadTemporaryFile(key: string, data: Buffer): Promise<string> {
    const fullPath = this.getFilePath(key);
    const dir = fullPath.substring(0, fullPath.lastIndexOf('/'));
    this.ensureDirectoryExists(dir);

    try {
      writeFileSync(fullPath, data);
      return this.getFileUrl(key);
    } catch (error) {
      console.error(error);
      throw new InternalServerErrorException('Error guardando archivo en disco');
    }
  }

  async createPresignedUrl(key: string, data?: Buffer): Promise<string> {
    if (data) {
      await this.uploadTemporaryFile(key, data);
    }
    return this.getFileUrl(key);
  }

  async getPresignedUrl(key: string): Promise<string> {
    return this.getFileUrl(key);
  }

  async handlePutUpload(key: string, req: Request): Promise<void> {
    return new Promise((resolve, reject) => {
      const fullPath = this.getFilePath(key);
      const dir = fullPath.substring(0, fullPath.lastIndexOf('/'));
      this.ensureDirectoryExists(dir);

      const chunks: Uint8Array[] = [];
      req.on('data', chunk => chunks.push(chunk));
      req.on('end', () => {
        try {
          const buffer = Buffer.concat(chunks);
          writeFileSync(fullPath, buffer);
          resolve();
        } catch (err) {
          console.error('Error al guardar archivo por PUT:', err);
          reject(new InternalServerErrorException('Error guardando archivo desde PUT'));
        }
      });
      req.on('error', err => {
        console.error('Error de stream al recibir archivo:', err);
        reject(new InternalServerErrorException('Error en la transmisión del archivo'));
      });
    });
  }
}
import { Injectable, InternalServerErrorException } from '@nestjs/common';
import { StorageService } from '../models/storage-service';
import { writeFileSync, unlinkSync, existsSync, mkdirSync } from 'fs';
import { join } from 'path';

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

  private getFilePath(relativePath: string): string {
    return join(this.baseUploadPath, relativePath);
  }

  private getFileUrl(relativePath: string): string {
    return `${this.publicUrlBase}/${relativePath.replace(/\\/g, '/')}`;
  }

  async uploadFile(relativePath: string, data: Buffer): Promise<string> {
    if (!data || !Buffer.isBuffer(data) || data.length < 10) {
      throw new InternalServerErrorException('El archivo recibido está vacío o no es válido');
    }

    const fullPath = this.getFilePath(relativePath);
    const dir = fullPath.substring(0, fullPath.lastIndexOf('/'));
    this.ensureDirectoryExists(dir);

    try {
      writeFileSync(fullPath, data);
      return this.getFileUrl(relativePath);
    } catch (error) {
      console.error('Error al guardar archivo:', error);
      throw new InternalServerErrorException('Error al guardar archivo en disco');
    }
  }

  async deleteFile(relativePath: string): Promise<void> {
    const fullPath = this.getFilePath(relativePath);
    try {
      if (existsSync(fullPath)) {
        unlinkSync(fullPath);
      }
    } catch (error) {
      console.error('Error al eliminar archivo:', error);
      throw new InternalServerErrorException('Error al eliminar archivo del disco');
    }
  }

  getPublicUrl(relativePath: string): string {
    return this.getFileUrl(relativePath);
  }
}
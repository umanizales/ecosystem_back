import { Injectable, InternalServerErrorException } from '@nestjs/common';
import { StorageService } from '../models/storage-service';
import { writeFileSync, existsSync, mkdirSync } from 'fs';
import { join } from 'path';

@Injectable()
export class AwsService implements StorageService {
  private readonly baseUploadPath: string;
  private readonly publicUrlBase: string;

  constructor() {
    this.baseUploadPath = process.env.UPLOADS_PATH || './uploads';
    this.publicUrlBase = process.env.UPLOADS_PUBLIC_URL || 'http://172.28.20.128:3500/uploads';
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

  async createPresignedUrl(key: string): Promise<string> {
    return this.getFileUrl(key);
  }

  async getPresignedUrl(key: string): Promise<string> {
    return this.getFileUrl(key);
  }
}
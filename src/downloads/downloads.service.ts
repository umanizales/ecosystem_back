import { Injectable } from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Model } from 'mongoose';
import { Download } from './entities/download';
import { StorageService } from 'src/storage/models/storage-service';
import * as uuid from 'uuid';

@Injectable()
export class DownloadsService {
  constructor(
    @InjectModel(Download.name) private readonly downloadModel: Model<Download>,
    private readonly storageService: StorageService,
  ) {}

  /**
   * prepare data to download file of a table in app
   */
  async uploadTempFile(data: Buffer, extension: string): Promise<string> {
    const fileId = uuid.v4();
    const fileName = `${fileId}.${extension}`;

    const fileUrl = await this.storageService.uploadFile(fileName, data);

    const downloadData = {
      name: fileName,
      url: fileUrl,
    };
    const createdDownload = await this.downloadModel.create(downloadData);
    return createdDownload.url;
  }
}
/**
 * Abstract storage service for local file handling
 */
export abstract class StorageService {
  public abstract uploadFile(key: string, data: Buffer): Promise<string>;

  public abstract deleteFile(key: string): Promise<void>;

  public abstract getPublicUrl(key: string): string;
}
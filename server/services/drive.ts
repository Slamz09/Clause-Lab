import { google, drive_v3 } from 'googleapis';
import { OAuth2Client } from 'google-auth-library';
import { Readable } from 'stream';

const FOLDER_NAME = 'Clause Lab Contracts';

export class DriveService {
  private drive: drive_v3.Drive;
  private folderId: string | null = null;

  constructor(auth: OAuth2Client) {
    this.drive = google.drive({ version: 'v3', auth });
  }

  async createOrGetFolder(existingId?: string): Promise<string> {
    // If we have an existing ID, verify it exists
    if (existingId) {
      try {
        const response = await this.drive.files.get({
          fileId: existingId,
          fields: 'id, name, trashed'
        });
        if (response.data.id && !response.data.trashed) {
          this.folderId = existingId;
          return existingId;
        }
      } catch (e) {
        // Folder doesn't exist, create new one
      }
    }

    // Search for existing folder
    const searchResponse = await this.drive.files.list({
      q: `name='${FOLDER_NAME}' and mimeType='application/vnd.google-apps.folder' and trashed=false`,
      fields: 'files(id, name)'
    });

    if (searchResponse.data.files && searchResponse.data.files.length > 0) {
      this.folderId = searchResponse.data.files[0].id!;
      return this.folderId;
    }

    // Create new folder
    const createResponse = await this.drive.files.create({
      requestBody: {
        name: FOLDER_NAME,
        mimeType: 'application/vnd.google-apps.folder'
      },
      fields: 'id'
    });

    this.folderId = createResponse.data.id!;
    return this.folderId;
  }

  setFolderId(id: string) {
    this.folderId = id;
  }

  async uploadFile(
    fileName: string,
    content: string,
    mimeType: string = 'text/plain'
  ): Promise<string> {
    if (!this.folderId) {
      throw new Error('Drive folder not initialized');
    }

    // Check if file already exists
    const existingFile = await this.findFile(fileName);

    if (existingFile) {
      // Update existing file
      const response = await this.drive.files.update({
        fileId: existingFile,
        media: {
          mimeType,
          body: Readable.from([content])
        },
        fields: 'id'
      });
      return response.data.id!;
    }

    // Create new file
    const response = await this.drive.files.create({
      requestBody: {
        name: fileName,
        parents: [this.folderId]
      },
      media: {
        mimeType,
        body: Readable.from([content])
      },
      fields: 'id'
    });

    return response.data.id!;
  }

  async uploadFileFromBase64(
    fileName: string,
    base64Content: string,
    mimeType: string
  ): Promise<string> {
    if (!this.folderId) {
      throw new Error('Drive folder not initialized');
    }

    const buffer = Buffer.from(base64Content, 'base64');

    // Check if file already exists
    const existingFile = await this.findFile(fileName);

    if (existingFile) {
      // Update existing file
      const response = await this.drive.files.update({
        fileId: existingFile,
        media: {
          mimeType,
          body: Readable.from([buffer])
        },
        fields: 'id'
      });
      return response.data.id!;
    }

    // Create new file
    const response = await this.drive.files.create({
      requestBody: {
        name: fileName,
        parents: [this.folderId]
      },
      media: {
        mimeType,
        body: Readable.from([buffer])
      },
      fields: 'id'
    });

    return response.data.id!;
  }

  async findFile(fileName: string): Promise<string | null> {
    if (!this.folderId) return null;

    const response = await this.drive.files.list({
      q: `name='${fileName}' and '${this.folderId}' in parents and trashed=false`,
      fields: 'files(id)'
    });

    if (response.data.files && response.data.files.length > 0) {
      return response.data.files[0].id!;
    }

    return null;
  }

  async deleteFile(fileId: string): Promise<void> {
    await this.drive.files.delete({ fileId });
  }

  async getFileContent(fileId: string): Promise<string> {
    const response = await this.drive.files.get({
      fileId,
      alt: 'media'
    }, { responseType: 'text' });

    return response.data as string;
  }

  getFileUrl(fileId: string): string {
    return `https://drive.google.com/file/d/${fileId}/view`;
  }

  getFolderId(): string | null {
    return this.folderId;
  }

  getFolderUrl(): string | null {
    if (!this.folderId) return null;
    return `https://drive.google.com/drive/folders/${this.folderId}`;
  }
}

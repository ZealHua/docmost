import { NotFoundException } from '@nestjs/common';
import { AttachmentController } from './attachment.controller';
import { AttachmentType } from './attachment.constants';

describe('AttachmentController', () => {
  let controller: AttachmentController;
  let attachmentRepo: { findById: jest.Mock };
  let pageRepo: { findById: jest.Mock };
  let pageAccessService: { validateCanView: jest.Mock };

  beforeEach(() => {
    attachmentRepo = {
      findById: jest.fn(),
    };

    pageRepo = {
      findById: jest.fn(),
    };

    pageAccessService = {
      validateCanView: jest.fn(),
    };

    controller = new AttachmentController(
      {} as any,
      {} as any,
      {} as any,
      {} as any,
      pageRepo as any,
      attachmentRepo as any,
      {} as any,
      {} as any,
      pageAccessService as any,
    );
  });

  describe('getAttachmentInfo', () => {
    it('returns attachment when file is accessible in same workspace', async () => {
      const workspaceId = 'workspace-1';
      const pageId = 'page-1';
      const attachment = {
        id: 'attachment-1',
        pageId,
        workspaceId,
        type: AttachmentType.File,
      };
      const page = { id: pageId };
      const user = { id: 'user-1' };

      attachmentRepo.findById.mockResolvedValue(attachment);
      pageRepo.findById.mockResolvedValue(page);
      pageAccessService.validateCanView.mockResolvedValue(undefined);

      const result = await controller.getAttachmentInfo(
        { attachmentId: attachment.id },
        { id: workspaceId } as any,
        user as any,
      );

      expect(attachmentRepo.findById).toHaveBeenCalledWith(attachment.id);
      expect(pageRepo.findById).toHaveBeenCalledWith(pageId);
      expect(pageAccessService.validateCanView).toHaveBeenCalledWith(page, user);
      expect(result).toBe(attachment);
    });

    it('throws NotFoundException when attachment is missing', async () => {
      attachmentRepo.findById.mockResolvedValue(null);

      await expect(
        controller.getAttachmentInfo(
          { attachmentId: 'missing-id' },
          { id: 'workspace-1' } as any,
          { id: 'user-1' } as any,
        ),
      ).rejects.toThrow(NotFoundException);

      expect(pageRepo.findById).not.toHaveBeenCalled();
      expect(pageAccessService.validateCanView).not.toHaveBeenCalled();
    });

    it('throws NotFoundException when attachment does not belong to workspace', async () => {
      attachmentRepo.findById.mockResolvedValue({
        id: 'attachment-1',
        pageId: 'page-1',
        workspaceId: 'workspace-2',
        type: AttachmentType.File,
      });

      await expect(
        controller.getAttachmentInfo(
          { attachmentId: 'attachment-1' },
          { id: 'workspace-1' } as any,
          { id: 'user-1' } as any,
        ),
      ).rejects.toThrow(NotFoundException);

      expect(pageRepo.findById).not.toHaveBeenCalled();
      expect(pageAccessService.validateCanView).not.toHaveBeenCalled();
    });

    it('throws NotFoundException when attachment is not a file type', async () => {
      attachmentRepo.findById.mockResolvedValue({
        id: 'attachment-1',
        pageId: 'page-1',
        workspaceId: 'workspace-1',
        type: AttachmentType.Avatar,
      });

      await expect(
        controller.getAttachmentInfo(
          { attachmentId: 'attachment-1' },
          { id: 'workspace-1' } as any,
          { id: 'user-1' } as any,
        ),
      ).rejects.toThrow(NotFoundException);

      expect(pageRepo.findById).not.toHaveBeenCalled();
      expect(pageAccessService.validateCanView).not.toHaveBeenCalled();
    });

    it('throws NotFoundException when linked page does not exist', async () => {
      attachmentRepo.findById.mockResolvedValue({
        id: 'attachment-1',
        pageId: 'page-1',
        workspaceId: 'workspace-1',
        type: AttachmentType.File,
      });
      pageRepo.findById.mockResolvedValue(null);

      await expect(
        controller.getAttachmentInfo(
          { attachmentId: 'attachment-1' },
          { id: 'workspace-1' } as any,
          { id: 'user-1' } as any,
        ),
      ).rejects.toThrow(NotFoundException);

      expect(pageAccessService.validateCanView).not.toHaveBeenCalled();
    });
  });
});

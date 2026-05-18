import { BadRequestException, Injectable } from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Model, Types } from 'mongoose';
import { Subject } from 'rxjs';
import {
  ADMIN_NOTIFICATION_KIND_PACK_PURCHASE,
  AdminNotification,
  AdminNotificationDocument,
} from './admin-notification.schema';

export interface PackPurchaseNotificationPayload {
  purchaserEmail: string;
  purchaserName?: string;
  previousPlan: string;
  newPlan: string;
}

export interface AdminNotificationItemDto {
  id: string;
  kind: typeof ADMIN_NOTIFICATION_KIND_PACK_PURCHASE;
  purchaserEmail: string;
  purchaserName?: string;
  previousPlan: string;
  newPlan: string;
  read: boolean;
  createdAt: string;
}

type NotificationDocLike = {
  _id: Types.ObjectId | string;
  kind: typeof ADMIN_NOTIFICATION_KIND_PACK_PURCHASE;
  purchaserEmail: string;
  purchaserName?: string;
  previousPlan: string;
  newPlan: string;
  read: boolean;
  createdAt?: Date | string;
};

@Injectable()
export class NotificationsService {
  private readonly purchaseRealtimeSubject =
    new Subject<AdminNotificationItemDto>();

  /** Hot stream for SSE / future gateway (single-process only). */
  readonly purchaseRealtime$ = this.purchaseRealtimeSubject.asObservable();

  constructor(
    @InjectModel(AdminNotification.name)
    private readonly notificationModel: Model<AdminNotificationDocument>,
  ) {}

  private docToDto(doc: NotificationDocLike): AdminNotificationItemDto {
    const created =
      doc.createdAt instanceof Date
        ? doc.createdAt
        : doc.createdAt
          ? new Date(doc.createdAt)
          : new Date();
    return {
      id: String(doc._id),
      kind: ADMIN_NOTIFICATION_KIND_PACK_PURCHASE,
      purchaserEmail: doc.purchaserEmail,
      purchaserName: doc.purchaserName,
      previousPlan: doc.previousPlan,
      newPlan: doc.newPlan,
      read: doc.read,
      createdAt: created.toISOString(),
    };
  }

  async recordPackPurchase(
    payload: PackPurchaseNotificationPayload,
  ): Promise<void> {
    const doc = await this.notificationModel.create({
      kind: ADMIN_NOTIFICATION_KIND_PACK_PURCHASE,
      purchaserEmail: payload.purchaserEmail.trim().toLowerCase(),
      purchaserName: payload.purchaserName?.trim() || undefined,
      previousPlan: payload.previousPlan,
      newPlan: payload.newPlan,
      read: false,
    });
    this.purchaseRealtimeSubject.next(this.docToDto(doc));
  }

  async listRecent(limitRaw = 50): Promise<{
    items: AdminNotificationItemDto[];
    unreadCount: number;
  }> {
    const limit = Math.min(Math.max(Number(limitRaw) || 50, 1), 200);
    const [items, unreadCount] = await Promise.all([
      this.notificationModel
        .find()
        .sort({ createdAt: -1 })
        .limit(limit)
        .lean()
        .exec(),
      this.notificationModel.countDocuments({ read: false }).exec(),
    ]);

    return {
      unreadCount,
      items: items.map((doc) =>
        this.docToDto(doc as unknown as NotificationDocLike),
      ),
    };
  }

  async markRead(id: string): Promise<void> {
    if (!Types.ObjectId.isValid(id)) {
      throw new BadRequestException('Invalid notification id');
    }
    await this.notificationModel
      .updateOne({ _id: new Types.ObjectId(id) }, { $set: { read: true } })
      .exec();
  }

  async markAllRead(): Promise<void> {
    await this.notificationModel
      .updateMany({ read: false }, { $set: { read: true } })
      .exec();
  }
}

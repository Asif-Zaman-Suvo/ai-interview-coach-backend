import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { HydratedDocument } from 'mongoose';

export const ADMIN_NOTIFICATION_KIND_PACK_PURCHASE = 'pack_purchase' as const;

@Schema({ collection: 'admin_notifications', timestamps: true })
export class AdminNotification {
  @Prop({
    type: String,
    required: true,
    enum: [ADMIN_NOTIFICATION_KIND_PACK_PURCHASE],
  })
  kind!: typeof ADMIN_NOTIFICATION_KIND_PACK_PURCHASE;

  @Prop({ required: true })
  purchaserEmail!: string;

  @Prop()
  purchaserName?: string;

  @Prop({ required: true })
  previousPlan!: string;

  @Prop({ required: true })
  newPlan!: string;

  @Prop({ default: false })
  read!: boolean;

  createdAt?: Date;
  updatedAt?: Date;
}

export type AdminNotificationDocument = HydratedDocument<AdminNotification>;
export const AdminNotificationSchema =
  SchemaFactory.createForClass(AdminNotification);

AdminNotificationSchema.index({ createdAt: -1 });
AdminNotificationSchema.index({ read: 1, createdAt: -1 });

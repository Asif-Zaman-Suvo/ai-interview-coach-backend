import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { HydratedDocument } from 'mongoose';

export const ADMIN_NOTIFICATION_KIND_PACK_PURCHASE = 'pack_purchase' as const;
export const ADMIN_NOTIFICATION_KIND_USER_SIGNUP = 'user_signup' as const;

export type AdminNotificationKind =
  | typeof ADMIN_NOTIFICATION_KIND_PACK_PURCHASE
  | typeof ADMIN_NOTIFICATION_KIND_USER_SIGNUP;

export const ADMIN_NOTIFICATION_KINDS: AdminNotificationKind[] = [
  ADMIN_NOTIFICATION_KIND_PACK_PURCHASE,
  ADMIN_NOTIFICATION_KIND_USER_SIGNUP,
];

@Schema({ collection: 'admin_notifications', timestamps: true })
export class AdminNotification {
  @Prop({
    type: String,
    required: true,
    enum: ADMIN_NOTIFICATION_KINDS,
  })
  kind!: AdminNotificationKind;

  @Prop({ required: true })
  purchaserEmail!: string;

  @Prop()
  purchaserName?: string;

  /** Pack purchase: prior plan. Signup: omitted / empty. */
  @Prop({ required: false, default: '' })
  previousPlan!: string;

  /** Pack purchase: new plan. Signup: `free`. */
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
